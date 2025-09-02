#!/bin/bash

# ASN CAPTCHA Proxy - Setup Script
# This script sets up the ASN proxy server for production use

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/asn-proxy"
SERVICE_USER="asn-proxy"
CONFIG_FILE="$INSTALL_DIR/config.yaml"

echo -e "${GREEN}ASN CAPTCHA Proxy Setup${NC}"
echo "================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Create service user
echo -e "${YELLOW}Creating service user...${NC}"
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false "$SERVICE_USER"
    echo -e "${GREEN}Created user: $SERVICE_USER${NC}"
else
    echo -e "${YELLOW}User $SERVICE_USER already exists${NC}"
fi

# Create installation directory
echo -e "${YELLOW}Creating installation directory...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/data"
mkdir -p "$INSTALL_DIR/config"

# Copy application files
echo -e "${YELLOW}Copying application files...${NC}"
cp -r . "$INSTALL_DIR/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm install --production

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
cat > /etc/systemd/system/asn-proxy.service << EOF
[Unit]
Description=ASN CAPTCHA Proxy Server
Documentation=https://github.com/your-repo/asn-proxy
After=network.target
Wants=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node server.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=asn-proxy

Environment=NODE_ENV=production
Environment=ASN_PROXY_PORT=80

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR/logs
ReadWritePaths=$INSTALL_DIR/data

LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# Create default configuration if it doesn't exist
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${YELLOW}Creating default configuration...${NC}"
    sudo -u "$SERVICE_USER" cp config/config.example.yaml "$CONFIG_FILE"
fi

# Setup log rotation
echo -e "${YELLOW}Setting up log rotation...${NC}"
cat > /etc/logrotate.d/asn-proxy << EOF
$INSTALL_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        systemctl reload asn-proxy
    endscript
}
EOF

# Setup MaxMind database (if license key provided)
if [[ -n "$MAXMIND_LICENSE_KEY" ]]; then
    echo -e "${YELLOW}Setting up MaxMind database...${NC}"
    sudo -u "$SERVICE_USER" MAXMIND_LICENSE_KEY="$MAXMIND_LICENSE_KEY" node scripts/setup-maxmind.js
fi

# Enable and start service
echo -e "${YELLOW}Enabling and starting service...${NC}"
systemctl daemon-reload
systemctl enable asn-proxy

# Validate configuration
echo -e "${YELLOW}Validating configuration...${NC}"
if sudo -u "$SERVICE_USER" node scripts/config-manager.js validate "$CONFIG_FILE"; then
    echo -e "${GREEN}Configuration is valid${NC}"
else
    echo -e "${RED}Configuration validation failed${NC}"
    exit 1
fi

# Start service
systemctl start asn-proxy

# Check service status
sleep 2
if systemctl is-active --quiet asn-proxy; then
    echo -e "${GREEN}Service started successfully${NC}"
else
    echo -e "${RED}Service failed to start${NC}"
    systemctl status asn-proxy
    exit 1
fi

echo ""
echo -e "${GREEN}Setup completed successfully!${NC}"
echo ""
echo "Service status: $(systemctl is-active asn-proxy)"
echo "Configuration: $CONFIG_FILE"
echo "Logs: journalctl -u asn-proxy -f"
echo ""
echo "Next steps:"
echo "1. Edit $CONFIG_FILE to configure your upstream server"
echo "2. Add MaxMind license key: export MAXMIND_LICENSE_KEY=your_key"
echo "3. Configure firewall rules"
echo "4. Test the proxy: curl http://localhost/"
