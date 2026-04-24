/* 管理后台核心 - 路由 + 登录 + 工具函数 */
const API = '';
let token = localStorage.getItem('admin_token') || '';
let allCategories = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pwdInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  if (token) showMain();
  setInterval(() => { document.getElementById('topbarTime').textContent = new Date().toLocaleString('zh-CN'); }, 1000);
});

// 登录
async function doLogin() {
  const pw = document.getElementById('pwdInput').value.trim();
  if (!pw) { document.getElementById('loginErr').textContent = '请输入密码'; return; }
  try {
    const r = await api('/api/admin/login', 'POST', { password: pw });
    if (r.success) { token = r.data.token; localStorage.setItem('admin_token', token); showMain(); }
    else document.getElementById('loginErr').textContent = r.message || '密码错误';
  } catch(e) { document.getElementById('loginErr').textContent = '网络错误'; }
}
function doLogout() { token=''; localStorage.removeItem('admin_token'); location.reload(); }
function showMain() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('mainView').classList.remove('hidden');
  navigate('dashboard', document.querySelector('[data-page="dashboard"]'));
}

// 路由
function navigate(page, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  const titles = { dashboard:'首页', orders:'订单管理', products:'商品管理', categories:'分类管理',
    tables:'桌台管理', analytics:'数据统计', finance:'财务管理', store:'店铺设置', settings:'系统设置' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  const fn = window['render_' + page];
  if (fn) fn(); else document.getElementById('pageContent').innerHTML = '<div class="empty-state"><div class="empty-icon">🚧</div><div class="empty-text">功能开发中...</div></div>';
}

// API 请求
async function api(url, method='GET', body=null) {
  const opts = { method, headers: { 'Content-Type':'application/json' } };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + url, opts);
  if (r.status === 401) { doLogout(); throw new Error('未授权'); }
  return r.json();
}

// 弹窗
function openModal(title, contentHtml, footerHtml='') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalContent').innerHTML = contentHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml;
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

// Toast
function showToast(msg) {
  const d = document.createElement('div'); d.className='toast'; d.textContent=msg;
  document.body.appendChild(d); setTimeout(()=>d.remove(), 2500);
}

// 工具
function esc(s) { if(!s)return''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function fmtTime(iso) { if(!iso)return''; const d=new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

// 提示音
function playBeep() {
  try { const c=new(window.AudioContext||window.webkitAudioContext)(); const o=c.createOscillator(); const g=c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value=880; g.gain.setValueAtTime(0.3,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+0.3); o.start(); o.stop(c.currentTime+0.3); } catch(e){}
}

// 加载分类缓存
async function loadCategoriesCache() {
  try { const r = await api('/api/admin/categories'); if(r.success) allCategories=r.data||[]; } catch(e){}
}
