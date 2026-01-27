import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';

interface TestEnv {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  N8N_WEBHOOK_URL: string;
  WEBHOOK_SECRET: string;
  ZUCKZAPGO_SECRET: string;
  VALID_API_KEYS: string;
  CHATWOOT_TOKEN: string;
  [key: string]: any;  // Index signature for Hono compatibility
}

describe('Customer Billing Endpoint', () => {
  const CHATWOOT_TOKEN = 'test-chatwoot-token';
  let env: TestEnv;
  
  beforeEach(async () => {
    // Create in-memory D1 database for testing
    const db = await import('@miniflare/d1');
    const d1Database = new db.D1Database(new db.D1DatabaseAPI(await db.getD1DatabaseDirectoryStoragePath(':memory:')));
    
    // Create tables
    await d1Database.exec(`
      CREATE TABLE payment_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL,
        recovery_branch TEXT NOT NULL,
        due_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE INDEX idx_payment_customer ON payment_events(customer_id);
      CREATE INDEX idx_payment_status ON payment_events(status);
    `);
    
    // Create mock KV namespace
    const { KVNamespace } = await import('@miniflare/kv');
    const kv = new KVNamespace();
    
    env = {
      DB: d1Database as unknown as D1Database,
      KV: kv as unknown as KVNamespace,
      ENVIRONMENT: 'test',
      N8N_WEBHOOK_URL: 'https://test.n8n.io/webhook',
      WEBHOOK_SECRET: 'test-secret',
      ZUCKZAPGO_SECRET: 'test-zuckzapgo-secret',
      VALID_API_KEYS: 'test-key-1,test-key-2',
      CHATWOOT_TOKEN,
    };
  });
  
  it('should return customer billing history with outstanding invoices', async () => {
    // Insert test data - outstanding invoices
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_1',
      'cust_123',
      'inv_1',
      10000,
      'pix',
      'pending',
      'due-today',
      tomorrow.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_2',
      'cust_123',
      'inv_2',
      15000,
      'boleto',
      'pending',
      'overdue',
      yesterday.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    // Insert paid invoice for payment history
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_3',
      'cust_123',
      'inv_3',
      20000,
      'pix',
      'confirmed',
      '3-day-notice',
      yesterday.toISOString(),
      now.toISOString(),
      yesterday.toISOString()
    ).run();
    
    // Make request
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Verify response structure
    expect(data.customer_id).toBe('cust_123');
    expect(data.outstanding_invoices).toHaveLength(2);
    expect(data.total_outstanding).toBe(25000);
    expect(data.payment_history_summary).toBeDefined();
    expect(data.payment_history_summary.total_paid).toBe(1);
    
    // Verify outstanding invoices
    const pixInvoice = data.outstanding_invoices.find((inv: any) => inv.payment_method === 'pix');
    expect(pixInvoice).toBeDefined();
    expect(pixInvoice.invoice_id).toBe('inv_1');
    expect(pixInvoice.amount).toBe(10000);
    expect(pixInvoice.status).toBe('pending');
    expect(pixInvoice.pix_code).toBeDefined();
    expect(pixInvoice.boleto_url).toBeUndefined();
    
    const boletoInvoice = data.outstanding_invoices.find((inv: any) => inv.payment_method === 'boleto');
    expect(boletoInvoice).toBeDefined();
    expect(boletoInvoice.invoice_id).toBe('inv_2');
    expect(boletoInvoice.amount).toBe(15000);
    expect(boletoInvoice.status).toBe('overdue');
    expect(boletoInvoice.boleto_url).toBeDefined();
    expect(boletoInvoice.pix_code).toBeUndefined();
    expect(boletoInvoice.days_overdue).toBeGreaterThanOrEqual(1);
  });
  
  it('should return empty outstanding invoices for customer with no pending payments', async () => {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_999/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data.customer_id).toBe('cust_999');
    expect(data.outstanding_invoices).toHaveLength(0);
    expect(data.total_outstanding).toBe(0);
    expect(data.payment_history_summary.total_paid).toBe(0);
  });
  
  it('should reject request without authentication', async () => {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/billing');
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
  
  it('should reject request with invalid token', async () => {
    const req = new Request('http://localhost/api/chatwoot/customer/cust_123/billing', {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });
    
    const res = await app.fetch(req, env);
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });
  
  it('should include pix_code only for Pix payment method', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_pix',
      'cust_456',
      'inv_pix',
      10000,
      'pix',
      'pending',
      'due-today',
      tomorrow.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_456/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    const data = await res.json();
    
    expect(data.outstanding_invoices).toHaveLength(1);
    expect(data.outstanding_invoices[0].pix_code).toBeDefined();
    expect(data.outstanding_invoices[0].boleto_url).toBeUndefined();
  });
  
  it('should include boleto_url only for Boleto payment method', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_boleto',
      'cust_789',
      'inv_boleto',
      15000,
      'boleto',
      'pending',
      'due-today',
      tomorrow.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_789/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    const data = await res.json();
    
    expect(data.outstanding_invoices).toHaveLength(1);
    expect(data.outstanding_invoices[0].boleto_url).toBeDefined();
    expect(data.outstanding_invoices[0].pix_code).toBeUndefined();
  });
  
  it('should calculate days_overdue correctly for overdue invoices', async () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_overdue',
      'cust_overdue',
      'inv_overdue',
      10000,
      'pix',
      'pending',
      'overdue',
      threeDaysAgo.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_overdue/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    const data = await res.json();
    
    expect(data.outstanding_invoices).toHaveLength(1);
    expect(data.outstanding_invoices[0].status).toBe('overdue');
    expect(data.outstanding_invoices[0].days_overdue).toBeGreaterThanOrEqual(3);
  });
  
  it('should not include days_overdue for pending invoices', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    await env.DB.prepare(`
      INSERT INTO payment_events 
      (event_id, customer_id, invoice_id, amount, payment_method, status, recovery_branch, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      'evt_pending',
      'cust_pending',
      'inv_pending',
      10000,
      'pix',
      'pending',
      'due-today',
      tomorrow.toISOString(),
      now.toISOString(),
      now.toISOString()
    ).run();
    
    const req = new Request('http://localhost/api/chatwoot/customer/cust_pending/billing', {
      headers: {
        'Authorization': `Bearer ${CHATWOOT_TOKEN}`,
      },
    });
    
    const res = await app.fetch(req, env);
    const data = await res.json();
    
    expect(data.outstanding_invoices).toHaveLength(1);
    expect(data.outstanding_invoices[0].status).toBe('pending');
    expect(data.outstanding_invoices[0].days_overdue).toBeUndefined();
  });
});
