#!/usr/bin/env node

const IPResolver = require("../src/ip/IPResolver")
const ConfigManager = require("../src/config/ConfigManager")
const winston = require("winston")

const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
})

async function testIPResolution() {
  console.log("=== IP-to-ASN Resolution Test ===\n")

  try {
    // Load configuration
    const config = new ConfigManager()
    await config.load()

    // Initialize IP resolver
    const ipResolver = new IPResolver(config, logger)
    await ipResolver.initialize()

    // Test IPs
    const testIPs = [
      "8.8.8.8", // Google DNS
      "1.1.1.1", // Cloudflare DNS
      "208.67.222.222", // OpenDNS
      "9.9.9.9", // Quad9 DNS
      "76.76.19.19", // Control D
    ]

    console.log("Testing IP resolution...\n")

    for (const ip of testIPs) {
      try {
        console.log(`Resolving ${ip}...`)
        const result = await ipResolver.resolveIP(ip)

        if (result) {
          console.log(`  ASN: ${result.asn}`)
          console.log(`  Organization: ${result.org}`)
          console.log(`  Source: ${result.source}`)
        } else {
          console.log("  Could not resolve ASN")
        }
        console.log()
      } catch (error) {
        console.error(`  Error: ${error.message}\n`)
      }
    }

    // Show stats
    const stats = ipResolver.getStats()
    console.log("=== Resolver Stats ===")
    console.log(`MaxMind Available: ${stats.maxmindAvailable}`)
    console.log(`Fallback API Configured: ${stats.fallbackAPIConfigured}`)
    console.log(`Cache Hits: ${stats.cacheStats.hits}`)
    console.log(`Cache Misses: ${stats.cacheStats.misses}`)

    ipResolver.destroy()
  } catch (error) {
    console.error("Test failed:", error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testIPResolution().catch(console.error)
}

module.exports = testIPResolution
