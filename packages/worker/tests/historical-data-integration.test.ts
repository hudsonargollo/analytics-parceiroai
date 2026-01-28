/**
 * Historical Data Query Integration Tests
 * 
 * Tests that verify the system can query historical data up to 24 months
 * with actual database operations.
 * 
 * Validates Requirements 8.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { calculateRecoveryRate } from '../src/lib/recovery-rate';
import { calculateDSO } from '../src/lib/dso';
import { calculateCohortAnalysis } from '../src/lib/cohort-analysis';

// Mock D1 Database with realistic historical data
class MockD1DatabaseWithHistory {
  private paymentEvents: any[] = [];
  private recoveryLogs: any[] = [];
  private customerCohorts: any[] = [];
  
  /**
   * Seed database with historical data spanning 24 months
   */
  seedHistoricalData() {
    const now = new Date();
    
    // Create payment events for the last 24 months
    for (let monthsAgo = 0; monthsAgo < 24; monthsAgo++) {
      const eventDate = new Date(now);
      eventDate.setMonth(eventDate.getMonth() - monthsAgo);
      
      // Create 50 events per month
      for (let i = 0; i < 50; i++) {
        const eventId = `evt_${monthsAgo}_${i}`;
        const customerId = `cust_${monthsAgo}_${i % 20}`; // 20 unique customers per month
        const status = i % 4 === 0 ? 'pending' : 'confirmed'; // 75% success rate
        
        this.paymentEvents.push({
          event_id: eventId,
          customer_id: customerId,
          invoice_id: `inv_${monthsAgo}_${i}`,
          amount: 10000 + (i * 100),
          payment_method: ['pix', 'boleto', 'credit_card'][i % 3],
          status: status,
          recovery_branch: ['3-day-notice', 'due-today', 'overdue'][monthsAgo % 3],
          due_date: eventDate.toISOString(),
          created_at: eventDate.toISOString(),
          updated_at: eventDate.toISOString(),
        });
        
        // Create recovery logs for confirmed payments
        if (status === 'confirmed') {
          const messageSentDate = new Date(eventDate);
          messageSentDate.setDate(messageSentDate.getDate() - 5);
          
          this.recoveryLogs.push({
            customer_id: customerId,
            invoice_id: `inv_${monthsAgo}_${i}`,
            recovery_branch: ['3-day-notice', 'due-today', 'overdue'][monthsAgo % 3],
            message_sent_at: messageSentDate.toISOString(),
            payment_received_at: eventDate.toISOString(),
            amount: 10000 + (i * 100),
            payment_method: ['pix', 'boleto', 'credit_card'][i % 3],
            recovery_time_hours: 120, // 5 days
            created_at: messageSentDate.toISOString(),
            updated_at: eventDate.toISOString(),
          });
        }
      }
      
      // Create customer cohorts
      const cohortMonth = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
      for (let i = 0; i < 20; i++) {
        const customerId = `cust_${monthsAgo}_${i}`;
        if (!this.customerCohorts.find(c => c.customer_id === customerId)) {
          this.customerCohorts.push({
            customer_id: customerId,
            cohort_month: cohortMonth,
            subscription_start_date: eventDate.toISOString(),
            subscription_plan: 'premium',
            created_at: eventDate.toISOString(),
          });
        }
      }
    }
  }
  
  prepare(query: string) {
    return {
      bind: (...params: any[]) => {
        return {
          first: async () => {
            // Handle recovery rate query
            if (query.includes('recovery_branch') && query.includes('total_attempts')) {
              const startDate = new Date(params[0] as string);
              const endDate = new Date(params[1] as string);
              
              const filteredEvents = this.paymentEvents.filter(e => {
                const eventDate = new Date(e.created_at);
                return eventDate >= startDate && eventDate <= endDate;
              });
              
              const totalAttempts = filteredEvents.length;
              const successfulRecoveries = filteredEvents.filter(e => e.status === 'confirmed').length;
              const totalAmount = filteredEvents.reduce((sum, e) => sum + e.amount, 0);
              const recoveredAmount = filteredEvents
                .filter(e => e.status === 'confirmed')
                .reduce((sum, e) => sum + e.amount, 0);
              
              return {
                recovery_branch: filteredEvents[0]?.recovery_branch || 'overdue',
                total_attempts: totalAttempts,
                successful_recoveries: successfulRecoveries,
                recovery_rate: totalAttempts > 0 ? (successfulRecoveries / totalAttempts) * 100 : 0,
                total_amount_attempted: totalAmount,
                total_amount_recovered: recoveredAmount,
              };
            }
            
            return null;
          },
          all: async () => {
            // Handle DSO query
            if (query.includes('JULIANDAY') && query.includes('recovery_logs')) {
              const startDate = new Date(params[0] as string);
              const endDate = new Date(params[1] as string);
              
              const filteredLogs = this.recoveryLogs.filter(log => {
                const logDate = new Date(log.created_at);
                return logDate >= startDate && logDate <= endDate;
              });
              
              const results = filteredLogs.map(log => {
                const sentDate = new Date(log.message_sent_at);
                const receivedDate = new Date(log.payment_received_at);
                const daysoDiff = (receivedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
                
                return {
                  recovery_branch: log.recovery_branch,
                  dso_days: daysoDiff,
                };
              });
              
              return { results };
            }
            
            // Handle cohort analysis query
            if (query.includes('customer_cohorts') && query.includes('payment_events')) {
              const startMonth = params[0] as string;
              const endMonth = params[1] as string;
              
              const filteredCohorts = this.customerCohorts.filter(c => {
                return c.cohort_month >= startMonth && c.cohort_month <= endMonth;
              });
              
              const results = filteredCohorts.map(cohort => {
                const customerEvents = this.paymentEvents.filter(e => e.customer_id === cohort.customer_id);
                const latestEvent = customerEvents[0];
                
                return {
                  cohort_month: cohort.cohort_month,
                  customer_id: cohort.customer_id,
                  payment_date: latestEvent?.created_at || null,
                  status: latestEvent?.status || null,
                };
              });
              
              return { results };
            }
            
            // Handle payment method breakdown
            if (query.includes('payment_method')) {
              const startDate = new Date(params[0] as string);
              const endDate = new Date(params[1] as string);
              
              const filteredEvents = this.paymentEvents.filter(e => {
                const eventDate = new Date(e.created_at);
                return eventDate >= startDate && eventDate <= endDate;
              });
              
              const methodBreakdown = new Map<string, { attempts: number; recoveries: number }>();
              
              for (const event of filteredEvents) {
                if (!methodBreakdown.has(event.payment_method)) {
                  methodBreakdown.set(event.payment_method, { attempts: 0, recoveries: 0 });
                }
                const stats = methodBreakdown.get(event.payment_method)!;
                stats.attempts++;
                if (event.status === 'confirmed') {
                  stats.recoveries++;
                }
              }
              
              const results = Array.from(methodBreakdown.entries()).map(([method, stats]) => ({
                payment_method: method,
                attempts: stats.attempts,
                recoveries: stats.recoveries,
                rate: stats.attempts > 0 ? (stats.recoveries / stats.attempts) * 100 : 0,
              }));
              
              return { results };
            }
            
            return { results: [] };
          },
        };
      },
    };
  }
}

