/**
 * Manual test script for retry wrapper with exponential backoff
 * 
 * Run with: npx tsx tests/manual-test-retry.ts
 */

import { processWithRetry, retryDatabaseOperation, retryApiCall } from '../src/lib/retry'

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logTest(name: string) {
  console.log(`\n${colors.blue}━━━ ${name} ━━━${colors.reset}`)
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green)
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red)
}

// Test 1: Successful first attempt
async function testSuccessfulFirstAttempt() {
  logTest('Test 1: Successful first attempt')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    return 'success'
  }
  
  const result = await processWithRetry(fn)
  
  if (result === 'success' && callCount === 1) {
    logSuccess('Function succeeded on first attempt')
  } else {
    logError(`Expected 1 call, got ${callCount}`)
  }
}

// Test 2: Retry after one failure
async function testRetryAfterOneFailure() {
  logTest('Test 2: Retry after one failure')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    if (callCount === 1) {
      throw new Error('First attempt failed')
    }
    return 'success'
  }
  
  const result = await processWithRetry(fn, { baseDelayMs: 100 })
  
  if (result === 'success' && callCount === 2) {
    logSuccess('Function succeeded on second attempt after one failure')
  } else {
    logError(`Expected 2 calls, got ${callCount}`)
  }
}

// Test 3: Retry up to 3 times then fail
async function testRetryUpTo3Times() {
  logTest('Test 3: Retry up to 3 times then fail')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    throw new Error(`Attempt ${callCount} failed`)
  }
  
  try {
    await processWithRetry(fn, { baseDelayMs: 100 })
    logError('Should have thrown an error')
  } catch (error) {
    if (callCount === 3 && error instanceof Error && error.message === 'Attempt 3 failed') {
      logSuccess('Function failed after 3 attempts as expected')
    } else {
      logError(`Expected 3 calls with "Attempt 3 failed", got ${callCount} calls with "${error}"`)
    }
  }
}

// Test 4: Exponential backoff timing
async function testExponentialBackoff() {
  logTest('Test 4: Exponential backoff timing')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    if (callCount < 3) {
      throw new Error(`Attempt ${callCount} failed`)
    }
    return 'success'
  }
  
  const startTime = Date.now()
  await processWithRetry(fn, { baseDelayMs: 100 })
  const endTime = Date.now()
  const totalTime = endTime - startTime
  
  // Expected delays: 100ms + 200ms = 300ms
  // Allow some tolerance for execution time
  if (totalTime >= 300 && totalTime < 500) {
    logSuccess(`Exponential backoff timing correct: ${totalTime}ms (expected ~300ms)`)
  } else {
    logError(`Exponential backoff timing incorrect: ${totalTime}ms (expected ~300ms)`)
  }
}

// Test 5: onRetry callback
async function testOnRetryCallback() {
  logTest('Test 5: onRetry callback')
  
  let callCount = 0
  let retryCount = 0
  const errors: Error[] = []
  
  const fn = async () => {
    callCount++
    if (callCount < 3) {
      throw new Error(`Attempt ${callCount} failed`)
    }
    return 'success'
  }
  
  const onRetry = (attempt: number, error: Error) => {
    retryCount++
    errors.push(error)
  }
  
  await processWithRetry(fn, { onRetry, baseDelayMs: 100 })
  
  if (retryCount === 2 && errors.length === 2) {
    logSuccess(`onRetry callback called ${retryCount} times as expected`)
  } else {
    logError(`Expected 2 retry callbacks, got ${retryCount}`)
  }
}

// Test 6: Custom maxRetries
async function testCustomMaxRetries() {
  logTest('Test 6: Custom maxRetries')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    throw new Error(`Attempt ${callCount} failed`)
  }
  
  try {
    await processWithRetry(fn, { maxRetries: 5, baseDelayMs: 50 })
    logError('Should have thrown an error')
  } catch (error) {
    if (callCount === 5) {
      logSuccess(`Function failed after 5 attempts as expected (custom maxRetries)`)
    } else {
      logError(`Expected 5 calls, got ${callCount}`)
    }
  }
}

