const NodeCache = require("node-cache")
const crypto = require("crypto")

class CaptchaManager {
  constructor(config, logger) {
    this.config = config
    this.logger = logger
    this.challengeCache = new NodeCache({ stdTTL: config.get("captcha.expiry", 300) })
    this.verifiedIPs = new NodeCache({ stdTTL: config.get("captcha.verification_ttl", 3600) })
    this.difficulty = config.get("captcha.difficulty", "medium")
  }

  generateChallenge() {
    const challengeId = crypto.randomUUID()
    const challenge = this.createMathChallenge()

    // Store challenge with answer
    this.challengeCache.set(challengeId, {
      answer: challenge.answer,
      question: challenge.question,
      created: Date.now(),
    })

    this.logger.debug(`Generated CAPTCHA challenge: ${challengeId}`)

    return {
      id: challengeId,
      question: challenge.question,
      type: challenge.type,
    }
  }

  createMathChallenge() {
    const challenges = {
      easy: () => {
        const a = Math.floor(Math.random() * 10) + 1
        const b = Math.floor(Math.random() * 10) + 1
        const operations = ["+", "-"]
        const op = operations[Math.floor(Math.random() * operations.length)]

        let answer
        let question

        if (op === "+") {
          answer = a + b
          question = `${a} + ${b}`
        } else {
          // Ensure positive result for subtraction
          const larger = Math.max(a, b)
          const smaller = Math.min(a, b)
          answer = larger - smaller
          question = `${larger} - ${smaller}`
        }

        return { question, answer, type: "math" }
      },

      medium: () => {
        const operations = [
          () => {
            const a = Math.floor(Math.random() * 20) + 1
            const b = Math.floor(Math.random() * 20) + 1
            return { question: `${a} + ${b}`, answer: a + b }
          },
          () => {
            const a = Math.floor(Math.random() * 50) + 10
            const b = Math.floor(Math.random() * 30) + 1
            return { question: `${a} - ${b}`, answer: a - b }
          },
          () => {
            const a = Math.floor(Math.random() * 12) + 1
            const b = Math.floor(Math.random() * 12) + 1
            return { question: `${a} × ${b}`, answer: a * b }
          },
        ]

        const challenge = operations[Math.floor(Math.random() * operations.length)]()
        return { ...challenge, type: "math" }
      },

      hard: () => {
        const operations = [
          () => {
            const a = Math.floor(Math.random() * 100) + 10
            const b = Math.floor(Math.random() * 100) + 10
            const c = Math.floor(Math.random() * 10) + 1
            return { question: `${a} + ${b} - ${c}`, answer: a + b - c }
          },
          () => {
            const a = Math.floor(Math.random() * 15) + 2
            const b = Math.floor(Math.random() * 15) + 2
            return { question: `${a} × ${b}`, answer: a * b }
          },
          () => {
            const base = Math.floor(Math.random() * 10) + 2
            const exp = Math.floor(Math.random() * 3) + 2
            return { question: `${base}^${exp}`, answer: Math.pow(base, exp) }
          },
        ]

        const challenge = operations[Math.floor(Math.random() * operations.length)]()
        return { ...challenge, type: "math" }
      },
    }

    const generator = challenges[this.difficulty] || challenges.medium
    return generator()
  }

  async verifyChallenge(challengeId, userAnswer) {
    if (!challengeId || userAnswer === undefined || userAnswer === null) {
      return false
    }

    const challenge = this.challengeCache.get(challengeId)
    if (!challenge) {
      this.logger.debug(`Challenge not found or expired: ${challengeId}`)
      return false
    }

    // Remove challenge after use (one-time use)
    this.challengeCache.del(challengeId)

    const isCorrect = Number.parseInt(userAnswer) === challenge.answer
    this.logger.debug(`Challenge ${challengeId} verification: ${isCorrect}`)

    return isCorrect
  }

