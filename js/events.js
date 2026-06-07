// =====================================================================
// js/events.js — MODUL EVENT LISTENERS & INISIALISASI UTAMA
// Tanggung jawab: Setup semua event listener UI, init tema, dan
//                 koneksi Supabase Realtime.
// Harus di-load TERAKHIR setelah semua modul lain siap.
// =====================================================================

// MAIN INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
    loadProductsFromSheet();
    setupEventListeners();
    updateCartTotals();
    initTheme();
});

// =====================================================================
// SETUP SEMUA EVENT LISTENER UI
// =====================================================================
function setupEventListeners() {
    const sheetDecQtyBtn        = document.getElementById("sheetDecQtyBtn");
    const sheetIncQtyBtn        = document.getElementById("sheetIncQtyBtn");
    const sheetAddCartBtn       = document.getElementById("sheetAddCartBtn");
    const sheetCancelBtn        = document.getElementById("sheetCancelBtn");
    const searchInput           = document.getElementById("searchInput");
    const categoryChips         = document.querySelectorAll(".category-chip");
    const catalogTitle          = document.getElementById("catalogTitle");
    const bottomCartBar         = document.getElementById("bottomCartBar");
    const cartDrawer            = document.getElementById("cartDrawer");
    const cartOverlay           = document.getElementById("cartOverlay");
    const closeCartBtn          = document.getElementById("closeCartBtn");
    const selectAllCartCheckbox = document.getElementById("selectAllCartCheckbox");
    const checkoutBtn           = document.getElementById("checkoutBtn");
    const checkoutModal         = document.getElementById("checkoutModal");
    const closeCheckoutBtn      = document.getElementById("closeCheckoutBtn");
    const deliveryCards         = document.querySelectorAll("#deliveryGrid .delivery-card");
    const deliveryForm          = document.getElementById("deliveryForm");
    const confirmPaymentBtn     = document.getElementById("confirmPaymentBtn");
    const finishCheckoutBtn     = document.getElementById("finishCheckoutBtn");
    const myOrdersBtn           = document.getElementById("myOrdersBtn");
    const closeOrdersModalBtn   = document.getElementById("closeOrdersModalBtn");
    const submitLoginWaBtn      = document.getElementById("submitLoginWaBtn");

    // Seller Elements
    const sellerDashboardBtn    = document.getElementById("sellerDashboardBtn");
    const submitSellerPinBtn    = document.getElementById("submitSellerPinBtn");
    const sellerLogoutBtn       = document.getElementById("sellerLogoutBtn");
    const tabSellerDashboard    = document.getElementById("tabSellerDashboard");
    const tabSellerOrders       = document.getElementById("tabSellerOrders");
    const tabSellerProducts     = document.getElementById("tabSellerProducts");
    const addNewProductBtn      = document.getElementById("addNewProductBtn");
    const productEditForm       = document.getElementById("productEditForm");
    const closeProdFormBtn      = document.getElementById("closeProdFormBtn");
    const addFormVariantBtn     = document.getElementById("addFormVariantBtn");
    const editProdImageFile     = document.getElementById("editProdImageFile");

    // ----------------------------------------------------------------
    // BOTTOM SHEET — Qty & Keranjang
    // ----------------------------------------------------------------
    sheetDecQtyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (sheetQty > 1) {
            sheetQty--;
            document.getElementById("sheetQtyVal").innerText   = sheetQty;
            const price = activeProduct.variants[activeVariantIndex].price;
            document.getElementById("sheetProdPrice").innerText = formatRupiah(price * sheetQty);
        }
    });

    sheetIncQtyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sheetQty++;
        document.getElementById("sheetQtyVal").innerText   = sheetQty;
        const price = activeProduct.variants[activeVariantIndex].price;
        document.getElementById("sheetProdPrice").innerText = formatRupiah(price * sheetQty);
    });

    sheetCancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeProductBottomSheet();
    });

    sheetAddCartBtn.addEventListener("click", () => {
        if (!activeProduct) return;

        const variant    = activeProduct.variants[activeVariantIndex];
        const cartItemId = `${activeProduct.id}-${activeVariantIndex}`;

        const existingItem = cart.find(item => item.cartItemId === cartItemId);
        if (existingItem) {
            existingItem.quantity += sheetQty;
        } else {
            cart.push({
                cartItemId: cartItemId,
                productId:  activeProduct.id,
                name:       `${activeProduct.name} (${variant.name})`,
                price:      variant.price,
                unit:       variant.name,
                quantity:   sheetQty,
                image:      activeProduct.images[0],
                checked:    true
            });
        }

        updateCartTotals();
        renderCart();
        showToast(`🛒 ${activeProduct.name} dimasukkan ke keranjang!`);
        closeProductBottomSheet();
    });

    // ----------------------------------------------------------------
    // SEARCH & FILTER KATEGORI
    // ----------------------------------------------------------------
    searchInput.addEventListener("input", (e) => {
        const query          = e.target.value.toLowerCase().trim();
        const activeChip     = document.querySelector(".category-chip.active");
        const activeCategory = activeChip ? activeChip.dataset.category : "semua";
        filterProducts(query, activeCategory);
    });

    categoryChips.forEach(chip => {
        chip.addEventListener("click", () => {
            categoryChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            const activeCategory = chip.dataset.category;
            const query          = searchInput.value.toLowerCase().trim();

            catalogTitle.innerText = activeCategory === "semua"
                ? "Semua Produk"
                : `Kategori: ${chip.innerText.substring(2)}`;

            filterProducts(query, activeCategory);
        });
    });

    // ----------------------------------------------------------------
    // KERANJANG
    // ----------------------------------------------------------------
    bottomCartBar.addEventListener("click", () => {
        cartDrawer.classList.add("open");
        cartOverlay.classList.add("open");
        renderCart();
        toggleBodyScroll(true);
    });

    closeCartBtn.addEventListener("click", () => {
        cartDrawer.classList.remove("open");
        cartOverlay.classList.remove("open");
        toggleBodyScroll(false);
    });

    cartOverlay.addEventListener("click", () => {
        cartDrawer.classList.remove("open");
        cartOverlay.classList.remove("open");
        checkoutModal.classList.remove("open");
        document.getElementById("ordersHistoryModal").classList.remove("open");
        document.getElementById("orderDetailModal").classList.remove("open");
        activeTrackingOrderId = null;
        toggleBodyScroll(false);
    });

    document.getElementById("bottomSheetOverlay").addEventListener("click", () => {
        closeProductBottomSheet();
    });

    selectAllCartCheckbox.addEventListener("change", (e) => {
        const checked = e.target.checked;
        cart.forEach(item => { item.checked = checked; });
        updateCartTotals();
        renderCart();
    });

    // ----------------------------------------------------------------
    // CHECKOUT MODAL
    // ----------------------------------------------------------------
    checkoutBtn.addEventListener("click", () => {
        cartDrawer.classList.remove("open");
        cartOverlay.classList.remove("open");
        checkoutModal.classList.add("open");
        cartOverlay.classList.add("open");

        const checkedSubtotal = calculateCheckedSubtotal();
        
        // Initialize currentOrder draft for Stage 1 real-time calculations
        currentOrder = {
            id:               "",
            customerName:     "",
            customerWhatsapp: "",
            customerAddress:  "",
            googleMapsLink:   "",
            shippingMethod:   selectedShipping.method,
            shippingCost:     selectedShipping.cost,
            subtotal:         checkedSubtotal,
            total:            checkedSubtotal + selectedShipping.cost,
            items:            cart.filter(item => item.checked),
            status:           "Menunggu Pembayaran",
            date:             "",
            amountVersion:    1
        };

        // Reset payment radios in Stage 1
        const paymentRadios = document.querySelectorAll('input[name="paymentType"]');
        paymentRadios.forEach(radio => {
            radio.checked = false;
            const card = radio.closest(".delivery-card");
            if (card) card.classList.remove("selected");
        });

        navigateToStage(1);
        if (typeof calculateStage2Costs === "function") calculateStage2Costs();
        toggleBodyScroll(true);
    });

    closeCheckoutBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("open");
        cartOverlay.classList.remove("open");
        toggleBodyScroll(false);
        if (typeof stopPaymentPolling === "function") stopPaymentPolling();
    });

    deliveryCards.forEach(card => {
        card.addEventListener("click", () => {
            deliveryCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");

            selectedShipping = {
                method: card.dataset.shipping,
                cost:   parseInt(card.dataset.cost),
                name:   card.querySelector(".delivery-name").innerText
            };

            if (currentOrder) {
                currentOrder.shippingMethod = selectedShipping.method;
                currentOrder.shippingCost   = selectedShipping.cost;
            }

            if (typeof calculateStage2Costs === "function") calculateStage2Costs();
        });
    });

    // STAGE 1 SUBMIT (Form Pengiriman)
    deliveryForm.addEventListener("submit", (e) => {
        e.preventDefault();

        if (selectedShipping.method !== "ambil-sendiri" && !isLocationConfirmed) {
            alert("Harap konfirmasi titik lokasi pengiriman Anda terlebih dahulu dengan mengeklik tombol '📍 Konfirmasi Lokasi & Cek Ongkir' di bawah peta!");
            return;
        }

        const paymentRadio = document.querySelector('input[name="paymentType"]:checked');
        if (!paymentRadio) {
            alert("Harap pilih metode pembayaran terlebih dahulu!");
            return;
        }
        const paymentType = paymentRadio.value;

        const name     = document.getElementById("customerName").value.trim();
        const whatsapp = document.getElementById("customerWhatsapp").value.trim();
        const address  = document.getElementById("customerAddress").value.trim();
        const mapsLink = document.getElementById("customerMapsLink").value.trim();

        const customerProfile = { name, whatsapp, address, google_maps_link: mapsLink };
        localStorage.setItem("mbokde_customer_profile", JSON.stringify(customerProfile));

        const orderedItems = cart.filter(item => item.checked);
        const subtotal     = calculateCheckedSubtotal();

        // Update currentOrder values before inserting into Supabase
        currentOrder.id               = currentOrder.id || generateRandomOrderId();
        currentOrder.customerName     = name;
        currentOrder.customerWhatsapp = whatsapp;
        currentOrder.customerAddress  = address;
        currentOrder.googleMapsLink   = mapsLink;
        currentOrder.shippingMethod   = selectedShipping.method;
        currentOrder.shippingCost     = selectedShipping.cost;
        currentOrder.subtotal         = subtotal;
        currentOrder.items            = orderedItems;
        currentOrder.status           = "Menunggu Pembayaran";
        currentOrder.date             = new Date().toLocaleString("id-ID");
        currentOrder.paymentMethod    = paymentType.toUpperCase();

        // Re-calculate to get final total with discount and admin fees
        if (typeof calculateStage2Costs === "function") calculateStage2Costs();
        const finalTotal = currentOrder.total;

        showToast("Mengirim pesanan ke database...");

        const orderData = {
            id:                currentOrder.id,
            date:              currentOrder.date,
            customer_name:     currentOrder.customerName,
            customer_whatsapp: currentOrder.customerWhatsapp,
            customer_address:  currentOrder.customerAddress,
            latitude:          customerCoords.lat,
            longitude:         customerCoords.lng,
            shipping_method:   currentOrder.shippingMethod,
            shipping_cost:     currentOrder.shippingCost,
            subtotal:          currentOrder.subtotal,
            total:             finalTotal,
            payment_method:    currentOrder.paymentMethod,
            items:             currentOrder.items,
            status:            currentOrder.status
        };

        supabaseClient.from('pesanan').insert([orderData])
            .then(({ error }) => {
                if (error) throw error;
                showToast("📦 Pesanan Anda sukses dicatat!");
                cart = cart.filter(item => !item.checked);
                updateCartTotals();
                navigateToStage(2);
            })
            .catch(err => {
                console.error("Failed to insert order into Supabase:", err);
                alert("Koneksi database bermasalah. Gagal membuat pesanan!");
            });
    });

    // ----------------------------------------------------------------
    // PAYMENT RADIO BUTTONS & GLOBAL RESET
    // ----------------------------------------------------------------
    const paymentRadios             = document.querySelectorAll('input[name="paymentType"]');
    const qrisBox                   = document.getElementById("qrisPaymentBox");
    const vaBox                     = document.getElementById("vaPaymentBox");
    const codBox                    = document.getElementById("codPaymentBox");
    const midtransEmbedBox          = document.getElementById("midtransEmbedBox");
    const paymentPlaceholderBox     = document.getElementById("paymentPlaceholderBox");
    const midtransQrisConfirmBox    = document.getElementById("midtransQrisConfirmBox");
    const midtransVaConfirmBox      = document.getElementById("midtransVaConfirmBox");
    const bankCards                 = document.querySelectorAll(".bank-opt-card");
    const btnConfirmVaPay           = document.getElementById("btnConfirmVaPay");

    bankCards.forEach(card => {
        card.addEventListener("click", () => {
            bankCards.forEach(c => {
                c.style.borderColor     = "var(--gray-300)";
                c.style.backgroundColor = "var(--white)";
                c.style.color           = "var(--dark)";
                c.style.boxShadow       = "none";
            });
            card.style.borderColor     = "#3b82f6";
            card.style.backgroundColor = "#eff6ff";
            card.style.color           = "#1d4ed8";
            card.style.boxShadow       = "0 0 0 1px #3b82f6";

            selectedVaBank = card.getAttribute("data-bank");

            if (typeof savePaymentSession === "function") savePaymentSession();

            if (btnConfirmVaPay) {
                btnConfirmVaPay.removeAttribute("disabled");
                btnConfirmVaPay.style.background = "#3b82f6";
                btnConfirmVaPay.style.color      = "var(--white)";
                btnConfirmVaPay.style.cursor     = "pointer";
                btnConfirmVaPay.innerText = `Bayar dengan VA ${selectedVaBank.toUpperCase()} ➔`;
            }
        });
    });

    // Expose resetVaBankSelector globally
    window.resetVaBankSelector = function() {
        selectedVaBank = null;
        const bCards = document.querySelectorAll(".bank-opt-card");
        const btnVa = document.getElementById("btnConfirmVaPay");
        bCards.forEach(c => {
            c.style.borderColor     = "var(--gray-300)";
            c.style.backgroundColor = "var(--white)";
            c.style.color           = "var(--dark)";
            c.style.boxShadow       = "none";
        });
        if (btnVa) {
            btnVa.setAttribute("disabled", "true");
            btnVa.style.background = "var(--gray-300)";
            btnVa.style.color      = "var(--gray-500)";
            btnVa.style.cursor     = "not-allowed";
            btnVa.innerText        = "Pilih Bank Terlebih Dahulu";
        }
    };

    const btnConfirmQrisPay = document.getElementById("btnConfirmQrisPay");
    if (btnConfirmQrisPay) {
        btnConfirmQrisPay.addEventListener("click", () => {
            if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "none";
            if (midtransEmbedBox)       midtransEmbedBox.style.display       = "block";
            if (typeof triggerMidtransInlinePayment === "function") triggerMidtransInlinePayment("qris");
        });
    }

    if (btnConfirmVaPay) {
        btnConfirmVaPay.addEventListener("click", () => {
            if (!selectedVaBank) return;
            if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "none";
            if (midtransEmbedBox)     midtransEmbedBox.style.display     = "block";
            if (typeof triggerMidtransInlinePayment === "function") triggerMidtransInlinePayment("va", selectedVaBank);
        });
    }

    paymentRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            // Highlight card
            document.querySelectorAll(".payment-method-selector .delivery-card").forEach(c => c.classList.remove("selected"));
            const card = e.target.closest(".delivery-card");
            if (card) card.classList.add("selected");

            if (currentOrder) {
                currentOrder.paymentMethod = e.target.value.toUpperCase();
            }

            if (typeof calculateStage2Costs === "function") calculateStage2Costs();
        });
    });

    // STAGE 2 CONFIRM BUTTON
    confirmPaymentBtn.addEventListener("click", () => {
        const paymentRadio = document.querySelector('input[name="paymentType"]:checked');
        const paymentType = paymentRadio ? paymentRadio.value : "";

        if (!paymentType) return;

        if ((paymentType === "qris" || paymentType === "va") &&
            (typeof MIDTRANS_CLIENT_KEY !== "undefined" && !MIDTRANS_CLIENT_KEY.includes("SB-Mid-client-XXXXXX"))) {
            if (typeof triggerMidtransInlinePayment === "function") {
                triggerMidtransInlinePayment(paymentType);
                return;
            }
        }

        let finalStatus = "Lunas";
        if (paymentType === "cod") finalStatus = "COD - Diproses";

        showToast("Memverifikasi pembayaran...");

        supabaseClient.from('pesanan')
            .update({ payment_method: paymentType.toUpperCase(), status: finalStatus })
            .eq('id', currentOrder.id)
            .then(({ error }) => {
                if (error) throw error;
                currentOrder.paymentMethod = paymentType.toUpperCase();
                currentOrder.status        = finalStatus;
                showToast("✔️ Transaksi Berhasil!");
                navigateToStage(3);
            })
            .catch(err => {
                console.error("Error updating payment in Supabase:", err);
                alert("Gagal memperbarui status pembayaran!");
            });
    });

    finishCheckoutBtn.addEventListener("click", () => {
        deliveryForm.reset();
        checkoutModal.classList.remove("open");
        cartOverlay.classList.remove("open");
        toggleBodyScroll(false);
    });

    // ----------------------------------------------------------------
    // KUPON
    // ----------------------------------------------------------------
    const btnApplyCoupon  = document.getElementById("btnApplyCoupon");
    const couponCodeInput = document.getElementById("couponCodeInput");

    if (btnApplyCoupon) {
        btnApplyCoupon.addEventListener("click", () => {
            if (typeof applyCouponCode === "function") applyCouponCode();
        });
    }

    if (couponCodeInput) {
        couponCodeInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (typeof applyCouponCode === "function") applyCouponCode();
            }
        });
    }

    // ----------------------------------------------------------------
    // PESANAN & RIWAYAT
    // ----------------------------------------------------------------
    myOrdersBtn.addEventListener("click", () => {
        openOrdersHistoryModal();
    });

    closeOrdersModalBtn.addEventListener("click", () => {
        document.getElementById("ordersHistoryModal").classList.remove("open");
        cartOverlay.classList.remove("open");
        toggleBodyScroll(false);
    });

    submitLoginWaBtn.addEventListener("click", () => {
        const wa = document.getElementById("searchWaNo").value.trim();
        if (wa === "") {
            alert("Harap masukkan nomor WhatsApp Anda!");
            return;
        }

        let customerProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile")) || {};
        customerProfile.whatsapp = wa;
        localStorage.setItem("mbokde_customer_profile", JSON.stringify(customerProfile));

        document.getElementById("noHpLoginBox").style.display = "none";
        renderOrdersList(wa);
    });

    // ----------------------------------------------------------------
    // SELLER DASHBOARD
    // ----------------------------------------------------------------
    sellerDashboardBtn.addEventListener("click", () => {
        openSellerDashboard();
    });

    submitSellerPinBtn.addEventListener("click", () => {
        verifySellerPin();
    });

    sellerLogoutBtn.addEventListener("click", () => {
        sellerLogout();
    });

    document.getElementById("closeSellerDashboardBtn").addEventListener("click", () => {
        document.getElementById("sellerDashboardPage").classList.remove("open");
        toggleBodyScroll(false);
    });

    tabSellerDashboard.addEventListener("click", () => selectAdminTab("tabSellerDashboard"));
    tabSellerOrders.addEventListener("click",    () => selectAdminTab("tabSellerOrders"));
    tabSellerProducts.addEventListener("click",  () => selectAdminTab("tabSellerProducts"));

    addNewProductBtn.addEventListener("click", () => {
        openEditProductModal(null);
    });

    closeProdFormBtn.addEventListener("click", () => {
        document.getElementById("productFormModal").classList.remove("open");
    });

    addFormVariantBtn.addEventListener("click", () => {
        addVariantRowToForm("", "", "");
    });

    productEditForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveProductToSheet();
    });

    editProdImageFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) uploadImageToSupabaseStorage(file);
    });
}

