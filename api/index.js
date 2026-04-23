/**
 * /api/index
 * 根路径健康检查
 */
module.exports = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      endpoints: [
        'GET  /api/menu',
        'GET  /api/table?scene=xxx',
        'POST /api/order',
        'GET  /api/order?order_no=xxx',
        'POST /api/admin/login',
        'GET  /api/admin/orders',
        'PATCH /api/admin/orders',
        'ALL  /api/admin/products',
        'ALL  /api/admin/categories',
        'ALL  /api/admin/tables'
      ]
    },
    message: '微信小程序点单系统 API 运行中'
  });
};
