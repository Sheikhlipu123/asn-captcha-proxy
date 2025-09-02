const axios = require("axios")
const fs = require("fs").promises
const NodeCache = require("node-cache")
const path = require("path")

class ASNManager {
  constructor(config, logger) {
    this.config = config
    this.logger = logger
    this.cache = new NodeCache({ stdTTL: config.get("asn.cache_ttl", 300) })
    this.blockedASNs = new Set()
    this.allowedASNs = new Set()
    this.lastUpdate = null
    this.updateInterval = null
  }

  async initialize() {
    try {
      this.logger.info("Initializing ASN Manager...")

      // Load custom ASN lists first
      await this.loadCustomASNList()

      // Load ASN lists from GitHub sources
      await this.loadRemoteASNLists()

      // Setup periodic refresh
      this.setupPeriodicRefresh()

      this.logger.info(
        `ASN Manager initialized with ${this.blockedASNs.size} blocked ASNs and ${this.allowedASNs.size} allowed ASNs`,
      )
    } catch (error) {
      this.logger.error("Failed to initialize ASN Manager:", error)
      throw error
    }
  }

  async loadCustomASNList() {
    const customListPath = this.config.get("asn.custom_list")
    if (!customListPath) {
      this.logger.info("No custom ASN list configured")
      return
    }

    try {
      const data = await fs.readFile(customListPath, "utf8")
      const customList = JSON.parse(data)

      // Add blocked ASNs
      if (customList.blocked_asns && Array.isArray(customList.blocked_asns)) {
        for (const entry of customList.blocked_asns) {
          this.blockedASNs.add(entry.asn)
          this.logger.debug(`Added blocked ASN ${entry.asn}: ${entry.org}`)
        }
      }

      // Add allowed ASNs (these override blocked ones)
      if (customList.allowed_asns && Array.isArray(customList.allowed_asns)) {
        for (const entry of customList.allowed_asns) {
          this.allowedASNs.add(entry.asn)
          // Remove from blocked list if present
          this.blockedASNs.delete(entry.asn)
          this.logger.debug(`Added allowed ASN ${entry.asn}: ${entry.org}`)
        }
      }

      this.logger.info(`Loaded custom ASN list from ${customListPath}`)
    } catch (error) {
      if (error.code === "ENOENT") {
        this.logger.warn(`Custom ASN list file not found: ${customListPath}`)
      } else {
        this.logger.error(`Failed to load custom ASN list: ${error.message}`)
      }
    }
  }

  async loadRemoteASNLists() {
    const sources = this.config.get("asn.sources", [])

    for (const source of sources) {
      try {
        this.logger.info(`Fetching ASN list from: ${source.url}`)
        await this.fetchAndProcessSource(source)
      } catch (error) {
        this.logger.error(`Failed to fetch ASN list from ${source.url}:`, error.message)
        // Continue with other sources even if one fails
      }
    }

    this.lastUpdate = new Date()
  }

  async fetchAndProcessSource(source) {
    const response = await axios.get(source.url, {
      timeout: 30000,
      headers: {
        "User-Agent": "ASN-Proxy-Server/1.0.0",
      },
    })

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = response.data
    let asnCount = 0

    switch (source.format.toLowerCase()) {
      case "json":
        asnCount = await this.processJSONSource(data, source.url)
        break
      case "txt":
        asnCount = await this.processTextSource(data, source.url)
        break
      default:
        throw new Error(`Unsupported format: ${source.format}`)
    }

    this.logger.info(`Processed ${asnCount} ASNs from ${source.url}`)
  }

