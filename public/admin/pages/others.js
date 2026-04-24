/* 分类管理 + 桌台管理 + 店铺设置 + 系统设置 + 数据统计 + 财务 */

// ===== 分类管理 =====
async function render_categories() {
  await loadCategoriesCache();
  const pc=document.getElementById('pageContent');
  pc.innerHTML=`<div class="toolbar"><div class="toolbar-left"><h3>分类列表</h3></div><div class="toolbar-right"><button class="btn btn-primary" onclick="showCatForm()">+ 新增分类</button></div></div>
    <div class="card" style="padding:0"><table class="data-table"><thead><tr><th>图标</th><th>名称</th><th>排序</th><th class="col-actions">操作</th></tr></thead><tbody id="catsBody"></tbody></table></div>`;
  const tb=document.getElementById('catsBody');
  if(!allCategories.length){tb.innerHTML='<tr><td colspan="4" style="text-align:center;padding:40px;color:#ccc">暂无分类</td></tr>';return;}
  tb.innerHTML=allCategories.map(c=>`<tr><td style="font-size:24px">${c.icon||'📁'}</td><td><strong>${esc(c.name)}</strong></td><td>${c.sort_order}</td>
    <td class="col-actions"><button class="btn btn-outline btn-sm" onclick="showCatForm({id:'${c.id}',name:'${esc(c.name)}',icon:'${esc(c.icon)}',sort_order:${c.sort_order}})">编辑</button> <button class="btn btn-danger btn-sm" onclick="delCat('${c.id}','${esc(c.name)}')">删除</button></td></tr>`).join('');
}
function showCatForm(c){
  const isEdit=!!c;
  openModal(isEdit?'编辑分类':'新增分类',`
    <div class="form-row"><label class="form-label">名称 *</label><input class="form-input" id="cName" value="${isEdit?esc(c.name):''}"></div>
    <div class="form-row"><label class="form-label">图标 (emoji)</label><input class="form-input" id="cIcon" value="${isEdit?esc(c.icon):''}" placeholder="🔥"></div>
    <div class="form-row"><label class="form-label">排序</label><input class="form-input" id="cSort" type="number" value="${isEdit?c.sort_order:0}"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveCat('${isEdit?c.id:''}')">保存</button>`);
}
async function saveCat(id){
  const body={name:document.getElementById('cName').value.trim(),icon:document.getElementById('cIcon').value.trim(),sort_order:parseInt(document.getElementById('cSort').value)||0};
  if(!body.name){alert('请输入名称');return;}
  try{let r;if(id){body.id=id;r=await api('/api/admin/categories','PATCH',body);}else{r=await api('/api/admin/categories','POST',body);}
    if(r.success){closeModal();showToast('保存成功');await loadCategoriesCache();render_categories();}else alert(r.message);}catch(e){alert('网络错误');}
}
async function delCat(id,name){if(!confirm(`确定删除分类「${name}」？`))return;try{const r=await api('/api/admin/categories','DELETE',{id});if(r.success){showToast('已删除');await loadCategoriesCache();render_categories();}else alert(r.message);}catch(e){alert('网络错误');}}

