/**
 * 后台管理逻辑 — app.js
 * 
 * 功能：
 * 1. 密码登录 / Token 管理
 * 2. 订单管理（列表、状态操作、Realtime 实时推送）
 * 3. 菜品管理（CRUD、上下架、图片上传）
 */

// ==================== 配置 ====================

// 后端 API 地址（同域，相对路径即可）
const API_BASE = '';

// Supabase 配置（用于 Realtime 订阅）
// ⚠️ 这里填你的 Supabase 项目信息，anon key 是安全的公开密钥
const SUPABASE_URL = 'https://vnrtfblebqmciumysvdj.supabase.co';
const SUPABASE_ANON_KEY = ''; // 在此填入你的 anon key，或留空则不启用实时推送

// ==================== 全局状态 ====================

let token = localStorage.getItem('admin_token') || '';
let allOrders = [];           // 所有订单
let allCategories = [];       // 所有分类
let currentFilter = '';       // 当前订单筛选状态
let supabaseClient = null;    // Supabase 客户端
let newOrderCount = 0;        // 新订单计数

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  // 回车登录
  document.getElementById('passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // 检查是否已登录
  if (token) {
    showMainView();
  }
});

// ==================== 登录 ====================

async function handleLogin() {
  const password = document.getElementById('passwordInput').value.trim();
  if (!password) {
    showLoginError('请输入密码');
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.textContent = '登录中...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      token = data.data.token;
      localStorage.setItem('admin_token', token);
      showLoginError('');
      showMainView();
    } else {
      showLoginError(data.message || '密码错误');
    }
  } catch (e) {
    showLoginError('网络错误，请重试');
  } finally {
    btn.textContent = '登 录';
    btn.disabled = false;
  }
}

function handleLogout() {
  token = '';
  localStorage.removeItem('admin_token');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('mainView').classList.add('hidden');
  // 断开 Realtime
  if (supabaseClient) {
    supabaseClient.removeAllChannels();
  }
}

function showLoginError(msg) {
  document.getElementById('loginError').textContent = msg;
}

// ==================== 主界面 ====================

function showMainView() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');

  // 加载订单
  loadOrders();

  // 初始化 Realtime
  initRealtime();
}

// ==================== Tab 切换 ====================

function switchTab(tab, el) {
  // 高亮 Tab
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  // 切换页面
  document.getElementById('ordersPage').classList.toggle('hidden', tab !== 'orders');
  document.getElementById('productsPage').classList.toggle('hidden', tab !== 'products');

  // 更新标题
  document.getElementById('pageTitle').textContent = tab === 'orders' ? '📋 订单管理' : '🍜 菜品管理';

  // 加载数据
  if (tab === 'orders') {
    loadOrders();
  } else {
    loadProducts();
  }
}

// ==================== 订单管理 ====================

/**
 * 加载订单列表
 */
async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success) {
      allOrders = data.data || [];
      renderOrders();
    } else if (res.status === 401) {
      handleLogout();
    }
  } catch (e) {
    document.getElementById('ordersList').innerHTML = '<div class="empty-tip">加载失败，请刷新</div>';
  }
}

/**
 * 渲染订单列表
 */
function renderOrders() {
  const container = document.getElementById('ordersList');

  // 筛选
  let orders = allOrders;
  if (currentFilter) {
    orders = orders.filter(o => o.status === currentFilter);
  }

  if (orders.length === 0) {
    container.innerHTML = '<div class="empty-tip">暂无订单</div>';
    return;
  }

  container.innerHTML = orders.map(order => {
    // 状态标签
    const statusMap = {
      pending: { text: '待处理', cls: 'status-pending' },
      paid: { text: '已支付', cls: 'status-paid' },
      done: { text: '已完成', cls: 'status-done' }
    };
    const st = statusMap[order.status] || { text: order.status, cls: '' };

    // 菜品概要
    const itemsSummary = (order.items || [])
      .map(i => `${i.product_name} ×${i.quantity}`)
      .join('、') || '—';

    // 时间
    const time = formatTime(order.created_at);

    // 操作按钮
    let actionHtml = '';
    if (order.status === 'pending' || order.status === 'paid') {
      actionHtml = `
        <div class="order-action">
          <button class="action-btn btn-process" onclick="updateOrderStatus('${order.id}', 'done')">
            ✅ 已收款，完成订单
          </button>
        </div>`;
    } else if (order.status === 'done') {
      actionHtml = `
        <div class="order-action">
          <button class="action-btn btn-done-label">✅ 已完成</button>
        </div>`;
    }

    // 备注
    const remarkHtml = order.remark ? `<div class="order-remark">📝 ${escapeHtml(order.remark)}</div>` : '';

    return `
      <div class="order-card" id="order-${order.id}">
        <div class="order-header">
          <span class="order-table">🍽️ ${escapeHtml(order.table_number)}号桌</span>
          <span class="order-status ${st.cls}">${st.text}</span>
        </div>
        <div class="order-no">${escapeHtml(order.order_no)}</div>
        <div class="order-items">${escapeHtml(itemsSummary)}</div>
        ${remarkHtml}
        <div class="order-footer">
          <span class="order-price">¥${Number(order.total_amount).toFixed(2)}</span>
          <span class="order-time">${time}</span>
        </div>
        ${actionHtml}
      </div>`;
  }).join('');
}

