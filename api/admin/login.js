/**
 * POST /api/admin/login
 * 
 * 前台管理员登录（简单密码验证）
 * 不涉及用户体系，使用环境变量中的 ADMIN_PASSWORD 做校验
 * 
 * 请求体：{ password: "xxx" }
 * 返回：{ success: true, data: { token: "xxx" } }
 * 
 * token 是简单的 Base64 编码，前端每次请求管理接口时带上
 * 注意：生产环境建议使用 JWT
 */

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      data: null,
      message: '仅支持 POST 请求'
    });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '请输入密码'
      });
    }

    // 校验密码
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (password !== adminPassword) {
      return res.status(401).json({
        success: false,
        data: null,
        message: '密码错误'
      });
    }

    // 生成简易 token（密码 + 时间戳的哈希值）
    const timestamp = Date.now();
    const raw = `${adminPassword}:${timestamp}`;
    const token = crypto.createHash('sha256').update(raw).digest('hex');

    // 存储 token 有效期信息（这里用简单方案：token = hash，前端带上即可）
    // 实际生产建议用 JWT 设置过期时间
    return res.status(200).json({
      success: true,
      data: { token, expires_in: 86400 },  // 提示前端 24 小时有效
      message: '登录成功'
    });
  } catch (error) {
    console.error('登录异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
};