  markIPAsVerified(ip) {
    this.verifiedIPs.set(ip, {
      verified: true,
      timestamp: Date.now(),
    })
    this.logger.debug(`Marked IP as verified: ${ip}`)
  }

  isIPVerified(ip) {
    const verification = this.verifiedIPs.get(ip)
    return !!verification?.verified
  }

  renderChallengePage(challenge, redirectUrl = "/") {
    const errorParam = new URLSearchParams(global.location?.search || "").get("error")
    const errorMessage = errorParam === "invalid" ? "Incorrect answer. Please try again." : ""

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Verification</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        
        .shield-icon {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            background: #667eea;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
        }
        
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 24px;
            font-weight: 600;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            line-height: 1.5;
        }
        
        .challenge-box {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .challenge-question {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
        }
        
        .challenge-prompt {
            color: #666;
            font-size: 14px;
        }
        
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        
        input[type="number"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e9ecef;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }
        
        input[type="number"]:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .submit-btn {
            width: 100%;
            background: #667eea;
            color: white;
            border: none;
            padding: 14px 20px;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        
        .submit-btn:hover {
            background: #5a6fd8;
        }
        
        .submit-btn:active {
            transform: translateY(1px);
        }
        
        .error-message {
            background: #fee;
            color: #c33;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #fcc;
        }
        
        .info-text {
            color: #666;
            font-size: 12px;
            margin-top: 20px;
            line-height: 1.4;
        }
        
        @media (max-width: 480px) {
            .container {
                padding: 30px 20px;
            }
            
            h1 {
                font-size: 20px;
            }
            
            .challenge-question {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="shield-icon">🛡️</div>
        <h1>Security Verification</h1>
        <p class="subtitle">Please solve this simple math problem to continue</p>
        
        ${errorMessage ? `<div class="error-message">${errorMessage}</div>` : ""}
        
        <div class="challenge-box">
            <div class="challenge-question">${challenge.question} = ?</div>
            <div class="challenge-prompt">What is the answer?</div>
        </div>
        
        <form method="POST" action="/captcha/verify">
            <input type="hidden" name="challenge" value="${challenge.id}">
            <input type="hidden" name="redirect" value="${redirectUrl}">
            
            <div class="form-group">
                <label for="answer">Your Answer:</label>
                <input 
                    type="number" 
                    id="answer" 
                    name="response" 
                    required 
                    autofocus
                    placeholder="Enter the answer"
                >
            </div>
            
            <button type="submit" class="submit-btn">Verify & Continue</button>
        </form>
        
        <p class="info-text">
            This verification helps protect against automated traffic. 
            Your answer will be verified and you'll be redirected to your destination.
        </p>
    </div>
    
    <script>
        // Auto-focus on the input field
        document.getElementById('answer').focus();
        
        // Handle form submission
        document.querySelector('form').addEventListener('submit', function(e) {
            const answer = document.getElementById('answer').value;
            if (!answer || answer.trim() === '') {
                e.preventDefault();
                alert('Please enter an answer');
                return false;
            }
        });
        
        // Handle Enter key
        document.getElementById('answer').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.querySelector('form').submit();
            }
        });
    </script>
</body>
</html>`
  }

  getStats() {
    return {
      activeChallenges: this.challengeCache.keys().length,
      verifiedIPs: this.verifiedIPs.keys().length,
      challengeStats: this.challengeCache.getStats(),
      verificationStats: this.verifiedIPs.getStats(),
      difficulty: this.difficulty,
    }
  }

  clearExpiredChallenges() {
    // NodeCache handles expiration automatically
    const stats = this.challengeCache.getStats()
    this.logger.debug(`Challenge cache stats: ${JSON.stringify(stats)}`)
  }

  clearVerifiedIPs() {
    this.verifiedIPs.flushAll()
    this.logger.info("Cleared all verified IPs")
  }

  destroy() {
    this.challengeCache.flushAll()
    this.verifiedIPs.flushAll()
    this.logger.info("CAPTCHA Manager destroyed")
  }
}

module.exports = CaptchaManager
