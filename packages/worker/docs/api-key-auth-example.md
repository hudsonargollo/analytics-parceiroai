# API Key Authentication - Usage Example

## Quick Start

This example shows how to protect API endpoints with API key authentication.

### 1. Set Up Environment

First, generate and set your API keys:

```bash
# Generate a secure API key
openssl rand -hex 32

# Set the secret (for development)
wrangler secret put VALID_API_KEYS --env development
# Enter: your-generated-key-here

# For multiple keys, use comma-separated values
wrangler secret put VALID_API_KEYS --env development
# Enter: key-1,key-2,key-3
```

### 2. Protect an Endpoint

```typescript
import { Hono } from 'hono';
import { authenticateApiKey } from './lib/api-key-auth';
import type { Env } from './index';

const app = new Hono<{ Bindings: Env }>();

// Public endpoint (no authentication)
app.get('/', (c) => {
  return c.json({ status: 'ok' });
});

// Protected endpoint (requires API key)
app.get('/api/metrics/recovery-rate', authenticateApiKey, async (c) => {
  // This code only runs if authentication succeeds
  const { branch, date_range } = c.req.query();
  
  // Your business logic here
  const data = {
    branch: branch || 'all',
    recovery_rate: 75.5,
    total_attempts: 1000,
  };
  
  return c.json(data);
});

// Another protected endpoint
app.get('/api/metrics/dso', authenticateApiKey, async (c) => {
  const data = {
    average_dso: 12.5,
    median_dso: 10,
  };
  
  return c.json(data);
});

export default app;
```

### 3. Make Authenticated Requests

#### Using curl

```bash
# Success - with valid API key
curl -H "X-API-Key: your-api-key-here" \
  http://localhost:8787/api/metrics/recovery-rate

# Response:
# {
#   "branch": "all",
#   "recovery_rate": 75.5,
#   "total_attempts": 1000
# }

# Failure - without API key
curl http://localhost:8787/api/metrics/recovery-rate

# Response (401):
# {
#   "error": "Unauthorized",
#   "message": "Missing API key. Please provide X-API-Key header."
# }

# Failure - with invalid API key
curl -H "X-API-Key: wrong-key" \
  http://localhost:8787/api/metrics/recovery-rate

# Response (401):
# {
#   "error": "Unauthorized",
#   "message": "Invalid API key"
# }
```

#### Using JavaScript/TypeScript

```typescript
// Create an API client
class AnalyticsClient {
  constructor(private apiKey: string, private baseUrl: string) {}
  
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
  }
  
  async getRecoveryRate(branch?: string, dateRange?: string) {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (dateRange) params.set('date_range', dateRange);
    
    return this.request(`/api/metrics/recovery-rate?${params}`);
  }
  
  async getDSO(dateRange?: string) {
    const params = new URLSearchParams();
    if (dateRange) params.set('date_range', dateRange);
    
    return this.request(`/api/metrics/dso?${params}`);
  }
}

// Usage
const client = new AnalyticsClient(
  'your-api-key-here',
  'https://api.example.com'
);

try {
  const recoveryRate = await client.getRecoveryRate('overdue', '30d');
  console.log('Recovery rate:', recoveryRate);
} catch (error) {
  console.error('API error:', error.message);
}
```

#### Using React

```typescript
import { useState, useEffect } from 'react';

function useRecoveryMetrics(apiKey: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/metrics/recovery-rate', {
          headers: {
            'X-API-Key': apiKey,
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [apiKey]);
  
  return { data, loading, error };
}

// Component usage
function Dashboard() {
  const apiKey = process.env.REACT_APP_API_KEY;
  const { data, loading, error } = useRecoveryMetrics(apiKey);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>Recovery Rate: {data.recovery_rate}%</h1>
      <p>Total Attempts: {data.total_attempts}</p>
    </div>
  );
}
```

## Testing Locally

### 1. Start the Development Server

```bash
cd packages/worker
wrangler dev
```

### 2. Test with curl

```bash
# Set your test API key
export TEST_API_KEY="test-key-123"

# Test the endpoint
curl -H "X-API-Key: $TEST_API_KEY" \
  http://localhost:8787/api/metrics/recovery-rate
```

### 3. Run Manual Tests

```bash
npx tsx tests/manual-test-api-key-auth.ts
```

## Security Best Practices

### 1. Never Commit API Keys

```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".dev.vars" >> .gitignore
```

### 2. Use Environment Variables

```bash
# Create .dev.vars for local development
cat > .dev.vars << EOF
VALID_API_KEYS=dev-key-1,dev-key-2
WEBHOOK_SECRET=dev-webhook-secret
EOF
```

### 3. Rotate Keys Regularly

```bash
# Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Update secret
wrangler secret put VALID_API_KEYS --env production
# Enter: old-key-1,old-key-2,$NEW_KEY

# After clients migrate, remove old keys
wrangler secret put VALID_API_KEYS --env production
# Enter: $NEW_KEY
```

### 4. Monitor Authentication Failures

Check logs for suspicious activity:

```bash
wrangler tail --env production | grep "authentication failed"
```

## Troubleshooting

### Issue: "Missing API key" error

**Cause**: The `X-API-Key` header is not being sent.

**Solution**: Ensure the header is included in all requests:
```bash
curl -H "X-API-Key: your-key" http://localhost:8787/api/test
```

### Issue: "Invalid API key" error

**Cause**: The API key doesn't match any valid keys.

**Solutions**:
1. Check if the key is correct (case-sensitive)
2. Verify the key is set in secrets: `wrangler secret list`
3. Check for whitespace in the key

### Issue: API key works locally but not in production

**Cause**: Different secrets for different environments.

**Solution**: Set secrets for each environment:
```bash
wrangler secret put VALID_API_KEYS --env development
wrangler secret put VALID_API_KEYS --env staging
wrangler secret put VALID_API_KEYS --env production
```

## Next Steps

- Implement rate limiting (Task 8.2)
- Add API key usage tracking
- Set up monitoring and alerting
- Create API documentation for consumers
