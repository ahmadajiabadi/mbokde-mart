// =====================================================================
// js/seller-auth.js — MODUL AUTENTIKASI & NAVIGASI DASHBOARD PENJUAL
// Tanggung jawab: Login/logout seller, navigasi antar tab admin.
// Dependensi: config.js (SELLER_PIN, supabaseClient),
//             utils.js (showToast, toggleBodyScroll),
//             seller-orders.js (loadAllOrdersFromSheet, updateDashboardMetrics)
//             seller-products.js (loadAllProductsForSeller)
//             seller-settings.js (loadShopSettingsInDashboard)
// =====================================================================

function openSellerDashboard() {
    const sellerPinSection   = document.getElementById("sellerPinSection");
    const sellerControlPanel = document.getElementById("sellerControlPanel");
    const sellerDashboardPage = document.getElementById("sellerDashboardPage");

    if (localStorage.getItem("mbokde_seller_logged") === "true") {
        sellerPinSection.style.display   = "none";
        sellerControlPanel.style.display = "flex";
        selectAdminTab("tabSellerDashboard");
    } else {
        sellerPinSection.style.display   = "flex";
        sellerControlPanel.style.display = "none";
    }
    document.getElementById("sellerPinInput").value = "";
    sellerDashboardPage.classList.add("open");
    toggleBodyScroll(true);
}

function verifySellerPin() {
    const pin                = document.getElementById("sellerPinInput").value.trim();
    const sellerPinSection   = document.getElementById("sellerPinSection");
    const sellerControlPanel = document.getElementById("sellerControlPanel");

    const activePin = localStorage.getItem("mbokde_seller_pin") || SELLER_PIN;

    if (pin === activePin) {
        localStorage.setItem("mbokde_seller_logged", "true");
        sellerPinSection.style.display   = "none";
        sellerControlPanel.style.display = "flex";
        selectAdminTab("tabSellerDashboard");
        showToast("🔑 Login Penjual Berhasil!");
    } else {
        alert("PIN Keamanan Salah! Akses Ditolak.");
    }
}

function sellerLogout() {
    localStorage.removeItem("mbokde_seller_logged");
    document.getElementById("sellerControlPanel").style.display = "none";
    document.getElementById("sellerPinSection").style.display   = "flex";
    document.getElementById("sellerPinInput").value             = "";
    document.getElementById("sellerDashboardPage").classList.remove("open");
    toggleBodyScroll(false);
    showToast("🚪 Berhasil keluar dari Dashboard.");
}

// =====================================================================
// NAVIGASI TAB ADMIN SIDEBAR
// =====================================================================
function selectAdminTab(tabId) {
    const tabOverview  = document.getElementById("sellerDashboardOverview");
    const tabOrders    = document.getElementById("sellerOrdersView");
    const tabProducts  = document.getElementById("sellerProductsView");
    const tabSettings  = document.getElementById("sellerSettingsView");

    const btnOverview  = document.getElementById("tabSellerDashboard");
    const btnOrders    = document.getElementById("tabSellerOrders");
    const btnProducts  = document.getElementById("tabSellerProducts");
    const btnSettings  = document.getElementById("tabSellerSettings");
    const adminPageTitle = document.getElementById("adminPageTitle");

    [btnOverview, btnOrders, btnProducts, btnSettings].forEach(btn => {
        if (btn) btn.classList.remove("active");
    });
    [tabOverview, tabOrders, tabProducts, tabSettings].forEach(sec => {
        if (sec) sec.style.display = "none";
    });

    if (tabId === "tabSellerDashboard") {
        btnOverview.classList.add("active");
        tabOverview.style.display = "block";
        adminPageTitle.innerText  = "📊 Ringkasan Dasbor";
        updateDashboardMetrics();

    } else if (tabId === "tabSellerOrders") {
        btnOrders.classList.add("active");
        tabOrders.style.display  = "block";
        adminPageTitle.innerText = "📦 Pesanan Masuk";

        currentSellerFilter = "semua";
        const filterContainer = document.getElementById("adminOrdersFilterContainer");
        if (filterContainer) {
            const buttons = filterContainer.querySelectorAll(".admin-filter-status-btn");
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
        loadAllOrdersFromSheet();

    } else if (tabId === "tabSellerProducts") {
        btnProducts.classList.add("active");
        tabProducts.style.display = "block";
        adminPageTitle.innerText  = "🥦 Katalog Produk";
        loadAllProductsForSeller();

    } else if (tabId === "tabSellerSettings") {
        if (btnSettings) btnSettings.classList.add("active");
        if (tabSettings) tabSettings.style.display = "block";
        adminPageTitle.innerText = "⚙️ Pengaturan Toko";
        loadShopSettingsInDashboard();
    }
}

function refreshAdminData() {
    const activeBtn = document.querySelector(".sidebar-link.active");
    if (activeBtn) selectAdminTab(activeBtn.id);
}
