const axios = require("axios")
const fs = require("fs").promises
const path = require("path")
const zlib = require("zlib")
const { promisify } = require("util")
const gunzip = promisify(zlib.gunzip)

class GeoIPDownloader {
  constructor(logger) {
    this.logger = logger
    this.maxmindLicenseKey = process.env.MAXMIND_LICENSE_KEY
  }

  async downloadGeoLite2ASN(outputPath) {
    if (!this.maxmindLicenseKey) {
      throw new Error(
        "MaxMind license key not found. Set MAXMIND_LICENSE_KEY environment variable or download manually from https://dev.maxmind.com/geoip/geolite2-free-geolocation-data",
      )
    }

    const downloadUrl = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-ASN&license_key=${this.maxmindLicenseKey}&suffix=tar.gz`

    try {
      this.logger.info("Downloading GeoLite2-ASN database...")

      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: 300000, // 5 minutes
        headers: {
          "User-Agent": "ASN-Proxy-Server/1.0.0",
        },
      })

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // For simplicity, we'll provide instructions instead of extracting tar.gz
      // In production, you'd want to extract and find the .mmdb file
      const outputDir = path.dirname(outputPath)
      await fs.mkdir(outputDir, { recursive: true })

      // Save the compressed file
      const compressedPath = path.join(outputDir, "GeoLite2-ASN.tar.gz")
      await fs.writeFile(compressedPath, response.data)

      this.logger.info(`Downloaded GeoLite2-ASN database to: ${compressedPath}`)
      this.logger.info("Please extract the .mmdb file from the archive and place it at the configured path")

      return compressedPath
    } catch (error) {
      this.logger.error("Failed to download GeoLite2-ASN database:", error.message)
      throw error
    }
  }

  async checkDatabaseAge(dbPath) {
    try {
      const stats = await fs.stat(dbPath)
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)

      if (ageInDays > 30) {
        this.logger.warn(`GeoLite2-ASN database is ${Math.floor(ageInDays)} days old. Consider updating.`)
        return false
      }

      return true
    } catch (error) {
      this.logger.error("Failed to check database age:", error.message)
      return false
    }
  }
}

module.exports = GeoIPDownloader
