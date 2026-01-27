import { CustomerBillingResponse } from '../types';

/**
 * Get customer billing history including outstanding invoices and payment summary
 * 
 * Queries D1 for:
 * - Outstanding invoices with amounts, due dates, status, payment methods
 * - Pix codes for Pix payment method
 * - Boleto URLs for Boleto payment method
 * - Days overdue for overdue invoices
 * - Payment history summary
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export async function getCustomerBillingHistory(
  db: D1Database,
  customerId: string
): Promise<CustomerBillingResponse> {
  // Query outstanding invoices for the customer
  const outstandingQuery = `
    SELECT 
      invoice_id,
      amount,
      due_date,
      status,
      payment_method,
      created_at
    FROM payment_events
    WHERE customer_id = ?
      AND status IN ('pending', 'failed')
    ORDER BY due_date ASC
  `;
  
  const outstandingResult = await db.prepare(outstandingQuery)
    .bind(customerId)
    .all();
  
  // Query payment history summary
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_paid,
      SUM(CASE 
        WHEN JULIANDAY(updated_at) <= JULIANDAY(due_date) THEN 1 
        ELSE 0 
      END) as on_time_payments,
      SUM(CASE 
        WHEN JULIANDAY(updated_at) > JULIANDAY(due_date) THEN 1 
        ELSE 0 
      END) as late_payments,
      MAX(updated_at) as last_payment_date
    FROM payment_events
    WHERE customer_id = ?
      AND status = 'confirmed'
  `;
  
  const summaryResult = await db.prepare(summaryQuery)
    .bind(customerId)
    .first();
  
  // Process outstanding invoices
  const now = new Date();
  const outstanding_invoices = (outstandingResult.results || []).map((row: any) => {
    const dueDate = new Date(row.due_date);
    const isOverdue = now > dueDate;
    
    // Calculate days overdue if applicable
    let days_overdue: number | undefined;
    if (isOverdue) {
      const diffTime = now.getTime() - dueDate.getTime();
      days_overdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
    
    // Determine status based on due date
    let invoiceStatus: 'pending' | 'overdue' | 'paid';
    if (row.status === 'confirmed') {
      invoiceStatus = 'paid';
    } else if (isOverdue) {
      invoiceStatus = 'overdue';
    } else {
      invoiceStatus = 'pending';
    }
    
    // Build invoice object with conditional fields
    const invoice: any = {
      invoice_id: row.invoice_id,
      amount: row.amount,
      due_date: row.due_date,
      status: invoiceStatus,
      payment_method: row.payment_method,
    };
    
    // Include pix_code if payment method is Pix
    // Note: In a real system, this would be fetched from Asaas API or stored in DB
    // For now, we'll generate a placeholder
    if (row.payment_method === 'pix') {
      invoice.pix_code = `PIX_${row.invoice_id}_${customerId}`;
    }
    
    // Include boleto_url if payment method is Boleto
    // Note: In a real system, this would be fetched from Asaas API or stored in DB
    // For now, we'll generate a placeholder URL
    if (row.payment_method === 'boleto') {
      invoice.boleto_url = `https://asaas.com/boleto/${row.invoice_id}`;
    }
    
    // Include days_overdue if overdue
    if (days_overdue !== undefined) {
      invoice.days_overdue = days_overdue;
    }
    
    return invoice;
  });
  
  // Calculate total outstanding amount
  const total_outstanding = outstanding_invoices.reduce(
    (sum, invoice) => sum + invoice.amount,
    0
  );
  
  // Build payment history summary
  const payment_history_summary = {
    total_paid: summaryResult?.total_paid || 0,
    on_time_payments: summaryResult?.on_time_payments || 0,
    late_payments: summaryResult?.late_payments || 0,
  };
  
  // Build response
  const response: CustomerBillingResponse = {
    customer_id: customerId,
    outstanding_invoices,
    total_outstanding,
    payment_history_summary,
  };
  
  // Include last payment date if available
  if (summaryResult?.last_payment_date) {
    response.last_payment_date = summaryResult.last_payment_date;
  }
  
  return response;
}
