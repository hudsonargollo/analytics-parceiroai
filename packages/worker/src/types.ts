// Webhook payload types
export interface PaymentWebhookPayload {
  event_id: string;           // Unique identifier from Asaas
  customer_id: string;         // Customer identifier
  invoice_id: string;          // Invoice reference
  amount: number;              // Payment amount in BRL cents
  payment_method: 'pix' | 'boleto' | 'credit_card';
  status: 'pending' | 'confirmed' | 'failed';
  due_date: string;            // ISO 8601 date
  timestamp: string;           // ISO 8601 timestamp
  branch?: string;             // Optional explicit branch classification
}

export interface EngagementWebhookPayload {
  message_id: string;          // WhatsApp message identifier
  customer_id: string;         // Customer identifier
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;           // ISO 8601 timestamp
}

// API response types
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

// Database model types
export interface PaymentEvent {
  id: number;
  event_id: string;
  customer_id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  status: string;
  recovery_branch: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface EngagementEvent {
  id: number;
  message_id: string;
  customer_id: string;
  invoice_id: string | null;
  status: string;
  recovery_branch: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryLog {
  id: number;
  customer_id: string;
  invoice_id: string;
  payment_event_id: number | null;
  engagement_event_id: number | null;
  recovery_branch: string;
  message_sent_at: string | null;
  message_delivered_at: string | null;
  message_read_at: string | null;
  payment_received_at: string | null;
  amount: number | null;
  payment_method: string | null;
  recovery_time_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCohort {
  id: number;
  customer_id: string;
  cohort_month: string;
  subscription_start_date: string;
  subscription_plan: string | null;
  created_at: string;
}

// Utility types
export type RecoveryBranch = '3-day-notice' | 'due-today' | 'overdue';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: {
    request_id: string;
    customer_id?: string;
    endpoint?: string;
    duration_ms?: number;
    error?: string;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginationMetadata {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T;
  pagination: PaginationMetadata;
}

// Cache types
export interface CacheKeyParams {
  branch?: string;
  date_range?: string;
  plan?: string;
  start_month?: string;
  end_month?: string;
  page?: string;
  page_size?: string;
  [key: string]: string | undefined;
}

export type CacheableMetrics = 
  | RecoveryRateResponse 
  | DSOResponse 
  | CohortAnalysisResponse
  | PaginatedResponse<RecoveryRateResponse>
  | PaginatedResponse<DSOResponse>
  | PaginatedResponse<CohortAnalysisResponse>;
