/**
 * 本地开发服务器（Express）
 * Vercel 部署时不会使用此文件
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
// 支付回调需要原始 XML body
app.use('/api/payment/notify', express.text({ type: 'text/xml' }));

// ========== 小程序端接口 ==========
app.get('/api/menu', require('./api/menu'));
app.get('/api/table', require('./api/table'));
app.get('/api/order', require('./api/order/index'));
app.post('/api/order/create', require('./api/order/create'));

// ========== 支付接口 ==========
app.post('/api/payment/prepay', require('./api/payment/prepay'));
app.post('/api/payment/notify', require('./api/payment/notify'));

// ========== 管理端接口 ==========
app.post('/api/admin/login', require('./api/admin/login'));
app.all('/api/admin/orders', require('./api/admin/orders'));
app.all('/api/admin/products', require('./api/admin/products'));
app.all('/api/admin/categories', require('./api/admin/categories'));
app.all('/api/admin/tables', require('./api/admin/tables'));

// 健康检查
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: { version: '1.1.0' },
    message: '微信小程序点单系统 API 运行中'
  });
});

app.listen(PORT, () => {
  console.log(`✅ 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('📱 小程序端:');
  console.log('   GET  /api/menu');
  console.log('   GET  /api/table?scene=1003');
  console.log('   GET  /api/order?order_no=xxx');
  console.log('   POST /api/order/create');
  console.log('');
  console.log('💰 支付:');
  console.log('   POST /api/payment/prepay');
  console.log('   POST /api/payment/notify');
  console.log('');
  console.log('🔧 管理端:');
  console.log('   POST /api/admin/login');
  console.log('   ALL  /api/admin/orders');
  console.log('   ALL  /api/admin/products');
  console.log('   ALL  /api/admin/categories');
  console.log('   ALL  /api/admin/tables');
});
