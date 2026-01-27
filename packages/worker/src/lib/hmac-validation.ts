/**
 * HMAC Signature Validation Module
 * 
 * Provides secure webhook signature validation using HMAC-SHA256.
 * Implements constant-time comparison to prevent timing attacks.
 */

/**
 * Converts an ArrayBuffer to a hexadecimal string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Performs constant-time comparison of two strings to prevent timing attacks.
 * 
 * This is critical for security: a regular string comparison (===) would return
 * as soon as it finds a mismatch, allowing attackers to use timing information
 * to guess the signature byte by byte.
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  // If lengths differ, still compare to prevent timing leaks
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR will be 0 if characters match, non-zero otherwise
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  // result will be 0 only if all characters matched
  return result === 0;
}

/**
 * Computes HMAC-SHA256 signature for a given payload and secret.
 * 
 * @param payload - The request body as a string
 * @param secret - The shared secret key
 * @returns Promise resolving to the hex-encoded HMAC signature
 */
export async function computeHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  // Convert secret to a CryptoKey for HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Compute HMAC signature
  const payloadData = encoder.encode(payload);
  const signature = await crypto.subtle.sign('HMAC', key, payloadData);
  
  return bufferToHex(signature);
}

/**
 * Validates an HMAC signature from a webhook request.
 * 
 * @param signature - The signature from the request header (can be null/undefined)
 * @param payload - The request body as a string
 * @param secret - The shared secret key
 * @returns Promise resolving to true if signature is valid, false otherwise
 * 
 * @example
 * ```typescript
 * const isValid = await validateHmacSignature(
 *   request.headers.get('X-Webhook-Signature'),
 *   await request.text(),
 *   env.WEBHOOK_SECRET
 * );
 * 
 * if (!isValid) {
 *   return new Response('Invalid signature', { status: 401 });
 * }
 * ```
 */
export async function validateHmacSignature(
  signature: string | null | undefined,
  payload: string,
  secret: string
): Promise<boolean> {
  // Handle missing signature
  if (!signature) {
    return false;
  }
  
  // Handle malformed signature (not a valid hex string)
  if (!/^[0-9a-f]+$/i.test(signature)) {
    return false;
  }
  
  try {
    // Compute expected signature
    const expectedSignature = await computeHmacSignature(payload, secret);
    
    // Use constant-time comparison to prevent timing attacks
    return constantTimeCompare(signature.toLowerCase(), expectedSignature.toLowerCase());
  } catch (error) {
    // If any error occurs during computation, treat as invalid
    return false;
  }
}
