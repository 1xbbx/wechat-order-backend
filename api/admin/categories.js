/**
 * /api/admin/categories
 * 
 * GET    /api/admin/categories — 获取所有分类
 * POST   /api/admin/categories — 新增分类
 * PATCH  /api/admin/categories — 更新分类
 * DELETE /api/admin/categories — 删除分类
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
      return handleGetCategories(req, res);
    case 'POST':
      return handleCreateCategory(req, res);
    case 'PATCH':
      return handleUpdateCategory(req, res);
    case 'DELETE':
      return handleDeleteCategory(req, res);
    default:
      return res.status(405).json({
        success: false,
        data: null,
        message: '不支持的请求方法'
      });
  }
};

/**
 * GET /api/admin/categories
 * 获取所有分类，按 sort_order 排序
 */
async function handleGetCategories(req, res) {
  try {
    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('查询分类列表失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询分类列表失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: categories,
      message: '获取分类列表成功'
    });
  } catch (error) {
    console.error('查询分类异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * POST /api/admin/categories
 * 新增分类
 * 
 * 请求体：
 * {
 *   name: "烧烤",
 *   icon: "🍖",
 *   sort_order: 5
 * }
 */
async function handleCreateCategory(req, res) {
  try {
    const { name, icon, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少分类名称 name'
      });
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name,
        icon: icon || '',
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (error) {
      console.error('新增分类失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '新增分类失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
      message: '分类添加成功'
    });
  } catch (error) {
    console.error('新增分类异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * PATCH /api/admin/categories
 * 更新分类信息
 * 
 * 请求体：
 * {
 *   id: "uuid",
 *   name: "新名称",
 *   icon: "🍖",
 *   sort_order: 5
 * }
 */
async function handleUpdateCategory(req, res) {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少分类 id'
      });
    }

    // 只允许更新指定字段
    const allowedFields = ['name', 'icon', 'sort_order'];
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

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新分类失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '更新分类失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
      message: '分类更新成功'
    });
  } catch (error) {
    console.error('更新分类异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * DELETE /api/admin/categories
 * 删除分类（注意：会级联删除该分类下的所有菜品）
 * 
 * 请求体：{ id: "uuid" }
 */
async function handleDeleteCategory(req, res) {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少分类 id'
      });
    }

    // 先检查分类下是否有菜品
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('category_id', id);

    if (products && products.length > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `该分类下还有 ${products.length} 个菜品，请先移除或转移菜品`
      });
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除分类失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '删除分类失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: null,
      message: '分类删除成功'
    });
  } catch (error) {
    console.error('删除分类异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}
