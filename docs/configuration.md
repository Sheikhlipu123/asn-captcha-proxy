# Configuration Guide

This guide explains how to configure the ASN Proxy Server.

## Configuration Files

The server uses YAML configuration files. The default configuration file is `config.yaml` in the project root.

### Environment-Specific Configurations

- `config.yaml` - Default configuration
- `config/config.production.yaml` - Production settings
- `config/config.development.yaml` - Development settings

## Configuration Structure

### Server Settings

```yaml
server:
  port: 3000          # Port to listen on
  host: "0.0.0.0"     # Host to bind to
```

### Apache Backend

```yaml
apache:
  upstream: "http://localhost:8080"  # Apache server URL
```

### ASN Management

```yaml
asn:
  sources:
    - url: "https://raw.githubusercontent.com/O-X-L/risk-db/main/asn.json"
      format: "json"
      refresh_interval: 3600  # Refresh every hour
  custom_list: "./config/custom_asn.json"
  cache_ttl: 300  # Cache for 5 minutes
```

### CAPTCHA Settings

```yaml
captcha:
  difficulty: "medium"        # easy, medium, hard
  expiry: 300                  # Challenge expires in 5 minutes
  verification_ttl: 3600       # Verified IPs remembered for 1 hour
```

### IP Resolution

```yaml
ip_resolution:
  maxmind_db: "./data/GeoLite2-ASN.mmdb"
  fallback_api: "https://ipapi.co/{ip}/json/"
  cache_ttl: 3600  # Cache for 1 hour
```

### Logging

```yaml
logging:
  level: "info"      # debug, info, warn, error
  max_files: 10      # Maximum log files to keep
  max_size: "10m"    # Maximum size per log file
```

## Environment Variables

Environment variables override configuration file values:

| Variable             | Config Path                  | Description           |
| -------------------- | ---------------------------- | --------------------- |
| `ASN_PROXY_PORT`     | `server.port`                | Server port           |
| `ASN_PROXY_HOST`     | `server.host`                | Server host           |
| `APACHE_UPSTREAM`    | `apache.upstream`            | Apache backend URL    |
| `MAXMIND_DB_PATH`    | `ip_resolution.maxmind_db`   | MaxMind database path |
| `FALLBACK_API_URL`   | `ip_resolution.fallback_api` | Fallback API URL      |
| `CAPTCHA_DIFFICULTY` | `captcha.difficulty`         | CAPTCHA difficulty    |
| `LOG_LEVEL`          | `logging.level`              | Log level             |

## Configuration Management CLI

Use the configuration manager script for common tasks:

### Validate Configuration

```bash
node scripts/config-manager.js validate
node scripts/config-manager.js validate ./config/production.yaml
```

### Create Default Configuration

```bash
node scripts/config-manager.js create
node scripts/config-manager.js create ./config/new-config.yaml
```

### View Configuration

```bash
node scripts/config-manager.js show
```

### Set Configuration Values

```bash
node scripts/config-manager.js set ./config.yaml server.port 8080
node scripts/config-manager.js set ./config.yaml captcha.difficulty hard
```

### Get Configuration Values

```bash
node scripts/config-manager.js get ./config.yaml server.port
node scripts/config-manager.js get ./config.yaml apache.upstream
```

### Show Environment Variables

```bash
node scripts/config-manager.js env
```

## Hot Reload

The configuration manager supports hot reload. When the configuration file changes, the server will automatically reload the configuration without restarting.

### Listening for Configuration Changes

```javascript
const config = new ConfigManager()
await config.load()

config.on('change', (key, newValue, oldValue) => {
  console.log(`Configuration changed: ${key} = ${newValue}`)
})

config.on('reloaded', (newConfig) => {
  console.log('Configuration reloaded')
})
```

## Validation

The configuration is automatically validated on load. Common validation errors:

- **Missing required fields**: `server.port`, `apache.upstream`
- **Invalid port range**: Port must be 1-65535
- **Invalid CAPTCHA difficulty**: Must be easy, medium, or hard
- **Invalid log level**: Must be debug, info, warn, or error
- **Invalid URLs**: Apache upstream and ASN sources must be valid URLs

## Best Practices

### Production

- Use `config/config.production.yaml`
- Set `logging.level` to `info` or `warn`
- Use longer cache TTL values
- Set appropriate refresh intervals for ASN sources
- Use environment variables for sensitive values

### Development

- Use `config/config.development.yaml`
- Set `logging.level` to `debug`
- Use shorter cache TTL for testing
- Set CAPTCHA difficulty to `easy`

### Security

- Never commit sensitive values to version control
- Use environment variables for production secrets
- Regularly update ASN blocklists
- Monitor configuration changes in production
