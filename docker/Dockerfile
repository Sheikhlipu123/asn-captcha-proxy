FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    tzdata

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S asn-proxy && \
    adduser -S asn-proxy -u 1001 -G asn-proxy

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs data config && \
    chown -R asn-proxy:asn-proxy /app

# Switch to non-root user
USER asn-proxy

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "server.js"]
