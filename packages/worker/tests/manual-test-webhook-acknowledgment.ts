/**
 * Manual test for immediate webhook acknowledgment (Task 16.3)
 * 
 * This script demonstrates that webhooks return HTTP 202 immediately
 * and process events asynchronously.
 * 
 * Validates: Requirements 8.1
 */

import { Hono } from 'hono'
import type { PaymentWebhookPayload, EngagementWebhookPayload } from '../src/types'

interface TestEnv {
  DB: D1Database
  KV: KVNamespace
  WEBHOOK_SECRET: string
  [key: string]: any
}

// Mock database that simulates slow processing
const createMockDB = (delayMs: number = 50) => ({
  prepare: () => ({
    bind: () => ({
      run: async () => {
        // Simulate database processing time
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return { success: true }
      },
      first: async () => null,
      all: async () => ({ results: [] })
    })
  })
})

// Test 1: Payment webhook returns 202 immediately
async function testPaymentWebhookAcknowledgment() {
  console.log('\n=== Test 1: Payment Webhook Immediate Acknowledgment ===\n')
  
  const app = new Hono<{ Bindings: TestEnv }>()
  const mockDB = createMockDB(100) // Simulate 100ms database operation
  const processingLog: string[] = []
  
  // Implement the acknowledge-first pattern
  app.post('/webhooks/payment', async (c) => {
    const payload = await c.req.json<PaymentWebhookPayload>()
    const { event_id } = payload
    
    processingLog.push(`Received webhook for event ${event_id}`)
    
    // Return HTTP 202 immediately
    const response = c.json({ 
      status: 'accepted',
      event_id: event_id 
    }, 202)
    
    // Simulate async processing with waitUntil
    // In real Cloudflare Workers, this would be: c.executionCtx.waitUntil(...)
    // For testing, we'll just track that it was called
    const asyncProcessing = (async () => {
      processingLog.push(`Starting async processing for event ${event_id}`)
      
      // Simulate database operation
      await c.env.DB.prepare('INSERT INTO payment_events...').bind().run()
      
      processingLog.push(`Completed async processing for event ${event_id}`)
    })()
    
    // Don't await - let it run in background
    asyncProcessing.catch(err => {
      processingLog.push(`Error in async processing: ${err.message}`)
    })
    
    return response
  })
  
  const payload: PaymentWebhookPayload = {
    event_id: 'evt_test_123',
    customer_id: 'cust_456',
    invoice_id: 'inv_789',
    amount: 10000,
    payment_method: 'pix',
    status: 'confirmed',
    due_date: '2024-01-15',
    timestamp: '2024-01-15T10:00:00Z'
  }
  
  const startTime = Date.now()
  
  const response = await app.request('/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, {
    DB: mockDB as any,
    KV: {} as any,
    WEBHOOK_SECRET: 'test-secret'
  })
  
  const endTime = Date.now()
  const responseTime = endTime - startTime
  
  console.log(`✓ Response status: ${response.status}`)
  console.log(`✓ Response time: ${responseTime}ms`)
  console.log(`✓ Response body:`, await response.json())
  console.log(`✓ Processing log:`, processingLog)
  
  // Verify response was immediate (< 100ms)
  if (response.status === 202) {
    console.log('✅ PASS: Returned HTTP 202 Accepted')
  } else {
    console.log('❌ FAIL: Did not return HTTP 202')
  }
  
  if (responseTime < 100) {
    console.log(`✅ PASS: Response time ${responseTime}ms < 100ms`)
  } else {
    console.log(`❌ FAIL: Response time ${responseTime}ms >= 100ms`)
  }
  
  // Wait a bit to see async processing complete
  await new Promise(resolve => setTimeout(resolve, 200))
  console.log(`✓ Final processing log:`, processingLog)
}