  async processJSONSource(data, sourceUrl) {
    let asnCount = 0

    try {
      // Handle O-X-L/risk-db format
      if (sourceUrl.includes("risk-db")) {
        // The risk-db format contains ASN data in various structures
        if (data.asn && Array.isArray(data.asn)) {
          for (const entry of data.asn) {
            if (entry.asn) {
              this.blockedASNs.add(Number.parseInt(entry.asn))
              asnCount++
            }
          }
        } else if (Array.isArray(data)) {
          // Handle array of ASN objects
          for (const entry of data) {
            if (entry.asn) {
              this.blockedASNs.add(Number.parseInt(entry.asn))
              asnCount++
            }
          }
        }
      } else {
        // Generic JSON format handling
        if (Array.isArray(data)) {
          for (const item of data) {
            if (typeof item === "number") {
              this.blockedASNs.add(item)
              asnCount++
            } else if (typeof item === "object" && item.asn) {
              this.blockedASNs.add(Number.parseInt(item.asn))
              asnCount++
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing JSON source: ${error.message}`)
    }

    return asnCount
  }

  async processTextSource(data, sourceUrl) {
    let asnCount = 0

    try {
      const lines = data.split("\n")

      for (const line of lines) {
        const trimmed = line.trim()

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
          continue
        }

        // Extract ASN number (handle various formats)
        const asnMatch = trimmed.match(/(?:AS)?(\d+)/i)

        if (asnMatch) {
          const asn = Number.parseInt(asnMatch[1])
          if (!isNaN(asn) && asn > 0) {
            this.blockedASNs.add(asn)
            asnCount++
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error processing text source: ${error.message}`)
    }

    return asnCount
  }

  setupPeriodicRefresh() {
    const sources = this.config.get("asn.sources", [])
    if (sources.length === 0) {
      return
    }

    // Find the minimum refresh interval
    const minInterval = Math.min(...sources.map((s) => s.refresh_interval || 3600))
    const intervalMs = minInterval * 1000

    this.updateInterval = setInterval(async () => {
      try {
        this.logger.info("Refreshing ASN lists...")
        await this.loadRemoteASNLists()
        this.logger.info("ASN lists refreshed successfully")
      } catch (error) {
        this.logger.error("Failed to refresh ASN lists:", error)
      }
    }, intervalMs)

    this.logger.info(`ASN list refresh scheduled every ${minInterval} seconds`)
  }

  async isASNBlocked(asn) {
    if (!asn || isNaN(asn)) {
      return false
    }

    const asnNumber = Number.parseInt(asn)

    // Check cache first
    const cacheKey = `asn_check_${asnNumber}`
    const cached = this.cache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    // Check if ASN is explicitly allowed (whitelist overrides blocklist)
    if (this.allowedASNs.has(asnNumber)) {
      this.cache.set(cacheKey, false)
      return false
    }

    // Check if ASN is blocked
    const isBlocked = this.blockedASNs.has(asnNumber)
    this.cache.set(cacheKey, isBlocked)

    return isBlocked
  }

  getStats() {
    return {
      blockedASNs: this.blockedASNs.size,
      allowedASNs: this.allowedASNs.size,
      lastUpdate: this.lastUpdate,
      cacheStats: this.cache.getStats(),
    }
  }

  async addCustomASN(asn, type = "blocked", org = "", reason = "") {
    const asnNumber = Number.parseInt(asn)
    if (isNaN(asnNumber)) {
      throw new Error("Invalid ASN number")
    }

    if (type === "blocked") {
      this.blockedASNs.add(asnNumber)
      this.allowedASNs.delete(asnNumber)
    } else if (type === "allowed") {
      this.allowedASNs.add(asnNumber)
      this.blockedASNs.delete(asnNumber)
    }

    // Clear cache for this ASN
    this.cache.del(`asn_check_${asnNumber}`)

    this.logger.info(`Added ${type} ASN ${asnNumber}: ${org}`)
  }

  async removeCustomASN(asn) {
    const asnNumber = Number.parseInt(asn)
    if (isNaN(asnNumber)) {
      throw new Error("Invalid ASN number")
    }

    this.blockedASNs.delete(asnNumber)
    this.allowedASNs.delete(asnNumber)

    // Clear cache for this ASN
    this.cache.del(`asn_check_${asnNumber}`)

    this.logger.info(`Removed ASN ${asnNumber} from all lists`)
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.cache.flushAll()
    this.logger.info("ASN Manager destroyed")
  }
}

module.exports = ASNManager
