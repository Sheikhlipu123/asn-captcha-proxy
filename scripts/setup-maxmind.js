#!/usr/bin/env node

const path = require("path")
const fs = require("fs").promises
const GeoIPDownloader = require("../src/ip/GeoIPDownloader")
const winston = require("winston")

const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
})

async function setupMaxMind() {
  console.log("=== MaxMind GeoLite2-ASN Database Setup ===\n")

  const dataDir = path.join(__dirname, "..", "data")
  const dbPath = path.join(dataDir, "GeoLite2-ASN.mmdb")

  try {
    // Create data directory
    await fs.mkdir(dataDir, { recursive: true })

    // Check if database already exists
    try {
      await fs.access(dbPath)
      console.log(`✓ Database already exists at: ${dbPath}`)

      const downloader = new GeoIPDownloader(logger)
      const isRecent = await downloader.checkDatabaseAge(dbPath)

      if (!isRecent) {
        console.log("⚠ Database is older than 30 days")
      }

      return
    } catch (error) {
      // Database doesn't exist, continue with setup
    }

    console.log("Database not found. Setting up MaxMind GeoLite2-ASN database...\n")

    console.log("Options:")
    console.log("1. Download automatically (requires MaxMind license key)")
    console.log("2. Manual download instructions")
    console.log()

    if (process.env.MAXMIND_LICENSE_KEY) {
      console.log("MaxMind license key found in environment variables.")
      console.log("Attempting automatic download...")

      const downloader = new GeoIPDownloader(logger)
      await downloader.downloadGeoLite2ASN(dbPath)
    } else {
      console.log("Manual Download Instructions:")
      console.log("1. Sign up for a free MaxMind account at: https://www.maxmind.com/en/geolite2/signup")
      console.log("2. Generate a license key in your account")
      console.log("3. Download GeoLite2-ASN database")
      console.log("4. Extract the .mmdb file to:", dbPath)
      console.log()
      console.log("Alternatively, set MAXMIND_LICENSE_KEY environment variable and run this script again.")
    }
  } catch (error) {
    console.error("Setup failed:", error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  setupMaxMind().catch(console.error)
}

module.exports = setupMaxMind
