/**
 * GET /api/menu
 * 
 * 获取完整菜单：所有分类 + 每个分类下的菜品
 * 返回格式：分类列表，每个分类包含 products 数组
 * 只返回上架（available=true）的菜品
 */

const { supabaseAdmin } = require('../lib/supabase');

module.exports = async (req, res) => {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      data: null,
      message: '仅支持 GET 请求'
    });
  }

  try {
    // 1. 查询所有分类，按 sort_order 排序
    const { data: categories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id, name, icon, sort_order')
      .order('sort_order', { ascending: true });

    if (catError) {
      console.error('查询分类失败:', catError);
      return res.status(500).json({
        success: false,
        data: null,
        message: '获取分类失败'
      });
    }

    // 2. 查询所有上架菜品，按 sort_order 排序
    const { data: products, error: prodError } = await supabaseAdmin
      .from('products')
      .select('id, category_id, name, description, price, image_url, sort_order')
      .eq('available', true)
      .order('sort_order', { ascending: true });

    if (prodError) {
      console.error('查询菜品失败:', prodError);
      return res.status(500).json({
        success: false,
        data: null,
        message: '获取菜品失败'
      });
    }

    // 3. 将菜品按分类分组，组装成嵌套结构
    const menu = categories.map(category => ({
      ...category,
      products: products.filter(p => p.category_id === category.id)
    }));

    // 4. 返回完整菜单
    return res.status(200).json({
      success: true,
      data: menu,
      message: '获取菜单成功'
    });
  } catch (error) {
    console.error('获取菜单异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
};
