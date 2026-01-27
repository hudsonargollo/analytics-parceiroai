/**
 * Manual test script for resend-boleto endpoint
 * 
 * This script tests the POST /api/chatwoot/customer/:customer_id/resend-boleto endpoint
 * by creating a mock n8n server and making requests to verify the implementation.
 * 
 * Run with: bun run tests/manual-test-resend-boleto.ts
 */

import { Hono } from 'hono';
import { authenticateChatwootToken } from '../src/lib/chatwoot-auth';

interface TestEnv {
  N8N_WEBHOOK_URL: string;
  CHATWOOT_TOKEN: string;
}

const CHATWOOT_TOKEN = 'test-chatwoot-token-123';

// Create test app with the resend-boleto endpoint
const app = new Hono<{ Bindings: TestEnv }>();

app.post('/api/chatwoot/customer/:customer_id/resend-boleto', authenticateChatwootToken, async (c) => {
  try {
    // Extract customer_id from URL parameter
    const customerId = c.req.param('customer_id');
    
    if (!customerId) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing customer_id parameter'
      }, 400);
    }
    
    // Parse request body
    const body = await c.req.json();
    const { invoice_id } = body;
    
    if (!invoice_id) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing invoice_id in request body'
      }, 400);
    }
    
    // Trigger n8n webhook with action, customer_id, and invoice_id
    const n8nWebhookUrl = c.env.N8N_WEBHOOK_URL;
    
    const n8nPayload = {
      action: 'resend_boleto',
      customer_id: customerId,
      invoice_id: invoice_id,
      timestamp: new Date().toISOString(),
    };
    
    // Make request to n8n webhook
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload),
    });
    
    // Check if n8n webhook call was successful
    if (!n8nResponse.ok) {
      console.error('n8n webhook call failed', {
        timestamp: new Date().toISOString(),
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        customer_id: customerId,
        invoice_id: invoice_id,
      });
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Failed to trigger Boleto resend workflow'
      }, 500);
    }
    
    // Log successful trigger
    console.log('Boleto resend triggered successfully', {
      timestamp: new Date().toISOString(),
      customer_id: customerId,
      invoice_id: invoice_id,
    });
    
    // Return success status
    return c.json({
      status: 'triggered',
      message: 'Boleto resend workflow triggered successfully',
      customer_id: customerId,
      invoice_id: invoice_id,
    });
  } catch (error) {
    // Log error and return 500
    console.error('Boleto resend request failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      customer_id: c.req.param('customer_id'),
    });
    
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to process Boleto resend request'
    }, 500);
  }
});

// Test runner
async function runTests() {
  console.log('🧪 Starting manual tests for resend-boleto endpoint\n');
  
  let passedTests = 0;
  let failedTests = 0;
  
  // Test 1: Successful resend with valid authentication
  console.log('Test 1: Successful resend with valid authentication');
  try {
    // Create mock n8n server
    let n8nRequestReceived: any = null;
    
    const mockN8nServer = Bun.serve({
      port: 0,
      fetch(req) {
        return req.json().then(body => {
          n8nRequestReceived = body;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      },
    });
    
    const mockN8nUrl = `http://localhost:${mockN8nServer.port}/webhook`;
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/resend-boleto', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_id: 'inv_456',
      }),
    });
    
    const res = await app.fetch(req, {
      N8N_WEBHOOK_URL: mockN8nUrl,
      CHATWOOT_TOKEN,
    });
    
    const data = await res.json();
    
    mockN8nServer.stop();
    
    if (res.status === 200 && 
        data.status === 'triggered' && 
        data.customer_id === 'cust_123' &&
        data.invoice_id === 'inv_456' &&
        n8nRequestReceived?.action === 'resend_boleto') {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED');
      console.log('Response:', data);
      console.log('n8n received:', n8nRequestReceived);
      console.log();
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Test 2: Reject request without authentication
  console.log('Test 2: Reject request without authentication');
  try {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/resend-boleto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_id: 'inv_456',
      }),
    });
    
    const res = await app.fetch(req, {
      N8N_WEBHOOK_URL: 'https://test.n8n.io/webhook',
      CHATWOOT_TOKEN,
    });
    
    const data = await res.json();
    
    if (res.status === 401 && data.error === 'Unauthorized') {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED');
      console.log('Response:', data);
      console.log();
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Test 3: Reject request with invalid token
  console.log('Test 3: Reject request with invalid token');
  try {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/resend-boleto', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_id: 'inv_456',
      }),
    });
    
    const res = await app.fetch(req, {
      N8N_WEBHOOK_URL: 'https://test.n8n.io/webhook',
      CHATWOOT_TOKEN,
    });
    
    const data = await res.json();
    
    if (res.status === 401 && data.error === 'Unauthorized') {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED');
      console.log('Response:', data);
      console.log();
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Test 4: Return 400 if invoice_id is missing
  console.log('Test 4: Return 400 if invoice_id is missing');
  try {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/resend-boleto', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    const res = await app.fetch(req, {
      N8N_WEBHOOK_URL: 'https://test.n8n.io/webhook',
      CHATWOOT_TOKEN,
    });
    
    const data = await res.json();
    
    if (res.status === 400 && 
        data.error === 'Bad Request' && 
        data.message.includes('invoice_id')) {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED');
      console.log('Response:', data);
      console.log();
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Test 5: Return 500 if n8n webhook fails
  console.log('Test 5: Return 500 if n8n webhook fails');
  try {
    const mockN8nServer = Bun.serve({
      port: 0,
      fetch(req) {
        return new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    
    const mockN8nUrl = `http://localhost:${mockN8nServer.port}/webhook`;
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/resend-boleto', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice_id: 'inv_456',
      }),
    });
    
    const res = await app.fetch(req, {
      N8N_WEBHOOK_URL: mockN8nUrl,
      CHATWOOT_TOKEN,
    });
    
    const data = await res.json();
    
    mockN8nServer.stop();
    
    if (res.status === 500 && 
        data.error === 'Internal Server Error' &&
        data.message.includes('Failed to trigger Boleto resend workflow')) {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED');
      console.log('Response:', data);
      console.log();
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Test 6: Handle multiple customer IDs correctly
  console.log('Test 6: Handle multiple customer IDs correctly');
  try {
    const mockN8nServer = Bun.serve({
      port: 0,
      fetch(req) {
        return req.json().then(body => {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      },
    });
    
    const mockN8nUrl = `http://localhost:${mockN8nServer.port}/webhook`;
    
    const customerIds = ['cust_001', 'cust_002', 'cust_003'];
    let allPassed = true;
    
    for (const customerId of customerIds) {
      const req = new Request(`http://localhost/api/chatwoot/customer/${customerId}/resend-boleto`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: `inv_${customerId}`,
        }),
      });
      
      const res = await app.fetch(req, {
        N8N_WEBHOOK_URL: mockN8nUrl,
        CHATWOOT_TOKEN,
      });
      
      const data = await res.json();
      
      if (res.status !== 200 || 
          data.customer_id !== customerId || 
          data.invoice_id !== `inv_${customerId}`) {
        allPassed = false;
        console.log(`Failed for customer ${customerId}:`, data);
      }
    }
    
    mockN8nServer.stop();
    
    if (allPassed) {
      console.log('✅ PASSED\n');
      passedTests++;
    } else {
      console.log('❌ FAILED\n');
      failedTests++;
    }
  } catch (error) {
    console.log('❌ FAILED with error:', error);
    console.log();
    failedTests++;
  }
  
  // Summary
  console.log('═'.repeat(50));
  console.log(`Test Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('═'.repeat(50));
  
  if (failedTests === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
