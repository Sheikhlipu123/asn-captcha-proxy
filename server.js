const express = require("express")
const { createProxyMiddleware } = require("http-proxy-middleware")
const helmet = require("helmet")
const cors = require("cors")
const rateLimit = require("express-rate-limit")
const winston = require("winston")
const path = require("path")

const ConfigManager = require("./src/config/ConfigManager")
const ASNManager = require("./src/asn/ASNManager")
const CaptchaManager = require("./src/captcha/CaptchaManager")
const IPResolver = require("./src/ip/IPResolver")
const { getClientIP, isPrivateIP } = require("./src/utils/ipUtils")

class ASNProxyServer {
  constructor() {
    this.app = express()
    this.config = null
    this.asnManager = null
    this.captchaManager = null
    this.ipResolver = null
    this.logger = null

    this.setupLogger()
  }

  setupLogger() {
    this.logger = winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: "asn-proxy" },
      transports: [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    })
  }

  async initialize() {
    try {
      // Load configuration
      this.config = new ConfigManager()
      await this.config.load()

      // Initialize managers
      this.asnManager = new ASNManager(this.config, this.logger)
      this.captchaManager = new CaptchaManager(this.config, this.logger)
      this.ipResolver = new IPResolver(this.config, this.logger)

      // Setup middleware
      this.setupMiddleware()

      // Setup routes
      this.setupRoutes()

      // Initialize ASN lists
      await this.asnManager.initialize()
      await this.ipResolver.initialize()

      this.logger.info("ASN Proxy Server initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize server:", error)
      process.exit(1)
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet())
    this.app.use(cors())

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: "Too many requests from this IP",
    })
    this.app.use(limiter)

    // Body parsing
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req, res, next) => {
      const clientIP = getClientIP(req)
      this.logger.info(`${req.method} ${req.url} from ${clientIP}`)
      next()
    })
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: require("./package.json").version,
      })
    })

    // CAPTCHA challenge page
    this.app.get("/captcha", (req, res) => {
      const challenge = this.captchaManager.generateChallenge()
      res.send(this.captchaManager.renderChallengePage(challenge, req.query.redirect))
    })

    // CAPTCHA verification endpoint
    this.app.post("/captcha/verify", async (req, res) => {
      const { challenge, response, redirect } = req.body
      const clientIP = getClientIP(req)

      try {
        const isValid = await this.captchaManager.verifyChallenge(challenge, response)

        if (isValid) {
          // Store successful verification in session/cache
          this.captchaManager.markIPAsVerified(clientIP)
          this.logger.info(`CAPTCHA verified successfully for IP: ${clientIP}`)

          // Redirect to original destination
          res.redirect(redirect || "/")
        } else {
          this.logger.warn(`CAPTCHA verification failed for IP: ${clientIP}`)
          res.redirect("/captcha?error=invalid&redirect=" + encodeURIComponent(redirect || "/"))
        }
      } catch (error) {
        this.logger.error("CAPTCHA verification error:", error)
        res.status(500).send("Verification error")
      }
    })

    // Main proxy middleware - handles all other requests
    this.app.use("*", async (req, res, next) => {
      const clientIP = getClientIP(req)

      try {
        // Skip ASN check for private IPs
        if (isPrivateIP(clientIP)) {
          return next()
        }

        // Check if IP is already verified
        if (this.captchaManager.isIPVerified(clientIP)) {
          return next()
        }

        // Resolve IP to ASN
        const asnInfo = await this.ipResolver.resolveIP(clientIP)

        if (!asnInfo) {
          this.logger.warn(`Could not resolve ASN for IP: ${clientIP}`)
          return next() // Allow through if we can't resolve ASN
        }

        // Check if ASN is blocked
        const isBlocked = await this.asnManager.isASNBlocked(asnInfo.asn)

        if (isBlocked) {
          this.logger.info(`Blocked ASN ${asnInfo.asn} (${asnInfo.org}) for IP: ${clientIP}`)

          // Redirect to CAPTCHA challenge
          const redirectUrl = encodeURIComponent(req.originalUrl)
          return res.redirect(`/captcha?redirect=${redirectUrl}`)
        }

        this.logger.info(`Allowed ASN ${asnInfo.asn} (${asnInfo.org}) for IP: ${clientIP}`)
        next()
      } catch (error) {
        this.logger.error(`Error processing request for IP ${clientIP}:`, error)
        // On error, allow the request through to avoid blocking legitimate traffic
        next()
      }
    })

    // Proxy to Apache backend
    const proxyOptions = {
      target: this.config.get("apache.upstream"),
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      onError: (err, req, res) => {
        this.logger.error("Proxy error:", err)
        res.status(502).send("Bad Gateway")
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add custom headers
        proxyReq.setHeader("X-Forwarded-For", getClientIP(req))
        proxyReq.setHeader("X-ASN-Proxy", "true")
      },
    }

    this.app.use("*", createProxyMiddleware(proxyOptions))
  }

  start() {
    const port = this.config.get("server.port", 3000)
    const host = this.config.get("server.host", "0.0.0.0")

    this.app.listen(port, host, () => {
      this.logger.info(`ASN Proxy Server running on ${host}:${port}`)
      this.logger.info(`Proxying to: ${this.config.get("apache.upstream")}`)
    })
  }
}

// Start the server
const server = new ASNProxyServer()
server
  .initialize()
  .then(() => {
    server.start()
  })
  .catch((error) => {
    console.error("Failed to start server:", error)
    process.exit(1)
  })

module.exports = ASNProxyServer
