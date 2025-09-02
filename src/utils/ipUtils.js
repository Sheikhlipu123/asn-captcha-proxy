const net = require("net")

/**
 * Extract client IP address from request
 */
function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1"
  )
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip) {
  if (!net.isIP(ip)) return false

  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ]

  return privateRanges.some((range) => range.test(ip))
}

/**
 * Validate IP address format
 */
function isValidIP(ip) {
  return net.isIP(ip) !== 0
}

module.exports = {
  getClientIP,
  isPrivateIP,
  isValidIP,
}
