/**
 * /api/admin/tables
 * 
 * GET    /api/admin/tables — 获取所有桌台
 * POST   /api/admin/tables — 新增桌台
 * PATCH  /api/admin/tables — 更新桌台信息
 * DELETE /api/admin/tables — 删除桌台
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
      return handleGetTables(req, res);
    case 'POST':
      return handleCreateTable(req, res);
    case 'PATCH':
      return handleUpdateTable(req, res);
    case 'DELETE':
      return handleDeleteTable(req, res);
    default:
      return res.status(405).json({
        success: false,
        data: null,
        message: '不支持的请求方法'
      });
  }
};

/**
 * GET /api/admin/tables
 * 获取所有桌台列表
 */
async function handleGetTables(req, res) {
  try {
    const { data: tables, error } = await supabaseAdmin
      .from('tables')
      .select('*')
      .order('table_number', { ascending: true });

    if (error) {
      console.error('查询桌台列表失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '查询桌台列表失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: tables,
      message: '获取桌台列表成功'
    });
  } catch (error) {
    console.error('查询桌台异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * POST /api/admin/tables
 * 新增桌台
 * 
 * 请求体：
 * {
 *   table_number: "C1",
 *   table_name: "露天1号桌",
 *   scene_id: "2001",
 *   is_active: true
 * }
 */
async function handleCreateTable(req, res) {
  try {
    const { table_number, table_name, scene_id, is_active } = req.body;

    if (!table_number) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少桌号 table_number'
      });
    }

    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .insert({
        table_number,
        table_name: table_name || '',
        scene_id: scene_id || null,
        is_active: is_active !== false  // 默认启用
      })
      .select()
      .single();

    if (error) {
      console.error('新增桌台失败:', error);
      // 检查是否是唯一约束冲突
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          data: null,
          message: '桌号或 scene_id 已存在，请检查是否重复'
        });
      }
      return res.status(500).json({
        success: false,
        data: null,
        message: '新增桌台失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: table,
      message: '桌台添加成功'
    });
  } catch (error) {
    console.error('新增桌台异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * PATCH /api/admin/tables
 * 更新桌台信息（改名、改 scene_id、启用/停用）
 * 
 * 请求体：
 * {
 *   id: "uuid",
 *   table_name: "新名称",
 *   is_active: false
 * }
 */
async function handleUpdateTable(req, res) {
  try {
    const { id, ...updates } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少桌台 id'
      });
    }

    // 只允许更新指定字段
    const allowedFields = ['table_number', 'table_name', 'scene_id', 'is_active'];
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

    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新桌台失败:', error);
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          data: null,
          message: '桌号或 scene_id 已被其他桌台使用'
        });
      }
      return res.status(500).json({
        success: false,
        data: null,
        message: '更新桌台失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: table,
      message: '桌台更新成功'
    });
  } catch (error) {
    console.error('更新桌台异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}

/**
 * DELETE /api/admin/tables
 * 删除桌台
 * 
 * 请求体：{ id: "uuid" }
 */
async function handleDeleteTable(req, res) {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少桌台 id'
      });
    }

    const { error } = await supabaseAdmin
      .from('tables')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除桌台失败:', error);
      return res.status(500).json({
        success: false,
        data: null,
        message: '删除桌台失败'
      });
    }

    return res.status(200).json({
      success: true,
      data: null,
      message: '桌台删除成功'
    });
  } catch (error) {
    console.error('删除桌台异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
}
