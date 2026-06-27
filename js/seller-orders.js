// =====================================================================
// js/seller-orders.js — MODUL MANAJEMEN PESANAN MASUK (ADMIN)
// Tanggung jawab: Memuat, filter, dan update status semua pesanan di dashboard.
// Dependensi: config.js (supabaseClient),
//             utils.js (formatRupiah, showToast)
// =====================================================================

let sellerOrdersCache  = [];
let currentSellerFilter = "semua";

// =====================================================================
// METRIK DASBOR ADMIN (Revenue, Pesanan Baru, Produk Aktif)
// =====================================================================
async function updateDashboardMetrics() {
    try {
        const { data: pesanan, error: errOrders } = await supabaseClient.from('pesanan').select('total, status');
        if (errOrders) throw errOrders;

        const { count: prodCount, error: errProds } = await supabaseClient.from('produk').select('*', { count: 'exact', head: true });
        if (errProds) throw errProds;

        let totalRevenue  = 0;
        let newOrdersCount = 0;

        (pesanan || []).forEach(order => {
            if (order.status === "Lunas" || order.status === "Sudah Dibayar" || order.status === "Selesai") {
                totalRevenue += Number(order.total);
            } else if (order.status === "Menunggu Pembayaran") {
                newOrdersCount++;
            }
        });

        document.getElementById("analyticTotalRevenue").innerText   = formatRupiah(totalRevenue);
        document.getElementById("analyticNewOrders").innerText      = newOrdersCount + " Pesanan";
        document.getElementById("analyticActiveProducts").innerText = (prodCount || 0) + " Sayur";
    } catch (err) {
        console.error("Failed to update dashboard analytics metrics:", err);
    }
}

// =====================================================================
// BADGE FILTER STATUS (Admin)
// =====================================================================
function updateSellerFilterBadges() {
    const filterContainer = document.getElementById("adminOrdersFilterContainer");
    if (!filterContainer) return;

    const countSemua      = sellerOrdersCache.length;
    const countBelumBayar = sellerOrdersCache.filter(o => o.status === "Menunggu Pembayaran").length;
    const countDiproses   = sellerOrdersCache.filter(o =>
        o.status === "Lunas" || o.status === "Sudah Dibayar" ||
        o.status === "COD - Diproses" || o.status === "Sedang Disiapkan"
    ).length;
    const countDikirim    = sellerOrdersCache.filter(o => o.status === "Sedang Dikirim").length;
    const countSelesai    = sellerOrdersCache.filter(o => o.status === "Selesai").length;

    const getBadge = (count, color = "var(--primary)") => {
        if (count === 0) return "";
        return ` <span style="background:${color}; color:white; border-radius:50%; padding:0.15rem 0.35rem; font-size:0.65rem; font-weight:800; min-width:16px; text-align:center; line-height:1; display:inline-block; margin-left:0.25rem;">${count}</span>`;
    };

    const btnSemua      = filterContainer.querySelector('[data-status="semua"]');
    const btnBelumBayar = filterContainer.querySelector('[data-status="belum-bayar"]');
    const btnDiproses   = filterContainer.querySelector('[data-status="diproses"]');
    const btnDikirim    = filterContainer.querySelector('[data-status="dikirim"]');
    const btnSelesai    = filterContainer.querySelector('[data-status="selesai"]');

    if (btnSemua)      btnSemua.innerHTML      = `Semua${getBadge(countSemua, "var(--primary)")}`;
    if (btnBelumBayar) btnBelumBayar.innerHTML = `Belum Bayar${getBadge(countBelumBayar, "var(--gray-500)")}`;
    if (btnDiproses)   btnDiproses.innerHTML   = `Diproses${getBadge(countDiproses, "#d97706")}`;
    if (btnDikirim)    btnDikirim.innerHTML     = `Dikirim${getBadge(countDikirim, "var(--primary)")}`;
    if (btnSelesai)    btnSelesai.innerHTML     = `Selesai${getBadge(countSelesai, "var(--gray-500)")}`;
}

// =====================================================================
// LOAD SEMUA PESANAN DARI SUPABASE
// =====================================================================
function loadAllOrdersFromSheet() {
    const sellerOrdersList = document.getElementById("sellerOrdersList");
    sellerOrdersList.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--gray-500);">Menghubungi Supabase database...</div>`;

    supabaseClient.from('pesanan')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) throw error;
            sellerOrdersCache = data || [];
            updateSellerFilterBadges();
            applySellerOrdersFilter();
        })
        .catch(err => {
            console.error("Failed to load seller orders from Supabase:", err);
            sellerOrdersList.innerHTML = `<div style="text-align:center; padding:3rem; color:#f43f5e;">Gagal menyinkronkan data dari Supabase.</div>`;
        });
}

