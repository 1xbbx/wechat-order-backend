/**
 * GET /api/table?scene=1003
 * 
 * 根据小程序码的 scene 参数查询桌台信息
 * 小程序扫码进入时，会携带 scene_id，用于识别对应桌号
 * 
 * 查询参数：
 *   scene - 小程序码 scene 值（对应 tables.scene_id）
 * 
 * 返回：桌台信息（table_number, table_name 等）
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
    // 1. 获取 scene 参数
    const { scene } = req.query;

    if (!scene) {
      return res.status(400).json({
        success: false,
        data: null,
        message: '缺少 scene 参数'
      });
    }

    // 2. 根据 scene_id 查询桌台
    const { data: table, error } = await supabaseAdmin
      .from('tables')
      .select('id, table_number, table_name, scene_id, is_active')
      .eq('scene_id', scene)
      .single();   // 期望只返回一条记录

    if (error || !table) {
      console.error('查询桌台失败:', error);
      return res.status(404).json({
        success: false,
        data: null,
        message: '未找到对应桌台，请确认二维码是否正确'
      });
    }

    // 3. 检查桌台是否启用
    if (!table.is_active) {
      return res.status(403).json({
        success: false,
        data: null,
        message: '该桌台已停用，请联系服务员'
      });
    }

    // 4. 返回桌台信息
    return res.status(200).json({
      success: true,
      data: table,
      message: '获取桌台信息成功'
    });
  } catch (error) {
    console.error('获取桌台信息异常:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: '服务器内部错误'
    });
  }
};
