/**
 * Unit tests for retry wrapper with exponential backoff
 * 
 * Tests the retry logic, exponential backoff delays, and error handling
 */

import { describe, it, expect, vi } from 'vitest'
import { processWithRetry, retryDatabaseOperation, retryApiCall } from '../src/lib/retry'

describe('processWithRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    
    const result = await processWithRetry(fn)
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry up to 3 times on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockRejectedValueOnce(new Error('Attempt 3 failed'))
    
    await expect(processWithRetry(fn)).rejects.toThrow('Attempt 3 failed')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should succeed on second attempt after one failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockResolvedValueOnce('success')
    
    const result = await processWithRetry(fn)
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should succeed on third attempt after two failures', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockRejectedValueOnce(new Error('Second attempt failed'))
      .mockResolvedValueOnce('success')
    
    const result = await processWithRetry(fn)
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should use exponential backoff delays (1s, 2s, 4s)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockRejectedValueOnce(new Error('Attempt 3 failed'))
    
    const startTime = Date.now()
    
    await expect(processWithRetry(fn, { baseDelayMs: 100 })).rejects.toThrow('Attempt 3 failed')
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Total delay should be approximately 100ms + 200ms = 300ms
    // Allow some tolerance for execution time
    expect(totalTime).toBeGreaterThanOrEqual(300)
    expect(totalTime).toBeLessThan(500)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should call onRetry callback on each retry attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success')
    
    const onRetry = vi.fn()
    
    await processWithRetry(fn, { onRetry, baseDelayMs: 10 })
    
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error))
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error))
  })

  it('should not call onRetry on successful first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const onRetry = vi.fn()
    
    await processWithRetry(fn, { onRetry })
    
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('should respect custom maxRetries option', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockRejectedValueOnce(new Error('Attempt 3 failed'))
      .mockRejectedValueOnce(new Error('Attempt 4 failed'))
      .mockRejectedValueOnce(new Error('Attempt 5 failed'))
    
    await expect(processWithRetry(fn, { maxRetries: 5, baseDelayMs: 10 })).rejects.toThrow('Attempt 5 failed')
    expect(fn).toHaveBeenCalledTimes(5)
  })

  it('should respect custom baseDelayMs option', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success')
    
    const startTime = Date.now()
    const result = await processWithRetry(fn, { baseDelayMs: 50 })
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // Total delay should be approximately 50ms + 100ms = 150ms
    expect(totalTime).toBeGreaterThanOrEqual(150)
    expect(totalTime).toBeLessThan(250)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should handle non-Error exceptions', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce('string error')
      .mockRejectedValueOnce({ message: 'object error' })
      .mockRejectedValueOnce(new Error('real error'))
    
    await expect(processWithRetry(fn, { baseDelayMs: 10 })).rejects.toThrow('real error')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should preserve the original error message', async () => {
    const originalError = new Error('Database connection timeout')
    const fn = vi.fn().mockRejectedValue(originalError)
    
    await expect(processWithRetry(fn, { baseDelayMs: 10 })).rejects.toThrow('Database connection timeout')
  })
})

describe('retryDatabaseOperation', () => {
  it('should retry database operations with default settings', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce({ id: 1, data: 'test' })
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const result = await retryDatabaseOperation(fn)
    
    expect(result).toEqual({ id: 1, data: 'test' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Database operation failed (attempt 1/3):',
      'Connection failed'
    )
    
    consoleWarnSpy.mockRestore()
  })

  it('should log warnings on retry attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockResolvedValueOnce('success')
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    await retryDatabaseOperation(fn)
    
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      1,
      'Database operation failed (attempt 1/3):',
      'Timeout'
    )
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      2,
      'Database operation failed (attempt 2/3):',
      'Connection reset'
    )
    
    consoleWarnSpy.mockRestore()
  })
})

describe('retryApiCall', () => {
  it('should retry API calls with default settings', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ status: 200, data: 'response' })
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const result = await retryApiCall(fn)
    
    expect(result).toEqual({ status: 200, data: 'response' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'API call failed (attempt 1/3):',
      'Network error'
    )
    
    consoleWarnSpy.mockRestore()
  })

  it('should log warnings on retry attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockRejectedValueOnce(new Error('504 Gateway Timeout'))
      .mockResolvedValueOnce({ status: 200 })
    
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    await retryApiCall(fn)
    
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      1,
      'API call failed (attempt 1/3):',
      '503 Service Unavailable'
    )
    expect(consoleWarnSpy).toHaveBeenNthCalledWith(
      2,
      'API call failed (attempt 2/3):',
      '504 Gateway Timeout'
    )
    
    consoleWarnSpy.mockRestore()
  })
})

describe('Edge cases', () => {
  it('should handle maxRetries of 1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Failed'))
    
    await expect(processWithRetry(fn, { maxRetries: 1 })).rejects.toThrow('Failed')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle functions that return undefined', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    
    const result = await processWithRetry(fn)
    
    expect(result).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle functions that return null', async () => {
    const fn = vi.fn().mockResolvedValue(null)
    
    const result = await processWithRetry(fn)
    
    expect(result).toBeNull()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should handle functions that return complex objects', async () => {
    const complexObject = {
      nested: { data: [1, 2, 3] },
      timestamp: new Date(),
      metadata: { key: 'value' }
    }
    const fn = vi.fn().mockResolvedValue(complexObject)
    
    const result = await processWithRetry(fn)
    
    expect(result).toEqual(complexObject)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
