/* 商品管理页 */
let productsData=[];
async function render_products() {
  await loadCategoriesCache();
  const pc = document.getElementById('pageContent');
  pc.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-left"><h3 style="font-size:15px">共 <span id="prodCount">0</span> 个商品</h3></div>
      <div class="toolbar-right"><button class="btn btn-primary" onclick="showProdForm()">+ 新增菜品</button></div>
    </div>
    <div class="card" style="padding:0"><table class="data-table"><thead><tr>
      <th>图片</th><th>名称</th><th>分类</th><th>价格</th><th>状态</th><th>排序</th><th class="col-actions">操作</th>
    </tr></thead><tbody id="prodsBody"><tr><td colspan="7" style="text-align:center;padding:40px;color:#ccc">加载中...</td></tr></tbody></table></div>`;
  try {
    const r = await api('/api/admin/products');
    if(r.success) { productsData=r.data||[]; renderProdRows(); }
  } catch(e) {}
}
function renderProdRows() {
  const catMap={}; allCategories.forEach(c=>{catMap[c.id]=c.name;});
  document.getElementById('prodCount').textContent=productsData.length;
  const tb=document.getElementById('prodsBody');
  if(!productsData.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:40px;color:#ccc">暂无商品</td></tr>';return;}
  tb.innerHTML=productsData.map(p=>{
    const img=p.image_url?`<img class="thumb" src="${esc(p.image_url)}">`:'<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:24px">🍜</div>';
    const cat=catMap[p.category_id]||'未分类';
    const tag=p.available?'<span class="tag tag-on">在售</span>':'<span class="tag tag-off">售罄</span>';
    const toggleBtn=p.available?`<button class="btn btn-danger btn-sm" onclick="toggleProd('${p.id}',false)">下架</button>`:`<button class="btn btn-success btn-sm" onclick="toggleProd('${p.id}',true)">上架</button>`;
    return `<tr>
      <td>${img}</td><td><strong>${esc(p.name)}</strong>${p.description?`<br><span style="color:#999;font-size:12px">${esc(p.description)}</span>`:''}</td>
      <td>${esc(cat)}</td><td style="font-weight:600;color:#C8973A">¥${Number(p.price).toFixed(2)}</td>
      <td>${tag}</td><td>${p.sort_order||0}</td>
      <td class="col-actions">${toggleBtn} <button class="btn btn-outline btn-sm" onclick='editProd(${JSON.stringify(p).replace(/'/g,"&#39;")})'>编辑</button> <button class="btn btn-danger btn-sm" onclick="delProd('${p.id}','${esc(p.name)}')">删除</button></td>
    </tr>`}).join('');
}
async function toggleProd(id,val){try{const r=await api('/api/admin/products','PATCH',{id,available:val});if(r.success){showToast(val?'已上架':'已下架');render_products();}else alert(r.message);}catch(e){alert('网络错误');}}
async function delProd(id,name){if(!confirm(`确定删除「${name}」？`))return;try{const r=await api('/api/admin/products','DELETE',{id});if(r.success){showToast('已删除');render_products();}else alert(r.message);}catch(e){alert('网络错误');}}
function showProdForm(p){
  const isEdit=!!p; const title=isEdit?'编辑菜品':'新增菜品';
  const catOpts=allCategories.map(c=>`<option value="${c.id}" ${p&&p.category_id===c.id?'selected':''}>${c.icon} ${c.name}</option>`).join('');
  openModal(title, `
    <div class="form-row"><label class="form-label">名称 *</label><input class="form-input" id="pName" value="${isEdit?esc(p.name):''}"></div>
    <div class="form-row"><label class="form-label">分类 *</label><select class="form-input" id="pCat">${catOpts}</select></div>
    <div class="form-row"><label class="form-label">价格 *</label><input class="form-input" id="pPrice" type="number" step="0.01" value="${isEdit?p.price:''}"></div>
    <div class="form-row"><label class="form-label">描述</label><input class="form-input" id="pDesc" value="${isEdit?esc(p.description||''):''}"></div>
    <div class="form-row"><label class="form-label">图片URL</label><input class="form-input" id="pImg" value="${isEdit?esc(p.image_url||''):''}"></div>
    <div class="form-row"><label class="form-label">排序</label><input class="form-input" id="pSort" type="number" value="${isEdit?p.sort_order||0:0}"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveProd('${isEdit?p.id:''}')">保存</button>`
  );
}
function editProd(p){showProdForm(p);}
async function saveProd(id){
  const body={name:document.getElementById('pName').value.trim(),category_id:document.getElementById('pCat').value,price:parseFloat(document.getElementById('pPrice').value),description:document.getElementById('pDesc').value.trim(),image_url:document.getElementById('pImg').value.trim(),sort_order:parseInt(document.getElementById('pSort').value)||0};
  if(!body.name||!body.category_id||isNaN(body.price)){alert('请填写必填项');return;}
  try{let r; if(id){body.id=id;r=await api('/api/admin/products','PATCH',body);}else{r=await api('/api/admin/products','POST',body);}
    if(r.success){closeModal();showToast('保存成功');render_products();}else alert(r.message);}catch(e){alert('网络错误');}
}
