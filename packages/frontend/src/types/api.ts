// API response types matching the backend
export interface RecoveryRateResponse {
  branch: string;
  date_range: string;
  total_attempts: number;
  successful_recoveries: number;
  recovery_rate: number;        // Percentage (0-100)
  total_amount_attempted: number;
  total_amount_recovered: number;
  breakdown_by_method: {
    pix: { attempts: number; recoveries: number; rate: number };
    boleto: { attempts: number; recoveries: number; rate: number };
    credit_card: { attempts: number; recoveries: number; rate: number };
  };
}

export interface DSOResponse {
  date_range: string;
  average_dso: number;          // Days
  median_dso: number;           // Days
  by_branch: {
    '3-day-notice': number;
    'due-today': number;
    'overdue': number;
  };
}

export interface CohortAnalysisResponse {
  cohorts: Array<{
    cohort_month: string;       // YYYY-MM format
    total_customers: number;
    billing_cycles: Array<{
      cycle_number: number;
      attempted: number;
      recovered: number;
      recovery_rate: number;
    }>;
    is_statistically_significant: boolean;
  }>;
}

export interface CustomerBillingResponse {
  customer_id: string;
  outstanding_invoices: Array<{
    invoice_id: string;
    amount: number;
    due_date: string;
    status: 'pending' | 'overdue' | 'paid';
    payment_method: string;
    pix_code?: string;          // Present if Pix payment available
    boleto_url?: string;        // Present if Boleto available
    days_overdue?: number;      // Present if overdue
  }>;
  total_outstanding: number;
  last_payment_date?: string;
  payment_history_summary: {
    total_paid: number;
    on_time_payments: number;
    late_payments: number;
  };
}

// Query parameter types
export interface RecoveryMetricsParams {
  branch?: string;
  date_range?: string;
  plan?: string;
}

export interface DSOMetricsParams {
  date_range?: string;
}

export interface CohortAnalysisParams {
  start_month?: string;
  end_month?: string;
}
