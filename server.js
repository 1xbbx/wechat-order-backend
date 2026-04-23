/**
 * 本地开发服务器（Express）
 * 
 * 用于本地调试，Vercel 部署时不会使用此文件
 * Vercel 会直接将 api/ 目录下的文件作为 Serverless Functions
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());                        // 跨域支持
app.use(express.json());                // 解析 JSON 请求体

// ========== 小程序端接口 ==========
const menuHandler = require('./api/menu');
const tableHandler = require('./api/table');
const orderHandler = require('./api/order');

app.get('/api/menu', menuHandler);
app.get('/api/table', tableHandler);
app.all('/api/order', orderHandler);

// ========== 管理端接口 ==========
const loginHandler = require('./api/admin/login');
const adminOrdersHandler = require('./api/admin/orders');
const adminProductsHandler = require('./api/admin/products');
const adminCategoriesHandler = require('./api/admin/categories');
const adminTablesHandler = require('./api/admin/tables');

app.post('/api/admin/login', loginHandler);
app.all('/api/admin/orders', adminOrdersHandler);
app.all('/api/admin/products', adminProductsHandler);
app.all('/api/admin/categories', adminCategoriesHandler);
app.all('/api/admin/tables', adminTablesHandler);

// 健康检查
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: { version: '1.0.0' },
    message: '微信小程序点单系统 API 运行中'
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ 服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('📱 小程序端接口:');
  console.log(`   GET  /api/menu`);
  console.log(`   GET  /api/table?scene=1003`);
  console.log(`   POST /api/order`);
  console.log(`   GET  /api/order?order_no=xxx`);
  console.log('');
  console.log('🔧 管理端接口:');
  console.log(`   POST /api/admin/login`);
  console.log(`   ALL  /api/admin/orders`);
  console.log(`   ALL  /api/admin/products`);
  console.log(`   ALL  /api/admin/categories`);
  console.log(`   ALL  /api/admin/tables`);
});
