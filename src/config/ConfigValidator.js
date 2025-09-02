class ConfigValidator {
  static getSchema() {
    return {
      type: "object",
      properties: {
        server: {
          type: "object",
          properties: {
            port: { type: "number", minimum: 1, maximum: 65535 },
            host: { type: "string" },
          },
          required: ["port", "host"],
        },
        apache: {
          type: "object",
          properties: {
            upstream: { type: "string", pattern: "^https?://.+" },
          },
          required: ["upstream"],
        },
        asn: {
          type: "object",
          properties: {
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                  format: { type: "string", enum: ["json", "txt"] },
                  refresh_interval: { type: "number", minimum: 300 },
                },
                required: ["url", "format"],
              },
            },
            custom_list: { type: "string" },
            cache_ttl: { type: "number", minimum: 60 },
          },
        },
        captcha: {
          type: "object",
          properties: {
            difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
            expiry: { type: "number", minimum: 60, maximum: 3600 },
            verification_ttl: { type: "number", minimum: 300 },
          },
        },
        ip_resolution: {
          type: "object",
          properties: {
            maxmind_db: { type: "string" },
            fallback_api: { type: "string" },
            cache_ttl: { type: "number", minimum: 300 },
          },
        },
        logging: {
          type: "object",
          properties: {
            level: { type: "string", enum: ["debug", "info", "warn", "error"] },
            max_files: { type: "number", minimum: 1 },
            max_size: { type: "string" },
          },
        },
      },
      required: ["server", "apache"],
    }
  }

  static validate(config) {
    const errors = []
    const schema = this.getSchema()

    // Basic validation
    this.validateObject(config, schema, "", errors)

    // Custom validations
    this.validateCustomRules(config, errors)

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  static validateObject(obj, schema, path, errors) {
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in obj)) {
          errors.push(`Missing required field: ${path}${required}`)
        }
      }
    }

    if (schema.properties) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key]
        if (propSchema) {
          const newPath = path ? `${path}.${key}` : key
          this.validateValue(value, propSchema, newPath, errors)
        }
      }
    }
  }

  static validateValue(value, schema, path, errors) {
    if (schema.type === "object" && typeof value === "object") {
      this.validateObject(value, schema, `${path}.`, errors)
    } else if (schema.type === "array" && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items, `${path}[${index}]`, errors)
        })
      }
    } else if (schema.type === "number" && typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path} must be >= ${schema.minimum}`)
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path} must be <= ${schema.maximum}`)
      }
    } else if (schema.type === "string" && typeof value === "string") {
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path} must be one of: ${schema.enum.join(", ")}`)
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errors.push(`${path} does not match required pattern`)
      }
    } else if (schema.type && typeof value !== schema.type) {
      errors.push(`${path} must be of type ${schema.type}`)
    }
  }

  static validateCustomRules(config, errors) {
    // Validate Apache upstream URL
    if (config.apache?.upstream) {
      try {
        new URL(config.apache.upstream)
      } catch {
        errors.push("apache.upstream must be a valid URL")
      }
    }

    // Validate ASN source URLs
    if (config.asn?.sources) {
      config.asn.sources.forEach((source, index) => {
        try {
          new URL(source.url)
        } catch {
          errors.push(`asn.sources[${index}].url must be a valid URL`)
        }
      })
    }

    // Validate file paths exist (if specified)
    // Note: This would require async validation in a real implementation
  }
}

module.exports = ConfigValidator