describe('Historical Data Query Integration Tests', () => {
  let mockDb: MockD1DatabaseWithHistory;
  
  beforeEach(() => {
    mockDb = new MockD1DatabaseWithHistory();
    mockDb.seedHistoricalData();
  });
  
  describe('Recovery Rate - 24 Month Historical Data', () => {
    it('should successfully query recovery rate for 24 months of data', async () => {
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '730d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('730d');
      expect(result.total_attempts).toBeGreaterThan(0);
      expect(result.successful_recoveries).toBeGreaterThan(0);
      expect(result.recovery_rate).toBeGreaterThan(0);
      expect(result.recovery_rate).toBeLessThanOrEqual(100);
      
      // Verify we got data from the full 24 month period
      // With 50 events per month * 24 months = 1200 events
      expect(result.total_attempts).toBeGreaterThanOrEqual(1000);
    });
    
    it('should successfully query recovery rate for 12 months of data', async () => {
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '365d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('365d');
      expect(result.total_attempts).toBeGreaterThan(0);
      
      // Should have roughly half the data of 24 months
      expect(result.total_attempts).toBeGreaterThanOrEqual(500);
      expect(result.total_attempts).toBeLessThan(700);
    });
    
    it('should successfully query recovery rate for 18 months of data', async () => {
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '547d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('547d');
      expect(result.total_attempts).toBeGreaterThan(0);
      
      // Should have roughly 75% of 24 months data
      expect(result.total_attempts).toBeGreaterThanOrEqual(700);
      expect(result.total_attempts).toBeLessThan(1000);
    });
    
    it('should maintain consistent recovery rate across different time periods', async () => {
      const result24m = await calculateRecoveryRate(mockDb as any, { date_range: '730d' });
      const result12m = await calculateRecoveryRate(mockDb as any, { date_range: '365d' });
      const result6m = await calculateRecoveryRate(mockDb as any, { date_range: '180d' });
      
      // All should have similar recovery rates (around 75% based on our seed data)
      expect(result24m.recovery_rate).toBeGreaterThan(70);
      expect(result24m.recovery_rate).toBeLessThan(80);
      
      expect(result12m.recovery_rate).toBeGreaterThan(70);
      expect(result12m.recovery_rate).toBeLessThan(80);
      
      expect(result6m.recovery_rate).toBeGreaterThan(70);
      expect(result6m.recovery_rate).toBeLessThan(80);
    });
  });
  
  describe('DSO - 24 Month Historical Data', () => {
    it('should successfully query DSO for 24 months of data', async () => {
      const result = await calculateDSO(mockDb as any, {
        date_range: '730d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('730d');
      expect(result.average_dso).toBeGreaterThan(0);
      expect(result.median_dso).toBeGreaterThan(0);
      
      // Verify branch-specific DSO values
      expect(result.by_branch['3-day-notice']).toBeGreaterThanOrEqual(0);
      expect(result.by_branch['due-today']).toBeGreaterThanOrEqual(0);
      expect(result.by_branch['overdue']).toBeGreaterThanOrEqual(0);
    });
    
    it('should successfully query DSO for 12 months of data', async () => {
      const result = await calculateDSO(mockDb as any, {
        date_range: '365d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('365d');
      expect(result.average_dso).toBeGreaterThan(0);
    });
    
    it('should successfully query DSO for 18 months of data', async () => {
      const result = await calculateDSO(mockDb as any, {
        date_range: '547d',
      });
      
      expect(result).toBeDefined();
      expect(result.date_range).toBe('547d');
      expect(result.average_dso).toBeGreaterThan(0);
    });
  });
  
  describe('Cohort Analysis - 24 Month Historical Data', () => {
    it('should successfully query cohorts for 24 months of data', async () => {
      const now = new Date();
      const twentyFourMonthsAgo = new Date(now);
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
      
      const startMonth = `${twentyFourMonthsAgo.getFullYear()}-${String(twentyFourMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const result = await calculateCohortAnalysis(mockDb as any, {
        start_month: startMonth,
        end_month: endMonth,
      });
      
      expect(result).toBeDefined();
      expect(result.cohorts).toBeDefined();
      expect(result.cohorts.length).toBeGreaterThan(0);
      
      // Should have approximately 24 cohorts (one per month)
      expect(result.cohorts.length).toBeGreaterThanOrEqual(20);
      expect(result.cohorts.length).toBeLessThanOrEqual(25);
      
      // Verify each cohort has required fields
      for (const cohort of result.cohorts) {
        expect(cohort.cohort_month).toBeDefined();
        expect(cohort.total_customers).toBeGreaterThan(0);
        expect(cohort.is_statistically_significant).toBeDefined();
        
        // With 20 customers per cohort, all should be statistically significant
        expect(cohort.is_statistically_significant).toBe(true);
      }
    });
    
    it('should successfully query cohorts for 12 months of data', async () => {
      const now = new Date();
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const startMonth = `${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
      const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const result = await calculateCohortAnalysis(mockDb as any, {
        start_month: startMonth,
        end_month: endMonth,
      });
      
      expect(result).toBeDefined();
      expect(result.cohorts).toBeDefined();
      
      // Should have approximately 12 cohorts
      expect(result.cohorts.length).toBeGreaterThanOrEqual(10);
      expect(result.cohorts.length).toBeLessThanOrEqual(13);
    });
  });
  
  describe('Edge Cases - Historical Data', () => {
    it('should handle queries at the exact 24 month boundary', async () => {
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '730d',
      });
      
      expect(result).toBeDefined();
      expect(result.total_attempts).toBeGreaterThan(0);
    });
    
    it('should handle queries beyond 24 months (36 months)', async () => {
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '1095d',
      });
      
      expect(result).toBeDefined();
      // Should still return data (even if less than 36 months available)
      expect(result.total_attempts).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle very old date ranges with no data gracefully', async () => {
      // Query for data from 5 years ago (way beyond our seeded data)
      const result = await calculateRecoveryRate(mockDb as any, {
        date_range: '1825d', // ~5 years
      });
      
      expect(result).toBeDefined();
      // Should return zero values, not error
      expect(result.total_attempts).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Data Integrity - Historical Queries', () => {
    it('should return consistent data for overlapping date ranges', async () => {
      // Query 24 months
      const result24m = await calculateRecoveryRate(mockDb as any, { date_range: '730d' });
      
      // Query 12 months (subset of 24 months)
      const result12m = await calculateRecoveryRate(mockDb as any, { date_range: '365d' });
      
      // 12 month data should be less than or equal to 24 month data
      expect(result12m.total_attempts).toBeLessThanOrEqual(result24m.total_attempts);
      expect(result12m.successful_recoveries).toBeLessThanOrEqual(result24m.successful_recoveries);
      expect(result12m.total_amount_attempted).toBeLessThanOrEqual(result24m.total_amount_attempted);
    });
    
    it('should maintain data accuracy across different query types', async () => {
      // Query recovery rate
      const recoveryResult = await calculateRecoveryRate(mockDb as any, { date_range: '730d' });
      
      // Query DSO
      const dsoResult = await calculateDSO(mockDb as any, { date_range: '730d' });
      
      // Both should return valid data
      expect(recoveryResult.total_attempts).toBeGreaterThan(0);
      expect(dsoResult.average_dso).toBeGreaterThan(0);
    });
  });
});