/**
 * 筛选订单
 */
function filterOrders(el, status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderOrders();
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: orderId, status: newStatus })
    });

    const data = await res.json();

    if (data.success) {
      // 本地更新
      const order = allOrders.find(o => o.id === orderId);
      if (order) order.status = newStatus;
      renderOrders();
    } else {
      alert(data.message || '操作失败');
    }
  } catch (e) {
    alert('网络错误');
  }
}

// ==================== Supabase Realtime ====================

function initRealtime() {
  if (!SUPABASE_ANON_KEY || !window.supabase) return;

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 订阅 orders 表的 INSERT 事件
    supabaseClient
      .channel('admin-orders')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('🔔 新订单:', payload.new);
          handleNewOrder(payload.new);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('📝 订单更新:', payload.new);
          handleOrderUpdate(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('Realtime 状态:', status);
      });
  } catch (e) {
    console.error('Realtime 初始化失败:', e);
  }
}

/**
 * 处理新订单推送
 */
function handleNewOrder(newOrder) {
  // 避免重复
  if (allOrders.find(o => o.id === newOrder.id)) return;

  // 加到列表顶部（需要重新获取含明细的数据）
  loadOrders();

  // 计数 + 提示
  newOrderCount++;
  const alert = document.getElementById('newOrderAlert');
  document.getElementById('newOrderCount').textContent = newOrderCount;
  alert.classList.remove('hidden');

  // 播放提示音
  playBeep();
}

/**
 * 处理订单状态更新
 */
function handleOrderUpdate(updatedOrder) {
  const order = allOrders.find(o => o.id === updatedOrder.id);
  if (order) {
    order.status = updatedOrder.status;
    renderOrders();
  }
}

/**
 * 关闭新订单提醒
 */
function dismissAlert() {
  newOrderCount = 0;
  document.getElementById('newOrderAlert').classList.add('hidden');
}

/**
 * 播放提示音（Web Audio API）
 */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // 第一声
    playTone(ctx, 880, 0, 0.15);
    // 第二声（稍高音）
    playTone(ctx, 1100, 0.2, 0.15);
    // 第三声
    playTone(ctx, 1320, 0.4, 0.2);
  } catch (e) {
    console.log('无法播放提示音');
  }
}

function playTone(ctx, freq, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}

// ==================== 菜品管理 ====================

/**
 * 加载菜品列表
 */
async function loadProducts() {
  try {
    // 先加载分类
    const catRes = await fetch(`${API_BASE}/api/admin/categories`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const catData = await catRes.json();
    if (catData.success) {
      allCategories = catData.data || [];
    }

    // 加载菜品
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      renderProducts(data.data || []);
    } else if (res.status === 401) {
      handleLogout();
    }
  } catch (e) {
    document.getElementById('productsList').innerHTML = '<div class="empty-tip">加载失败</div>';
  }
}

/**
 * 渲染菜品列表
 */
function renderProducts(products) {
  const container = document.getElementById('productsList');

  if (products.length === 0) {
    container.innerHTML = '<div class="empty-tip">暂无菜品，点击上方"新增菜品"</div>';
    return;
  }

  // 按分类名找
  const catMap = {};
  allCategories.forEach(c => { catMap[c.id] = c.name; });

  container.innerHTML = products.map(p => {
    const catName = catMap[p.category_id] || '未分类';
    const img = p.image_url || '';
    const imgHtml = img
      ? `<img class="product-img" src="${escapeHtml(img)}" alt="">`
      : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;font-size:28px;">🍜</div>`;

    const toggleBtn = p.available
      ? `<button class="prod-btn btn-toggle-on" onclick="toggleProduct('${p.id}', false)">在售</button>`
      : `<button class="prod-btn btn-toggle-off" onclick="toggleProduct('${p.id}', true)">售罄</button>`;

    return `
      <div class="product-card ${p.available ? '' : 'product-unavailable'}">
        ${imgHtml}
        <div class="product-info">
          <div class="product-name">${escapeHtml(p.name)}</div>
          <div class="product-meta">${escapeHtml(catName)}</div>
          <div class="product-price">¥${Number(p.price).toFixed(2)}</div>
        </div>
        <div class="product-actions">
          ${toggleBtn}
          <button class="prod-btn btn-edit" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "\\'")})'>编辑</button>
          <button class="prod-btn btn-delete" onclick="deleteProduct('${p.id}', '${escapeHtml(p.name)}')">删除</button>
        </div>
      </div>`;
  }).join('');
}