// =====================================================================
// TUTUP MODAL DETAIL ORDER → KEMBALI KE RIWAYAT
// =====================================================================
document.getElementById("closeOrderDetailBtn").addEventListener("click", () => {
    document.getElementById("orderDetailModal").classList.remove("open");
    activeTrackingOrderId = null;

    if (document.getElementById("sellerDashboardPage").classList.contains("open")) {
        return;
    }

    const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
    if (savedProfile && savedProfile.whatsapp) {
        document.getElementById("ordersHistoryModal").classList.add("open");
    } else {
        document.getElementById("cartOverlay").classList.remove("open");
        toggleBodyScroll(false);
    }
});

// =====================================================================
// SUPABASE REALTIME — SINKRONISASI PERUBAHAN PESANAN
// =====================================================================
supabaseClient
    .channel('realtime-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, payload => {
        console.log('Realtime event received:', payload);
        const updatedOrder = payload.new || {};

        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            if (activeTrackingOrderId && updatedOrder.id === activeTrackingOrderId) {
                showToast(`🔔 Status pesanan ${updatedOrder.id} diperbarui: ${updatedOrder.status}!`);
                renderStatusStepper(updatedOrder.status);
            }
        }

        if (typeof updateMyOrdersMenuBadge === "function") updateMyOrdersMenuBadge();

        const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
        if (savedProfile && savedProfile.whatsapp && document.getElementById("ordersListBox").style.display === "block") {
            renderOrdersList(savedProfile.whatsapp);
        }

        if (localStorage.getItem("mbokde_seller_logged") === "true" &&
            document.getElementById("sellerDashboardPage").classList.contains("open")) {
            updateDashboardMetrics();
            if (document.getElementById("sellerOrdersView").style.display === "block") {
                loadAllOrdersFromSheet();
            }
        }
    })
    .subscribe();

// =====================================================================
// THEME TOGGLE
// =====================================================================
function initTheme() {
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (!themeToggleBtn) return;

    const isDark = document.documentElement.classList.contains("dark-mode") || document.body.classList.contains("dark-mode");
    themeToggleBtn.innerText = isDark ? "☀️" : "🌙";

    themeToggleBtn.addEventListener("click", () => {
        const currentlyDark = document.documentElement.classList.contains("dark-mode");
        if (currentlyDark) {
            document.documentElement.classList.remove("dark-mode");
            document.body.classList.remove("dark-mode");
            localStorage.setItem("mbokde_theme", "light");
            themeToggleBtn.innerText = "🌙";
            showToast("☀️ Mode Terang Aktif");
        } else {
            document.documentElement.classList.add("dark-mode");
            document.body.classList.add("dark-mode");
            localStorage.setItem("mbokde_theme", "dark");
            themeToggleBtn.innerText = "☀️";
            showToast("🌙 Mode Gelap Aktif");
        }
    });
}
