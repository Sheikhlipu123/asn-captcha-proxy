# API Documentation

The ASN CAPTCHA Proxy provides several HTTP endpoints for monitoring, management, and integration.

## Base URL

All API endpoints are relative to your proxy server:
- Development: `http://localhost:3000`
- Production: `http://your-domain.com`

## Health and Status Endpoints

### GET /health

Returns the current health status of the proxy server.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "components": {
    "asn_manager": "healthy",
    "ip_resolver": "healthy",
    "captcha_manager": "healthy",
    "apache_upstream": "healthy"
  },
  "cache_stats": {
    "asn_cache_size": 1250,
    "ip_cache_size": 890,
    "captcha_cache_size": 45
  }
}
```

**Status Codes:**
- `200` - All systems healthy
- `503` - One or more components unhealthy

### GET /stats

Returns detailed statistics about proxy operations.

**Response:**
```json
{
  "requests": {
    "total": 15420,
    "allowed": 14890,
    "blocked": 530,
    "captcha_challenges": 245,
    "captcha_solved": 198
  },
  "asn_stats": {
    "unique_asns_seen": 1250,
    "blocked_asns": 89,
    "top_blocked_asns": [
      {"asn": 13335, "count": 45},
      {"asn": 16509, "count": 32}
    ]
  },
  "performance": {
    "avg_response_time": 12.5,
    "cache_hit_rate": 0.85,
    "memory_usage": "94.2MB"
  },
  "last_updated": "2024-01-15T10:30:00.000Z"
}
```

## CAPTCHA Endpoints

### GET /captcha

Generates a new CAPTCHA challenge.

**Query Parameters:**
- `difficulty` (optional): `easy`, `medium`, `hard`
- `format` (optional): `html`, `json`

**Response (HTML format):**
Returns complete CAPTCHA challenge page.

**Response (JSON format):**
```json
{
  "challenge_id": "cap_1234567890abcdef",
  "question": "What is 15 + 7?",
  "expires_at": "2024-01-15T10:35:00.000Z",
  "image_url": "/captcha/image/cap_1234567890abcdef"
}
```

### POST /captcha/verify

Verifies a CAPTCHA solution.

**Request Body:**
```json
{
  "challenge_id": "cap_1234567890abcdef",
  "answer": "22"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "CAPTCHA verified successfully",
  "verification_token": "ver_abcdef1234567890",
  "expires_at": "2024-01-15T12:30:00.000Z"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Incorrect answer",
  "retry_allowed": true
}
```

**Status Codes:**
- `200` - Verification successful
- `400` - Invalid request or incorrect answer
- `404` - Challenge not found or expired
- `429` - Too many attempts

### GET /captcha/image/:challenge_id

Returns the CAPTCHA image for a specific challenge.

**Response:**
- Content-Type: `image/png`
- Binary image data

## Management Endpoints

### POST /admin/refresh-asn

Manually refresh ASN blocklists from configured sources.

**Headers:**
- `Authorization: Bearer <admin_token>` (if authentication enabled)

**Response:**
```json
{
  "success": true,
  "message": "ASN lists refreshed successfully",
  "sources_updated": 3,
  "total_asns": 1250,
  "new_asns": 15,
  "removed_asns": 3
}
```

### GET /admin/config

Returns current configuration (sensitive values masked).

**Headers:**
- `Authorization: Bearer <admin_token>` (if authentication enabled)

**Response:**
```json
{
  "server": {
    "port": 80,
    "host": "0.0.0.0"
  },
  "asn": {
    "sources": [
      {
        "url": "https://raw.githubusercontent.com/O-X-L/risk-db/main/asn.json",
        "format": "json",
        "last_updated": "2024-01-15T09:00:00.000Z",
        "status": "active"
      }
    ],
    "cache_ttl": 600,
    "total_blocked_asns": 1250
  }
}
```

### POST /admin/whitelist-ip

Temporarily whitelist an IP address.

**Headers:**
- `Authorization: Bearer <admin_token>` (if authentication enabled)

**Request Body:**
```json
{
  "ip": "192.168.1.100",
  "duration": 3600,
  "reason": "Emergency access for admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IP whitelisted successfully",
  "expires_at": "2024-01-15T11:30:00.000Z"
}
```

## IP Resolution Endpoints

### GET /resolve/:ip

Resolve an IP address to ASN information.

**Parameters:**
- `ip` - IPv4 or IPv6 address

**Response:**
```json
{
  "ip": "8.8.8.8",
  "asn": 15169,
  "organization": "Google LLC",
  "country": "US",
  "is_blocked": false,
  "source": "maxmind",
  "cached": true,
  "resolved_at": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200` - Successfully resolved
- `400` - Invalid IP address format
- `404` - IP not found in database
- `500` - Resolution service unavailable

## WebSocket API

### /ws/stats

Real-time statistics stream via WebSocket.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/stats');

ws.onmessage = function(event) {
  const stats = JSON.parse(event.data);
  console.log('Real-time stats:', stats);
};
```

**Message Format:**
```json
{
  "type": "stats_update",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "requests_per_second": 25.4,
    "active_challenges": 12,
    "blocked_requests": 3,
    "cache_hit_rate": 0.87
  }
}
```

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request parameters are invalid",
    "details": "IP address format is not valid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Common Error Codes:**
- `INVALID_REQUEST` - Malformed request
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `SERVICE_UNAVAILABLE` - Upstream service down
- `INTERNAL_ERROR` - Server error

## Rate Limiting

API endpoints are rate limited:
- `/health`: 60 requests/minute
- `/stats`: 30 requests/minute
- `/captcha/*`: 10 requests/minute per IP
- `/admin/*`: 100 requests/hour (authenticated)
- `/resolve/*`: 120 requests/minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642248600
```

## Authentication

Admin endpoints require authentication when enabled in configuration:

```yaml
admin:
  enabled: true
  auth_token: "your-secure-admin-token"
```

Include the token in requests:
```bash
curl -H "Authorization: Bearer your-secure-admin-token"      http://localhost/admin/config
```

## SDK Examples

### Node.js

```javascript
const axios = require('axios');

class ASNProxyClient {
  constructor(baseURL) {
    this.client = axios.create({ baseURL });
  }
  
  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }
  
  async resolveIP(ip) {
    const response = await this.client.get(`/resolve/${ip}`);
    return response.data;
  }
  
  async verifyCaptcha(challengeId, answer) {
    const response = await this.client.post('/captcha/verify', {
      challenge_id: challengeId,
      answer: answer
    });
    return response.data;
  }
}

// Usage
const client = new ASNProxyClient('http://localhost:3000');
const health = await client.getHealth();
console.log('Proxy status:', health.status);
```

### Python

```python
import requests

class ASNProxyClient:
    def __init__(self, base_url):
        self.base_url = base_url
    
    def get_health(self):
        response = requests.get(f"{self.base_url}/health")
        return response.json()
    
    def resolve_ip(self, ip):
        response = requests.get(f"{self.base_url}/resolve/{ip}")
        return response.json()
    
    def verify_captcha(self, challenge_id, answer):
        response = requests.post(f"{self.base_url}/captcha/verify", 
                               json={"challenge_id": challenge_id, "answer": answer})
        return response.json()

# Usage
client = ASNProxyClient("http://localhost:3000")
health = client.get_health()
print(f"Proxy status: {health['status']}")
```

## Integration Examples

### Nginx Integration

Use the proxy with Nginx as a load balancer:

```nginx
upstream asn_proxy {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://asn_proxy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Monitoring Integration

Integrate with Prometheus for monitoring:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'asn-proxy'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
