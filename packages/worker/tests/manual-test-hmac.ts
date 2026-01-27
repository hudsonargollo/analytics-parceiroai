/**
 * Manual test script for HMAC validation
 * Run with: npx tsx tests/manual-test-hmac.ts
 */

import { computeHmacSignature, validateHmacSignature } from '../src/lib/hmac-validation';

async function runTests() {
  console.log('🧪 Testing HMAC Signature Validation\n');
  
  const testSecret = 'test-secret-key-12345';
  const testPayload = '{"event":"payment","amount":1000}';
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Compute signature
  console.log('Test 1: Compute HMAC-SHA256 signature');
  try {
    const signature = await computeHmacSignature(testPayload, testSecret);
    if (signature && signature.length === 64 && /^[0-9a-f]+$/.test(signature)) {
      console.log('✅ PASS - Signature is valid hex string (64 chars)');
      console.log(`   Signature: ${signature.substring(0, 32)}...`);
      passed++;
    } else {
      console.log('❌ FAIL - Invalid signature format');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error computing signature:', error);
    failed++;
  }
  
  // Test 2: Consistent signatures
  console.log('\nTest 2: Consistent signatures for same input');
  try {
    const sig1 = await computeHmacSignature(testPayload, testSecret);
    const sig2 = await computeHmacSignature(testPayload, testSecret);
    if (sig1 === sig2) {
      console.log('✅ PASS - Signatures are consistent');
      passed++;
    } else {
      console.log('❌ FAIL - Signatures differ');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 3: Validate correct signature
  console.log('\nTest 3: Validate correct signature');
  try {
    const signature = await computeHmacSignature(testPayload, testSecret);
    const isValid = await validateHmacSignature(signature, testPayload, testSecret);
    if (isValid) {
      console.log('✅ PASS - Valid signature accepted');
      passed++;
    } else {
      console.log('❌ FAIL - Valid signature rejected');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 4: Reject incorrect signature
  console.log('\nTest 4: Reject incorrect signature');
  try {
    const wrongSignature = 'a'.repeat(64);
    const isValid = await validateHmacSignature(wrongSignature, testPayload, testSecret);
    if (!isValid) {
      console.log('✅ PASS - Invalid signature rejected');
      passed++;
    } else {
      console.log('❌ FAIL - Invalid signature accepted');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 5: Handle missing signature
  console.log('\nTest 5: Handle missing signature (null)');
  try {
    const isValid = await validateHmacSignature(null, testPayload, testSecret);
    if (!isValid) {
      console.log('✅ PASS - Null signature rejected');
      passed++;
    } else {
      console.log('❌ FAIL - Null signature accepted');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 6: Handle malformed signature
  console.log('\nTest 6: Handle malformed signature (not hex)');
  try {
    const isValid = await validateHmacSignature('not-hex-string', testPayload, testSecret);
    if (!isValid) {
      console.log('✅ PASS - Malformed signature rejected');
      passed++;
    } else {
      console.log('❌ FAIL - Malformed signature accepted');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 7: Case insensitive validation
  console.log('\nTest 7: Case insensitive validation');
  try {
    const signature = await computeHmacSignature(testPayload, testSecret);
    const uppercaseSignature = signature.toUpperCase();
    const isValid = await validateHmacSignature(uppercaseSignature, testPayload, testSecret);
    if (isValid) {
      console.log('✅ PASS - Uppercase signature accepted');
      passed++;
    } else {
      console.log('❌ FAIL - Uppercase signature rejected');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 8: Different payloads produce different signatures
  console.log('\nTest 8: Different payloads produce different signatures');
  try {
    const payload1 = '{"amount":1000}';
    const payload2 = '{"amount":2000}';
    const sig1 = await computeHmacSignature(payload1, testSecret);
    const sig2 = await computeHmacSignature(payload2, testSecret);
    if (sig1 !== sig2) {
      console.log('✅ PASS - Different payloads produce different signatures');
      passed++;
    } else {
      console.log('❌ FAIL - Same signature for different payloads');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 9: Different secrets produce different signatures
  console.log('\nTest 9: Different secrets produce different signatures');
  try {
    const secret1 = 'secret-1';
    const secret2 = 'secret-2';
    const sig1 = await computeHmacSignature(testPayload, secret1);
    const sig2 = await computeHmacSignature(testPayload, secret2);
    if (sig1 !== sig2) {
      console.log('✅ PASS - Different secrets produce different signatures');
      passed++;
    } else {
      console.log('❌ FAIL - Same signature for different secrets');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 10: Reject signature with wrong secret
  console.log('\nTest 10: Reject signature computed with wrong secret');
  try {
    const signature = await computeHmacSignature(testPayload, 'wrong-secret');
    const isValid = await validateHmacSignature(signature, testPayload, testSecret);
    if (!isValid) {
      console.log('✅ PASS - Signature with wrong secret rejected');
      passed++;
    } else {
      console.log('❌ FAIL - Signature with wrong secret accepted');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 11: Handle unicode characters
  console.log('\nTest 11: Handle unicode characters in payload');
  try {
    const unicodePayload = '{"message":"Hello 世界 🌍"}';
    const signature = await computeHmacSignature(unicodePayload, testSecret);
    const isValid = await validateHmacSignature(signature, unicodePayload, testSecret);
    if (isValid) {
      console.log('✅ PASS - Unicode payload handled correctly');
      passed++;
    } else {
      console.log('❌ FAIL - Unicode payload validation failed');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Test 12: Reject signature that differs by one character
  console.log('\nTest 12: Reject signature that differs by one character');
  try {
    const signature = await computeHmacSignature(testPayload, testSecret);
    const tamperedSignature = signature.slice(0, 32) + (signature[32] === 'a' ? 'b' : 'a') + signature.slice(33);
    const isValid = await validateHmacSignature(tamperedSignature, testPayload, testSecret);
    if (!isValid) {
      console.log('✅ PASS - Tampered signature rejected');
      passed++;
    } else {
      console.log('❌ FAIL - Tampered signature accepted');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL - Error:', error);
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
