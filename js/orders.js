// =====================================================================
// js/orders.js — MODUL RIWAYAT PESANAN & PELACAKAN STATUS
// Tanggung jawab: Buka modal riwayat, render daftar pesanan pelanggan,
//                 detail & stepper status, bayar pesanan pending.
// Dependensi: config.js (supabaseClient, currentOrder),
//             utils.js (formatRupiah, showToast, cleanWa, toggleBodyScroll),
//             checkout-stage.js (navigateToStage, currentCustomerFilter, customerOrdersCache)
// =====================================================================

let activeTrackingOrderId = null;

// =====================================================================
// BUKA MODAL RIWAYAT PESANAN
// =====================================================================
function openOrdersHistoryModal() {
    const noHpLoginBox    = document.getElementById("noHpLoginBox");
    const ordersListBox   = document.getElementById("ordersListBox");
    const ordersHistoryModal = document.getElementById("ordersHistoryModal");
    const cartOverlay     = document.getElementById("cartOverlay");
    const searchWaNo      = document.getElementById("searchWaNo");

    noHpLoginBox.style.display  = "block";
    ordersListBox.style.display = "none";

    currentCustomerFilter = "semua";
    const filterContainer = document.getElementById("ordersFilterContainer");
    if (filterContainer) {
        filterContainer.style.display = "none";
        const buttons = filterContainer.querySelectorAll(".filter-status-btn");
        buttons.forEach(b => {
            b.classList.remove("active");
            b.style.border     = "1px solid var(--gray-300)";
            b.style.background = "white";
            b.style.color      = "var(--gray-600)";
        });
        const allBtn = filterContainer.querySelector('[data-status="semua"]');
        if (allBtn) {
            allBtn.classList.add("active");
            allBtn.style.border     = "none";
            allBtn.style.background = "var(--primary)";
            allBtn.style.color      = "white";
        }
    }

    ordersHistoryModal.classList.add("open");
    cartOverlay.classList.add("open");
    toggleBodyScroll(true);

    const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
    if (savedProfile && savedProfile.whatsapp) {
        searchWaNo.value            = savedProfile.whatsapp;
        noHpLoginBox.style.display  = "none";
        renderOrdersList(savedProfile.whatsapp);
    } else {
        searchWaNo.value = "";
    }
}

// =====================================================================
// BADGE NOTIFIKASI PESANAN AKTIF DI HEADER
// =====================================================================
async function updateMyOrdersMenuBadge() {
    const badge = document.getElementById("myOrdersBadge");
    if (!badge) return;

    const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
    if (!savedProfile || !savedProfile.whatsapp) {
        badge.style.display = "none";
        return;
    }

    const cleanSearchWa = cleanWa(savedProfile.whatsapp);

    try {
        const { data, error } = await supabaseClient
            .from('pesanan')
            .select('status, customer_whatsapp')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const activeOrders = (data || []).filter(order => {
            const isMatchWa    = cleanWa(order.customer_whatsapp) === cleanSearchWa;
            const isUnfinished = order.status !== "Selesai" && order.status !== "Dibatalkan";
            return isMatchWa && isUnfinished;
        });

        if (activeOrders.length > 0) {
            badge.innerText      = activeOrders.length;
            badge.style.display  = "inline-flex";
        } else {
            badge.style.display  = "none";
        }
    } catch (e) {
        console.warn("Failed to update myOrders menu badge:", e);
    }
}

