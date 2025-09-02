const maxmind = require("maxmind")
const axios = require("axios")
const NodeCache = require("node-cache")
const fs = require("fs").promises
const path = require("path")
const { isValidIP, isPrivateIP } = require("../utils/ipUtils")

class IPResolver {
  constructor(config, logger) {
    this.config = config
    this.logger = logger
    this.cache = new NodeCache({ stdTTL: config.get("ip_resolution.cache_ttl", 3600) })
    this.maxmindReader = null
    this.fallbackAPI = config.get("ip_resolution.fallback_api")
    this.maxmindDbPath = config.get("ip_resolution.maxmind_db")
  }

  async initialize() {
    try {
      this.logger.info("Initializing IP Resolver...")

      // Try to load MaxMind database
      await this.loadMaxMindDatabase()

      // Test fallback API if configured
      if (this.fallbackAPI) {
        await this.testFallbackAPI()
      }

      this.logger.info("IP Resolver initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize IP Resolver:", error)
      throw error
    }
  }

  async loadMaxMindDatabase() {
    if (!this.maxmindDbPath) {
      this.logger.warn("No MaxMind database path configured")
      return
    }

    try {
      // Check if database file exists
      await fs.access(this.maxmindDbPath)

      // Load the database
      this.maxmindReader = await maxmind.open(this.maxmindDbPath)
      this.logger.info(`MaxMind ASN database loaded from: ${this.maxmindDbPath}`)
    } catch (error) {
      if (error.code === "ENOENT") {
        this.logger.warn(`MaxMind database not found: ${this.maxmindDbPath}`)
        this.logger.info("Download GeoLite2-ASN.mmdb from https://dev.maxmind.com/geoip/geolite2-free-geolocation-data")
      } else {
        this.logger.error(`Failed to load MaxMind database: ${error.message}`)
      }
    }
  }

  async testFallbackAPI() {
    try {
      // Test with a known IP (Google DNS)
      const testIP = "8.8.8.8"
      const testUrl = this.fallbackAPI.replace("{ip}", testIP)

      const response = await axios.get(testUrl, {
        timeout: 5000,
        headers: {
          "User-Agent": "ASN-Proxy-Server/1.0.0",
        },
      })

      if (response.status === 200 && response.data) {
        this.logger.info("Fallback API test successful")
      } else {
        this.logger.warn("Fallback API test returned unexpected response")
      }
    } catch (error) {
      this.logger.warn(`Fallback API test failed: ${error.message}`)
    }
  }

  async resolveIP(ip) {
    if (!isValidIP(ip)) {
      throw new Error(`Invalid IP address: ${ip}`)
    }

    // Skip private IPs
    if (isPrivateIP(ip)) {
      return null
    }

    // Check cache first
    const cacheKey = `ip_resolve_${ip}`
    const cached = this.cache.get(cacheKey)
    if (cached) {
      this.logger.debug(`Cache hit for IP: ${ip}`)
      return cached
    }

    let asnInfo = null

    try {
      // Try MaxMind database first
      if (this.maxmindReader) {
        asnInfo = await this.resolveWithMaxMind(ip)
      }

      // Fallback to API if MaxMind failed
      if (!asnInfo && this.fallbackAPI) {
        asnInfo = await this.resolveWithFallbackAPI(ip)
      }

      // Cache the result (even if null)
      if (asnInfo) {
        this.cache.set(cacheKey, asnInfo)
        this.logger.debug(`Resolved IP ${ip} to ASN ${asnInfo.asn} (${asnInfo.org})`)
      } else {
        // Cache negative results for shorter time
        this.cache.set(cacheKey, null, 300) // 5 minutes
        this.logger.debug(`Could not resolve ASN for IP: ${ip}`)
      }

      return asnInfo
    } catch (error) {
      this.logger.error(`Error resolving IP ${ip}:`, error.message)
      return null
    }
  }

  async resolveWithMaxMind(ip) {
    try {
      const result = this.maxmindReader.get(ip)

      if (result && result.autonomous_system_number) {
        return {
          asn: result.autonomous_system_number,
          org: result.autonomous_system_organization || "Unknown",
          source: "maxmind",
        }
      }

      return null
    } catch (error) {
      this.logger.debug(`MaxMind lookup failed for ${ip}: ${error.message}`)
      return null
    }
  }

  async resolveWithFallbackAPI(ip) {
    try {
      const url = this.fallbackAPI.replace("{ip}", ip)

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "ASN-Proxy-Server/1.0.0",
        },
      })

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = response.data

      // Handle different API response formats
      let asn = null
      let org = null

      // ipapi.co format
      if (data.asn) {
        const asnMatch = data.asn.match(/AS(\d+)/)
        if (asnMatch) {
          asn = Number.parseInt(asnMatch[1])
          org = data.org || data.asn_org || "Unknown"
        }
      }

      // ip-api.com format
      if (!asn && data.as) {
        const asnMatch = data.as.match(/AS(\d+)/)
        if (asnMatch) {
          asn = Number.parseInt(asnMatch[1])
          org = data.as.replace(/AS\d+\s*/, "") || "Unknown"
        }
      }

      // Generic format
      if (!asn && (data.autonomous_system_number || data.asn_number)) {
        asn = Number.parseInt(data.autonomous_system_number || data.asn_number)
        org = data.autonomous_system_organization || data.asn_org || "Unknown"
      }

      if (asn) {
        return {
          asn: asn,
          org: org,
          source: "api",
        }
      }

      return null
    } catch (error) {
      this.logger.debug(`API lookup failed for ${ip}: ${error.message}`)
      return null
    }
  }

  async bulkResolve(ips) {
    const results = new Map()
    const promises = ips.map(async (ip) => {
      try {
        const result = await this.resolveIP(ip)
        results.set(ip, result)
      } catch (error) {
        results.set(ip, null)
      }
    })

    await Promise.all(promises)
    return results
  }

  getStats() {
    return {
      cacheStats: this.cache.getStats(),
      maxmindAvailable: !!this.maxmindReader,
      fallbackAPIConfigured: !!this.fallbackAPI,
    }
  }

  clearCache() {
    this.cache.flushAll()
    this.logger.info("IP resolution cache cleared")
  }

  destroy() {
    this.cache.flushAll()
    if (this.maxmindReader) {
      // MaxMind reader doesn't need explicit cleanup
      this.maxmindReader = null
    }
    this.logger.info("IP Resolver destroyed")
  }
}

module.exports = IPResolver
