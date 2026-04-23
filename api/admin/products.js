/**
 * /api/admin/products
 * 
 * GET    /api/admin/products — 获取所有菜品（含已下架）
 * POST   /api/admin/products — 新增菜品
 * PATCH  /api/admin/products — 更新菜品信息
 * DELETE /api/admin/products — 删除菜品
 * 
 * 所有管理接口需要 header: Authorization: Bearer <token>
 */

const { supabaseAdmin } = require('../../lib/supabase');
const { verifyAdmin } = require('../../lib/auth');

module.exports = async (req, res) => {
  // 验证管理员身份
  const authResult = verifyAdmin(req);
  if (!authResult.valid) {
    return res.status(401).json({
      success: false,
      data: null,
      message: authResult.message
    });
  }

  switch (req.method) {
    case 'GET':
      return handleGetProducts(req, res);
    case 'POST':
      return handleCreateProduct(req, res);
    case 'PATCH':
      return handleUpdateProduct(req, res);
    case 'DELETE':
      return handleDeleteProduct(req, res);
    default:
      return res.status(405).json({
        success: false,
        data: null,
        message: '不支持的请求方法'
      });
  }
};

/**
 * GET /api/admin/products
 * 获取所有菜品（包括已下架），按分类和排序权重排列
 */
async function handleGetProducts(req, res) {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*, categories(name)')  // 联表查询分类名
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('查询菜品列表失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询菜品列表失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: products,
      message: '获取菜品列表成功'
    });
  } catch (error) {
    console.error('查询菜品异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * POST /api/admin/products
 * 新增菜品
 * 
 * 请求体：
 * {
 *   category_id: "uuid",
 *   name: "宫保鸡丁",
 *   description: "经典川菜",
 *   price: 38.00,
 *   image_url: "https://...",
 *   available: true,
 *   sort_order: 1
 * }
 */
async function handleCreateProduct(req, res) {
  try {
    const { category_id, name, description, price, image_url, available, sort_order } = req.body;

    // 参数校验
    if (!category_id || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少必填字段：category_id, name, price'
      });
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        category_id,
        name,
        description: description || '',
        price: Number(price),
        image_url: image_url || '',
        available: available !== false,  // 默认上架
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) {
      console.error('新增菜品失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '新增菜品失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
      message: '菜品添加成功'
    });
  } catch (error) {
    console.error('新增菜品异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * PATCH /api/admin/products
 * 更新菜品信息（上下架、改价、改名等）
 * 
 * 请求体：
 * {
 *   id: "uuid",
 *   name: "新名字",       // 可选
 *   price: 42.00,         // 可选
 *   available: false,      // 可选
 *   ...其他字段
 * }
 */
async function handleUpdateProduct(req, res) {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少菜品 id'
      });
    }

    // 只允许更新指定字段
    const allowedFields = ['category_id', 'name', 'description', 'price', 'image_url', 'available', 'sort_order'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '没有需要更新的字段'
      });
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新菜品失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '更新菜品失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
      message: '菜品更新成功'
    });
  } catch (error) {
    console.error('更新菜品异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * DELETE /api/admin/products
 * 删除菜品
 * 
 * 请求体：{ id: "uuid" }
 */
async function handleDeleteProduct(req, res) {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少菜品 id'
      });
    }

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除菜品失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '删除菜品失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: null,
      message: '菜品删除成功'
    });
  } catch (error) {
    console.error('删除菜品异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}
