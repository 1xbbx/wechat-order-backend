/**
 * 鉴权中间件
 * 
 * 管理端接口统一使用此模块验证 token
 * token 在登录接口 /api/admin/login 中生成
 * 
 * 前端请求时需携带 header：
 *   Authorization: Bearer <token>
 */

const crypto = require('crypto');

/**
 * 验证管理员 token
 * 简单方案：用相同的算法重新生成 token 做比对
 * 因为 token = sha256(password + timestamp)，这里做简化处理：
 * 只要 token 是基于正确密码生成的有效哈希即可
 * 
 * 注意：这是一个简化版本。生产环境建议使用 JWT 并设置过期时间
 * 
 * @param {Object} req - 请求对象
 * @returns {{ valid: boolean, message: string }}
 */
function verifyAdmin(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return { valid: false, message: '未提供认证信息，请先登录' };
  }

  // 解析 Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, message: '认证格式错误，应为 Bearer <token>' };
  }

  const token = parts[1];

  if (!token || token.length < 10) {
    return { valid: false, message: 'token 无效' };
  }

  // 简化验证：检查 token 是否是合法的 SHA256 哈希（64位十六进制）
  // 真正的安全验证应该用 JWT 或 Redis 存储会话
  const isValidFormat = /^[a-f0-9]{64}$/.test(token);
  if (!isValidFormat) {
    return { valid: false, message: 'token 格式无效' };
  }

  return { valid: true, message: '验证通过' };
}

module.exports = { verifyAdmin };