/**
 * 切换上架/下架
 */
async function toggleProduct(productId, available) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: productId, available })
    });

    const data = await res.json();
    if (data.success) {
      loadProducts();
    } else {
      alert(data.message || '操作失败');
    }
  } catch (e) {
    alert('网络错误');
  }
}

/**
 * 删除菜品
 */
async function deleteProduct(productId, name) {
  if (!confirm(`确定删除「${name}」吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/products`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: productId })
    });

    const data = await res.json();
    if (data.success) {
      loadProducts();
    } else {
      alert(data.message || '删除失败');
    }
  } catch (e) {
    alert('网络错误');
  }
}

// ==================== 菜品编辑弹窗 ====================

/**
 * 显示新增菜品表单
 */
function showProductForm() {
  document.getElementById('modalTitle').textContent = '新增菜品';
  document.getElementById('editProductId').value = '';
  document.getElementById('prodName').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodDesc').value = '';
  document.getElementById('prodSort').value = '0';
  document.getElementById('prodImage').value = '';
  document.getElementById('imgPreview').classList.add('hidden');

  // 填充分类下拉
  populateCategorySelect('');

  document.getElementById('productModal').classList.remove('hidden');
}

/**
 * 编辑菜品
 */
function editProduct(product) {
  document.getElementById('modalTitle').textContent = '编辑菜品';
  document.getElementById('editProductId').value = product.id;
  document.getElementById('prodName').value = product.name || '';
  document.getElementById('prodPrice').value = product.price || '';
  document.getElementById('prodDesc').value = product.description || '';
  document.getElementById('prodSort').value = product.sort_order || 0;
  document.getElementById('prodImage').value = '';

  // 图片预览
  if (product.image_url) {
    document.getElementById('imgPreview').src = product.image_url;
    document.getElementById('imgPreview').classList.remove('hidden');
  } else {
    document.getElementById('imgPreview').classList.add('hidden');
  }

  populateCategorySelect(product.category_id);

  document.getElementById('productModal').classList.remove('hidden');
}

/**
 * 填充分类下拉
 */
function populateCategorySelect(selectedId) {
  const select = document.getElementById('prodCategory');
  select.innerHTML = allCategories.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.icon} ${c.name}</option>`
  ).join('');
}

/**
 * 图片预览
 */
function previewImage(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('imgPreview');
    preview.src = e.target.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

/**
 * 保存菜品（新增或编辑）
 */
async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  const name = document.getElementById('prodName').value.trim();
  const categoryId = document.getElementById('prodCategory').value;
  const price = parseFloat(document.getElementById('prodPrice').value);
  const description = document.getElementById('prodDesc').value.trim();
  const sortOrder = parseInt(document.getElementById('prodSort').value) || 0;

  if (!name) { alert('请输入菜品名称'); return; }
  if (!categoryId) { alert('请选择分类'); return; }
  if (isNaN(price) || price <= 0) { alert('请输入有效价格'); return; }

  // 处理图片上传
  let imageUrl = '';
  const fileInput = document.getElementById('prodImage');
  if (fileInput.files[0]) {
    imageUrl = await uploadImage(fileInput.files[0]);
    if (!imageUrl) {
      alert('图片上传失败');
      return;
    }
  }

  const body = {
    name,
    category_id: categoryId,
    price,
    description,
    sort_order: sortOrder
  };

  if (imageUrl) body.image_url = imageUrl;

  try {
    let res;
    if (id) {
      // 编辑
      body.id = id;
      res = await fetch(`${API_BASE}/api/admin/products`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
    } else {
      // 新增
      res = await fetch(`${API_BASE}/api/admin/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
    }

    const data = await res.json();
    if (data.success) {
      closeProductModal();
      loadProducts();
    } else {
      alert(data.message || '保存失败');
    }
  } catch (e) {
    alert('网络错误');
  }
}

/**
 * 上传图片到 Supabase Storage
 */
async function uploadImage(file) {
  if (!SUPABASE_ANON_KEY) {
    // Supabase 未配置，使用 base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  try {
    const client = supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const fileName = `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split('.').pop()}`;

    const { data, error } = await client.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('上传失败:', error);
      return '';
    }

    // 获取公共 URL
    const { data: urlData } = client.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (e) {
    console.error('上传异常:', e);
    return '';
  }
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
}

// ==================== 工具函数 ====================

/**
 * 格式化时间
 */
function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
