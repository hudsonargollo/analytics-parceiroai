import type { 
  RecoveryRateResponse, 
  DSOResponse, 
  CohortAnalysisResponse, 
  CustomerBillingResponse 
} from '@/types/api';

// API client configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const API_KEY = import.meta.env.VITE_API_KEY || '';

// API client helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.error || 'An error occurred');
  }

  return response.json();
}

// API endpoints
export const api = {
  // Health check
  health: () => apiRequest<{ status: string; service: string }>('/'),

  // Recovery metrics
  getRecoveryRate: (params: {
    branch?: string;
    date_range?: string;
    plan?: string;
  }): Promise<RecoveryRateResponse> => {
    const searchParams = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    return apiRequest<RecoveryRateResponse>(`/api/metrics/recovery-rate?${searchParams}`);
  },

  // DSO metrics
  getDSO: (params: { date_range?: string }): Promise<DSOResponse> => {
    const searchParams = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    return apiRequest<DSOResponse>(`/api/metrics/dso?${searchParams}`);
  },

  // Cohort analysis
  getCohorts: (params: { start_month?: string; end_month?: string }): Promise<CohortAnalysisResponse> => {
    const searchParams = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    return apiRequest<CohortAnalysisResponse>(`/api/metrics/cohorts?${searchParams}`);
  },

  // Chatwoot integration
  getCustomerBilling: (customerId: string): Promise<CustomerBillingResponse> =>
    apiRequest<CustomerBillingResponse>(`/api/chatwoot/customer/${customerId}/billing`),

  resendBoleto: (customerId: string, invoiceId: string): Promise<{ status: string }> =>
    apiRequest<{ status: string }>(`/api/chatwoot/customer/${customerId}/resend-boleto`, {
      method: 'POST',
      body: JSON.stringify({ invoice_id: invoiceId }),
    }),
};
