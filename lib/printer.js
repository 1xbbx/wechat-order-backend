/**
 * lib/printer.js — 芯烨云打印机工具
 * 
 * 支持芯烨云 OPEN API 打印小票
 * 
 * 环境变量：
 *   PRINTER_SN        — 打印机编号（设备背面）
 *   PRINTER_USER      — 芯烨云开发者用户名
 *   PRINTER_UKEY      — 芯烨云开发者 UKEY
 */

const https = require('https');
const crypto = require('crypto');

const API_URL = 'https://open.xpyun.net/api/openapi/xprinter/print';

/**
 * 调用芯烨云打印 API
 * @param {string} content 打印内容（ESC/POS 格式）
 * @returns {Promise<Object>}
 */
async function sendToPrinter(content) {
  const user = process.env.PRINTER_USER;
  const ukey = process.env.PRINTER_UKEY;
  const sn = process.env.PRINTER_SN;

  if (!user || !ukey || !sn) {
    throw new Error('打印机环境变量未配置（PRINTER_USER, PRINTER_UKEY, PRINTER_SN）');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // 芯烨云签名：MD5(user + ukey + timestamp)
  const sign = crypto
    .createHash('md5')
    .update(user + ukey + timestamp)
    .digest('hex');

  const body = JSON.stringify({
    user,
    timestamp,
    sign,
    debug: 0,
    sn,
    content,
    copies: 1,
    voice: 2      // 蜂鸣提醒：2 = 响 2 次
  });

  return new Promise((resolve, reject) => {
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ msg: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * 格式化并打印订单小票
 * 
 * @param {Object} order  订单信息
 * @param {Array}  items  订单明细
 */
async function printOrder(order, items) {
  // 构建小票内容（芯烨云 ESC/POS 格式）
  let content = '';

  // 居中大标题
  content += '<CB>点单小票</CB>\n';
  content += '================================\n';
  content += `订单号: ${order.order_no}\n`;
  content += `桌号:   ${order.table_number}\n`;
  content += `时间:   ${new Date(order.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  content += '================================\n';

  // 菜品明细表头
  content += '<L>菜品           数量    小计</L>\n';
  content += '--------------------------------\n';

  // 逐条打印菜品
  for (const item of items) {
    const name = item.product_name.padEnd(10, '　');  // 中文全角空格补齐
    const qty = String(item.quantity).padStart(2, ' ');
    const sub = item.subtotal.toFixed(2).padStart(8, ' ');
    content += `${name} x${qty}  ${sub}\n`;
  }

  content += '================================\n';
  content += `<B>合计: ¥${order.total_amount.toFixed(2)}</B>\n`;

  if (order.remark) {
    content += `备注: ${order.remark}\n`;
  }

  content += '================================\n';
  content += '<QR>https://example.com</QR>\n';   // 可替换为小程序码链接
  content += '\n\n\n';   // 留白方便撕纸

  // 发送到打印机
  const result = await sendToPrinter(content);
  console.log('打印结果:', result);
  return result;
}

module.exports = {
  sendToPrinter,
  printOrder
};
