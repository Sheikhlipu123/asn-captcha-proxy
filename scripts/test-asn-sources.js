#!/usr/bin/env node

const axios = require("axios")
const ASNListParser = require("../src/asn/ASNListParser")

async function testASNSources() {
  const sources = [
    {
      name: "O-X-L Risk DB",
      url: "https://raw.githubusercontent.com/O-X-L/risk-db/main/asn.json",
      format: "json",
      parser: "riskdb",
    },
    {
      name: "NullifiedCode ASN Lists",
      url: "https://raw.githubusercontent.com/NullifiedCode/ASN-Lists/main/malicious_asns.txt",
      format: "txt",
      parser: "nullified",
    },
  ]

  for (const source of sources) {
    console.log(`\n=== Testing ${source.name} ===`)
    console.log(`URL: ${source.url}`)

    try {
      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          "User-Agent": "ASN-Proxy-Test/1.0.0",
        },
      })

      console.log(`Status: ${response.status}`)
      console.log(`Content-Type: ${response.headers["content-type"]}`)
      console.log(`Content-Length: ${response.data.length}`)

      let asns = []

      if (source.format === "json") {
        if (source.parser === "riskdb") {
          asns = ASNListParser.parseRiskDB(response.data)
        } else {
          asns = ASNListParser.parseGenericJSON(response.data)
        }
      } else if (source.format === "txt") {
        asns = ASNListParser.parseNullifiedCode(response.data)
      }

      console.log(`Parsed ASNs: ${asns.length}`)

      if (asns.length > 0) {
        console.log(`Sample ASNs: ${asns.slice(0, 10).join(", ")}`)
      }
    } catch (error) {
      console.error(`Error: ${error.message}`)
    }
  }
}

if (require.main === module) {
  testASNSources().catch(console.error)
}

module.exports = testASNSources
