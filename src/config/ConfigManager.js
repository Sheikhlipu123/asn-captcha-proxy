const fs = require("fs").promises
const yaml = require("js-yaml")
const path = require("path")
const { EventEmitter } = require("events")

class ConfigManager extends EventEmitter {
  constructor(configPath = "./config.yaml") {
    super()
    this.configPath = configPath
    this.config = {}
    this.schema = null
    this.watchers = new Map()
    this.envOverrides = new Map()

    this.loadEnvironmentOverrides()
  }

  async load() {
    try {
      const configFile = await fs.readFile(this.configPath, "utf8")
      this.config = yaml.load(configFile)

      this.applyEnvironmentOverrides()

      // Validate required configuration
      this.validate()

      await this.setupFileWatcher()

      console.log("Configuration loaded successfully")
      this.emit("loaded", this.config)
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`Config file not found: ${this.configPath}, using defaults`)
        this.loadDefaults()
        await this.createDefaultConfigFile()
      } else {
        throw new Error(`Failed to load configuration: ${error.message}`)
      }
    }
  }

  loadEnvironmentOverrides() {
    const envMappings = {
      ASN_PROXY_PORT: "server.port",
      ASN_PROXY_HOST: "server.host",
      APACHE_UPSTREAM: "apache.upstream",
      MAXMIND_DB_PATH: "ip_resolution.maxmind_db",
      FALLBACK_API_URL: "ip_resolution.fallback_api",
      CAPTCHA_DIFFICULTY: "captcha.difficulty",
      CAPTCHA_EXPIRY: "captcha.expiry",
      LOG_LEVEL: "logging.level",
      ASN_CACHE_TTL: "asn.cache_ttl",
      IP_CACHE_TTL: "ip_resolution.cache_ttl",
    }

    for (const [envVar, configPath] of Object.entries(envMappings)) {
      const value = process.env[envVar]
      if (value !== undefined) {
        this.envOverrides.set(configPath, this.parseEnvValue(value))
      }
    }
  }

  parseEnvValue(value) {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return Number.parseInt(value, 10)
    }

    // Try to parse as boolean
    if (value.toLowerCase() === "true") return true
    if (value.toLowerCase() === "false") return false

    // Try to parse as JSON
    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        return JSON.parse(value)
      } catch {
        // Fall through to string
      }
    }

    return value
  }

  applyEnvironmentOverrides() {
    for (const [configPath, value] of this.envOverrides) {
      this.set(configPath, value)
      console.log(`Applied environment override: ${configPath} = ${value}`)
    }
  }

  async setupFileWatcher() {
    if (this.watchers.has(this.configPath)) {
      return // Already watching
    }

    try {
      const { watch } = await import("chokidar")
      const watcher = watch(this.configPath, {
        persistent: true,
        ignoreInitial: true,
      })

      watcher.on("change", async () => {
        console.log("Configuration file changed, reloading...")
        try {
          await this.reload()
          this.emit("reloaded", this.config)
          console.log("Configuration reloaded successfully")
        } catch (error) {
          console.error("Failed to reload configuration:", error.message)
          this.emit("error", error)
        }
      })

      this.watchers.set(this.configPath, watcher)
    } catch (error) {
      console.warn("File watching not available, hot reload disabled")
    }
  }

  async reload() {
    const oldConfig = { ...this.config }
    await this.load()

    // Emit change events for modified values
    this.emitConfigChanges(oldConfig, this.config)
  }

  emitConfigChanges(oldConfig, newConfig, prefix = "") {
    for (const [key, value] of Object.entries(newConfig)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      const oldValue = this.getNestedValue(oldConfig, fullKey)

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        this.emitConfigChanges(oldConfig, value, fullKey)
      } else if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
        this.emit("change", fullKey, value, oldValue)
      }
    }
  }

  getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj)
  }

  loadDefaults() {
    this.config = {
      server: {
        port: 3000,
        host: "0.0.0.0",
      },
      apache: {
        upstream: "http://localhost:8080",
      },
      asn: {
        sources: [
          {
            url: "https://raw.githubusercontent.com/O-X-L/risk-db/main/asn.json",
            format: "json",
            refresh_interval: 3600,
          },
        ],
        custom_list: "./config/custom_asn.json",
        cache_ttl: 300,
      },
      captcha: {
        difficulty: "medium",
        expiry: 300,
        verification_ttl: 3600,
      },
      ip_resolution: {
        maxmind_db: "./data/GeoLite2-ASN.mmdb",
        cache_ttl: 3600,
      },
      logging: {
        level: "info",
        max_files: 10,
        max_size: "10m",
      },
    }
  }

  async createDefaultConfigFile() {
    try {
      const configDir = path.dirname(this.configPath)
      await fs.mkdir(configDir, { recursive: true })

      const yamlStr = yaml.dump(this.config, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
      })

      await fs.writeFile(this.configPath, yamlStr, "utf8")
      console.log(`Created default configuration file: ${this.configPath}`)
    } catch (error) {
      console.warn(`Could not create default config file: ${error.message}`)
    }
  }

  validate() {
    const required = ["server.port", "apache.upstream"]
    const errors = []

    for (const key of required) {
      if (!this.get(key)) {
        errors.push(`Missing required configuration: ${key}`)
      }
    }

    const validations = [
      {
        key: "server.port",
        type: "number",
        min: 1,
        max: 65535,
        message: "Server port must be a number between 1 and 65535",
      },
      {
        key: "captcha.difficulty",
        type: "string",
        enum: ["easy", "medium", "hard"],
        message: "CAPTCHA difficulty must be easy, medium, or hard",
      },
      {
        key: "captcha.expiry",
        type: "number",
        min: 60,
        max: 3600,
        message: "CAPTCHA expiry must be between 60 and 3600 seconds",
      },
      {
        key: "logging.level",
        type: "string",
        enum: ["debug", "info", "warn", "error"],
        message: "Log level must be debug, info, warn, or error",
      },
    ]

    for (const validation of validations) {
      const value = this.get(validation.key)
      if (value !== undefined && value !== null) {
        if (!this.validateValue(value, validation)) {
          errors.push(validation.message)
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join("\n")}`)
    }
  }

  validateValue(value, validation) {
    if (validation.type === "number") {
      if (typeof value !== "number" || isNaN(value)) return false
      if (validation.min !== undefined && value < validation.min) return false
      if (validation.max !== undefined && value > validation.max) return false
    }

    if (validation.type === "string") {
      if (typeof value !== "string") return false
      if (validation.enum && !validation.enum.includes(value)) return false
    }

    return true
  }

  get(key, defaultValue = null) {
    const keys = key.split(".")
    let value = this.config

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k]
      } else {
        return defaultValue
      }
    }

    return value
  }

  set(key, value) {
    const keys = key.split(".")
    let obj = this.config

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i]
      if (!(k in obj) || typeof obj[k] !== "object") {
        obj[k] = {}
      }
      obj = obj[k]
    }

    const oldValue = obj[keys[keys.length - 1]]
    obj[keys[keys.length - 1]] = value

    this.emit("change", key, value, oldValue)
  }

  async save() {
    const yamlStr = yaml.dump(this.config, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    })
    await fs.writeFile(this.configPath, yamlStr, "utf8")
    console.log(`Configuration saved to: ${this.configPath}`)
  }

  getSummary() {
    return {
      configPath: this.configPath,
      lastLoaded: new Date().toISOString(),
      environmentOverrides: Object.fromEntries(this.envOverrides),
      watchersActive: this.watchers.size,
      config: this.config,
    }
  }

  destroy() {
    // Close file watchers
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()

    // Remove all listeners
    this.removeAllListeners()

    console.log("Configuration manager destroyed")
  }
}

module.exports = ConfigManager
