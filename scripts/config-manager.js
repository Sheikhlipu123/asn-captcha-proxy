#!/usr/bin/env node

const ConfigManager = require("../src/config/ConfigManager")
const ConfigValidator = require("../src/config/ConfigValidator")
const path = require("path")

async function main() {
  const command = process.argv[2]
  const configPath = process.argv[3] || "./config.yaml"

  switch (command) {
    case "validate":
      await validateConfig(configPath)
      break
    case "create":
      await createConfig(configPath)
      break
    case "show":
      await showConfig(configPath)
      break
    case "set":
      await setConfigValue(configPath, process.argv[4], process.argv[5])
      break
    case "get":
      await getConfigValue(configPath, process.argv[4])
      break
    case "env":
      showEnvironmentVariables()
      break
    default:
      showHelp()
  }
}

async function validateConfig(configPath) {
  console.log(`Validating configuration: ${configPath}\n`)

  try {
    const config = new ConfigManager(configPath)
    await config.load()

    const validation = ConfigValidator.validate(config.config)

    if (validation.valid) {
      console.log("✅ Configuration is valid")
    } else {
      console.log("❌ Configuration validation failed:")
      validation.errors.forEach((error) => {
        console.log(`  - ${error}`)
      })
      process.exit(1)
    }
  } catch (error) {
    console.error("❌ Failed to validate configuration:", error.message)
    process.exit(1)
  }
}

async function createConfig(configPath) {
  console.log(`Creating default configuration: ${configPath}\n`)

  try {
    const config = new ConfigManager(configPath)
    config.loadDefaults()
    await config.save()
    console.log("✅ Default configuration created successfully")
  } catch (error) {
    console.error("❌ Failed to create configuration:", error.message)
    process.exit(1)
  }
}

async function showConfig(configPath) {
  console.log(`Configuration: ${configPath}\n`)

  try {
    const config = new ConfigManager(configPath)
    await config.load()

    const summary = config.getSummary()
    console.log("📋 Configuration Summary:")
    console.log(`  Config Path: ${summary.configPath}`)
    console.log(`  Last Loaded: ${summary.lastLoaded}`)
    console.log(`  Environment Overrides: ${Object.keys(summary.environmentOverrides).length}`)
    console.log(`  File Watchers: ${summary.watchersActive}`)
    console.log()

    if (Object.keys(summary.environmentOverrides).length > 0) {
      console.log("🌍 Environment Overrides:")
      for (const [key, value] of Object.entries(summary.environmentOverrides)) {
        console.log(`  ${key}: ${value}`)
      }
      console.log()
    }

    console.log("⚙️ Current Configuration:")
    console.log(JSON.stringify(summary.config, null, 2))
  } catch (error) {
    console.error("❌ Failed to show configuration:", error.message)
    process.exit(1)
  }
}

async function setConfigValue(configPath, key, value) {
  if (!key || value === undefined) {
    console.error("Usage: node config-manager.js set <config-path> <key> <value>")
    process.exit(1)
  }

  try {
    const config = new ConfigManager(configPath)
    await config.load()

    // Parse value
    let parsedValue = value
    if (value === "true") parsedValue = true
    else if (value === "false") parsedValue = false
    else if (/^\d+$/.test(value)) parsedValue = Number.parseInt(value, 10)
    else if (/^\d+\.\d+$/.test(value)) parsedValue = Number.parseFloat(value)

    config.set(key, parsedValue)
    await config.save()

    console.log(`✅ Set ${key} = ${parsedValue}`)
  } catch (error) {
    console.error("❌ Failed to set configuration value:", error.message)
    process.exit(1)
  }
}

async function getConfigValue(configPath, key) {
  if (!key) {
    console.error("Usage: node config-manager.js get <config-path> <key>")
    process.exit(1)
  }

  try {
    const config = new ConfigManager(configPath)
    await config.load()

    const value = config.get(key)
    if (value !== null) {
      console.log(`${key}: ${JSON.stringify(value, null, 2)}`)
    } else {
      console.log(`${key}: (not set)`)
    }
  } catch (error) {
    console.error("❌ Failed to get configuration value:", error.message)
    process.exit(1)
  }
}

function showEnvironmentVariables() {
  console.log("🌍 Supported Environment Variables:\n")

  const envVars = [
    { name: "ASN_PROXY_PORT", config: "server.port", description: "Server port number" },
    { name: "ASN_PROXY_HOST", config: "server.host", description: "Server bind address" },
    { name: "APACHE_UPSTREAM", config: "apache.upstream", description: "Apache backend URL" },
    { name: "MAXMIND_DB_PATH", config: "ip_resolution.maxmind_db", description: "MaxMind database path" },
    { name: "FALLBACK_API_URL", config: "ip_resolution.fallback_api", description: "Fallback IP API URL" },
    { name: "CAPTCHA_DIFFICULTY", config: "captcha.difficulty", description: "CAPTCHA difficulty (easy/medium/hard)" },
    { name: "CAPTCHA_EXPIRY", config: "captcha.expiry", description: "CAPTCHA expiry in seconds" },
    { name: "LOG_LEVEL", config: "logging.level", description: "Log level (debug/info/warn/error)" },
    { name: "ASN_CACHE_TTL", config: "asn.cache_ttl", description: "ASN cache TTL in seconds" },
    { name: "IP_CACHE_TTL", config: "ip_resolution.cache_ttl", description: "IP resolution cache TTL" },
  ]

  envVars.forEach((env) => {
    const currentValue = process.env[env.name]
    const status = currentValue ? `✅ ${currentValue}` : "❌ (not set)"
    console.log(`${env.name}`)
    console.log(`  Config: ${env.config}`)
    console.log(`  Description: ${env.description}`)
    console.log(`  Current: ${status}`)
    console.log()
  })
}

function showHelp() {
  console.log("ASN Proxy Configuration Manager\n")
  console.log("Usage: node config-manager.js <command> [options]\n")
  console.log("Commands:")
  console.log("  validate [config-path]     Validate configuration file")
  console.log("  create [config-path]       Create default configuration file")
  console.log("  show [config-path]         Show current configuration")
  console.log("  set <config-path> <key> <value>  Set configuration value")
  console.log("  get <config-path> <key>    Get configuration value")
  console.log("  env                        Show supported environment variables")
  console.log("  help                       Show this help message")
  console.log()
  console.log("Examples:")
  console.log("  node config-manager.js validate")
  console.log("  node config-manager.js create ./my-config.yaml")
  console.log("  node config-manager.js set ./config.yaml server.port 8080")
  console.log("  node config-manager.js get ./config.yaml apache.upstream")
  console.log("  node config-manager.js env")
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { main }
