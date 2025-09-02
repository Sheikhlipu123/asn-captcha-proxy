const crypto = require("crypto")

class CaptchaGenerator {
  static generateImageCaptcha(width = 200, height = 80) {
    // Simple text-based CAPTCHA for demonstration
    // In production, you might want to use a proper image generation library
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let text = ""

    for (let i = 0; i < 5; i++) {
      text += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    return {
      text: text,
      image: CaptchaGenerator.generateSVGCaptcha(text, width, height),
    }
  }

  static generateSVGCaptcha(text, width = 200, height = 80) {
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]
    const bgColor = "#F8F9FA"

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="100%" height="100%" fill="${bgColor}"/>`

    // Add noise lines
    for (let i = 0; i < 5; i++) {
      const x1 = Math.random() * width
      const y1 = Math.random() * height
      const x2 = Math.random() * width
      const y2 = Math.random() * height
      const color = colors[Math.floor(Math.random() * colors.length)]

      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.3"/>`
    }

    // Add text
    const fontSize = 32
    const letterSpacing = width / (text.length + 1)

    for (let i = 0; i < text.length; i++) {
      const x = letterSpacing * (i + 1)
      const y = height / 2 + fontSize / 3
      const rotation = (Math.random() - 0.5) * 30 // Random rotation between -15 and 15 degrees
      const color = colors[Math.floor(Math.random() * colors.length)]

      svg += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="middle" transform="rotate(${rotation} ${x} ${y})">${text[i]}</text>`
    }

    // Add noise dots
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const color = colors[Math.floor(Math.random() * colors.length)]

      svg += `<circle cx="${x}" cy="${y}" r="2" fill="${color}" opacity="0.5"/>`
    }

    svg += "</svg>"

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  }

  static generateWordCaptcha() {
    const words = [
      "apple",
      "house",
      "water",
      "light",
      "music",
      "happy",
      "green",
      "quick",
      "smart",
      "brave",
      "ocean",
      "mountain",
      "flower",
      "sunset",
      "rainbow",
    ]

    const word = words[Math.floor(Math.random() * words.length)]
    const scrambled = word
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("")

    return {
      question: `Unscramble this word: ${scrambled.toUpperCase()}`,
      answer: word.toLowerCase(),
      type: "word",
    }
  }

  static generateSequenceCaptcha() {
    const sequences = [
      { pattern: [2, 4, 6, 8], next: 10, description: "even numbers" },
      { pattern: [1, 3, 5, 7], next: 9, description: "odd numbers" },
      { pattern: [1, 4, 7, 10], next: 13, description: "add 3" },
      { pattern: [2, 6, 18, 54], next: 162, description: "multiply by 3" },
      { pattern: [1, 1, 2, 3], next: 5, description: "Fibonacci" },
    ]

    const sequence = sequences[Math.floor(Math.random() * sequences.length)]

    return {
      question: `What comes next in this sequence: ${sequence.pattern.join(", ")}, ?`,
      answer: sequence.next,
      type: "sequence",
      hint: sequence.description,
    }
  }
}

module.exports = CaptchaGenerator