// =====================================================================
// BADGE JUMLAH FILTER STATUS PELANGGAN
// =====================================================================
function updateCustomerFilterBadges() {
    const filterContainer = document.getElementById("ordersFilterContainer");
    if (!filterContainer) return;

    const countSemua      = customerOrdersCache.length;
    const countBelumBayar = customerOrdersCache.filter(o => o.status === "Menunggu Pembayaran").length;
    const countDiproses   = customerOrdersCache.filter(o =>
        o.status === "Lunas" || o.status === "Sudah Dibayar" ||
        o.status === "COD - Diproses" || o.status === "Sedang Disiapkan"
    ).length;
    const countDikirim    = customerOrdersCache.filter(o => o.status === "Sedang Dikirim").length;
    const countSelesai    = customerOrdersCache.filter(o => o.status === "Selesai").length;

    const getBadge = (count, isAccent = false) => {
        if (count === 0) return "";
        const bg = isAccent ? "var(--accent)" : "var(--primary)";
        return ` <span style="background:${bg}; color:white; border-radius:50%; padding:0.15rem 0.35rem; font-size:0.65rem; font-weight:800; min-width:16px; text-align:center; line-height:1; display:inline-block; margin-left:0.25rem;">${count}</span>`;
    };

    const btnSemua      = filterContainer.querySelector('[data-status="semua"]');
    const btnBelumBayar = filterContainer.querySelector('[data-status="belum-bayar"]');
    const btnDiproses   = filterContainer.querySelector('[data-status="diproses"]');
    const btnDikirim    = filterContainer.querySelector('[data-status="dikirim"]');
    const btnSelesai    = filterContainer.querySelector('[data-status="selesai"]');

    if (btnSemua)      btnSemua.innerHTML      = `Semua${getBadge(countSemua, false)}`;
    if (btnBelumBayar) btnBelumBayar.innerHTML = `Belum Bayar${getBadge(countBelumBayar, true)}`;
    if (btnDiproses)   btnDiproses.innerHTML   = `Diproses${getBadge(countDiproses, false)}`;
    if (btnDikirim)    btnDikirim.innerHTML     = `Dikirim${getBadge(countDikirim, false)}`;
    if (btnSelesai)    btnSelesai.innerHTML     = `Selesai${getBadge(countSelesai, false)}`;
}

// =====================================================================
// RENDER DAFTAR PESANAN PELANGGAN
// =====================================================================
function renderOrdersList(waNumber) {
    const ordersListBox = document.getElementById("ordersListBox");
    ordersListBox.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--gray-500);">Menghubungi server Mbokde Mart...</div>`;
    ordersListBox.style.display = "block";

    const cleanSearchWa = cleanWa(waNumber);

    supabaseClient.from('pesanan')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) throw error;

            customerOrdersCache = (data || [])
                .map(order => ({
                    id:               order.id,
                    date:             order.date,
                    customerName:     order.customer_name,
                    customerWhatsapp: order.customer_whatsapp,
                    customerAddress:  order.customer_address,
                    latitude:         order.latitude,
                    longitude:        order.longitude,
                    shippingMethod:   order.shipping_method,
                    shippingCost:     Number(order.shipping_cost),
                    subtotal:         Number(order.subtotal),
                    total:            Number(order.total),
                    paymentMethod:    order.payment_method,
                    items:            typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
                    status:           order.status
                }))
                .filter(order => cleanWa(order.customerWhatsapp) === cleanSearchWa);

            const filterContainer = document.getElementById("ordersFilterContainer");
            if (filterContainer) filterContainer.style.display = "flex";

            updateCustomerFilterBadges();
            applyCustomerOrdersFilter(waNumber);
        })
        .catch(err => {
            console.error("Failed to fetch client orders from Supabase:", err);
            ordersListBox.innerHTML = `<div style="text-align:center; padding:2rem; color:#f43f5e;">Koneksi database bermasalah. Gagal memuat data.</div>`;
        });
}

