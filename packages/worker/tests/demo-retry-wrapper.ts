/**
 * Demonstration script for retry wrapper with exponential backoff
 * 
 * This script demonstrates the retry wrapper functionality with visual output
 * showing the exponential backoff delays in action.
 * 
 * Run with: npx tsx tests/demo-retry-wrapper.ts
 */

import { processWithRetry } from '../src/lib/retry'

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logHeader(title: string) {
  console.log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`)
  console.log(`${colors.bold}${colors.blue}${title}${colors.reset}`)
  console.log(`${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`)
}

function logSection(title: string) {
  console.log(`\n${colors.cyan}${colors.bold}${title}${colors.reset}`)
  console.log(`${colors.cyan}${'-'.repeat(60)}${colors.reset}`)
}

// Demo 1: Successful operation (no retries needed)
async function demoSuccessfulOperation() {
  logSection('Demo 1: Successful Operation (No Retries)')
  
  log('Executing operation that succeeds on first attempt...', colors.yellow)
  
  const result = await processWithRetry(
    async () => {
      log('  → Operation executing...', colors.cyan)
      return { status: 'success', data: 'Payment processed' }
    },
    {
      onRetry: (attempt, error) => {
        log(`  ⟳ Retry attempt ${attempt}: ${error.message}`, colors.yellow)
      }
    }
  )
  
  log(`✓ Result: ${JSON.stringify(result)}`, colors.green)
}

// Demo 2: Operation that fails once then succeeds
async function demoRetryOnce() {
  logSection('Demo 2: Retry After One Failure')
  
  log('Executing operation that fails once then succeeds...', colors.yellow)
  
  let attemptCount = 0
  const startTime = Date.now()
  
  const result = await processWithRetry(
    async () => {
      attemptCount++
      log(`  → Attempt ${attemptCount} executing...`, colors.cyan)
      
      if (attemptCount === 1) {
        throw new Error('Database connection timeout')
      }
      
      return { status: 'success', attempt: attemptCount }
    },
    {
      baseDelayMs: 1000,
      onRetry: (attempt, error) => {
        const elapsed = Date.now() - startTime
        log(`  ⟳ Retry ${attempt}/3 after ${elapsed}ms: ${error.message}`, colors.yellow)
        log(`  ⏱  Waiting ${1000 * Math.pow(2, attempt - 1)}ms before next attempt...`, colors.magenta)
      }
    }
  )
  
  const totalTime = Date.now() - startTime
  log(`✓ Success after ${attemptCount} attempts in ${totalTime}ms`, colors.green)
  log(`  Result: ${JSON.stringify(result)}`, colors.green)
}

// Demo 3: Operation that fails twice then succeeds
async function demoRetryTwice() {
  logSection('Demo 3: Retry After Two Failures (Exponential Backoff)')
  
  log('Executing operation that fails twice then succeeds...', colors.yellow)
  log('Watch the exponential backoff delays: 1s, 2s', colors.yellow)
  
  let attemptCount = 0
  const startTime = Date.now()
  const attemptTimes: number[] = []
  
  const result = await processWithRetry(
    async () => {
      attemptCount++
      const elapsed = Date.now() - startTime
      attemptTimes.push(elapsed)
      log(`  → Attempt ${attemptCount} at ${elapsed}ms`, colors.cyan)
      
      if (attemptCount < 3) {
        throw new Error(`Transient failure ${attemptCount}`)
      }
      
      return { status: 'success', attempt: attemptCount }
    },
    {
      baseDelayMs: 1000,
      onRetry: (attempt, error) => {
        const delay = 1000 * Math.pow(2, attempt - 1)
        log(`  ⟳ Retry ${attempt}/3: ${error.message}`, colors.yellow)
        log(`  ⏱  Exponential backoff: waiting ${delay}ms...`, colors.magenta)
      }
    }
  )
  
  const totalTime = Date.now() - startTime
  log(`✓ Success after ${attemptCount} attempts in ${totalTime}ms`, colors.green)
  log(`  Attempt times: ${attemptTimes.map(t => `${t}ms`).join(', ')}`, colors.green)
  log(`  Delays between attempts: ~1000ms, ~2000ms`, colors.green)
}

// Demo 4: Operation that fails all retries
async function demoAllRetriesFail() {
  logSection('Demo 4: All Retries Exhausted')
  
  log('Executing operation that fails all 3 attempts...', colors.yellow)
  
  let attemptCount = 0
  const startTime = Date.now()
  
  try {
    await processWithRetry(
      async () => {
        attemptCount++
        const elapsed = Date.now() - startTime
        log(`  → Attempt ${attemptCount} at ${elapsed}ms`, colors.cyan)
        throw new Error('Persistent database failure')
      },
      {
        baseDelayMs: 1000,
        onRetry: (attempt, error) => {
          const delay = 1000 * Math.pow(2, attempt - 1)
          log(`  ⟳ Retry ${attempt}/3: ${error.message}`, colors.yellow)
          log(`  ⏱  Waiting ${delay}ms before next attempt...`, colors.magenta)
        },
        onFinalFailure: async (error, attempts) => {
          log(`  ✗ All ${attempts} attempts failed`, colors.red)
          log(`  → Would send to dead-letter queue: ${error.message}`, colors.magenta)
        }
      }
    )
  } catch (error) {
    const totalTime = Date.now() - startTime
    log(`✗ Operation failed after ${attemptCount} attempts in ${totalTime}ms`, colors.red)
    if (error instanceof Error) {
      log(`  Error: ${error.message}`, colors.red)
    }
  }
}

// Demo 5: Custom configuration
async function demoCustomConfiguration() {
  logSection('Demo 5: Custom Configuration (5 retries, 500ms base delay)')
  
  log('Executing with custom retry settings...', colors.yellow)
  
  let attemptCount = 0
  const startTime = Date.now()
  
  const result = await processWithRetry(
    async () => {
      attemptCount++
      const elapsed = Date.now() - startTime
      log(`  → Attempt ${attemptCount} at ${elapsed}ms`, colors.cyan)
      
      if (attemptCount < 3) {
        throw new Error(`Failure ${attemptCount}`)
      }
      
      return { status: 'success', attempt: attemptCount }
    },
    {
      maxRetries: 5,
      baseDelayMs: 500,
      onRetry: (attempt, error) => {
        const delay = 500 * Math.pow(2, attempt - 1)
        log(`  ⟳ Retry ${attempt}/5: ${error.message}`, colors.yellow)
        log(`  ⏱  Waiting ${delay}ms...`, colors.magenta)
      }
    }
  )
  
  const totalTime = Date.now() - startTime
  log(`✓ Success after ${attemptCount} attempts in ${totalTime}ms`, colors.green)
  log(`  Custom delays: 500ms, 1000ms`, colors.green)
}

// Main execution
async function main() {
  logHeader('Retry Wrapper with Exponential Backoff - Live Demo')
  
  log('This demo shows the retry wrapper in action with visual timing.', colors.cyan)
  log('Each demo will show attempt numbers, delays, and outcomes.\n', colors.cyan)
  
  try {
    await demoSuccessfulOperation()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    await demoRetryOnce()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    await demoRetryTwice()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    await demoAllRetriesFail()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    await demoCustomConfiguration()
    
    logHeader('Demo Complete!')
    log('Key Takeaways:', colors.cyan)
    log('  • Default: 3 retries with 1s, 2s, 4s delays', colors.cyan)
    log('  • Exponential backoff prevents overwhelming failing services', colors.cyan)
    log('  • Configurable retry count and base delay', colors.cyan)
    log('  • Callbacks for monitoring and logging', colors.cyan)
    log('  • Integration with dead-letter queue for persistent failures', colors.cyan)
    log('\n✓ All demos completed successfully!', colors.green)
    
  } catch (error) {
    log('\n✗ Demo failed with error:', colors.red)
    console.error(error)
    process.exit(1)
  }
}

// Run the demo
main()