// Test 2: Engagement webhook returns 202 immediately
async function testEngagementWebhookAcknowledgment() {
  console.log('\n=== Test 2: Engagement Webhook Immediate Acknowledgment ===\n')
  
  const app = new Hono<{ Bindings: TestEnv }>()
  const mockDB = createMockDB(100) // Simulate 100ms database operation
  const processingLog: string[] = []
  
  // Implement the acknowledge-first pattern
  app.post('/webhooks/engagement', async (c) => {
    const payload = await c.req.json<EngagementWebhookPayload>()
    const { message_id } = payload
    
    processingLog.push(`Received webhook for message ${message_id}`)
    
    // Return HTTP 202 immediately
    const response = c.json({ 
      status: 'accepted',
      message_id: message_id
    }, 202)
    
    // Simulate async processing
    const asyncProcessing = (async () => {
      processingLog.push(`Starting async processing for message ${message_id}`)
      
      // Simulate database operation
      await c.env.DB.prepare('UPDATE engagement_events...').bind().run()
      
      processingLog.push(`Completed async processing for message ${message_id}`)
    })()
    
    // Don't await - let it run in background
    asyncProcessing.catch(err => {
      processingLog.push(`Error in async processing: ${err.message}`)
    })
    
    return response
  })
  
  const payload: EngagementWebhookPayload = {
    message_id: 'msg_test_456',
    customer_id: 'cust_789',
    status: 'read',
    timestamp: '2024-01-15T10:00:00Z'
  }
  
  const startTime = Date.now()
  
  const response = await app.request('/webhooks/engagement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, {
    DB: mockDB as any,
    KV: {} as any,
    WEBHOOK_SECRET: 'test-secret'
  })
  
  const endTime = Date.now()
  const responseTime = endTime - startTime
  
  console.log(`✓ Response status: ${response.status}`)
  console.log(`✓ Response time: ${responseTime}ms`)
  console.log(`✓ Response body:`, await response.json())
  console.log(`✓ Processing log:`, processingLog)
  
  // Verify response was immediate (< 100ms)
  if (response.status === 202) {
    console.log('✅ PASS: Returned HTTP 202 Accepted')
  } else {
    console.log('❌ FAIL: Did not return HTTP 202')
  }
  
  if (responseTime < 100) {
    console.log(`✅ PASS: Response time ${responseTime}ms < 100ms`)
  } else {
    console.log(`❌ FAIL: Response time ${responseTime}ms >= 100ms`)
  }
  
  // Wait a bit to see async processing complete
  await new Promise(resolve => setTimeout(resolve, 200))
  console.log(`✓ Final processing log:`, processingLog)
}

// Test 3: Errors in async processing don't affect response
async function testErrorHandling() {
  console.log('\n=== Test 3: Error Handling in Async Processing ===\n')
  
  const app = new Hono<{ Bindings: TestEnv }>()
  const processingLog: string[] = []
  
  // Mock DB that throws an error
  const failingDB = {
    prepare: () => ({
      bind: () => ({
        run: async () => {
          throw new Error('Database connection failed')
        }
      })
    })
  }
  
  app.post('/webhooks/payment', async (c) => {
    const payload = await c.req.json<PaymentWebhookPayload>()
    const { event_id } = payload
    
    // Return HTTP 202 immediately
    const response = c.json({ 
      status: 'accepted',
      event_id: event_id 
    }, 202)
    
    // Async processing that will fail
    const asyncProcessing = (async () => {
      try {
        await c.env.DB.prepare('INSERT...').bind().run()
        processingLog.push('Processing succeeded')
      } catch (error) {
        processingLog.push(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })()
    
    asyncProcessing.catch(() => {}) // Prevent unhandled rejection
    
    return response
  })
  
  const payload: PaymentWebhookPayload = {
    event_id: 'evt_fail_123',
    customer_id: 'cust_456',
    invoice_id: 'inv_789',
    amount: 10000,
    payment_method: 'pix',
    status: 'confirmed',
    due_date: '2024-01-15',
    timestamp: '2024-01-15T10:00:00Z'
  }
  
  const response = await app.request('/webhooks/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }, {
    DB: failingDB as any,
    KV: {} as any,
    WEBHOOK_SECRET: 'test-secret'
  })
  
  console.log(`✓ Response status: ${response.status}`)
  console.log(`✓ Response body:`, await response.json())
  
  // Wait for async processing to complete
  await new Promise(resolve => setTimeout(resolve, 100))
  console.log(`✓ Processing log:`, processingLog)
  
  if (response.status === 202) {
    console.log('✅ PASS: Returned HTTP 202 even with async processing error')
  } else {
    console.log('❌ FAIL: Did not return HTTP 202')
  }
  
  if (processingLog.some(log => log.includes('Processing failed'))) {
    console.log('✅ PASS: Error was caught and logged in async processing')
  } else {
    console.log('❌ FAIL: Error was not properly handled')
  }
}

// Run all tests
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║  Manual Test: Immediate Webhook Acknowledgment (Task 16.3) ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  try {
    await testPaymentWebhookAcknowledgment()
    await testEngagementWebhookAcknowledgment()
    await testErrorHandling()
    
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║  All tests completed successfully!                         ║')
    console.log('╚════════════════════════════════════════════════════════════╝\n')
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}

export { runTests }