function applyCustomerOrdersFilter(waNumber) {
    const ordersListBox = document.getElementById("ordersListBox");
    if (!ordersListBox) return;

    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--gray-100); padding:0.6rem 1rem; border-radius:6px; margin-bottom:1rem; font-size:0.85rem; border: 1px solid var(--gray-200);">
            <span>Pesanan untuk: <strong>${waNumber}</strong></span>
            <button onclick="changeSavedWaNumber()" style="background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer; text-decoration:underline; font-size:0.85rem; padding:0;">Ganti Nomor</button>
        </div>
    `;

    let filtered = [...customerOrdersCache];
    if (currentCustomerFilter === "belum-bayar")   filtered = customerOrdersCache.filter(o => o.status === "Menunggu Pembayaran");
    else if (currentCustomerFilter === "diproses")  filtered = customerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan");
    else if (currentCustomerFilter === "dikirim")   filtered = customerOrdersCache.filter(o => o.status === "Sedang Dikirim");
    else if (currentCustomerFilter === "selesai")   filtered = customerOrdersCache.filter(o => o.status === "Selesai");

    if (filtered.length > 0) {
        ordersListBox.innerHTML = headerHtml + filtered.map(order => {
            let statusBadgeClass = "status-pending";
            if (order.status === "Lunas" || order.status === "Sudah Dibayar") statusBadgeClass = "status-paid";
            if (order.status.includes("COD") || order.status === "Sedang Dikirim" || order.status === "Selesai" || order.status === "Sedang Disiapkan") statusBadgeClass = "status-cod";

            return `
                <div class="order-card" onclick="openOrderDetail('${order.id}')" style="cursor:pointer; transition: var(--transition); position:relative;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--gray-200)'">
                    <div class="order-card-header">
                        <strong style="color:var(--primary); font-family:monospace;">${order.id}</strong>
                        <span class="status-badge ${statusBadgeClass}">${order.status}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--gray-500); margin-bottom:0.5rem;">📅 ${order.date}</div>
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:0.75rem;">${order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--gray-100); padding-top:0.5rem;">
                        <div>
                            <span style="font-size:0.75rem; color:var(--gray-400);">Total Belanja:</span>
                            <div style="font-weight:800; color:var(--dark);">${formatRupiah(order.total)}</div>
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            ${order.status === "Menunggu Pembayaran" ? `
                                <button class="checkout-btn" style="width:auto; padding:0.4rem 1rem; font-size:0.8rem; margin:0;" onclick="event.stopPropagation(); payPendingOrder('${order.id}', '${order.total}')">
                                    Bayar Sekarang
                                </button>
                            ` : ''}
                            <span style="font-size:0.75rem; color:var(--primary); font-weight:700;">🔎 Lacak Detail</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        let filterLabel = "Semua";
        if (currentCustomerFilter === "belum-bayar") filterLabel = "Belum Bayar";
        else if (currentCustomerFilter === "diproses") filterLabel = "Diproses";
        else if (currentCustomerFilter === "dikirim")  filterLabel = "Dikirim";
        else if (currentCustomerFilter === "selesai")  filterLabel = "Selesai";

        ordersListBox.innerHTML = headerHtml + `
            <div style="text-align:center; padding:3rem 1rem; color:var(--gray-400);">
                <span style="font-size: 2rem; display:block; margin-bottom:0.5rem;">🔍</span>
                <p style="font-weight:700; margin-bottom:0.25rem;">Tidak Ada Pesanan</p>
                <p style="font-size:0.8rem;">Tidak ada riwayat pesanan dengan status "${filterLabel}".</p>
            </div>
        `;
    }
}

// =====================================================================
// BAYAR PESANAN PENDING DARI RIWAYAT
// =====================================================================
async function payPendingOrder(orderId, total) {
    showToast("Memuat detail pesanan...");
    try {
        const { data: order, error } = await supabaseClient
            .from('pesanan')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) throw error;
        if (!order) { alert("Pesanan tidak ditemukan!"); return; }

        currentOrder = {
            id:               order.id,
            customerName:     order.customer_name,
            customerWhatsapp: order.customer_whatsapp,
            customerAddress:  order.customer_address,
            latitude:         order.latitude,
            longitude:        order.longitude,
            shippingMethod:   order.shipping_method,
            shippingCost:     Number(order.shipping_cost),
            subtotal:         Number(order.subtotal),
            total:            Number(order.total),
            paymentMethod:    order.payment_method,
            items:            typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
            amountVersion:    1
        };

        const ordersHistoryModal = document.getElementById("ordersHistoryModal");
        const checkoutModal      = document.getElementById("checkoutModal");
        if (ordersHistoryModal) ordersHistoryModal.classList.remove("open");
        if (checkoutModal) checkoutModal.classList.add("open");

        navigateToStage(2);
    } catch (err) {
        console.error("Gagal memuat detail pesanan:", err);
        alert("Gagal memuat detail pesanan untuk pembayaran!");
    }
}

