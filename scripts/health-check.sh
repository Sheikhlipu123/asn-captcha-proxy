#!/bin/bash

# ASN CAPTCHA Proxy - Health Check Script
# Monitors the proxy service and restarts if unhealthy

# Configuration
SERVICE_NAME="asn-proxy"
HEALTH_URL="http://localhost/health"
LOG_FILE="/var/log/asn-proxy-health.log"
MAX_RETRIES=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Check if service is running
check_service() {
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        return 0
    else
        return 1
    fi
}

# Check HTTP health endpoint
check_http() {
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null)
    
    if [[ "$response" == "200" ]]; then
        return 0
    else
        return 1
    fi
}

# Restart service
restart_service() {
    log "Restarting $SERVICE_NAME service..."
    systemctl restart "$SERVICE_NAME"
    sleep 5
    
    if check_service; then
        log "Service restarted successfully"
        return 0
    else
        log "Failed to restart service"
        return 1
    fi
}

# Main health check
main() {
    local retries=0
    
    # Check if service is running
    if ! check_service; then
        log "ERROR: Service $SERVICE_NAME is not running"
        restart_service
        exit $?
    fi
    
    # Check HTTP endpoint with retries
    while [[ $retries -lt $MAX_RETRIES ]]; do
        if check_http; then
            log "Health check passed"
            exit 0
        else
            retries=$((retries + 1))
            log "Health check failed (attempt $retries/$MAX_RETRIES)"
            
            if [[ $retries -lt $MAX_RETRIES ]]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    # All retries failed
    log "ERROR: Health check failed after $MAX_RETRIES attempts"
    restart_service
    exit $?
}

# Run main function
main "$@"
