/**
 * Manual Test for Payment Event Insertion
 * 
 * This file can be used to manually test the payment event insertion logic
 * without relying on the Cloudflare Workers test environment.
 * 
 * Run with: npx tsx tests/manual-test-payment-event.ts
 */

import { insertPaymentEvent } from '../src/lib/payment-event';
import { PaymentWebhookPayload } from '../src/types';

// Mock D1 Database for manual testing
class MockD1Database {
  private data: Map<string, any> = new Map();
  private lastRowId = 0;

  prepare(query: string) {
    const boundParams: any[] = [];
    
    return {
      bind: (...params: any[]) => {
        boundParams.push(...params);
        return {
          run: async () => {
            console.log('SQL Query:', query);
            console.log('Parameters:', boundParams);
            
            // Check for duplicate event_id
            if (query.includes('INSERT INTO payment_events')) {
              const eventId = boundParams[0];
              if (this.data.has(eventId)) {
                throw new Error('UNIQUE constraint failed: payment_events.event_id');
              }
              
              // Store the event
              this.lastRowId++;
              const event = {
                id: this.lastRowId,
                event_id: boundParams[0],
                customer_id: boundParams[1],
                invoice_id: boundParams[2],
                amount: boundParams[3],
                payment_method: boundParams[4],
                status: boundParams[5],
                recovery_branch: boundParams[6],
                due_date: boundParams[7],
                created_at: boundParams[8],
                updated_at: boundParams[9],
              };
              
              this.data.set(eventId, event);
              console.log('✓ Event stored:', event);
              
              return {
                success: true,
                meta: {
                  last_row_id: this.lastRowId,
                },
              };
            }
            
            return { success: true, meta: {} };
          },
        };
      },
    };
  }

  getData(eventId: string) {
    return this.data.get(eventId);
  }

  getAllData() {
    return Array.from(this.data.values());
  }
}

async function runTests() {
  console.log('=== Manual Payment Event Tests ===\n');
  
  const db = new MockD1Database();
  
  // Test 1: Basic insertion
  console.log('Test 1: Basic insertion with all fields');
  try {
    const payload1: PaymentWebhookPayload = {
      event_id: 'evt_123',
      customer_id: 'cust_456',
      invoice_id: 'inv_789',
      amount: 5000,
      payment_method: 'pix',
      status: 'pending',
      due_date: '2024-01-20',
      timestamp: '2024-01-17T10:00:00Z',
    };
    
    const result1 = await insertPaymentEvent(db as any, payload1);
    console.log('✓ Test 1 passed - Event inserted:', result1.event_id);
    console.log('  Recovery branch:', result1.recovery_branch);
  } catch (error) {
    console.error('✗ Test 1 failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 2: Auto-generate event_id
  console.log('Test 2: Auto-generate event_id when not provided');
  try {
    const payload2: PaymentWebhookPayload = {
      event_id: '',
      customer_id: 'cust_789',
      invoice_id: 'inv_101',
      amount: 3000,
      payment_method: 'boleto',
      status: 'confirmed',
      due_date: '2024-01-20',
      timestamp: '2024-01-17T10:00:00Z',
    };
    
    const result2 = await insertPaymentEvent(db as any, payload2);
    console.log('✓ Test 2 passed - Generated event_id:', result2.event_id);
  } catch (error) {
    console.error('✗ Test 2 failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 3: Duplicate event_id rejection
  console.log('Test 3: Reject duplicate event_id');
  try {
    const payload3: PaymentWebhookPayload = {
      event_id: 'evt_123', // Same as Test 1
      customer_id: 'cust_999',
      invoice_id: 'inv_999',
      amount: 1000,
      payment_method: 'credit_card',
      status: 'pending',
      due_date: '2024-01-20',
      timestamp: '2024-01-17T10:00:00Z',
    };
    
    await insertPaymentEvent(db as any, payload3);
    console.error('✗ Test 3 failed - Should have rejected duplicate');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Duplicate event_id')) {
      console.log('✓ Test 3 passed - Duplicate correctly rejected');
    } else {
      console.error('✗ Test 3 failed with unexpected error:', error);
    }
  }
  
  console.log('\n---\n');
  
  // Test 4: Recovery branch classification - due today
  console.log('Test 4: Recovery branch classification - due today');
  try {
    const payload4: PaymentWebhookPayload = {
      event_id: 'evt_today',
      customer_id: 'cust_111',
      invoice_id: 'inv_111',
      amount: 2000,
      payment_method: 'pix',
      status: 'pending',
      due_date: '2024-01-17',
      timestamp: '2024-01-17T10:00:00Z',
    };
    
    const result4 = await insertPaymentEvent(db as any, payload4);
    if (result4.recovery_branch === 'due-today') {
      console.log('✓ Test 4 passed - Correctly classified as due-today');
    } else {
      console.error('✗ Test 4 failed - Expected due-today, got:', result4.recovery_branch);
    }
  } catch (error) {
    console.error('✗ Test 4 failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 5: Recovery branch classification - overdue
  console.log('Test 5: Recovery branch classification - overdue');
  try {
    const payload5: PaymentWebhookPayload = {
      event_id: 'evt_overdue',
      customer_id: 'cust_222',
      invoice_id: 'inv_222',
      amount: 4000,
      payment_method: 'boleto',
      status: 'pending',
      due_date: '2024-01-10',
      timestamp: '2024-01-17T10:00:00Z',
    };
    
    const result5 = await insertPaymentEvent(db as any, payload5);
    if (result5.recovery_branch === 'overdue') {
      console.log('✓ Test 5 passed - Correctly classified as overdue');
    } else {
      console.error('✗ Test 5 failed - Expected overdue, got:', result5.recovery_branch);
    }
  } catch (error) {
    console.error('✗ Test 5 failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 6: Explicit branch override
  console.log('Test 6: Explicit branch parameter override');
  try {
    const payload6: PaymentWebhookPayload = {
      event_id: 'evt_explicit',
      customer_id: 'cust_333',
      invoice_id: 'inv_333',
      amount: 6000,
      payment_method: 'pix',
      status: 'confirmed',
      due_date: '2024-01-20', // Would be 3-day-notice
      timestamp: '2024-01-17T10:00:00Z',
      branch: 'overdue', // Explicit override
    };
    
    const result6 = await insertPaymentEvent(db as any, payload6);
    if (result6.recovery_branch === 'overdue') {
      console.log('✓ Test 6 passed - Explicit branch override worked');
    } else {
      console.error('✗ Test 6 failed - Expected overdue, got:', result6.recovery_branch);
    }
  } catch (error) {
    console.error('✗ Test 6 failed:', error);
  }
  
  console.log('\n---\n');
  
  // Summary
  console.log('=== Test Summary ===');
  console.log('Total events stored:', db.getAllData().length);
  console.log('\nAll stored events:');
  db.getAllData().forEach((event, index) => {
    console.log(`${index + 1}. ${event.event_id} - ${event.recovery_branch} - ${event.status}`);
  });
}

// Run the tests
runTests().catch(console.error);