// =====================================================================
// DETAIL PESANAN & STEPPER STATUS
// =====================================================================
async function openOrderDetail(orderId) {
    try {
        showToast("Memuat status pelacakan...");

        const { data, error } = await supabaseClient
            .from('pesanan')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) throw error;
        if (!data)  return;

        activeTrackingOrderId = orderId;

        document.getElementById("detailOrderId").innerText          = data.id;
        document.getElementById("detailOrderDate").innerText        = data.date;
        document.getElementById("detailCustomerName").innerText     = data.customer_name;
        document.getElementById("detailCustomerWhatsapp").innerText = data.customer_whatsapp;
        document.getElementById("detailCustomerAddress").innerText  = data.customer_address;

        const mapsLinkElement = document.getElementById("detailCustomerMapsLink");
        if (data.google_maps_link) {
            mapsLinkElement.href = data.google_maps_link;
        } else if (data.latitude && data.longitude) {
            mapsLinkElement.href = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        } else {
            mapsLinkElement.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.customer_address)}`;
        }

        const items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
        document.getElementById("detailPurchasedItems").innerHTML = items.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; background:#fff; padding:0.4rem 0.6rem; border-radius:6px; border:1px solid var(--gray-200);">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <img src="${item.image}" alt="${item.name}" style="width:30px; height:30px; border-radius:4px; object-fit:cover;">
                    <div>
                        <strong>${item.name}</strong>
                        <div style="font-size:0.72rem; color:var(--gray-500);">${formatRupiah(item.price)} x${item.quantity}</div>
                    </div>
                </div>
                <strong>${formatRupiah(item.price * item.quantity)}</strong>
            </div>
        `).join('');

        document.getElementById("detailSubtotal").innerText = formatRupiah(Number(data.subtotal));

        let courierDisplayName = "🛵 Kurir Lokal Toko";
        if (data.shipping_method === "ambil-sendiri") {
            courierDisplayName = "🏪 Ambil Sendiri di Warung";
        } else if (data.shipping_method !== "kurir-toko") {
            courierDisplayName = data.shipping_method || "Kurir";
        }
        document.getElementById("detailCourierName").innerText  = courierDisplayName;
        document.getElementById("detailShippingCost").innerText = formatRupiah(Number(data.shipping_cost));
        document.getElementById("detailTotal").innerText        = formatRupiah(Number(data.total));

        renderStatusStepper(data.status);

        document.getElementById("orderDetailModal").classList.add("open");
        document.getElementById("cartOverlay").classList.add("open");
        document.getElementById("ordersHistoryModal").classList.remove("open");
        toggleBodyScroll(true);
    } catch (err) {
        console.error("Failed to load order tracking details:", err);
        alert("Gagal memuat status pelacakan pesanan!");
    }
}

// =====================================================================
// RENDER STATUS STEPPER (Timeline Pesanan)
// =====================================================================
function renderStatusStepper(status) {
    const banner = document.getElementById("detailStatusBanner");
    const steps  = ["step1", "step2", "step3", "step4", "step5"];
    const lines  = ["line1", "line2", "line3", "line4"];

    steps.forEach(id => { document.getElementById(id).className = "step-item"; });
    lines.forEach(id => { document.getElementById(id).className = "step-line"; });

    if (status === "Dibatalkan") {
        steps.forEach(id => document.getElementById(id).classList.add("cancelled"));
        banner.innerText        = "❌ Pesanan Dibatalkan oleh Penjual";
        banner.style.background = "#ffebe9";
        banner.style.color      = "#f43f5e";
        return;
    }

    banner.style.background = "var(--primary-light)";
    banner.style.color      = "var(--primary-dark)";

    if (status === "Menunggu Pembayaran") {
        document.getElementById("step1").classList.add("active");
        banner.innerText = "⏳ Dibuat (Menunggu Pembayaran)";
    } else if (status === "Lunas" || status === "Sudah Dibayar" || status === "COD - Diproses") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("line1").classList.add("completed");
        document.getElementById("step2").classList.add("active");
        banner.innerText = status.includes("COD") ? "💵 COD Terkonfirmasi (Sedang Diproses)" : "💳 Terbayar (Sudah Lunas)";
    } else if (status === "Sedang Disiapkan") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("line1").classList.add("completed");
        document.getElementById("step2").classList.add("completed");
        document.getElementById("line2").classList.add("completed");
        document.getElementById("step3").classList.add("active");
        banner.innerText = "📦 Sedang Disiapkan & Dipacking Penjual";
    } else if (status === "Sedang Dikirim") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("step4").classList.add("completed");
        document.getElementById("line4").classList.add("completed");
        document.getElementById("step5").classList.add("completed");
        banner.innerText = "🎉 Pesanan Selesai (Diterima dengan Segar!)";
    }
}
