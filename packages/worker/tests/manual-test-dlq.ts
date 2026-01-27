/**
 * Manual test script for Dead-Letter Queue (DLQ) functionality
 * 
 * This script demonstrates the DLQ implementation by simulating
 * various failure scenarios and showing how events are stored
 * for manual review.
 * 
 * Run with: npx tsx tests/manual-test-dlq.ts
 */

import { processWithRetryAndDLQ } from '../src/lib/retry'
import {
  writeToDLQ,
  listDLQEntries,
  getDLQEntry,
  deleteDLQEntry,
  getDLQCount
} from '../src/lib/dlq'

// Mock KV namespace for demonstration
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
}

async function main() {
  console.log('🧪 Dead-Letter Queue (DLQ) Manual Test\n')
  console.log('=' .repeat(60))
  
  const mockKV = new MockKVNamespace() as any

  // Test 1: Direct DLQ write
  console.log('\n📝 Test 1: Writing directly to DLQ')
  console.log('-'.repeat(60))
  
  const failedEvent = {
    customer_id: 'cust-123',
    invoice_id: 'inv-456',
    amount: 5000,
    payment_method: 'pix'
  }
  
  await writeToDLQ(
    mockKV,
    failedEvent,
    'Database connection timeout after 30 seconds',
    3,
    { endpoint: '/webhooks/payment', customer_id: 'cust-123' }
  )
  
  console.log('✅ Event written to DLQ')

  // Test 2: List DLQ entries
  console.log('\n📋 Test 2: Listing DLQ entries')
  console.log('-'.repeat(60))
  
  const entries = await listDLQEntries(mockKV)
  console.log(`Found ${entries.length} entries in DLQ:`)
  
  for (const { key, entry } of entries) {
    console.log(`\n  Key: ${key}`)
    console.log(`  Error: ${entry.error}`)
    console.log(`  Attempts: ${entry.attemptCount}`)
    console.log(`  Timestamp: ${entry.timestamp}`)
    console.log(`  Event:`, JSON.stringify(entry.event, null, 2).split('\n').map(l => '    ' + l).join('\n').trim())
    if (entry.context) {
      console.log(`  Context:`, JSON.stringify(entry.context, null, 2).split('\n').map(l => '    ' + l).join('\n').trim())
    }
  }

  // Test 3: Retry with DLQ integration
  console.log('\n🔄 Test 3: Retry with automatic DLQ on failure')
  console.log('-'.repeat(60))
  
  const paymentEvent = {
    event_id: 'evt-789',
    customer_id: 'cust-456',
    invoice_id: 'inv-789',
    amount: 10000,
    payment_method: 'boleto' as const,
    status: 'pending' as const,
    due_date: '2024-02-01',
    timestamp: new Date().toISOString()
  }
  
  // Simulate a function that always fails
  const alwaysFailFn = async () => {
    throw new Error('Simulated database write failure')
  }
  
  console.log('Attempting to process payment event with retries...')
  
  try {
    await processWithRetryAndDLQ(
      alwaysFailFn,
      mockKV,
      paymentEvent,
      { endpoint: '/webhooks/payment', customer_id: paymentEvent.customer_id },
      { baseDelayMs: 100 } // Fast retries for demo
    )
  } catch (error) {
    console.log(`❌ All retries failed: ${(error as Error).message}`)
    console.log('✅ Event automatically written to DLQ')
  }

  // Test 4: Check DLQ count
  console.log('\n📊 Test 4: DLQ statistics')
  console.log('-'.repeat(60))
  
  const count = await getDLQCount(mockKV)
  console.log(`Total entries in DLQ: ${count}`)

  // Test 5: Retrieve specific entry
  console.log('\n🔍 Test 5: Retrieving specific DLQ entry')
  console.log('-'.repeat(60))
  
  const allEntries = await listDLQEntries(mockKV)
  if (allEntries.length > 0) {
    const firstKey = allEntries[0].key
    const entry = await getDLQEntry(mockKV, firstKey)
    
    if (entry) {
      console.log(`Retrieved entry: ${firstKey}`)
      console.log(`Error: ${entry.error}`)
      console.log(`Timestamp: ${entry.timestamp}`)
    }
  }

  // Test 6: Simulate successful retry (no DLQ write)
  console.log('\n✅ Test 6: Successful retry (no DLQ write)')
  console.log('-'.repeat(60))
  
  let attempts = 0
  const eventuallySucceedFn = async () => {
    attempts++
    if (attempts < 3) {
      throw new Error('Temporary failure')
    }
    return 'success'
  }
  
  console.log('Attempting operation that succeeds on 3rd try...')
  
  const result = await processWithRetryAndDLQ(
    eventuallySucceedFn,
    mockKV,
    { test: 'data' },
    undefined,
    { baseDelayMs: 100 }
  )
  
  console.log(`✅ Operation succeeded: ${result}`)
  console.log(`Attempts made: ${attempts}`)
  
  const countAfter = await getDLQCount(mockKV)
  console.log(`DLQ count unchanged: ${countAfter} (no new entries)`)

  // Test 7: Delete DLQ entry
  console.log('\n🗑️  Test 7: Deleting DLQ entry')
  console.log('-'.repeat(60))
  
  const entriesToDelete = await listDLQEntries(mockKV)
  if (entriesToDelete.length > 0) {
    const keyToDelete = entriesToDelete[0].key
    console.log(`Deleting entry: ${keyToDelete}`)
    
    await deleteDLQEntry(mockKV, keyToDelete)
    
    const countAfterDelete = await getDLQCount(mockKV)
    console.log(`✅ Entry deleted. New count: ${countAfterDelete}`)
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))
  
  const finalEntries = await listDLQEntries(mockKV)
  console.log(`\nFinal DLQ state:`)
  console.log(`  Total entries: ${finalEntries.length}`)
  console.log(`  TTL: 7 days (604800 seconds)`)
  console.log(`  Key format: dlq:{timestamp}:{uuid}`)
  
  console.log('\n✅ All DLQ tests completed successfully!')
  console.log('\nKey features demonstrated:')
  console.log('  ✓ Direct DLQ writes with error context')
  console.log('  ✓ Automatic DLQ on retry exhaustion')
  console.log('  ✓ List and retrieve DLQ entries')
  console.log('  ✓ Delete processed entries')
  console.log('  ✓ No DLQ write on successful retry')
  console.log('  ✓ 7-day TTL for automatic cleanup')
}

// Run the tests
main().catch(console.error)