// Test 7: retryDatabaseOperation wrapper
async function testRetryDatabaseOperation() {
  logTest('Test 7: retryDatabaseOperation wrapper')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    if (callCount === 1) {
      throw new Error('Database connection failed')
    }
    return { id: 1, data: 'test' }
  }
  
  // Suppress console.warn for this test
  const originalWarn = console.warn
  console.warn = () => {}
  
  const result = await retryDatabaseOperation(fn)
  
  console.warn = originalWarn
  
  if (result.id === 1 && result.data === 'test' && callCount === 2) {
    logSuccess('retryDatabaseOperation succeeded after one retry')
  } else {
    logError(`Expected 2 calls with correct result, got ${callCount} calls`)
  }
}

// Test 8: retryApiCall wrapper
async function testRetryApiCall() {
  logTest('Test 8: retryApiCall wrapper')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    if (callCount === 1) {
      throw new Error('Network error')
    }
    return { status: 200, data: 'response' }
  }
  
  // Suppress console.warn for this test
  const originalWarn = console.warn
  console.warn = () => {}
  
  const result = await retryApiCall(fn)
  
  console.warn = originalWarn
  
  if (result.status === 200 && result.data === 'response' && callCount === 2) {
    logSuccess('retryApiCall succeeded after one retry')
  } else {
    logError(`Expected 2 calls with correct result, got ${callCount} calls`)
  }
}

// Test 9: Handle non-Error exceptions
async function testNonErrorExceptions() {
  logTest('Test 9: Handle non-Error exceptions')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    if (callCount === 1) {
      throw 'string error'
    } else if (callCount === 2) {
      throw { message: 'object error' }
    }
    return 'success'
  }
  
  const result = await processWithRetry(fn, { baseDelayMs: 50 })
  
  if (result === 'success' && callCount === 3) {
    logSuccess('Handled non-Error exceptions correctly')
  } else {
    logError(`Expected 3 calls, got ${callCount}`)
  }
}

// Test 10: Edge case - maxRetries of 1
async function testMaxRetriesOne() {
  logTest('Test 10: Edge case - maxRetries of 1')
  
  let callCount = 0
  const fn = async () => {
    callCount++
    throw new Error('Failed')
  }
  
  try {
    await processWithRetry(fn, { maxRetries: 1 })
    logError('Should have thrown an error')
  } catch (error) {
    if (callCount === 1) {
      logSuccess('maxRetries of 1 means no retries (only one attempt)')
    } else {
      logError(`Expected 1 call, got ${callCount}`)
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log(`\n${colors.yellow}╔════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.yellow}║  Retry Wrapper Manual Test Suite              ║${colors.reset}`)
  console.log(`${colors.yellow}╚════════════════════════════════════════════════╝${colors.reset}`)
  
  try {
    await testSuccessfulFirstAttempt()
    await testRetryAfterOneFailure()
    await testRetryUpTo3Times()
    await testExponentialBackoff()
    await testOnRetryCallback()
    await testCustomMaxRetries()
    await testRetryDatabaseOperation()
    await testRetryApiCall()
    await testNonErrorExceptions()
    await testMaxRetriesOne()
    
    console.log(`\n${colors.green}╔════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.green}║  All tests completed successfully! ✓          ║${colors.reset}`)
    console.log(`${colors.green}╚════════════════════════════════════════════════╝${colors.reset}\n`)
  } catch (error) {
    console.log(`\n${colors.red}╔════════════════════════════════════════════════╗${colors.reset}`)
    console.log(`${colors.red}║  Test suite failed with error:                ║${colors.reset}`)
    console.log(`${colors.red}╚════════════════════════════════════════════════╝${colors.reset}`)
    console.error(error)
    process.exit(1)
  }
}

// Run the tests
runAllTests()
