import { useState } from 'react';
import { useCustomerBilling } from '@/hooks/useCustomerBilling';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Calendar, DollarSign, Clock, Copy, Send, Check } from 'lucide-react';

interface BillingSidebarProps {
  /**
   * Customer ID to fetch billing information for
   */
  customerId: string;
  /**
   * Optional API base URL (defaults to environment variable)
   */
  apiBaseUrl?: string;
}

/**
 * BillingSidebar Component
 * 
 * Displays customer billing information in a Chatwoot sidebar iframe.
 * Shows outstanding invoices with amounts, due dates, payment status, and days overdue.
 * 
 * Features:
 * - Outstanding invoices list
 * - Payment status badges
 * - Days overdue calculation
 * - Total outstanding amount
 * - Payment history summary
 * - Copy Pix Code button (conditional)
 * - Resend Boleto button (conditional)
 * - Loading skeleton during data fetch
 * - Error handling with toast notifications
 * - Compact layout for sidebar context
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 * 
 * @example
 * ```tsx
 * <BillingSidebar customerId="cust_123" />
 * ```
 */
export function BillingSidebar({ customerId, apiBaseUrl }: BillingSidebarProps) {
  const { toast } = useToast();
  const [copiedPixCode, setCopiedPixCode] = useState<string | null>(null);
  const [resendingBoleto, setResendingBoleto] = useState<string | null>(null);

  // Fetch customer billing data
  const { data, isLoading, error, isError } = useCustomerBilling(customerId);

  // Show error toast when query fails
  if (isError && error) {
    toast({
      variant: 'destructive',
      title: 'Failed to load billing data',
      description: error.message || 'An error occurred while fetching customer billing information.',
    });
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount / 100);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Handle copy Pix code to clipboard
  const handleCopyPixCode = async (pixCode: string, invoiceId: string) => {
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopiedPixCode(invoiceId);
      toast({
        title: 'Pix code copied!',
        description: 'The Pix code has been copied to your clipboard.',
      });
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedPixCode(null), 2000);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to copy',
        description: 'Could not copy Pix code to clipboard.',
      });
    }
  };

  // Handle resend Boleto
  const handleResendBoleto = async (invoiceId: string) => {
    setResendingBoleto(invoiceId);
    try {
      const baseUrl = apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(
        `${baseUrl}/api/chatwoot/customer/${customerId}/resend-boleto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resend Boleto');
      }

      toast({
        title: 'Boleto sent!',
        description: 'The Boleto has been resent to the customer via WhatsApp.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to resend Boleto',
        description: error instanceof Error ? error.message : 'An error occurred.',
      });
    } finally {
      setResendingBoleto(null);
    }
  };

  return (
    <div className="w-full max-w-md">
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Customer Billing</CardTitle>
          <CardDescription className="text-xs">
            Outstanding invoices and payment history
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {/* Error State */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
              <h3 className="mb-1 text-sm font-semibold">Failed to load data</h3>
              <p className="text-xs text-muted-foreground">
                {error?.message || 'An error occurred while fetching billing information.'}
              </p>
            </div>
          )}

          {/* Billing Data */}
          {!isLoading && !isError && data && (
            <>
              {/* Total Outstanding */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Total Outstanding
                    </span>
                  </div>
                  <span className="text-lg font-bold">
                    {formatCurrency(data.total_outstanding)}
                  </span>
                </div>
              </div>

              {/* Outstanding Invoices */}
              {data.outstanding_invoices.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Outstanding Invoices</h4>
                  {data.outstanding_invoices.map((invoice) => (
                    <Card key={invoice.invoice_id} className="border">
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          {/* Invoice Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                Invoice #{invoice.invoice_id.slice(-8)}
                              </p>
                              <p className="mt-1 text-lg font-bold">
                                {formatCurrency(invoice.amount)}
                              </p>
                            </div>
                            <Badge variant={getStatusVariant(invoice.status)} className="text-xs">
                              {invoice.status}
                            </Badge>
                          </div>

                          {/* Invoice Details */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Due: {formatDate(invoice.due_date)}</span>
                            </div>
                            
                            {invoice.days_overdue !== undefined && invoice.days_overdue > 0 && (
                              <div className="flex items-center gap-2 text-destructive">
                                <Clock className="h-3 w-3" />
                                <span className="font-medium">
                                  {invoice.days_overdue} {invoice.days_overdue === 1 ? 'day' : 'days'} overdue
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="capitalize">{invoice.payment_method.replace('_', ' ')}</span>
                            </div>
                          </div>

                          {/* Payment Action Buttons */}
                          <div className="mt-3 flex gap-2">
                            {/* Copy Pix Code Button - Only show if pix_code is present */}
                            {invoice.pix_code && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => handleCopyPixCode(invoice.pix_code!, invoice.invoice_id)}
                                disabled={copiedPixCode === invoice.invoice_id}
                              >
                                {copiedPixCode === invoice.invoice_id ? (
                                  <>
                                    <Check className="mr-1 h-3 w-3" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copy Pix Code
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Resend Boleto Button - Only show if boleto_url is present */}
                            {invoice.boleto_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => handleResendBoleto(invoice.invoice_id)}
                                disabled={resendingBoleto === invoice.invoice_id}
                              >
                                <Send className="mr-1 h-3 w-3" />
                                {resendingBoleto === invoice.invoice_id ? 'Sending...' : 'Resend Boleto'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No outstanding invoices
                  </p>
                </div>
              )}

              {/* Payment History Summary */}
              {data.payment_history_summary && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <h4 className="text-xs font-semibold">Payment History</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Total Paid</p>
                      <p className="font-semibold">
                        {data.payment_history_summary.total_paid}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">On Time</p>
                      <p className="font-semibold text-green-600">
                        {data.payment_history_summary.on_time_payments}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Late</p>
                      <p className="font-semibold text-amber-600">
                        {data.payment_history_summary.late_payments}
                      </p>
                    </div>
                    {data.last_payment_date && (
                      <div>
                        <p className="text-muted-foreground">Last Payment</p>
                        <p className="font-semibold">
                          {formatDate(data.last_payment_date)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
