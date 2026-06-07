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
                <div class="order-card" onclick="openOrderDetail('${order.id}')" style="border-left: 5px solid var(--primary); margin-bottom:0.75rem; cursor:pointer; transition:var(--transition);" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'">
                    <div class="order-card-header">
                        <strong>ID: ${order.id} (${order.customer_name})</strong>
                        <span class="status-badge ${statusBadgeClass}">${order.status}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--gray-500); margin-bottom:0.4rem; line-height:1.45;">
                        📅 ${order.date} | 📞 WA: ${order.customer_whatsapp}<br>
                        📍 Alamat: ${order.customer_address} (${order.latitude}, ${order.longitude})
                    </div>
                    <div style="font-size:0.85rem; font-weight:700; background:#f7f9fa; padding:0.5rem; border-radius:6px; margin:0.5rem 0;">
                        🛍️ Item: ${items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--gray-100); padding-top:0.5rem;" onclick="event.stopPropagation();">
                        <strong>Total: ${formatRupiah(order.total)}</strong>
                        <div style="display:flex; gap:0.25rem;">
                            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding:0.35rem; font-size:0.8rem; border-radius:4px; border:1px solid var(--gray-300); cursor:pointer;">
                                <option value="">-- Ubah Status --</option>
                                <option value="Menunggu Pembayaran">Menunggu Pembayaran</option>
                                <option value="Lunas">Lunas (Sudah Bayar)</option>
                                <option value="Sedang Disiapkan">Sedang Disiapkan</option>
                                <option value="Sedang Dikirim">Sedang Dikirim</option>
                                <option value="Selesai">Selesai (Sampai)</option>
                                <option value="Dibatalkan">Batalkan Pesanan</option>
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
