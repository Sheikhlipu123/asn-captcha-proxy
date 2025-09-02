class ASNListParser {
  static parseRiskDB(data) {
    const asns = new Set()

    try {
      // Handle different structures in risk-db
      if (data.asn && Array.isArray(data.asn)) {
        for (const entry of data.asn) {
          if (entry.asn) {
            asns.add(Number.parseInt(entry.asn))
          }
        }
      }

      // Handle direct array format
      if (Array.isArray(data)) {
        for (const entry of data) {
          if (typeof entry === "object" && entry.asn) {
            asns.add(Number.parseInt(entry.asn))
          } else if (typeof entry === "number") {
            asns.add(entry)
          }
        }
      }

      // Handle nested structures
      if (data.data && Array.isArray(data.data)) {
        for (const entry of data.data) {
          if (entry.asn) {
            asns.add(Number.parseInt(entry.asn))
          }
        }
      }
    } catch (error) {
      console.error("Error parsing risk-db format:", error)
    }

    return Array.from(asns)
  }

  static parseNullifiedCode(textData) {
    const asns = new Set()

    try {
      const lines = textData.split("\n")

      for (const line of lines) {
        const trimmed = line.trim()

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
          continue
        }

        // Handle various ASN formats:
        // AS12345
        // 12345
        // ASN12345
        const asnMatch = trimmed.match(/(?:AS|ASN)?(\d+)/i)

        if (asnMatch) {
          const asn = Number.parseInt(asnMatch[1])
          if (!isNaN(asn) && asn > 0 && asn <= 4294967295) {
            // Valid ASN range
            asns.add(asn)
          }
        }
      }
    } catch (error) {
      console.error("Error parsing NullifiedCode format:", error)
    }

    return Array.from(asns)
  }

  static parseGenericJSON(data) {
    const asns = new Set()

    try {
      if (Array.isArray(data)) {
        for (const item of data) {
          if (typeof item === "number" && item > 0) {
            asns.add(item)
          } else if (typeof item === "object") {
            // Try common field names
            const asnValue = item.asn || item.ASN || item.as || item.AS || item.number
            if (asnValue) {
              const asn = Number.parseInt(asnValue)
              if (!isNaN(asn) && asn > 0) {
                asns.add(asn)
              }
            }
          } else if (typeof item === "string") {
            const asnMatch = item.match(/(\d+)/)
            if (asnMatch) {
              const asn = Number.parseInt(asnMatch[1])
              if (!isNaN(asn) && asn > 0) {
                asns.add(asn)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing generic JSON format:", error)
    }

    return Array.from(asns)
  }
}

module.exports = ASNListParser
