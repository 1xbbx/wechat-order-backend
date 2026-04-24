/* 首页仪表盘 */
let dashChart = null;
async function render_dashboard() {
  document.getElementById('pageContent').innerHTML = '<div class="empty-state">加载中...</div>';
  try {
    const r = await api('/api/admin/system?action=dashboard');
    if (!r.success) return;
    const d = r.data;
    const t = d.today;
    document.getElementById('pageContent').innerHTML = `
      <div class="stat-row">
        <div class="stat-card"><div class="stat-label">今日订单</div><div class="stat-value">${t.orderCount}</div></div>
        <div class="stat-card"><div class="stat-label">今日营业额</div><div class="stat-value gold">¥${t.revenue}</div></div>
        <div class="stat-card"><div class="stat-label">待处理</div><div class="stat-value" style="color:#E65100">${t.pendingCount}</div></div>
        <div class="stat-card"><div class="stat-label">已完成</div><div class="stat-value" style="color:#2E7D32">${t.doneCount}</div></div>
      </div>
      <div class="stat-row" style="grid-template-columns:1fr 1fr">
        <div class="stat-card"><div class="stat-label">商品总数</div><div class="stat-value">${d.productCount}</div></div>
        <div class="stat-card"><div class="stat-label">桌台总数</div><div class="stat-value">${d.tableCount}</div></div>
      </div>
      <div class="card"><div class="card-title">近 7 天趋势</div><div class="chart-container"><canvas id="trendChart"></canvas></div></div>`;
    // 渲染折线图
    if (dashChart) dashChart.destroy();
    const ctx = document.getElementById('trendChart').getContext('2d');
    dashChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.weekTrend.map(i => i.date),
        datasets: [
          { label:'订单数', data:d.weekTrend.map(i=>i.orders), borderColor:'#C8973A', backgroundColor:'rgba(200,151,58,0.1)', fill:true, tension:0.4 },
          { label:'营业额', data:d.weekTrend.map(i=>i.revenue), borderColor:'#1A1A1A', backgroundColor:'rgba(26,26,26,0.05)', fill:true, tension:0.4, yAxisID:'y1' }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false,
        scales: { y:{beginAtZero:true, position:'left'}, y1:{beginAtZero:true, position:'right', grid:{drawOnChartArea:false}} },
        plugins: { legend:{position:'top'} }
      }
    });
  } catch(e) { document.getElementById('pageContent').innerHTML = '<div class="empty-state">加载失败</div>'; }
}
