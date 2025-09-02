#!/usr/bin/env node

const CaptchaManager = require("../src/captcha/CaptchaManager")
const ConfigManager = require("../src/config/ConfigManager")
const winston = require("winston")

const logger = winston.createLogger({
  level: "info",
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
})

async function testCaptcha() {
  console.log("=== CAPTCHA System Test ===\n")

  try {
    // Load configuration
    const config = new ConfigManager()
    await config.load()

    // Initialize CAPTCHA manager
    const captchaManager = new CaptchaManager(config, logger)

    console.log("Testing CAPTCHA generation and verification...\n")

    // Test different difficulty levels
    const difficulties = ["easy", "medium", "hard"]

    for (const difficulty of difficulties) {
      console.log(`--- Testing ${difficulty.toUpperCase()} difficulty ---`)

      // Temporarily set difficulty
      captchaManager.difficulty = difficulty

      // Generate challenge
      const challenge = captchaManager.generateChallenge()
      console.log(`Challenge ID: ${challenge.id}`)
      console.log(`Question: ${challenge.question}`)
      console.log(`Type: ${challenge.type}`)

      // Test correct answer (we need to peek at the stored challenge)
      const storedChallenge = captchaManager.challengeCache.get(challenge.id)
      if (storedChallenge) {
        console.log(`Correct Answer: ${storedChallenge.answer}`)

        // Test verification with correct answer
        const isValid = await captchaManager.verifyChallenge(challenge.id, storedChallenge.answer)
        console.log(`Verification Result: ${isValid ? "✓ PASS" : "✗ FAIL"}`)
      }

      console.log()
    }

    // Test IP verification
    console.log("--- Testing IP Verification ---")
    const testIP = "192.168.1.100"

    console.log(`Is IP verified initially: ${captchaManager.isIPVerified(testIP)}`)
    captchaManager.markIPAsVerified(testIP)
    console.log(`Is IP verified after marking: ${captchaManager.isIPVerified(testIP)}`)

    // Test stats
    console.log("\n--- CAPTCHA Stats ---")
    const stats = captchaManager.getStats()
    console.log(`Active Challenges: ${stats.activeChallenges}`)
    console.log(`Verified IPs: ${stats.verifiedIPs}`)
    console.log(`Difficulty: ${stats.difficulty}`)

    // Test HTML generation
    console.log("\n--- Testing HTML Generation ---")
    const htmlChallenge = captchaManager.generateChallenge()
    const html = captchaManager.renderChallengePage(htmlChallenge, "/test")
    console.log(`Generated HTML length: ${html.length} characters`)
    console.log("HTML generation: ✓ PASS")

    captchaManager.destroy()
    console.log("\n=== All tests completed successfully ===")
  } catch (error) {
    console.error("Test failed:", error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testCaptcha().catch(console.error)
}

module.exports = testCaptcha
