import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authenticateChatwootToken } from '../src/lib/chatwoot-auth';

interface TestEnv {
  N8N_WEBHOOK_URL: string;
  CHATWOOT_TOKEN: string;
}

describe('POST /api/chatwoot/customer/:customer_id/resend-boleto', () => {
  const CHATWOOT_TOKEN = 'test-chatwoot-token-123';
  let app: Hono<{ Bindings: TestEnv }>;
  
  beforeEach(() => {
    app = new Hono<{ Bindings: TestEnv }>();
    
    // Define the resend-boleto endpoint
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
  });
  
  it('should trigger n8n webhook with correct payload', async () => {
    // Mock n8n webhook server
    let n8nRequestReceived: any = null;
    
    const mockN8nServer = Bun.serve({
      port: 0, // Random available port
      fetch(req) {
        n8nRequestReceived = {
          method: req.method,
          url: req.url,
          body: null,
        };
        
        // Parse body
        return req.json().then(body => {
          n8nRequestReceived.body = body;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      },
    });
    
    const mockN8nUrl = `http://localhost:${mockN8nServer.port}/webhook`;
    
    try {
      // Make request
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
      
      // Verify response
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        status: 'triggered',
        message: 'Boleto resend workflow triggered successfully',
        customer_id: 'cust_123',
        invoice_id: 'inv_456',
      });
      
      // Verify n8n webhook was called with correct payload
      expect(n8nRequestReceived).not.toBeNull();
      expect(n8nRequestReceived.method).toBe('POST');
      expect(n8nRequestReceived.body).toMatchObject({
        action: 'resend_boleto',
        customer_id: 'cust_123',
        invoice_id: 'inv_456',
      });
      expect(n8nRequestReceived.body.timestamp).toBeDefined();
    } finally {
      mockN8nServer.stop();
    }
  });
  
  it('should reject request without authentication', async () => {
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
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
  
  it('should reject request with invalid token', async () => {
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
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
  
  it('should return 400 if invoice_id is missing', async () => {
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
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Bad Request');
    expect(data.message).toContain('invoice_id');
  });
  
  it('should return 500 if n8n webhook fails', async () => {
    // Mock n8n webhook server that returns error
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
    
    try {
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
      
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal Server Error');
      expect(data.message).toContain('Failed to trigger Boleto resend workflow');
    } finally {
      mockN8nServer.stop();
    }
  });
  
  it('should handle multiple customer IDs correctly', async () => {
    const mockN8nServer = Bun.serve({
      port: 0,
      fetch(req) {
        return req.json().then(body => {
          return new Response(JSON.stringify({ success: true, received: body }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      },
    });
    
    const mockN8nUrl = `http://localhost:${mockN8nServer.port}/webhook`;
    
    try {
      // Test with different customer IDs
      const customerIds = ['cust_001', 'cust_002', 'cust_003'];
      
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
        
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.customer_id).toBe(customerId);
        expect(data.invoice_id).toBe(`inv_${customerId}`);
      }
    } finally {
      mockN8nServer.stop();
    }
  });
});
