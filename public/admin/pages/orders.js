/* 订单管理页 */
let ordersData=[], orderFilter='';
async function render_orders() {
  const pc = document.getElementById('pageContent');
  pc.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="filter-group">
          <button class="filter-btn active" onclick="setOrderFilter('',this)">全部</button>
          <button class="filter-btn" onclick="setOrderFilter('pending',this)">待处理</button>
          <button class="filter-btn" onclick="setOrderFilter('paid',this)">已支付</button>
          <button class="filter-btn" onclick="setOrderFilter('done',this)">已完成</button>
        </div>
      </div>
      <div class="toolbar-right"><button class="btn btn-outline" onclick="render_orders()">🔄 刷新</button></div>
    </div>
    <div class="card" style="padding:0"><table class="data-table"><thead><tr>
      <th>桌号</th><th>订单号</th><th>菜品</th><th>金额</th><th>状态</th><th>时间</th><th class="col-actions">操作</th>
    </tr></thead><tbody id="ordersBody"><tr><td colspan="7" style="text-align:center;padding:40px;color:#ccc">加载中...</td></tr></tbody></table></div>`;
  try {
    const r = await api('/api/admin/orders');
    if(r.success) { ordersData=r.data||[]; renderOrderRows(); }
  } catch(e) { document.getElementById('ordersBody').innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#f00">加载失败</td></tr>'; }
}
function setOrderFilter(f,el) {
  orderFilter=f;
  document.querySelectorAll('.filter-group .filter-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderOrderRows();
}
function renderOrderRows() {
  let list = orderFilter ? ordersData.filter(o=>o.status===orderFilter) : ordersData;
  const tb = document.getElementById('ordersBody');
  if(!list.length) { tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#ccc">暂无订单</td></tr>'; return; }
  tb.innerHTML = list.map(o => {
    const st = {pending:{t:'待处理',c:'tag-pending'},paid:{t:'已支付',c:'tag-paid'},done:{t:'已完成',c:'tag-done'}}[o.status]||{t:o.status,c:''};
    const items = (o.items||[]).map(i=>`${i.product_name}×${i.quantity}`).join('、')||'—';
    const actionBtn = (o.status==='pending'||o.status==='paid')
      ? `<button class="btn btn-dark btn-sm" onclick="completeOrder('${o.id}')">完成订单</button>`
      : `<span class="tag tag-done">✓ 已完成</span>`;
    return `<tr>
      <td><strong>${esc(o.table_number)}</strong></td>
      <td style="font-size:12px;color:#999">${esc(o.order_no)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(items)}</td>
      <td style="font-weight:700;color:#C8973A">¥${Number(o.total_amount).toFixed(2)}</td>
      <td><span class="tag ${st.c}">${st.t}</span></td>
      <td style="color:#999;font-size:13px">${fmtTime(o.created_at)}</td>
      <td class="col-actions">${actionBtn} <button class="btn btn-outline btn-sm" onclick="viewOrder('${o.id}')">详情</button></td>
    </tr>`}).join('');
}
async function completeOrder(id) {
  if(!confirm('确认完成该订单？')) return;
  try { const r=await api('/api/admin/orders','PATCH',{id,status:'done'}); if(r.success){showToast('订单已完成');render_orders();} else alert(r.message); } catch(e){alert('网络错误');}
}
function viewOrder(id) {
  const o = ordersData.find(x=>x.id===id); if(!o) return;
  const items = (o.items||[]).map(i=>`<tr><td>${esc(i.product_name)}</td><td>×${i.quantity}</td><td>¥${Number(i.subtotal).toFixed(2)}</td></tr>`).join('');
  openModal('订单详情', `
    <div class="form-row"><span class="form-label">订单号</span><p>${esc(o.order_no)}</p></div>
    <div class="form-row"><span class="form-label">桌号</span><p>${esc(o.table_number)}号桌</p></div>
    <div class="form-row"><span class="form-label">菜品明细</span><div class="order-detail-items"><table><thead><tr><th>菜品</th><th>数量</th><th>小计</th></tr></thead><tbody>${items}</tbody></table></div></div>
    <div class="form-row"><span class="form-label">合计</span><p style="font-size:20px;font-weight:700;color:#C8973A">¥${Number(o.total_amount).toFixed(2)}</p></div>
    ${o.remark?`<div class="form-row"><span class="form-label">备注</span><p>${esc(o.remark)}</p></div>`:''}
    <div class="form-row"><span class="form-label">下单时间</span><p>${fmtTime(o.created_at)}</p></div>`,
    (o.status!=='done')?`<button class="btn btn-dark" onclick="completeOrder('${o.id}');closeModal()">完成订单</button>`:''
  );
}
