/**
 * Integration tests for retry logic with DLQ functionality
 * 
 * Tests the integration between retry wrapper and dead-letter queue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { processWithRetryAndDLQ } from '../src/lib/retry'
import { getDLQCount, listDLQEntries } from '../src/lib/dlq'

// Mock KV namespace for testing
class MockKVNamespace {
  private store: Map<string, { value: string; expiration?: number }> = new Map()

  async get(key: string, options?: { type?: 'text' | 'json' }): Promise<any> {
    const item = this.store.get(key)
    if (!item) return null
    
    if (options?.type === 'json') {
      return JSON.parse(item.value)
    }
    return item.value
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, {
      value,
      expiration: options?.expirationTtl
    })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<{ keys: Array<{ name: string }> }> {
    const keys = Array.from(this.store.keys())
    let filtered = keys
    
    if (options?.prefix) {
      filtered = keys.filter(k => k.startsWith(options.prefix))
    }
    
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit)
    }
    
    return {
      keys: filtered.map(name => ({ name }))
    }
  }

  clear(): void {
    this.store.clear()
  }
}

describe('Retry + DLQ Integration', () => {
  let mockKV: MockKVNamespace

  beforeEach(() => {
    mockKV = new MockKVNamespace()
  })

  describe('processWithRetryAndDLQ', () => {
    it('should succeed on first attempt without writing to DLQ', async () => {
      const successFn = vi.fn().mockResolvedValue('success')
      const event = { customer_id: '123', amount: 1000 }

      const result = await processWithRetryAndDLQ(
        successFn,
        mockKV as any,
        event
      )

      expect(result).toBe('success')
      expect(successFn).toHaveBeenCalledTimes(1)
      
      // No DLQ entries should be created
      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(0)
    })

    it('should retry and succeed without writing to DLQ', async () => {
      let attempts = 0
      const retryThenSucceedFn = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return Promise.resolve('success')
      })

      const event = { customer_id: '456', amount: 2000 }

      const result = await processWithRetryAndDLQ(
        retryThenSucceedFn,
        mockKV as any,
        event
      )

      expect(result).toBe('success')
      expect(retryThenSucceedFn).toHaveBeenCalledTimes(3)
      
      // No DLQ entries should be created
      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(0)
    })

    it('should write to DLQ after all retries fail', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      const event = { customer_id: '789', invoice_id: 'inv-123' }
      const context = { endpoint: '/webhooks/payment', customer_id: '789' }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          event,
          context
        )
      ).rejects.toThrow('Persistent failure')

      expect(failFn).toHaveBeenCalledTimes(3)
      
      // One DLQ entry should be created
      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(1)

      // Verify DLQ entry contents
      const entries = await listDLQEntries(mockKV as any)
      expect(entries.length).toBe(1)
      expect(entries[0].entry.event).toEqual(event)
      expect(entries[0].entry.error).toBe('Persistent failure')
      expect(entries[0].entry.attemptCount).toBe(3)
      expect(entries[0].entry.context).toEqual(context)
    })

    it('should write to DLQ with correct attempt count', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Database timeout'))
      const event = { test: 'data' }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          event,
          undefined,
          { maxRetries: 5, baseDelayMs: 100 } // Reduced delay for faster test
        )
      ).rejects.toThrow('Database timeout')

      expect(failFn).toHaveBeenCalledTimes(5)
      
      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.attemptCount).toBe(5)
    }, 10000) // 10 second timeout

    it('should preserve complex event objects in DLQ', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'))
      const complexEvent = {
        customer_id: '123',
        nested: {
          data: {
            values: [1, 2, 3]
          }
        },
        metadata: {
          source: 'webhook',
          timestamp: '2024-01-01T00:00:00Z'
        }
      }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          complexEvent
        )
      ).rejects.toThrow('Failed')

      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.event).toEqual(complexEvent)
    })

    it('should handle multiple failures and create separate DLQ entries', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Error'))
      
      const event1 = { id: 1 }
      const event2 = { id: 2 }
      const event3 = { id: 3 }

      // Use reduced delay for faster test
      const options = { baseDelayMs: 100 }

      await expect(processWithRetryAndDLQ(failFn, mockKV as any, event1, undefined, options)).rejects.toThrow()
      await expect(processWithRetryAndDLQ(failFn, mockKV as any, event2, undefined, options)).rejects.toThrow()
      await expect(processWithRetryAndDLQ(failFn, mockKV as any, event3, undefined, options)).rejects.toThrow()

      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(3)

      const entries = await listDLQEntries(mockKV as any)
      expect(entries.map(e => e.entry.event)).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ])
    }, 10000) // 10 second timeout

    it('should include context in DLQ entry when provided', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Network error'))
      const event = { customer_id: '999' }
      const context = {
        endpoint: '/webhooks/engagement',
        customer_id: '999',
        message_id: 'msg-456'
      }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          event,
          context
        )
      ).rejects.toThrow('Network error')

      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.context).toEqual(context)
    })

    it('should work without context parameter', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Error'))
      const event = { data: 'test' }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          event
        )
      ).rejects.toThrow('Error')

      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.context).toBeUndefined()
    })

    it('should respect custom retry options', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Error'))
      const event = { test: 'data' }

      await expect(
        processWithRetryAndDLQ(
          failFn,
          mockKV as any,
          event,
          undefined,
          {
            maxRetries: 2,
            baseDelayMs: 500
          }
        )
      ).rejects.toThrow('Error')

      // Should only retry 2 times
      expect(failFn).toHaveBeenCalledTimes(2)
      
      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.attemptCount).toBe(2)
    })

    it('should call onRetry callback during retries', async () => {
      let attempts = 0
      const failFn = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Retry me')
        }
        return Promise.resolve('success')
      })

      const onRetry = vi.fn()
      const event = { test: 'data' }

      await processWithRetryAndDLQ(
        failFn,
        mockKV as any,
        event,
        undefined,
        { onRetry }
      )

      // onRetry should be called twice (for attempts 1 and 2)
      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error))
    })
  })

  describe('Error message preservation', () => {
    it('should preserve error message in DLQ', async () => {
      const errorMessage = 'Database connection timeout after 30 seconds'
      const failFn = vi.fn().mockRejectedValue(new Error(errorMessage))
      const event = { test: 'data' }

      await expect(
        processWithRetryAndDLQ(failFn, mockKV as any, event)
      ).rejects.toThrow(errorMessage)

      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.error).toBe(errorMessage)
    })

    it('should handle non-Error objects', async () => {
      const failFn = vi.fn().mockRejectedValue('String error')
      const event = { test: 'data' }

      await expect(
        processWithRetryAndDLQ(failFn, mockKV as any, event)
      ).rejects.toThrow('String error')

      const entries = await listDLQEntries(mockKV as any)
      expect(entries[0].entry.error).toBe('String error')
    })
  })
})
