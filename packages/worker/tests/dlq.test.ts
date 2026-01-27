/**
 * Unit tests for Dead-Letter Queue (DLQ) functionality
 * 
 * Tests the DLQ implementation for storing and retrieving failed events
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  writeToDLQ,
  listDLQEntries,
  getDLQEntry,
  deleteDLQEntry,
  getDLQCount,
  type DLQEntry
} from '../src/lib/dlq'

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

  // Helper method to clear the store between tests
  clear(): void {
    this.store.clear()
  }

  // Helper method to get raw store for inspection
  getStore(): Map<string, { value: string; expiration?: number }> {
    return this.store
  }
}

describe('DLQ - Dead-Letter Queue', () => {
  let mockKV: MockKVNamespace

  beforeEach(() => {
    mockKV = new MockKVNamespace()
  })

  describe('writeToDLQ', () => {
    it('should write a failed event to KV with dlq: prefix', async () => {
      const event = { customer_id: '123', amount: 1000 }
      const error = 'Database connection timeout'
      const attemptCount = 3
      const context = { endpoint: '/webhooks/payment' }

      await writeToDLQ(mockKV as any, event, error, attemptCount, context)

      const store = mockKV.getStore()
      const keys = Array.from(store.keys())
      
      expect(keys.length).toBe(1)
      expect(keys[0]).toMatch(/^dlq:\d+:[a-f0-9-]+$/)
    })

    it('should include all required fields in DLQ entry', async () => {
      const event = { customer_id: '456', invoice_id: 'inv-789' }
      const error = 'Failed to insert payment event'
      const attemptCount = 3
      const context = { endpoint: '/webhooks/payment', customer_id: '456' }

      await writeToDLQ(mockKV as any, event, error, attemptCount, context)

      const keys = Array.from(mockKV.getStore().keys())
      const entry = await mockKV.get(keys[0], { type: 'json' }) as DLQEntry

      expect(entry.event).toEqual(event)
      expect(entry.error).toBe(error)
      expect(entry.attemptCount).toBe(attemptCount)
      expect(entry.timestamp).toBeDefined()
      expect(entry.context).toEqual(context)
    })

    it('should set TTL to 7 days (604800 seconds)', async () => {
      const event = { test: 'data' }
      const error = 'Test error'
      const attemptCount = 3

      await writeToDLQ(mockKV as any, event, error, attemptCount)

      const store = mockKV.getStore()
      const keys = Array.from(store.keys())
      const item = store.get(keys[0])

      expect(item?.expiration).toBe(604800)
    })

    it('should work without optional context', async () => {
      const event = { customer_id: '789' }
      const error = 'Network error'
      const attemptCount = 2

      await writeToDLQ(mockKV as any, event, error, attemptCount)

      const keys = Array.from(mockKV.getStore().keys())
      const entry = await mockKV.get(keys[0], { type: 'json' }) as DLQEntry

      expect(entry.event).toEqual(event)
      expect(entry.context).toBeUndefined()
    })

    it('should generate unique keys for multiple entries', async () => {
      const event1 = { id: 1 }
      const event2 = { id: 2 }
      const event3 = { id: 3 }

      await writeToDLQ(mockKV as any, event1, 'Error 1', 3)
      await writeToDLQ(mockKV as any, event2, 'Error 2', 3)
      await writeToDLQ(mockKV as any, event3, 'Error 3', 3)

      const keys = Array.from(mockKV.getStore().keys())
      expect(keys.length).toBe(3)
      
      // All keys should be unique
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(3)
    })
  })

  describe('listDLQEntries', () => {
    it('should return empty array when DLQ is empty', async () => {
      const entries = await listDLQEntries(mockKV as any)
      expect(entries).toEqual([])
    })

    it('should list all DLQ entries', async () => {
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error 1', 3)
      await writeToDLQ(mockKV as any, { id: 2 }, 'Error 2', 3)
      await writeToDLQ(mockKV as any, { id: 3 }, 'Error 3', 3)

      const entries = await listDLQEntries(mockKV as any)
      
      expect(entries.length).toBe(3)
      expect(entries[0].entry.event).toEqual({ id: 1 })
      expect(entries[1].entry.event).toEqual({ id: 2 })
      expect(entries[2].entry.event).toEqual({ id: 3 })
    })

    it('should respect limit parameter', async () => {
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error 1', 3)
      await writeToDLQ(mockKV as any, { id: 2 }, 'Error 2', 3)
      await writeToDLQ(mockKV as any, { id: 3 }, 'Error 3', 3)

      const entries = await listDLQEntries(mockKV as any, 2)
      
      expect(entries.length).toBe(2)
    })

    it('should only list entries with dlq: prefix', async () => {
      // Add DLQ entries
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error 1', 3)
      
      // Add non-DLQ entry
      await mockKV.put('cache:some-key', JSON.stringify({ data: 'test' }))

      const entries = await listDLQEntries(mockKV as any)
      
      expect(entries.length).toBe(1)
      expect(entries[0].key).toMatch(/^dlq:/)
    })
  })

  describe('getDLQEntry', () => {
    it('should retrieve a specific DLQ entry by key', async () => {
      const event = { customer_id: '123', amount: 5000 }
      await writeToDLQ(mockKV as any, event, 'Test error', 3)

      const keys = Array.from(mockKV.getStore().keys())
      const entry = await getDLQEntry(mockKV as any, keys[0])

      expect(entry).not.toBeNull()
      expect(entry?.event).toEqual(event)
      expect(entry?.error).toBe('Test error')
    })

    it('should return null for non-existent key', async () => {
      const entry = await getDLQEntry(mockKV as any, 'dlq:nonexistent:key')
      expect(entry).toBeNull()
    })
  })

  describe('deleteDLQEntry', () => {
    it('should delete a DLQ entry by key', async () => {
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error', 3)

      const keys = Array.from(mockKV.getStore().keys())
      expect(keys.length).toBe(1)

      await deleteDLQEntry(mockKV as any, keys[0])

      const keysAfter = Array.from(mockKV.getStore().keys())
      expect(keysAfter.length).toBe(0)
    })

    it('should not throw error when deleting non-existent key', async () => {
      await expect(
        deleteDLQEntry(mockKV as any, 'dlq:nonexistent:key')
      ).resolves.not.toThrow()
    })
  })

  describe('getDLQCount', () => {
    it('should return 0 when DLQ is empty', async () => {
      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(0)
    })

    it('should return correct count of DLQ entries', async () => {
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error 1', 3)
      await writeToDLQ(mockKV as any, { id: 2 }, 'Error 2', 3)
      await writeToDLQ(mockKV as any, { id: 3 }, 'Error 3', 3)

      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(3)
    })

    it('should only count entries with dlq: prefix', async () => {
      await writeToDLQ(mockKV as any, { id: 1 }, 'Error 1', 3)
      await mockKV.put('cache:some-key', JSON.stringify({ data: 'test' }))

      const count = await getDLQCount(mockKV as any)
      expect(count).toBe(1)
    })
  })

  describe('DLQ Entry Structure', () => {
    it('should store timestamp in ISO 8601 format', async () => {
      await writeToDLQ(mockKV as any, { test: 'data' }, 'Error', 3)

      const keys = Array.from(mockKV.getStore().keys())
      const entry = await mockKV.get(keys[0], { type: 'json' }) as DLQEntry

      // Check if timestamp is valid ISO 8601
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
    })

    it('should preserve complex event objects', async () => {
      const complexEvent = {
        customer_id: '123',
        nested: {
          data: {
            values: [1, 2, 3]
          }
        },
        array: ['a', 'b', 'c']
      }

      await writeToDLQ(mockKV as any, complexEvent, 'Error', 3)

      const keys = Array.from(mockKV.getStore().keys())
      const entry = await mockKV.get(keys[0], { type: 'json' }) as DLQEntry

      expect(entry.event).toEqual(complexEvent)
    })
  })
})