// ===== 桌台管理 =====
async function render_tables() {
  const pc=document.getElementById('pageContent');
  pc.innerHTML=`<div class="toolbar"><div class="toolbar-left"><h3>桌台列表</h3></div><div class="toolbar-right"><button class="btn btn-primary" onclick="showTableForm()">+ 新增桌台</button></div></div>
    <div class="card" style="padding:0"><table class="data-table"><thead><tr><th>桌号</th><th>名称</th><th>Scene ID</th><th>状态</th><th class="col-actions">操作</th></tr></thead><tbody id="tablesBody"><tr><td colspan="5" style="text-align:center;padding:40px;color:#ccc">加载中...</td></tr></tbody></table></div>`;
  try{const r=await api('/api/admin/tables');if(r.success){const list=r.data||[];const tb=document.getElementById('tablesBody');
    if(!list.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:40px;color:#ccc">暂无桌台</td></tr>';return;}
    tb.innerHTML=list.map(t=>{const tag=t.is_active?'<span class="tag tag-on">启用</span>':'<span class="tag tag-off">停用</span>';const toggleBtn=t.is_active?`<button class="btn btn-danger btn-sm" onclick="toggleTable('${t.id}',false)">停用</button>`:`<button class="btn btn-success btn-sm" onclick="toggleTable('${t.id}',true)">启用</button>`;
      return `<tr><td><strong>${esc(t.table_number)}</strong></td><td>${esc(t.table_name)}</td><td style="color:#999">${esc(t.scene_id)||'—'}</td><td>${tag}</td>
        <td class="col-actions">${toggleBtn} <button class="btn btn-outline btn-sm" onclick="showTableForm({id:'${t.id}',table_number:'${esc(t.table_number)}',table_name:'${esc(t.table_name)}',scene_id:'${esc(t.scene_id)||''}',is_active:${t.is_active}})">编辑</button> <button class="btn btn-danger btn-sm" onclick="delTable('${t.id}')">删除</button></td></tr>`}).join('');
  }}catch(e){}
}
function showTableForm(t){
  const isEdit=!!t;
  openModal(isEdit?'编辑桌台':'新增桌台',`
    <div class="form-row"><label class="form-label">桌号 *</label><input class="form-input" id="tNum" value="${isEdit?esc(t.table_number):''}"></div>
    <div class="form-row"><label class="form-label">名称</label><input class="form-input" id="tName" value="${isEdit?esc(t.table_name):''}" placeholder="如：包间1号桌"></div>
    <div class="form-row"><label class="form-label">Scene ID</label><input class="form-input" id="tScene" value="${isEdit?esc(t.scene_id):''}" placeholder="用于二维码识别"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveTable('${isEdit?t.id:''}')">保存</button>`);
}
async function saveTable(id){
  const body={table_number:document.getElementById('tNum').value.trim(),table_name:document.getElementById('tName').value.trim(),scene_id:document.getElementById('tScene').value.trim()};
  if(!body.table_number){alert('请输入桌号');return;}
  try{let r;if(id){body.id=id;r=await api('/api/admin/tables','PATCH',body);}else{r=await api('/api/admin/tables','POST',body);}
    if(r.success){closeModal();showToast('保存成功');render_tables();}else alert(r.message);}catch(e){alert('网络错误');}
}
async function toggleTable(id,val){try{const r=await api('/api/admin/tables','PATCH',{id,is_active:val});if(r.success){showToast(val?'已启用':'已停用');render_tables();}else alert(r.message);}catch(e){}}
async function delTable(id){if(!confirm('确定删除？'))return;try{const r=await api('/api/admin/tables','DELETE',{id});if(r.success){showToast('已删除');render_tables();}else alert(r.message);}catch(e){}}

// ===== 店铺设置 =====
async function render_store() {
  const pc=document.getElementById('pageContent');
  pc.innerHTML='<div class="card"><div class="card-title">店铺信息</div><div id="storeForm">加载中...</div></div>';
  try{const r=await api('/api/admin/settings');if(r.success){const s=r.data;
    document.getElementById('storeForm').innerHTML=`
      <div class="form-row"><label class="form-label">店铺名称</label><input class="form-input" id="sName" value="${esc(s.store_name)}"></div>
      <div class="form-row"><label class="form-label">LOGO URL</label><input class="form-input" id="sLogo" value="${esc(s.logo_url)}"></div>
      <div class="form-row"><label class="form-label">地址</label><input class="form-input" id="sAddr" value="${esc(s.address)}"></div>
      <div class="form-row"><label class="form-label">电话</label><input class="form-input" id="sPhone" value="${esc(s.phone)}"></div>
      <div class="form-row"><label class="form-label">营业时间</label><input class="form-input" id="sHours" value="${esc(s.business_hours)}"></div>
      <div class="form-row"><label class="form-label">公告</label><textarea class="form-textarea" id="sAnnounce">${esc(s.announcement)}</textarea></div>
      <button class="btn btn-primary" onclick="saveStore()" style="margin-top:12px">保存设置</button>`;
  }}catch(e){}
}
async function saveStore(){
  const body={store_name:document.getElementById('sName').value.trim(),logo_url:document.getElementById('sLogo').value.trim(),address:document.getElementById('sAddr').value.trim(),phone:document.getElementById('sPhone').value.trim(),business_hours:document.getElementById('sHours').value.trim(),announcement:document.getElementById('sAnnounce').value.trim()};
  try{const r=await api('/api/admin/settings','PATCH',body);if(r.success){showToast('保存成功');document.getElementById('brandName').textContent=body.store_name||'点单系统';}else alert(r.message);}catch(e){alert('网络错误');}
}

// ===== 系统设置 =====
function render_settings(){
  document.getElementById('pageContent').innerHTML=`
    <div class="card"><div class="card-title">支付配置</div>
      <div class="form-row"><label class="form-label">微信 AppID</label><input class="form-input" disabled value="请在 Vercel 环境变量中配置"></div>
      <div class="form-row"><label class="form-label">商户号</label><input class="form-input" disabled value="请在 Vercel 环境变量中配置"></div>
      <p style="color:#999;font-size:13px;margin-top:8px">⚠️ 支付配置需在 Vercel → Settings → Environment Variables 中修改</p>
    </div>
    <div class="card"><div class="card-title">打印机配置</div>
      <div class="form-row"><label class="form-label">芯烨云打印机 SN</label><input class="form-input" disabled value="请在 Vercel 环境变量中配置"></div>
      <p style="color:#999;font-size:13px;margin-top:8px">⚠️ 打印机配置需在 Vercel → Settings → Environment Variables 中修改</p>
    </div>`;
}

// ===== 数据统计 =====
async function render_analytics() {
  document.getElementById('pageContent').innerHTML='<div class="empty-state">加载中...</div>';
  try{const r=await api('/api/admin/dashboard');if(!r.success)return;const d=r.data;
    document.getElementById('pageContent').innerHTML=`
      <div class="stat-row"><div class="stat-card"><div class="stat-label">今日订单</div><div class="stat-value">${d.today.orderCount}</div></div>
        <div class="stat-card"><div class="stat-label">今日营业额</div><div class="stat-value gold">¥${d.today.revenue}</div></div>
        <div class="stat-card"><div class="stat-label">商品数</div><div class="stat-value">${d.productCount}</div></div>
        <div class="stat-card"><div class="stat-label">桌台数</div><div class="stat-value">${d.tableCount}</div></div></div>
      <div class="card"><div class="card-title">近 7 天订单趋势</div>
        <table class="data-table"><thead><tr><th>日期</th><th>订单数</th><th>营业额</th></tr></thead>
        <tbody>${d.weekTrend.map(i=>`<tr><td>${i.date}</td><td>${i.orders}</td><td style="color:#C8973A;font-weight:600">¥${Number(i.revenue).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){document.getElementById('pageContent').innerHTML='<div class="empty-state">加载失败</div>';}
}

// ===== 财务管理 =====
async function render_finance(){
  document.getElementById('pageContent').innerHTML='<div class="empty-state">加载中...</div>';
  try{const r=await api('/api/admin/dashboard');if(!r.success)return;const d=r.data;
    document.getElementById('pageContent').innerHTML=`
      <div class="stat-row" style="grid-template-columns:1fr 1fr">
        <div class="stat-card"><div class="stat-label">今日营业额</div><div class="stat-value gold">¥${d.today.revenue}</div></div>
        <div class="stat-card"><div class="stat-label">今日订单数</div><div class="stat-value">${d.today.orderCount}</div></div></div>
      <div class="card"><div class="card-title">近 7 天收入明细</div>
        <table class="data-table"><thead><tr><th>日期</th><th>订单数</th><th>营业额</th><th>平均客单价</th></tr></thead>
        <tbody>${d.weekTrend.map(i=>{const avg=i.orders>0?(i.revenue/i.orders).toFixed(2):'0.00';return `<tr><td>${i.date}</td><td>${i.orders}</td><td style="color:#C8973A;font-weight:600">¥${Number(i.revenue).toFixed(2)}</td><td>¥${avg}</td></tr>`}).join('')}</tbody></table></div>`;
  }catch(e){document.getElementById('pageContent').innerHTML='<div class="empty-state">加载失败</div>';}
}