// =====================================================================
// APPLY FILTER STATUS PESANAN ADMIN
// =====================================================================
function applySellerOrdersFilter() {
    const sellerOrdersList = document.getElementById("sellerOrdersList");
    if (!sellerOrdersList) return;

    let filtered = [...sellerOrdersCache];
    if (currentSellerFilter === "belum-bayar")   filtered = sellerOrdersCache.filter(o => o.status === "Menunggu Pembayaran");
    else if (currentSellerFilter === "diproses")  filtered = sellerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan");
    else if (currentSellerFilter === "dikirim")   filtered = sellerOrdersCache.filter(o => o.status === "Sedang Dikirim");
    else if (currentSellerFilter === "selesai")   filtered = sellerOrdersCache.filter(o => o.status === "Selesai");

    if (filtered.length > 0) {
        sellerOrdersList.innerHTML = filtered.map(order => {
            let statusBadgeClass = "status-pending";
            if (order.status === "Lunas" || order.status === "Sudah Dibayar") statusBadgeClass = "status-paid";
            if (order.status.includes("COD") || order.status === "Sedang Dikirim" || order.status === "Selesai" || order.status === "Sedang Disiapkan") statusBadgeClass = "status-cod";

            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

            return `
                <div class="order-card" style="border-left: 5px solid ${getStatusColor(order.status)}; margin-bottom:1rem; cursor:default; background:#fff; padding:1rem; border-radius:12px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:0.5rem;">
                    <div class="order-card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                        <strong style="font-size:0.85rem; color:var(--dark);">#${order.id.slice(-6).toUpperCase()} - ${order.customer_name}</strong>
                        <span class="status-badge ${statusBadgeClass}">${order.status}</span>
                    </div>
                    <div style="font-size:0.78rem; color:var(--gray-500); line-height:1.45;">
                        📅 ${order.date}<br>
                        📍 ${order.customer_address}
                    </div>
                    
                    <!-- Checklist Packing Barang -->
                    <div style="font-size:0.8rem; background:var(--gray-50); border:1px solid var(--gray-200); padding:0.6rem 0.75rem; border-radius:8px; margin:0.25rem 0;">
                        <strong style="display:block; margin-bottom:0.35rem; color:var(--dark); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px;">📦 Packing List:</strong>
                        <div style="display:flex; flex-direction:column; gap:0.3rem;">
                            ${items.map((i, idx) => `
                                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; user-select:none;">
                                    <input type="checkbox" style="width:14px; height:14px; accent-color:var(--primary); cursor:pointer;">
                                    <span>${i.name} <strong>x${i.quantity}</strong></span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; font-weight:700; border-top:1px solid var(--gray-100); padding-top:0.5rem; margin-top:0.25rem;">
                        <span>Total: <span style="color:var(--primary-dark); font-size:0.9rem;">${formatRupiah(order.total)}</span></span>
                        <span style="font-size:0.75rem; font-weight:600; color:var(--gray-400);">${order.shipping_method || 'Kurir Toko'}</span>
                    </div>

                    <!-- Action Buttons Panel -->
                    <div style="display:flex; gap:0.35rem; margin-top:0.4rem; flex-wrap:wrap; align-items:stretch;">
                        <!-- Primary Status Action Button -->
                        ${getPrimaryActionButton(order.id, order.status)}
                        
                        <!-- Contact WA -->
                        <a href="${getWaLink(order.customer_whatsapp)}" target="_blank" class="header-btn" style="flex:1; min-width:60px; text-align:center; padding:0.45rem; font-size:0.75rem; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:0.25rem; font-weight:700; color:#25D366; border-color:#25D366; text-decoration:none; transition:var(--transition);">
                            💬 WA
                        </a>
                        
                        <!-- Google Maps Route -->
                        ${order.latitude ? `
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}" target="_blank" class="header-btn" style="flex:1; min-width:65px; text-align:center; padding:0.45rem; font-size:0.75rem; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:0.25rem; font-weight:700; color:var(--primary); border-color:var(--primary); text-decoration:none; transition:var(--transition);">
                                📍 Rute
                            </a>
                        ` : ''}
                        
                        <!-- Dropdown Status fallback -->
                        <div style="position:relative; flex:1; min-width:75px;">
                            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding:0.45rem 0.25rem; font-size:0.75rem; border-radius:8px; border:1px solid var(--gray-300); background:#fff; cursor:pointer; font-weight:600; color:var(--gray-600); width:100%; height:100%;">
                                <option value="" disabled selected>Ubah...</option>
                                <option value="Menunggu Pembayaran">Belum Bayar</option>
                                <option value="Lunas">Lunas</option>
                                <option value="Sedang Disiapkan">Disiapkan</option>
                                <option value="Sedang Dikirim">Dikirim</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Dibatalkan">Batalkan</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        let filterLabel = "Semua";
        if (currentSellerFilter === "belum-bayar") filterLabel = "Belum Bayar";
        else if (currentSellerFilter === "diproses") filterLabel = "Diproses";
        else if (currentSellerFilter === "dikirim")  filterLabel = "Dikirim";
        else if (currentSellerFilter === "selesai")  filterLabel = "Selesai";

        sellerOrdersList.innerHTML = `
            <div style="text-align:center; padding:4rem 1rem; color:var(--gray-500);">
                <span style="font-size: 2.5rem; display:block; margin-bottom:0.5rem;">📦</span>
                <p style="font-weight:700; margin-bottom:0.25rem;">Tidak Ada Pesanan</p>
                <p style="font-size:0.9rem;">Tidak ada pesanan masuk dengan status "${filterLabel}".</p>
            </div>
        `;
    }
}

// =====================================================================
// UPDATE STATUS PESANAN (Admin)
// =====================================================================
function updateOrderStatus(orderId, statusVal) {
    if (!statusVal) return;

    showToast("Mengupdate status pesanan...");

    supabaseClient.from('pesanan')
        .update({ status: statusVal })
        .eq('id', orderId)
        .then(({ error }) => {
            if (error) throw error;
            showToast("✔️ Status pesanan berhasil diubah!");
            loadAllOrdersFromSheet();
        })
        .catch(err => {
            console.error("Error updating order status in Supabase:", err);
            alert("Koneksi gagal saat update status!");
        });
}

// =====================================================================
// ORDER STATUS BUTTON BUILDERS & COLORS
// =====================================================================
function getStatusColor(status) {
    if (status === "Menunggu Pembayaran") return "#9ca3af"; 
    if (status === "Lunas" || status === "Sudah Dibayar") return "#3b82f6"; 
    if (status === "Sedang Disiapkan" || status === "COD - Diproses") return "#f59e0b"; 
    if (status === "Sedang Dikirim") return "#10b981"; 
    if (status === "Selesai") return "#10b981"; 
    return "#ef4444"; 
}

function getPrimaryActionButton(orderId, status) {
    if (status === "Menunggu Pembayaran") {
        return `<button onclick="updateOrderStatus('${orderId}', 'Lunas')" class="checkout-btn" style="flex:2; min-width:120px; margin:0; padding:0.45rem; font-size:0.75rem; border-radius:8px; font-weight:800;">💰 Tandai Lunas</button>`;
    }
    if (status === "Lunas" || status === "Sudah Dibayar" || status === "COD - Diproses") {
        return `<button onclick="updateOrderStatus('${orderId}', 'Sedang Disiapkan')" class="checkout-btn" style="flex:2; min-width:120px; margin:0; padding:0.45rem; font-size:0.75rem; border-radius:8px; font-weight:800; background:#f59e0b; border-color:#f59e0b;">📦 Siapkan Barang</button>`;
    }
    if (status === "Sedang Disiapkan") {
        return `<button onclick="updateOrderStatus('${orderId}', 'Sedang Dikirim')" class="checkout-btn" style="flex:2; min-width:120px; margin:0; padding:0.45rem; font-size:0.75rem; border-radius:8px; font-weight:800; background:#3b82f6; border-color:#3b82f6;">🚚 Kirim Sayur</button>`;
    }
    if (status === "Sedang Dikirim") {
        return `<button onclick="updateOrderStatus('${orderId}', 'Selesai')" class="checkout-btn" style="flex:2; min-width:120px; margin:0; padding:0.45rem; font-size:0.75rem; border-radius:8px; font-weight:800; background:#10b981; border-color:#10b981;">✅ Selesaikan</button>`;
    }
    return '';
}

function getWaLink(phone) {
    let clean = String(phone).replace(/[^0-9]/g, '').trim();
    if (clean.startsWith('0')) {
        clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
        clean = '62' + clean;
    }
    return `https://wa.me/${clean}`;
}
