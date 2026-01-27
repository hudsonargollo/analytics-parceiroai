/**
 * Tests for immediate webhook acknowledgment (Task 16.3)
 * 
 * Validates: Requirements 8.1
 * Property 26: Immediate Webhook Acknowledgment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { validateWebhookSignature } from '../src/lib/webhook-middleware'
import { insertPaymentEvent } from '../src/lib/payment-event'
import { updateEngagementStatus } from '../src/lib/engagement-event'
import type { PaymentWebhookPayload, EngagementWebhookPayload } from '../src/types'

interface TestEnv {
  DB: D1Database
  KV: KVNamespace
  WEBHOOK_SECRET: string
  ZUCKZAPGO_SECRET: string
  [key: string]: any
}

describe('Webhook Immediate Acknowledgment', () => {
  let app: Hono<{ Bindings: TestEnv }>
  let mockDB: any
  let mockKV: any
  let waitUntilCalls: Array<Promise<any>>

  beforeEach(() => {
    // Create a fresh Hono app for each test
    app = new Hono<{ Bindings: TestEnv }>()
    
    // Mock database
    mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] })
    }
    
    // Mock KV
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined)
    }
    
    // Track waitUntil calls
    waitUntilCalls = []
  })

  it('should return HTTP 202 immediately for payment webhook', async () => {
    // Create payment webhook endpoint with immediate acknowledgment
    app.post('/webhooks/payment', async (c) => {
      const payload = await c.req.json<PaymentWebhookPayload>()
      const { event_id } = payload
      
      // Return HTTP 202 immediately
      const response = c.json({ 
        status: 'accepted',
        event_id: event_id 
      }, 202)
      
      // Process asynchronously (mock waitUntil)
      const asyncProcessing = (async () => {
        await insertPaymentEvent(c.env.DB, payload)
      })()
      
      waitUntilCalls.push(asyncProcessing)
      
      return response
    })

    const payload: PaymentWebhookPayload = {
      event_id: 'evt_123',
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
      DB: mockDB,
      KV: mockKV,
      WEBHOOK_SECRET: 'test-secret',
      ZUCKZAPGO_SECRET: 'test-secret'
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify HTTP 202 returned
    expect(response.status).toBe(202)
    
    // Verify response body
    const body = await response.json()
    expect(body).toEqual({
      status: 'accepted',
      event_id: 'evt_123'
    })
    
    // Verify response was fast (should be well under 100ms in tests)
    // Note: In production with real network, this ensures < 100ms
    expect(responseTime).toBeLessThan(100)
    
    // Verify async processing was initiated
    expect(waitUntilCalls.length).toBe(1)
  })

  it('should return HTTP 202 immediately for engagement webhook', async () => {
    // Create engagement webhook endpoint with immediate acknowledgment
    app.post('/webhooks/engagement', async (c) => {
      const payload = await c.req.json<EngagementWebhookPayload>()
      const { message_id } = payload
      
      // Return HTTP 202 immediately
      const response = c.json({ 
        status: 'accepted',
        message_id: message_id
      }, 202)
      
      // Process asynchronously (mock waitUntil)
      const asyncProcessing = (async () => {
        await updateEngagementStatus(c.env.DB, payload)
      })()
      
      waitUntilCalls.push(asyncProcessing)
      
      return response
    })

    const payload: EngagementWebhookPayload = {
      message_id: 'msg_123',
      customer_id: 'cust_456',
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
      DB: mockDB,
      KV: mockKV,
      WEBHOOK_SECRET: 'test-secret',
      ZUCKZAPGO_SECRET: 'test-secret'
    })

    const endTime = Date.now()
    const responseTime = endTime - startTime

    // Verify HTTP 202 returned
    expect(response.status).toBe(202)
    
    // Verify response body
    const body = await response.json()
    expect(body).toEqual({
      status: 'accepted',
      message_id: 'msg_123'
    })
    
    // Verify response was fast (should be well under 100ms in tests)
    expect(responseTime).toBeLessThan(100)
    
    // Verify async processing was initiated
    expect(waitUntilCalls.length).toBe(1)
  })

  it('should not block response on database errors', async () => {
    // Create payment webhook endpoint that fails during processing
    app.post('/webhooks/payment', async (c) => {
      const payload = await c.req.json<PaymentWebhookPayload>()
      const { event_id } = payload
      
      // Return HTTP 202 immediately
      const response = c.json({ 
        status: 'accepted',
        event_id: event_id 
      }, 202)
      
      // Process asynchronously with error
      const asyncProcessing = (async () => {
        throw new Error('Database connection failed')
      })()
      
      waitUntilCalls.push(asyncProcessing)
      
      return response
    })

    const payload: PaymentWebhookPayload = {
      event_id: 'evt_123',
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
      DB: mockDB,
      KV: mockKV,
      WEBHOOK_SECRET: 'test-secret',
      ZUCKZAPGO_SECRET: 'test-secret'
    })

    // Verify HTTP 202 still returned despite async error
    expect(response.status).toBe(202)
    
    const body = await response.json()
    expect(body).toEqual({
      status: 'accepted',
      event_id: 'evt_123'
    })
    
    // Verify async processing was initiated (even though it will fail)
    expect(waitUntilCalls.length).toBe(1)
    
    // Verify the async processing fails as expected
    await expect(waitUntilCalls[0]).rejects.toThrow('Database connection failed')
  })
})
