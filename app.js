// MAIN INITIALIZATION & CONTROLLERS
document.addEventListener("DOMContentLoaded", () => {
    loadProductsFromSheet();
    setupEventListeners();
    updateCartTotals();
    initTheme();
});

// REAL-TIME PRODUCT CATALOG SYNC WITH SUPABASE
async function loadProductsFromSheet() {
    try {
        const { data, error } = await supabaseClient.from('produk').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            products = data;
            console.log("Products successfully synchronized from Supabase!");
        } else {
            console.log("No products found in Supabase, using mock products fallback.");
        }
        renderProducts(products);
    } catch (err) {
        console.error("Failed to connect to Supabase, using mock products fallback:", err);
        renderProducts(products);
    }
}

// RENDERING PRODUCTS (Sayurbox Grid)
function renderProducts(items) {
    const productGrid = document.getElementById("productGrid");
    if (!productGrid) return;
    
    if (items.length === 0) {
        productGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1.5rem; color: var(--gray-500);">
                <svg fill="none" stroke="currentColor" width="48" height="48" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 1rem; color: var(--gray-400);">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p style="font-weight: 600; font-size: 1.1rem; margin-bottom: 0.25rem;">Sayur tidak ditemukan</p>
                <p style="font-size: 0.9rem;">Coba ketik nama sayur lain.</p>
            </div>
        `;
        return;
    }

    productGrid.innerHTML = items.map(product => {
        const defaultVar = product.variants[0];
        return `
            <article class="product-card" onclick="openProductBottomSheet('${product.id}')">
                <div class="product-image-container">
                    ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                    <img src="${product.images[0]}" alt="${product.name}" class="product-image" loading="lazy">
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <span class="product-unit-info">${defaultVar.name}</span>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto;">
                        <span class="product-card-price">${formatRupiah(defaultVar.price)}</span>
                    </div>
                    <button class="product-card-action">Tambah</button>
                </div>
            </article>
        `;
    }).join('');
}

// BOTTOM SHEET - DETAIL & VARIANT POPUP (Sayurbox-style)
function openProductBottomSheet(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    activeProduct = product;
    activeVariantIndex = 0;
    sheetQty = 1;
    carouselIndex = 0;

    const sheetProdName = document.getElementById("sheetProdName");
    const sheetProdDesc = document.getElementById("sheetProdDesc");
    const sheetProdPrice = document.getElementById("sheetProdPrice");
    const sheetQtyVal = document.getElementById("sheetQtyVal");
    const carouselSlides = document.getElementById("carouselSlides");
    const carouselDots = document.getElementById("carouselDots");
    const sheetVariantGrid = document.getElementById("sheetVariantGrid");
    const bottomSheetOverlay = document.getElementById("bottomSheetOverlay");
    const productBottomSheet = document.getElementById("productBottomSheet");

    sheetProdName.innerText = product.name;
    sheetProdDesc.innerText = product.desc;
    sheetProdPrice.innerText = formatRupiah(product.variants[0].price);
    sheetQtyVal.innerText = "1";

    carouselSlides.innerHTML = product.images.map(img => `
        <img src="${img}" alt="${product.name}" class="carousel-slide">
    `).join('');
    
    carouselDots.innerHTML = product.images.map((_, idx) => `
        <span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="setCarouselIndex(${idx}); event.stopPropagation();"></span>
    `).join('');

    updateCarouselTransform();

    sheetVariantGrid.innerHTML = product.variants.map((variant, idx) => `
        <div class="variant-chip-card ${idx === 0 ? 'selected' : ''}" onclick="selectSheetVariant(${idx}); event.stopPropagation();">
            ${variant.label ? `<span class="variant-chip-badge">${variant.label}</span>` : ''}
            <div>${variant.name}</div>
            <div style="font-weight:700; color:var(--primary); margin-top:0.25rem;">${formatRupiah(variant.price)}</div>
        </div>
    `).join('');

    bottomSheetOverlay.classList.add("open");
    productBottomSheet.classList.add("open");
    toggleBodyScroll(true);
}

function closeProductBottomSheet() {
    const bottomSheetOverlay = document.getElementById("bottomSheetOverlay");
    const productBottomSheet = document.getElementById("productBottomSheet");
    bottomSheetOverlay.classList.remove("open");
    productBottomSheet.classList.remove("open");
    activeProduct = null;
    toggleBodyScroll(false);
}

function setCarouselIndex(idx) {
    carouselIndex = idx;
    updateCarouselTransform();
}

function updateCarouselTransform() {
    const carouselSlides = document.getElementById("carouselSlides");
    carouselSlides.style.transform = `translateX(-${carouselIndex * 100}%)`;
    const dots = document.querySelectorAll(".carousel-dot");
    dots.forEach((dot, idx) => {
        if (idx === carouselIndex) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

function selectSheetVariant(idx) {
    activeVariantIndex = idx;
    const selectedVariant = activeProduct.variants[idx];
    
    const sheetProdPrice = document.getElementById("sheetProdPrice");
    sheetProdPrice.innerText = formatRupiah(selectedVariant.price * sheetQty);

    const chips = document.querySelectorAll(".variant-chip-card");
    chips.forEach((chip, i) => {
        if (i === idx) {
            chip.classList.add("selected");
        } else {
            chip.classList.remove("selected");
        }
    });
}

// EVENT LISTENERS Setup (SAFELY NESTED)
function setupEventListeners() {
    const sheetDecQtyBtn = document.getElementById("sheetDecQtyBtn");
    const sheetIncQtyBtn = document.getElementById("sheetIncQtyBtn");
    const sheetAddCartBtn = document.getElementById("sheetAddCartBtn");
    const sheetCancelBtn = document.getElementById("sheetCancelBtn");
    const searchInput = document.getElementById("searchInput");
    const categoryChips = document.querySelectorAll(".category-chip");
    const catalogTitle = document.getElementById("catalogTitle");
    const bottomCartBar = document.getElementById("bottomCartBar");
    const cartDrawer = document.getElementById("cartDrawer");
    const cartOverlay = document.getElementById("cartOverlay");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const selectAllCartCheckbox = document.getElementById("selectAllCartCheckbox");
    const checkoutBtn = document.getElementById("checkoutBtn");
    const checkoutModal = document.getElementById("checkoutModal");
    const closeCheckoutBtn = document.getElementById("closeCheckoutBtn");
    const deliveryCards = document.querySelectorAll(".delivery-card");
    const deliveryForm = document.getElementById("deliveryForm");
    const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
    const finishCheckoutBtn = document.getElementById("finishCheckoutBtn");
    const myOrdersBtn = document.getElementById("myOrdersBtn");
    const closeOrdersModalBtn = document.getElementById("closeOrdersModalBtn");
    const submitLoginWaBtn = document.getElementById("submitLoginWaBtn");
    
    // Seller Elements
    const sellerDashboardBtn = document.getElementById("sellerDashboardBtn");
    const submitSellerPinBtn = document.getElementById("submitSellerPinBtn");
    const sellerLogoutBtn = document.getElementById("sellerLogoutBtn");
    
    const tabSellerDashboard = document.getElementById("tabSellerDashboard");
    const tabSellerOrders = document.getElementById("tabSellerOrders");
    const tabSellerProducts = document.getElementById("tabSellerProducts");
    const addNewProductBtn = document.getElementById("addNewProductBtn");
    const productEditForm = document.getElementById("productEditForm");
    const closeProdFormBtn = document.getElementById("closeProdFormBtn");
    const addFormVariantBtn = document.getElementById("addFormVariantBtn");
    const editProdImageFile = document.getElementById("editProdImageFile");
    
    sheetDecQtyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (sheetQty > 1) {
            sheetQty--;
            document.getElementById("sheetQtyVal").innerText = sheetQty;
            const price = activeProduct.variants[activeVariantIndex].price;
            document.getElementById("sheetProdPrice").innerText = formatRupiah(price * sheetQty);
        }
    });

    sheetIncQtyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        sheetQty++;
        document.getElementById("sheetQtyVal").innerText = sheetQty;
        const price = activeProduct.variants[activeVariantIndex].price;
        document.getElementById("sheetProdPrice").innerText = formatRupiah(price * sheetQty);
    });

    sheetCancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeProductBottomSheet();
    });

    sheetAddCartBtn.addEventListener("click", () => {
        if (!activeProduct) return;

        const variant = activeProduct.variants[activeVariantIndex];
        const cartItemId = `${activeProduct.id}-${activeVariantIndex}`;

        const existingItem = cart.find(item => item.cartItemId === cartItemId);
        if (existingItem) {
            existingItem.quantity += sheetQty;
        } else {
            cart.push({
                cartItemId: cartItemId,
                productId: activeProduct.id,
                name: `${activeProduct.name} (${variant.name})`,
                price: variant.price,
                unit: variant.name,
                quantity: sheetQty,
                image: activeProduct.images[0],
                checked: true 
            });
        }

        updateCartTotals();
        renderCart();
        showToast(`🛒 ${activeProduct.name} dimasukkan ke keranjang!`);
        closeProductBottomSheet();
    });

    // SEARCH BAR EVENT
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const activeChip = document.querySelector(".category-chip.active");
        const activeCategory = activeChip ? activeChip.dataset.category : "semua";
        filterProducts(query, activeCategory);
    });

    // CATEGORY FILTER
    categoryChips.forEach(chip => {
        chip.addEventListener("click", () => {
            categoryChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            const activeCategory = chip.dataset.category;
            const query = searchInput.value.toLowerCase().trim();

            if (activeCategory === "semua") {
                catalogTitle.innerText = "Semua Produk";
            } else {
                catalogTitle.innerText = `Kategori: ${chip.innerText.substring(2)}`;
            }

            filterProducts(query, activeCategory);
        });
    });

    // BOTTOM CART CLICKS
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

    checkoutBtn.addEventListener("click", () => {
        cartDrawer.classList.remove("open");
        cartOverlay.classList.remove("open");
        checkoutModal.classList.add("open");
        cartOverlay.classList.add("open");

        const checkedSubtotal = calculateCheckedSubtotal();
        document.getElementById("stage1Total").innerText = formatRupiah(checkedSubtotal + selectedShipping.cost);

        navigateToStage(1);
        toggleBodyScroll(true);
    });

    closeCheckoutBtn.addEventListener("click", () => {
        checkoutModal.classList.remove("open");
        cartOverlay.classList.remove("open");
        toggleBodyScroll(false);
        if (typeof stopPaymentPolling === "function") {
            stopPaymentPolling();
        }
    });

    deliveryCards.forEach(card => {
        card.addEventListener("click", () => {
            deliveryCards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");

            selectedShipping = {
                method: card.dataset.shipping,
                cost: parseInt(card.dataset.cost),
                name: card.querySelector(".delivery-name").innerText
            };

            const checkedSubtotal = calculateCheckedSubtotal();
            document.getElementById("stage1Total").innerText = formatRupiah(checkedSubtotal + selectedShipping.cost);
        });
    });

    // STAGE 1 SUBMIT
    deliveryForm.addEventListener("submit", (e) => {
        e.preventDefault();

        // Validasi Konfirmasi Lokasi untuk metode selain Ambil Sendiri
        if (selectedShipping.method !== "ambil-sendiri" && !isLocationConfirmed) {
            alert("Harap konfirmasi titik lokasi pengiriman Anda terlebih dahulu dengan mengeklik tombol '📍 Konfirmasi Lokasi & Cek Ongkir' di bawah peta!");
            return;
        }

        const name = document.getElementById("customerName").value.trim();
        const whatsapp = document.getElementById("customerWhatsapp").value.trim();
        const address = document.getElementById("customerAddress").value.trim();
        const mapsLink = document.getElementById("customerMapsLink").value.trim();
        
        const customerProfile = {
            name: name,
            whatsapp: whatsapp,
            address: address,
            google_maps_link: mapsLink
        };
        localStorage.setItem("mbokde_customer_profile", JSON.stringify(customerProfile));

        const orderedItems = cart.filter(item => item.checked);
        const subtotal = calculateCheckedSubtotal();
        const total = subtotal + selectedShipping.cost;

        currentOrder = {
            id: generateRandomOrderId(),
            customerName: name,
            customerWhatsapp: whatsapp,
            customerAddress: address,
            googleMapsLink: mapsLink,
            shippingMethod: selectedShipping.method,
            shippingCost: selectedShipping.cost,
            subtotal: subtotal,
            total: total,
            items: orderedItems,
            status: "Menunggu Pembayaran",
            date: new Date().toLocaleString("id-ID"),
            amountVersion: 1
        };

        showToast("Mengirim pesanan ke database...");

        const orderData = {
            id: currentOrder.id,
            date: currentOrder.date,
            customer_name: currentOrder.customerName,
            customer_whatsapp: currentOrder.customerWhatsapp,
            customer_address: currentOrder.customerAddress,
            latitude: customerCoords.lat, // Dynamic latitude pinpointed on map
            longitude: customerCoords.lng, // Dynamic longitude pinpointed on map
            shipping_method: currentOrder.shippingMethod,
            shipping_cost: currentOrder.shippingCost,
            subtotal: currentOrder.subtotal,
            total: currentOrder.total,
            items: currentOrder.items,
            status: currentOrder.status
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

    const paymentRadios = document.querySelectorAll('input[name="paymentType"]');
    const qrisBox = document.getElementById("qrisPaymentBox");
    const vaBox = document.getElementById("vaPaymentBox");
    const codBox = document.getElementById("codPaymentBox");
    const midtransEmbedBox = document.getElementById("midtransEmbedBox");
    
    // Elemen UX Baru
    const paymentPlaceholderBox = document.getElementById("paymentPlaceholderBox");
    const midtransQrisConfirmBox = document.getElementById("midtransQrisConfirmBox");
    const midtransVaConfirmBox = document.getElementById("midtransVaConfirmBox");

    // Bank Selector Card Click Listener
    const bankCards = document.querySelectorAll(".bank-opt-card");
    const btnConfirmVaPay = document.getElementById("btnConfirmVaPay");

    bankCards.forEach(card => {
        card.addEventListener("click", () => {
            // Hapus seleksi dari semua kartu bank
            bankCards.forEach(c => {
                c.style.borderColor = "var(--gray-300)";
                c.style.backgroundColor = "var(--white)";
                c.style.color = "var(--dark)";
                c.style.boxShadow = "none";
            });

            // Highlight kartu terpilih
            card.style.borderColor = "#3b82f6";
            card.style.backgroundColor = "#eff6ff";
            card.style.color = "#1d4ed8";
            card.style.boxShadow = "0 0 0 1px #3b82f6";

            selectedVaBank = card.getAttribute("data-bank");

            // Save the payment session state
            if (typeof savePaymentSession === "function") {
                savePaymentSession();
            }

            // Aktifkan tombol konfirmasi VA
            if (btnConfirmVaPay) {
                btnConfirmVaPay.removeAttribute("disabled");
                btnConfirmVaPay.style.background = "#3b82f6";
                btnConfirmVaPay.style.color = "var(--white)";
                btnConfirmVaPay.style.cursor = "pointer";
                btnConfirmVaPay.innerText = `Bayar dengan VA ${selectedVaBank.toUpperCase()} ➔`;
            }
        });
    });

    function resetVaBankSelector() {
        selectedVaBank = null;
        bankCards.forEach(c => {
            c.style.borderColor = "var(--gray-300)";
            c.style.backgroundColor = "var(--white)";
            c.style.color = "var(--dark)";
            c.style.boxShadow = "none";
        });
        if (btnConfirmVaPay) {
            btnConfirmVaPay.setAttribute("disabled", "true");
            btnConfirmVaPay.style.background = "var(--gray-300)";
            btnConfirmVaPay.style.color = "var(--gray-500)";
            btnConfirmVaPay.style.cursor = "not-allowed";
            btnConfirmVaPay.innerText = "Pilih Bank Terlebih Dahulu";
        }
    }

    // Tombol Konfirmasi QRIS
    const btnConfirmQrisPay = document.getElementById("btnConfirmQrisPay");
    if (btnConfirmQrisPay) {
        btnConfirmQrisPay.addEventListener("click", () => {
            if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "none";
            if (midtransEmbedBox) midtransEmbedBox.style.display = "block";
            if (typeof triggerMidtransInlinePayment === "function") {
                triggerMidtransInlinePayment("qris");
            }
        });
    }

    // Tombol Konfirmasi VA
    if (btnConfirmVaPay) {
        btnConfirmVaPay.addEventListener("click", () => {
            if (!selectedVaBank) return;
            if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "none";
            if (midtransEmbedBox) midtransEmbedBox.style.display = "block";
            if (typeof triggerMidtransInlinePayment === "function") {
                triggerMidtransInlinePayment("va", selectedVaBank);
            }
        });
    }

    paymentRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            // Sembunyikan semua box terlebih dahulu
            qrisBox.style.display = "none";
            vaBox.style.display = "none";
            codBox.style.display = "none";
            if (paymentPlaceholderBox) paymentPlaceholderBox.style.display = "none";
            if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "none";
            if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "none";
            if (midtransEmbedBox) midtransEmbedBox.style.display = "none";
            
            // Tampilkan tombol konfirmasi utama bawah (default visible untuk non-Midtrans/COD)
            confirmPaymentBtn.style.display = "block"; 

            // Hancurkan library Snap yang sedang aktif di memori untuk mencegah eror status transisi
            if (typeof destroyMidtransSnapLibrary === "function") {
                destroyMidtransSnapLibrary();
            }

            document.querySelectorAll(".payment-method-selector .delivery-card").forEach(c => c.classList.remove("selected"));
            e.target.closest(".delivery-card").classList.add("selected");

            const isMidtransConfigured = typeof MIDTRANS_CLIENT_KEY !== "undefined" && !MIDTRANS_CLIENT_KEY.includes("SB-Mid-client-XXXXXX");

            if (e.target.value === "qris") {
                if (isMidtransConfigured) {
                    if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "block";
                    confirmPaymentBtn.style.display = "none"; // Gunakan tombol konfirmasi inline khusus
                } else {
                    qrisBox.style.display = "block";
                    confirmPaymentBtn.innerText = "Selesaikan Pembayaran";
                }
            } else if (e.target.value === "va") {
                if (isMidtransConfigured) {
                    resetVaBankSelector();
                    if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "block";
                    confirmPaymentBtn.style.display = "none"; // Gunakan tombol konfirmasi inline khusus
                } else {
                    vaBox.style.display = "block";
                    confirmPaymentBtn.innerText = "Selesaikan Pembayaran";
                }
            } else if (e.target.value === "cod") {
                codBox.style.display = "block";
                confirmPaymentBtn.innerText = "Selesaikan Pembayaran (COD) ➔";
            }

            // Recalculate Stage 2 costs dynamically on payment selection change
            if (typeof calculateStage2Costs === "function") {
                calculateStage2Costs();
            }

            // Save the payment session state
            if (typeof savePaymentSession === "function") {
                savePaymentSession();
            }
        });
    });

    // STAGE 2 CONFIRM
    confirmPaymentBtn.addEventListener("click", () => {
        const paymentType = document.querySelector('input[name="paymentType"]:checked').value;

        // Jika Midtrans dikonfigurasi (Client Key diisi & bukan placeholder), gunakan Midtrans Snap
        if ((paymentType === "qris" || paymentType === "va") && 
            (typeof MIDTRANS_CLIENT_KEY !== "undefined" && !MIDTRANS_CLIENT_KEY.includes("SB-Mid-client-XXXXXX"))) {
            if (typeof triggerMidtransInlinePayment === "function") {
                triggerMidtransInlinePayment(paymentType);
                return;
            }
        }

        let finalStatus = "Lunas";
        if (paymentType === "cod") {
            finalStatus = "COD - Diproses";
        }

        showToast("Memverifikasi pembayaran...");

        supabaseClient.from('pesanan')
        .update({ payment_method: paymentType.toUpperCase(), status: finalStatus })
        .eq('id', currentOrder.id)
        .then(({ error }) => {
            if (error) throw error;
            currentOrder.paymentMethod = paymentType.toUpperCase();
            currentOrder.status = finalStatus;
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

    // Bind Coupon Apply Elements
    const btnApplyCoupon = document.getElementById("btnApplyCoupon");
    const couponCodeInput = document.getElementById("couponCodeInput");

    if (btnApplyCoupon) {
        btnApplyCoupon.addEventListener("click", () => {
            if (typeof applyCouponCode === "function") {
                applyCouponCode();
            }
        });
    }

    if (couponCodeInput) {
        couponCodeInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (typeof applyCouponCode === "function") {
                    applyCouponCode();
                }
            }
        });
    }

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

    // SELLER DASHBOARD TRIGGERS
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

    // Sidebar panel navigation handlers
    tabSellerDashboard.addEventListener("click", () => selectAdminTab("tabSellerDashboard"));
    tabSellerOrders.addEventListener("click", () => selectAdminTab("tabSellerOrders"));
    tabSellerProducts.addEventListener("click", () => selectAdminTab("tabSellerProducts"));

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
        if (file) {
            uploadImageToSupabaseStorage(file);
        }
    });
}

// Tutup modal pelacakan dan buka kembali riwayat pesanan
document.getElementById("closeOrderDetailBtn").addEventListener("click", () => {
    document.getElementById("orderDetailModal").classList.remove("open");
    activeTrackingOrderId = null;
    
    // Check if seller dashboard is open. If yes, just close the modal and keep dashboard active.
    if (document.getElementById("sellerDashboardPage").classList.contains("open")) {
        // Keep overlay/body scroll locked because seller dashboard is open
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

// INSTAN REAL-TIME SINKRONISASI SUPABASE (WOW!)
supabaseClient
  .channel('realtime-orders')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan' }, payload => {
      console.log('Realtime event received:', payload);
      const updatedOrder = payload.new || {};
      
      // Jika terjadi penambahan atau pembaruan pesanan
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          if (activeTrackingOrderId && updatedOrder.id === activeTrackingOrderId) {
              showToast(`🔔 Status pesanan ${updatedOrder.id} diperbarui: ${updatedOrder.status}!`);
              renderStatusStepper(updatedOrder.status);
          }
      }
      
      // Selalu update badge pesanan saya di header
      if (typeof updateMyOrdersMenuBadge === "function") {
          updateMyOrdersMenuBadge();
      }
      
      // Update riwayat pesanan pelanggan jika modalnya sedang terbuka
      const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
      if (savedProfile && savedProfile.whatsapp && document.getElementById("ordersListBox").style.display === "block") {
          renderOrdersList(savedProfile.whatsapp);
      }
      
      // Update dasbor penjual jika sedang login & terbuka
      if (localStorage.getItem("mbokde_seller_logged") === "true" && document.getElementById("sellerDashboardPage").classList.contains("open")) {
          updateDashboardMetrics();
          if (document.getElementById("sellerOrdersView").style.display === "block") {
              loadAllOrdersFromSheet();
          }
      }
  })
  .subscribe();

// Theme Toggle Handler
function initTheme() {
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (!themeToggleBtn) return;

    // Set initial icon
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
