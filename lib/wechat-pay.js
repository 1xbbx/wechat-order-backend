/**
 * lib/wechat-pay.js — 微信支付工具类
 * 
 * 封装微信支付 V2 API（MD5 签名 + XML 格式）
 * 
 * 环境变量：
 *   WECHAT_APPID       — 小程序 AppID
 *   WECHAT_MCH_ID      — 商户号
 *   WECHAT_API_KEY     — 商户 API 密钥（v2）
 *   WECHAT_NOTIFY_URL  — 支付回调地址
 */

const crypto = require('crypto');
const https = require('https');

// ==================== 工具函数 ====================

/**
 * 生成随机字符串（nonce_str）
 * @param {number} length 字符串长度，默认 32
 * @returns {string}
 */
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成 MD5 签名
 * 
 * 微信支付签名规则：
 * 1. 按参数名 ASCII 码从小到大排序
 * 2. 拼接成 key=value&key=value 格式（排除空值和 sign 字段）
 * 3. 末尾追加 &key=商户API密钥
 * 4. 对整串做 MD5 并转大写
 * 
 * @param {Object} params 签名参数
 * @param {string} apiKey 商户 API 密钥
 * @returns {string} 大写 MD5 签名
 */
function generateSign(params, apiKey) {
  // 第一步：按 key 的 ASCII 码排序
  const sortedKeys = Object.keys(params).sort();

  // 第二步：拼接字符串（跳过空值和 sign 字段）
  const stringA = sortedKeys
    .filter(key => {
      const val = params[key];
      return val !== '' && val !== undefined && val !== null && key !== 'sign';
    })
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // 第三步：拼接商户密钥
  const stringSignTemp = `${stringA}&key=${apiKey}`;

  // 第四步：MD5 加密并转大写
  return crypto
    .createHash('md5')
    .update(stringSignTemp, 'utf8')
    .digest('hex')
    .toUpperCase();
}

/**
 * 验证微信回调签名
 * @param {Object} data 回调数据（已解析为对象）
 * @param {string} apiKey 商户 API 密钥
 * @returns {boolean} 签名是否有效
 */
function verifySign(data, apiKey) {
  const receivedSign = data.sign;
  if (!receivedSign) return false;

  const calculatedSign = generateSign(data, apiKey);
  return receivedSign === calculatedSign;
}

// ==================== XML 处理 ====================

/**
 * 对象转 XML（微信支付请求格式）
 * @param {Object} obj 
 * @returns {string} XML 字符串
 */
function toXml(obj) {
  let xml = '<xml>';
  for (const key of Object.keys(obj)) {
    // 数字类型不需要 CDATA
    if (typeof obj[key] === 'number') {
      xml += `<${key}>${obj[key]}</${key}>`;
    } else {
      xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
    }
  }
  xml += '</xml>';
  return xml;
}

/**
 * XML 转对象（解析微信回调 XML）
 * 同时支持 CDATA 和非 CDATA 格式
 * @param {string} xml 
 * @returns {Object}
 */
function parseXml(xml) {
  const result = {};

  // 匹配 CDATA 格式: <key><![CDATA[value]]></key>
  const cdataRegex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>/g;
  let match;
  while ((match = cdataRegex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }

  // 匹配普通格式: <key>value</key>
  const plainRegex = /<(\w+)>([^<]+)<\/\1>/g;
  while ((match = plainRegex.exec(xml)) !== null) {
    // 不覆盖已有字段（CDATA 优先）
    if (!result[match[1]]) {
      result[match[1]] = match[2];
    }
  }

  return result;
}

// ==================== 核心支付方法 ====================

/**
 * 调用微信统一下单接口
 * 
 * @param {Object} orderData
 * @param {string} orderData.out_trade_no    — 商户订单号
 * @param {number} orderData.total_fee       — 总金额（单位：分）
 * @param {string} orderData.openid          — 用户 openid
 * @param {string} orderData.body            — 商品描述（选填，默认"微信点单"）
 * @param {string} orderData.spbill_create_ip — 客户端IP（选填）
 * 
 * @returns {Promise<Object>} 统一下单返回结果，含 prepay_id
 */
async function unifiedOrder(orderData) {
  const apiKey = process.env.WECHAT_API_KEY;

  // 构建请求参数
  const params = {
    appid: process.env.WECHAT_APPID,
    mch_id: process.env.WECHAT_MCH_ID,
    nonce_str: generateNonceStr(),
    body: orderData.body || '微信点单',
    out_trade_no: orderData.out_trade_no,
    total_fee: orderData.total_fee,       // 单位：分
    spbill_create_ip: orderData.spbill_create_ip || '127.0.0.1',
    notify_url: process.env.WECHAT_NOTIFY_URL,
    trade_type: 'JSAPI',
    openid: orderData.openid
  };

  // 生成签名
  params.sign = generateSign(params, apiKey);

  // 转为 XML
  const xml = toXml(params);

  // 发起 HTTPS 请求到微信支付
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mch.weixin.qq.com',
      path: '/pay/unifiedorder',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(xml, 'utf8')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        const result = parseXml(data);
        if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
          resolve(result);
        } else {
          const errMsg = result.return_msg || result.err_code_des || '统一下单失败';
          console.error('统一下单失败:', result);
          reject(new Error(errMsg));
        }
      });
    });

    req.on('error', (err) => {
      console.error('请求微信下单接口异常:', err);
      reject(err);
    });

    req.write(xml);
    req.end();
  });
}

/**
 * 生成前端 wx.requestPayment 所需的支付参数
 * 
 * @param {string} prepayId 预支付交易会话标识（统一下单返回）
 * @returns {Object} { timeStamp, nonceStr, package, signType, paySign }
 */
function getPaymentParams(prepayId) {
  const apiKey = process.env.WECHAT_API_KEY;

  // 注意：前端 wx.requestPayment 的参数名是驼峰，但签名时用的字段名要注意大小写
  const params = {
    appId: process.env.WECHAT_APPID,
    timeStamp: String(Math.floor(Date.now() / 1000)),
    nonceStr: generateNonceStr(),
    package: `prepay_id=${prepayId}`,
    signType: 'MD5'
  };

  // 生成支付签名
  params.paySign = generateSign(params, apiKey);

  return params;
}

module.exports = {
  generateSign,
  verifySign,
  generateNonceStr,
  unifiedOrder,
  getPaymentParams,
  toXml,
  parseXml
};
