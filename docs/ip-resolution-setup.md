# IP-to-ASN Resolution Setup

This guide explains how to set up IP-to-ASN resolution for the ASN Proxy Server.

## Overview

The IP resolver supports two methods for resolving IP addresses to ASN information:

1. **MaxMind GeoLite2-ASN Database** (recommended for production)
2. **Fallback API** (for development or when MaxMind is unavailable)

## MaxMind GeoLite2-ASN Database Setup

### Option 1: Automatic Setup (Recommended)

1. Sign up for a free MaxMind account: https://www.maxmind.com/en/geolite2/signup
2. Generate a license key in your account dashboard
3. Set the environment variable:
```bash
export MAXMIND_LICENSE_KEY="your_license_key_here"
```
4. Run the setup script:
```bash
node scripts/setup-maxmind.js
```

### Option 2: Manual Setup

1. Download GeoLite2-ASN database from MaxMind
2. Extract the `.mmdb` file
3. Place it at: `./data/GeoLite2-ASN.mmdb`

## Fallback API Configuration

Configure a fallback API in `config.yaml`:
```yaml
ip_resolution:
  fallback_api: "https://ipapi.co/{ip}/json/"
  # Alternative APIs:
  # fallback_api: "http://ip-api.com/json/{ip}"
  # fallback_api: "https://ipinfo.io/{ip}/json"
```

## Supported APIs

### ipapi.co
- URL: `https://ipapi.co/{ip}/json/`
- Free tier: 1,000 requests/day
- Response format: `{"asn": "AS15169", "org": "Google LLC"}`

### ip-api.com
- URL: `http://ip-api.com/json/{ip}`
- Free tier: 1,000 requests/minute
- Response format: `{"as": "AS15169 Google LLC"}`

### ipinfo.io
- URL: `https://ipinfo.io/{ip}/json`
- Free tier: 50,000 requests/month
- Response format: `{"org": "AS15169 Google LLC"}`

## Testing

Test your IP resolution setup:
```bash
node scripts/test-ip-resolution.js
```

## Performance Considerations

- **MaxMind Database**: Fastest, no network requests, ~1ms lookup time
- **API Fallback**: Slower, requires network requests, ~100-500ms lookup time
- **Caching**: Results are cached for 1 hour by default to improve performance

## Database Updates

MaxMind updates the GeoLite2-ASN database weekly. Set up a cron job to update it:
```bash
# Update MaxMind database weekly (Tuesdays at 2 AM)
0 2 * * 2 cd /path/to/asn-proxy-server && node scripts/setup-maxmind.js
```

## Troubleshooting

### Database Not Found
```
MaxMind database not found: ./data/GeoLite2-ASN.mmdb
```
**Solution**: Run `node scripts/setup-maxmind.js` or download manually.

### API Rate Limits
```
API lookup failed for IP: HTTP 429
```
**Solution**: 
- Use MaxMind database for production
- Implement request throttling
- Use multiple fallback APIs

### Invalid License Key
```
Failed to download GeoLite2-ASN database: HTTP 401
```
**Solution**: Verify your MaxMind license key is correct and active.
