// CHECKOUT & GOOGLE MAPS LINK PINPOINT & ORDER STATUS TRACKING

let isLocationConfirmed = false;
let customerOrdersCache = [];
let currentCustomerFilter = "semua";

function navigateToStage(stageNum) {
    const modalTitle = document.getElementById("modalTitle");
    const checkoutStage1 = document.getElementById("checkoutStage1");
    const checkoutStage2 = document.getElementById("checkoutStage2");
    const checkoutStage3 = document.getElementById("checkoutStage3");
    const stage1Total = document.getElementById("stage1Total");
    const successOrderId = document.getElementById("successOrderId");
    const successDeliveryTime = document.getElementById("successDeliveryTime");

    checkoutStage1.style.display = "none";
    checkoutStage2.style.display = "none";
    checkoutStage3.style.display = "none";

    if (stageNum === 1) {
        stopPaymentPolling();
        modalTitle.innerText = "📝 Tahap 1: Informasi Pengiriman";
        checkoutStage1.style.display = "block";
        
        const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
        if (savedProfile) {
            document.getElementById("customerName").value = savedProfile.name || "";
            document.getElementById("customerWhatsapp").value = savedProfile.whatsapp || "";
            document.getElementById("customerAddress").value = savedProfile.address || "";
            if (document.getElementById("customerMapsLink") && savedProfile.google_maps_link) {
                document.getElementById("customerMapsLink").value = savedProfile.google_maps_link;
                
                // Copy to the paste link input in Tab 1
                const pasteInput = document.getElementById("customerMapsPasteInput");
                if (pasteInput) {
                    pasteInput.value = savedProfile.google_maps_link;
                }
                
                // Parse koordinat dari simpanan profil jika valid
                const coordsMatch = savedProfile.google_maps_link.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (coordsMatch) {
                    customerCoords = { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) };
                }
            }
        }
        initCheckoutMap();
        selectMapOption('link');
    } else if (stageNum === 2) {
        modalTitle.innerText = "💳 Tahap 2: Selesaikan Pembayaran";
        checkoutStage2.style.display = "block";
        startPaymentPolling();

        // Hancurkan Snap SDK lama di awal untuk mencegah eror transisi PopupInView
        destroyMidtransSnapLibrary();

        // 1. Bersihkan DOM Default
        document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
            radio.checked = false;
            const card = radio.closest(".delivery-card");
            if (card) card.classList.remove("selected");
        });

        const couponInput = document.getElementById("couponCodeInput");
        if (couponInput) couponInput.value = "";
        const badge = document.getElementById("voucherBadge");
        if (badge) badge.style.display = "none";
        const errorMsg = document.getElementById("voucherErrorMessage");
        if (errorMsg) {
            errorMsg.style.display = "none";
            errorMsg.innerText = "";
        }

        const paymentPlaceholderBox = document.getElementById("paymentPlaceholderBox");
        if (paymentPlaceholderBox) paymentPlaceholderBox.style.display = "block";
        
        const boxes = ["midtransQrisConfirmBox", "midtransVaConfirmBox", "midtransEmbedBox", "qrisPaymentBox", "vaPaymentBox", "codPaymentBox"];
        boxes.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        const confirmBtn = document.getElementById("confirmPaymentBtn");
        if (confirmBtn) confirmBtn.style.display = "none";

        // 2. Cek apakah ada sesi pembayaran sebelumnya di localStorage
        const savedSessionStr = localStorage.getItem("mbokde_payment_session_" + currentOrder.id);
        let savedSession = null;
        if (savedSessionStr) {
            try {
                savedSession = JSON.parse(savedSessionStr);
            } catch (e) {
                console.error("Error parsing saved payment session:", e);
            }
        }

        if (savedSession) {
            // Restore coupons in memory
            appliedCoupons = savedSession.appliedCoupons || {
                ongkir: false,
                ongkirCode: "",
                ongkirMaxDiscount: 0,
                admin: false,
                adminCode: ""
            };

            // Restore token cache to currentOrder
            if (savedSession.paymentType === "qris" && savedSession.token) {
                currentOrder.qrisToken = savedSession.token;
            } else if (savedSession.paymentType === "va" && savedSession.bankType && savedSession.token) {
                currentOrder["vaToken_" + savedSession.bankType] = savedSession.token;
            }

            // Restore global selectedVaBank and amount version
            selectedVaBank = savedSession.bankType || null;
            currentOrder.amountVersion = savedSession.amountVersion || 1;

            // Render UI Stage 2 dengan harga ter-discount sesuai voucher terpulih
            updateStage2UI();

            // Restore voucher badge UI
            if (badge) {
                const activeCodes = [];
                if (appliedCoupons.ongkir) activeCodes.push(appliedCoupons.ongkirCode);
                if (appliedCoupons.admin) activeCodes.push(appliedCoupons.adminCode);
                if (appliedCoupons.diskon) activeCodes.push(appliedCoupons.diskonCode);

                if (activeCodes.length > 0) {
                    badge.style.display = "inline-block";
                    badge.innerText = `🎟️ Voucher ${activeCodes.join(", ")} Terpasang`;
                } else {
                    badge.style.display = "none";
                }
            }

            // Restore payment selection in UI
            if (savedSession.paymentType) {
                const radio = document.querySelector(`input[name="paymentType"][value="${savedSession.paymentType}"]`);
                if (radio) {
                    radio.checked = true;
                    const card = radio.closest(".delivery-card");
                    if (card) card.classList.add("selected");
                }

                if (paymentPlaceholderBox) paymentPlaceholderBox.style.display = "none";

                if (savedSession.paymentType === "qris") {
                    const midtransEmbedBox = document.getElementById("midtransEmbedBox");
                    if (midtransEmbedBox) midtransEmbedBox.style.display = "block";
                    triggerMidtransInlinePayment("qris");
                } else if (savedSession.paymentType === "va" && savedSession.bankType) {
                    // Highlight selected bank opt card
                    const bankCards = document.querySelectorAll(".bank-opt-card");
                    bankCards.forEach(c => {
                        if (c.getAttribute("data-bank") === savedSession.bankType) {
                            c.style.borderColor = "#3b82f6";
                            c.style.backgroundColor = "#eff6ff";
                            c.style.color = "#1d4ed8";
                            c.style.boxShadow = "0 0 0 1px #3b82f6";
                        }
                    });

                    const midtransEmbedBox = document.getElementById("midtransEmbedBox");
                    if (midtransEmbedBox) midtransEmbedBox.style.display = "block";
                    triggerMidtransInlinePayment("va", savedSession.bankType);
                } else if (savedSession.paymentType === "cod") {
                    const codBox = document.getElementById("codPaymentBox");
                    if (codBox) codBox.style.display = "block";
                    if (confirmBtn) {
                        confirmBtn.style.display = "block";
                        confirmBtn.innerText = "Selesaikan Pembayaran (COD) ➔";
                    }
                }
            }
        } else {
            // Reset state kupon/voucher jika tidak ada sesi tersimpan
            appliedCoupons = {
                ongkir: false,
                ongkirCode: "",
                ongkirMaxDiscount: 0,
                admin: false,
                adminCode: "",
                diskon: false,
                diskonCode: "",
                diskonPercentage: 0,
                diskonMax: 0
            };
            selectedVaBank = null;
            updateStage2UI();
        }
    } else if (stageNum === 3) {
        stopPaymentPolling();
        modalTitle.innerText = "🎉 Pesanan Selesai!";
        checkoutStage3.style.display = "block";

        successOrderId.innerText = currentOrder.id;
        successDeliveryTime.innerText = currentOrder.shippingMethod === "kurir-toko" ? "1-3 Jam" : "Ambil Sendiri di Warung";

        // Clear the payment session from localStorage upon successful checkout
        localStorage.removeItem("mbokde_payment_session_" + currentOrder.id);
        console.log("🧹 Sesi pembayaran dibersihkan karena pesanan telah lunas:", currentOrder.id);
    }
}

function updateStage2UI() {
    if (!currentOrder) return;

    const paymentOrderId = document.getElementById("paymentOrderId");
    const qrisFinalPrice = document.getElementById("qrisFinalPrice");
    const vaFinalPrice = document.getElementById("vaFinalPrice");
    const codFinalPrice = document.getElementById("codFinalPrice");
    const stage2Total = document.getElementById("stage2Total");
    const qrisCodeImg = document.getElementById("qrisCodeImg");
    const vaBankTitle = document.getElementById("vaBankNameTitle");
    const vaAccountDisplay = document.getElementById("vaAccountNumberDisplay");

    paymentOrderId.innerText = currentOrder.id;

    // Load custom QRIS image or generate simulated QR code dynamically
    if (shopQrisImage && shopQrisImage.trim() !== "") {
        qrisCodeImg.src = shopQrisImage;
    } else {
        const qrisRawData = `qris://mbokdemart?orderid=${currentOrder.id}&amount=${currentOrder.total}`;
        qrisCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrisRawData)}`;
    }

    // Load custom VA Bank name and Account details
    if (vaBankTitle) {
        vaBankTitle.innerText = "Virtual Account " + (shopBankName || "BCA");
    }
    if (vaAccountDisplay) {
        vaAccountDisplay.innerText = (shopBankAccountNo || "8801 2345 6789 0123");
    }

    // Hitung rincian biaya, promo ongkir, biaya admin secara dinamis
    calculateStage2Costs();
}

let appliedCoupons = {
    ongkir: false,
    ongkirCode: "",
    ongkirMaxDiscount: 0,
    admin: false,
    adminCode: "",
    diskon: false,
    diskonCode: "",
    diskonPercentage: 0,
    diskonMax: 0
};

// Save payment state session dynamically in localStorage
function savePaymentSession() {
    if (!currentOrder) return;

    const paymentRadio = document.querySelector('input[name="paymentType"]:checked');
    const paymentType = paymentRadio ? paymentRadio.value : "";
    
    let token = "";
    if (paymentType === "qris") {
        token = currentOrder.qrisToken || "";
    } else if (paymentType === "va" && selectedVaBank) {
        token = currentOrder["vaToken_" + selectedVaBank] || "";
    }

    const sessionData = {
        paymentType: paymentType,
        bankType: selectedVaBank || "",
        token: token,
        appliedCoupons: appliedCoupons,
        amountVersion: currentOrder.amountVersion || 1
    };

    localStorage.setItem("mbokde_payment_session_" + currentOrder.id, JSON.stringify(sessionData));
    console.log("💾 Sesi pembayaran disimpan untuk pesanan " + currentOrder.id, sessionData);
}

function calculateStage2Costs() {
    if (!currentOrder) return;

    // Reload shopVouchers from localStorage to ensure we have the absolute latest vouchers created in seller panel
    if (typeof getShopSetting === "function") {
        shopVouchers = JSON.parse(getShopSetting("mbokde_vouchers", JSON.stringify(DEFAULT_VOUCHERS)));
    }

    const subtotal = Number(currentOrder.subtotal);
    const baseOngkir = Number(currentOrder.shippingCost);
    const isLocalCourier = currentOrder.shippingMethod === "kurir-toko";

    // 1. Hitung Ongkos Kirim Akhir (Promo hanya berlaku untuk Ekspedisi Biteship/SiCepat dll, bukan kurir toko)
    let finalOngkir = baseOngkir;
    let ongkirDiscount = 0;
    let ongkirFreeReason = "";

    if (!isLocalCourier) {
        // Cek Promo Otomatis
        if (shopAutoFreeOngkir && subtotal >= shopAutoFreeOngkirMin) {
            let maxAutoDiscount = 10000;
            const defaultOngkirVoucher = shopVouchers.find(v => v.type === "ongkir");
            if (defaultOngkirVoucher) {
                maxAutoDiscount = Number(defaultOngkirVoucher.maxDiscount) || baseOngkir;
                if (maxAutoDiscount === 0) maxAutoDiscount = baseOngkir;
            }
            ongkirDiscount = Math.min(baseOngkir, maxAutoDiscount);
            ongkirFreeReason = "PROMO_AUTO";
        }
        // Cek Kupon Voucher Dinamis
        else if (appliedCoupons.ongkir) {
            let cap = Number(appliedCoupons.ongkirMaxDiscount) || baseOngkir;
            if (cap === 0) cap = baseOngkir;
            ongkirDiscount = Math.min(baseOngkir, cap);
            ongkirFreeReason = "VOUCHER";
        }
        finalOngkir = Math.max(0, baseOngkir - ongkirDiscount);
    }

    // 2. Hitung Biaya Admin Akhir
    let baseAdminFee = 0;
    const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || "";

    if (paymentType === "qris") {
        baseAdminFee = Math.round(subtotal * 0.007);
    } else if (paymentType === "va") {
        baseAdminFee = shopVaAdminFee;
    } else if (paymentType === "cod") {
        baseAdminFee = 0;
    }

    let finalAdminFee = baseAdminFee;
    let adminDiscount = 0;
    let adminFreeReason = "";

    if (paymentType === "qris" || paymentType === "va") {
        // Cek jika penjual menonaktifkan beban admin secara default
        if (!shopChargeAdminToBuyer) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "SELLER_ABSORBED";
        } 
        // Cek Promo Otomatis
        else if (shopAutoFreeAdmin && subtotal >= shopAutoFreeAdminMin) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "PROMO_AUTO";
        } 
        // Cek Kupon Voucher Dinamis
        else if (appliedCoupons.admin) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "VOUCHER";
        }
    }

    // 3. Hitung Diskon Belanja Akhir (tipe diskon belanja %)
    let diskonDiscount = 0;
    if (appliedCoupons.diskon) {
        diskonDiscount = Math.round(subtotal * (Number(appliedCoupons.diskonPercentage) / 100));
        if (Number(appliedCoupons.diskonMax) > 0) {
            diskonDiscount = Math.min(diskonDiscount, Number(appliedCoupons.diskonMax));
        }
    }

    const finalTotal = Math.max(0, subtotal + finalOngkir + finalAdminFee - diskonDiscount);

    // Simpan total baru yang sudah didiskon ke pesanan aktif agar terkirim ke Midtrans
    currentOrder.total = finalTotal;

    // 4. Render rincian biaya di DOM secara real-time
    const breakdownSubtotal = document.getElementById("breakdownSubtotal");
    const breakdownOngkir = document.getElementById("breakdownOngkir");
    const breakdownAdmin = document.getElementById("breakdownAdmin");
    const breakdownDiskonRow = document.getElementById("breakdownDiskonRow");
    const breakdownDiskon = document.getElementById("breakdownDiskon");
    const stage2Total = document.getElementById("stage2Total");

    if (breakdownSubtotal) breakdownSubtotal.innerText = formatRupiah(subtotal);

    if (breakdownOngkir) {
        if (ongkirDiscount > 0) {
            const discText = ongkirFreeReason === "PROMO_AUTO" ? "(Promo Otomatis)" : `(${appliedCoupons.ongkirCode})`;
            breakdownOngkir.innerHTML = `<span style="text-decoration:line-through; color:var(--gray-400); font-size:0.8rem; margin-right:0.4rem;">${formatRupiah(baseOngkir)}</span> <span style="color:#047857; font-weight:700;">${formatRupiah(finalOngkir)} ${discText}</span>`;
        } else {
            breakdownOngkir.innerText = formatRupiah(baseOngkir);
        }
    }

    if (breakdownAdmin) {
        if (adminDiscount > 0 && baseAdminFee > 0) {
            let discText = `(${appliedCoupons.adminCode})`;
            if (adminFreeReason === "PROMO_AUTO") discText = "(Promo Otomatis)";
            else if (adminFreeReason === "SELLER_ABSORBED") discText = "(Ditanggung Penjual)";
            breakdownAdmin.innerHTML = `<span style="text-decoration:line-through; color:var(--gray-400); font-size:0.8rem; margin-right:0.4rem;">${formatRupiah(baseAdminFee)}</span> <span style="color:#047857; font-weight:700;">Rp 0 ${discText}</span>`;
        } else {
            breakdownAdmin.innerText = formatRupiah(baseAdminFee);
        }
    }

    if (breakdownDiskonRow && breakdownDiskon) {
        if (diskonDiscount > 0) {
            breakdownDiskonRow.style.display = "flex";
            breakdownDiskon.innerText = `-${formatRupiah(diskonDiscount)} (${appliedCoupons.diskonCode})`;
        } else {
            breakdownDiskonRow.style.display = "none";
        }
    }

    if (stage2Total) stage2Total.innerText = formatRupiah(finalTotal);

    // Update harga pada kontainer penjelasan jika ada
    const midtransQrisFinalPrice = document.getElementById("midtransQrisFinalPrice");
    const midtransVaFinalPrice = document.getElementById("midtransVaFinalPrice");
    if (midtransQrisFinalPrice) midtransQrisFinalPrice.innerText = formatRupiah(finalTotal);
    if (midtransVaFinalPrice) midtransVaFinalPrice.innerText = formatRupiah(finalTotal);
}

function applyCouponCode() {
    const input = document.getElementById("couponCodeInput");
    const badge = document.getElementById("voucherBadge");
    const errorMsg = document.getElementById("voucherErrorMessage");

    if (!input || !currentOrder) return;

    // Reload shopVouchers from localStorage to ensure we have the absolute latest vouchers created in seller panel
    if (typeof getShopSetting === "function") {
        shopVouchers = JSON.parse(getShopSetting("mbokde_vouchers", JSON.stringify(DEFAULT_VOUCHERS)));
    }

    const code = input.value.trim().toUpperCase();
    const subtotal = Number(currentOrder.subtotal);

    // Reset error
    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.innerText = "";
    }

    if (code === "") {
        appliedCoupons.ongkir = false;
        appliedCoupons.ongkirCode = "";
        appliedCoupons.ongkirMaxDiscount = 0;
        appliedCoupons.admin = false;
        appliedCoupons.adminCode = "";
        appliedCoupons.diskon = false;
        appliedCoupons.diskonCode = "";
        appliedCoupons.diskonPercentage = 0;
        appliedCoupons.diskonMax = 0;
        
        // Increment version and clear cache
        currentOrder.amountVersion = (currentOrder.amountVersion || 1) + 1;
        currentOrder.qrisToken = null;
        for (let key in currentOrder) {
            if (key.startsWith("vaToken_")) {
                currentOrder[key] = null;
            }
        }

        if (badge) badge.style.display = "none";
        calculateStage2Costs();
        if (typeof savePaymentSession === "function") {
            savePaymentSession();
        }

        // Auto-reload Midtrans inline payment frame with new price token
        const activeRadio = document.querySelector('input[name="paymentType"]:checked');
        if (activeRadio) {
            const paymentType = activeRadio.value;
            if (paymentType === "qris") {
                triggerMidtransInlinePayment("qris");
            } else if (paymentType === "va" && selectedVaBank) {
                triggerMidtransInlinePayment("va", selectedVaBank);
            }
        }
        return;
    }

    let couponApplied = false;
    let errorText = "";

    // Cari voucher di array dinamis shopVouchers secara case-insensitive
    const voucher = (shopVouchers || []).find(v => v.code.toUpperCase() === code);

    if (!voucher) {
        errorText = "Kode voucher tidak valid atau kedaluwarsa.";
    } else {
        const minPurchase = Number(voucher.minPurchase) || 0;
        if (voucher.type === "ongkir") {
            if (currentOrder.shippingMethod === "kurir-toko") {
                errorText = "Voucher Gratis Ongkir tidak berlaku untuk Kurir Lokal Toko.";
            } else if (subtotal < minPurchase) {
                errorText = `Minimal belanja untuk voucher ini adalah ${formatRupiah(minPurchase)}.`;
            } else {
                appliedCoupons.ongkir = true;
                appliedCoupons.ongkirCode = code;
                appliedCoupons.ongkirMaxDiscount = Number(voucher.maxDiscount) || 0;
                couponApplied = true;
            }
        } else if (voucher.type === "admin") {
            if (subtotal < minPurchase) {
                errorText = `Minimal belanja untuk voucher ini adalah ${formatRupiah(minPurchase)}.`;
            } else {
                appliedCoupons.admin = true;
                appliedCoupons.adminCode = code;
                couponApplied = true;
            }
        } else if (voucher.type === "diskon") {
            if (subtotal < minPurchase) {
                errorText = `Minimal belanja untuk voucher ini adalah ${formatRupiah(minPurchase)}.`;
            } else {
                appliedCoupons.diskon = true;
                appliedCoupons.diskonCode = code;
                appliedCoupons.diskonPercentage = Number(voucher.percentage) || 0;
                appliedCoupons.diskonMax = Number(voucher.maxDiscount) || 0;
                couponApplied = true;
            }
        }
    }

    if (couponApplied) {
        // Increment version and clear payment cache to fetch new token with updated price
        currentOrder.amountVersion = (currentOrder.amountVersion || 1) + 1;
        currentOrder.qrisToken = null;
        for (let key in currentOrder) {
            if (key.startsWith("vaToken_")) {
                currentOrder[key] = null;
            }
        }

        if (badge) {
            const activeCodes = [];
            if (appliedCoupons.ongkir) activeCodes.push(appliedCoupons.ongkirCode);
            if (appliedCoupons.admin) activeCodes.push(appliedCoupons.adminCode);
            if (appliedCoupons.diskon) activeCodes.push(appliedCoupons.diskonCode);

            if (activeCodes.length > 0) {
                badge.style.display = "inline-block";
                badge.innerText = `🎟️ Voucher ${activeCodes.join(", ")} Terpasang`;
            } else {
                badge.style.display = "none";
            }
        }
        showToast(`🎟️ Voucher ${code} berhasil dipasang!`);
        input.value = ""; // Bersihkan kolom input
    } else {
        if (errorMsg) {
            errorMsg.style.display = "block";
            errorMsg.innerText = errorText;
        }
        showToast("❌ Gagal memasang voucher!");
    }

    calculateStage2Costs();
    if (typeof savePaymentSession === "function") {
        savePaymentSession();
    }

    // Auto-reload Midtrans inline payment frame with new price token
    const activeRadio = document.querySelector('input[name="paymentType"]:checked');
    if (activeRadio) {
        const paymentType = activeRadio.value;
        if (paymentType === "qris") {
            triggerMidtransInlinePayment("qris");
        } else if (paymentType === "va" && selectedVaBank) {
            triggerMidtransInlinePayment("va", selectedVaBank);
        }
    }
}

function openOrdersHistoryModal() {
    const noHpLoginBox = document.getElementById("noHpLoginBox");
    const ordersListBox = document.getElementById("ordersListBox");
    const ordersHistoryModal = document.getElementById("ordersHistoryModal");
    const cartOverlay = document.getElementById("cartOverlay");
    const searchWaNo = document.getElementById("searchWaNo");

    noHpLoginBox.style.display = "block";
    ordersListBox.style.display = "none";

    // Reset status filter
    currentCustomerFilter = "semua";
    const filterContainer = document.getElementById("ordersFilterContainer");
    if (filterContainer) {
        filterContainer.style.display = "none";
        const buttons = filterContainer.querySelectorAll(".filter-status-btn");
        buttons.forEach(b => {
            b.classList.remove("active");
            b.style.border = "1px solid var(--gray-300)";
            b.style.background = "white";
            b.style.color = "var(--gray-600)";
        });
        const allBtn = filterContainer.querySelector('[data-status="semua"]');
        if (allBtn) {
            allBtn.classList.add("active");
            allBtn.style.border = "none";
            allBtn.style.background = "var(--primary)";
            allBtn.style.color = "white";
        }
    }

    ordersHistoryModal.classList.add("open");
    cartOverlay.classList.add("open");
    toggleBodyScroll(true);
    
    const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
    if (savedProfile && savedProfile.whatsapp) {
        searchWaNo.value = savedProfile.whatsapp;
        noHpLoginBox.style.display = "none";
        renderOrdersList(savedProfile.whatsapp);
    } else {
        searchWaNo.value = "";
    }
}

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

        // Saring pesanan aktif/belum selesai (bukan Selesai dan bukan Dibatalkan)
        const activeOrders = (data || []).filter(order => {
            const isMatchWa = cleanWa(order.customer_whatsapp) === cleanSearchWa;
            const isUnfinished = order.status !== "Selesai" && order.status !== "Dibatalkan";
            return isMatchWa && isUnfinished;
        });

        if (activeOrders.length > 0) {
            badge.innerText = activeOrders.length;
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    } catch (e) {
        console.warn("Failed to update myOrders menu badge:", e);
    }
}

function getProxyUrl(proxyName) {
    const base = typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : "";
    if (!base) {
        return proxyName + ".php";
    }
    if (base.includes("supabase.co/functions/v1/")) {
        const supabaseName = proxyName.replace("_", "-");
        return base + supabaseName;
    }
    return base + proxyName + ".php";
}

function updateCustomerFilterBadges() {
    const filterContainer = document.getElementById("ordersFilterContainer");
    if (!filterContainer) return;

    // Hitung jumlah pesanan aktif pelanggan berdasarkan cache
    const countSemua = customerOrdersCache.length;
    const countBelumBayar = customerOrdersCache.filter(o => o.status === "Menunggu Pembayaran").length;
    const countDiproses = customerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan").length;
    const countDikirim = customerOrdersCache.filter(o => o.status === "Sedang Dikirim").length;
    const countSelesai = customerOrdersCache.filter(o => o.status === "Selesai").length;

    // Helper untuk lencana bulat premium
    const getBadge = (count, isAccent = false) => {
        if (count === 0) return "";
        const bg = isAccent ? "var(--accent)" : "var(--primary)";
        return ` <span style="background:${bg}; color:white; border-radius:50%; padding:0.15rem 0.35rem; font-size:0.65rem; font-weight:800; min-width:16px; text-align:center; line-height:1; display:inline-block; margin-left:0.25rem;">${count}</span>`;
    };

    const btnSemua = filterContainer.querySelector('[data-status="semua"]');
    const btnBelumBayar = filterContainer.querySelector('[data-status="belum-bayar"]');
    const btnDiproses = filterContainer.querySelector('[data-status="diproses"]');
    const btnDikirim = filterContainer.querySelector('[data-status="dikirim"]');
    const btnSelesai = filterContainer.querySelector('[data-status="selesai"]');

    if (btnSemua) btnSemua.innerHTML = `Semua${getBadge(countSemua, false)}`;
    if (btnBelumBayar) btnBelumBayar.innerHTML = `Belum Bayar${getBadge(countBelumBayar, true)}`;
    if (btnDiproses) btnDiproses.innerHTML = `Diproses${getBadge(countDiproses, false)}`;
    if (btnDikirim) btnDikirim.innerHTML = `Dikirim${getBadge(countDikirim, false)}`;
    if (btnSelesai) btnSelesai.innerHTML = `Selesai${getBadge(countSelesai, false)}`;
}

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
                id: order.id,
                date: order.date,
                customerName: order.customer_name,
                customerWhatsapp: order.customer_whatsapp,
                customerAddress: order.customer_address,
                latitude: order.latitude,
                longitude: order.longitude,
                shippingMethod: order.shipping_method,
                shippingCost: Number(order.shipping_cost),
                subtotal: Number(order.subtotal),
                total: Number(order.total),
                paymentMethod: order.payment_method,
                items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
                status: order.status
            }))
            .filter(order => cleanWa(order.customerWhatsapp) === cleanSearchWa);

        // Tampilkan kontainer filter status
        const filterContainer = document.getElementById("ordersFilterContainer");
        if (filterContainer) {
            filterContainer.style.display = "flex";
        }

        // Perbarui badge jumlah pada tombol filter status
        updateCustomerFilterBadges();

        // Terapkan filter aktif untuk merender list
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
    if (currentCustomerFilter === "belum-bayar") {
        filtered = customerOrdersCache.filter(o => o.status === "Menunggu Pembayaran");
    } else if (currentCustomerFilter === "diproses") {
        filtered = customerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan");
    } else if (currentCustomerFilter === "dikirim") {
        filtered = customerOrdersCache.filter(o => o.status === "Sedang Dikirim");
    } else if (currentCustomerFilter === "selesai") {
        filtered = customerOrdersCache.filter(o => o.status === "Selesai");
    }

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
                    <div style="font-size:0.8rem; color:var(--gray-500); margin-bottom:0.5rem;">
                        📅 ${order.date}
                    </div>
                    <div style="font-size:0.85rem; font-weight:600; margin-bottom:0.75rem;">
                        ${order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                    </div>
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
        else if (currentCustomerFilter === "dikirim") filterLabel = "Dikirim";
        else if (currentCustomerFilter === "selesai") filterLabel = "Selesai";

        ordersListBox.innerHTML = headerHtml + `
            <div style="text-align:center; padding:3rem 1rem; color:var(--gray-400);">
                <span style="font-size: 2rem; display:block; margin-bottom:0.5rem;">🔍</span>
                <p style="font-weight:700; margin-bottom:0.25rem;">Tidak Ada Pesanan</p>
                <p style="font-size:0.8rem;">Tidak ada riwayat pesanan dengan status "${filterLabel}".</p>
            </div>
        `;
    }
}

async function payPendingOrder(orderId, total) {
    showToast("Memuat detail pesanan...");
    try {
        const { data: order, error } = await supabaseClient
            .from('pesanan')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) throw error;
        if (!order) {
            alert("Pesanan tidak ditemukan!");
            return;
        }

        currentOrder = {
            id: order.id,
            customerName: order.customer_name,
            customerWhatsapp: order.customer_whatsapp,
            customerAddress: order.customer_address,
            latitude: order.latitude,
            longitude: order.longitude,
            shippingMethod: order.shipping_method,
            shippingCost: Number(order.shipping_cost),
            subtotal: Number(order.subtotal),
            total: Number(order.total),
            paymentMethod: order.payment_method,
            items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
            amountVersion: 1
        };

        const ordersHistoryModal = document.getElementById("ordersHistoryModal");
        const checkoutModal = document.getElementById("checkoutModal");
        if (ordersHistoryModal) ordersHistoryModal.classList.remove("open");
        if (checkoutModal) checkoutModal.classList.add("open");
        
        navigateToStage(2);
    } catch (err) {
        console.error("Gagal memuat detail pesanan:", err);
        alert("Gagal memuat detail pesanan untuk pembayaran!");
    }
}

// REALTIME STATUS TRACKING DRAWERS
let activeTrackingOrderId = null;

async function openOrderDetail(orderId) {
    try {
        showToast("Memuat status pelacakan...");
        
        const { data, error } = await supabaseClient
            .from('pesanan')
            .select('*')
            .eq('id', orderId)
            .single();
            
        if (error) throw error;
        if (!data) return;
        
        activeTrackingOrderId = orderId;
        
        document.getElementById("detailOrderId").innerText = data.id;
        document.getElementById("detailOrderDate").innerText = data.date;
        document.getElementById("detailCustomerName").innerText = data.customer_name;
        document.getElementById("detailCustomerWhatsapp").innerText = data.customer_whatsapp;
        document.getElementById("detailCustomerAddress").innerText = data.customer_address;

        // Bind Google Maps link dynamic pinpoint (fallback to lat, lng maps query if manual link is missing or older record)
        const mapsLinkElement = document.getElementById("detailCustomerMapsLink");
        if (data.google_maps_link) {
            mapsLinkElement.href = data.google_maps_link;
        } else if (data.latitude && data.longitude) {
            mapsLinkElement.href = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`;
        } else {
            mapsLinkElement.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.customer_address)}`;
        }
        
        const items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
        const detailItemsContainer = document.getElementById("detailPurchasedItems");
        detailItemsContainer.innerHTML = items.map(item => `
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
        document.getElementById("detailCourierName").innerText = courierDisplayName;

        document.getElementById("detailShippingCost").innerText = formatRupiah(Number(data.shipping_cost));
        document.getElementById("detailTotal").innerText = formatRupiah(Number(data.total));
        
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

function renderStatusStepper(status) {
    const banner = document.getElementById("detailStatusBanner");
    const steps = ["step1", "step2", "step3", "step4", "step5"];
    const lines = ["line1", "line2", "line3", "line4"];
    
    steps.forEach(id => {
        const el = document.getElementById(id);
        el.className = "step-item";
    });
    
    lines.forEach(id => {
        const el = document.getElementById(id);
        el.className = "step-line";
    });
    
    if (status === "Dibatalkan") {
        steps.forEach(id => document.getElementById(id).classList.add("cancelled"));
        banner.innerText = "❌ Pesanan Dibatalkan oleh Penjual";
        banner.style.background = "#ffebe9";
        banner.style.color = "#f43f5e";
        return;
    }
    
    banner.style.background = "var(--primary-light)";
    banner.style.color = "var(--primary-dark)";
    
    if (status === "Menunggu Pembayaran") {
        document.getElementById("step1").classList.add("active");
        banner.innerText = "⏳ Dibuat (Menunggu Pembayaran)";
    } 
    else if (status === "Lunas" || status === "Sudah Dibayar" || status === "COD - Diproses") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("line1").classList.add("completed");
        document.getElementById("step2").classList.add("active");
        banner.innerText = status.includes("COD") ? "💵 COD Terkonfirmasi (Sedang Diproses)" : "💳 Terbayar (Sudah Lunas)";
    } 
    else if (status === "Sedang Disiapkan") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("line1").classList.add("completed");
        document.getElementById("step2").classList.add("completed");
        document.getElementById("line2").classList.add("completed");
        document.getElementById("step3").classList.add("active");
        banner.innerText = "📦 Sedang Disiapkan & Dipacking Penjual";
    } 
    else if (status === "Sedang Dikirim") {
        document.getElementById("step1").classList.add("completed");
        document.getElementById("step4").classList.add("completed");
        document.getElementById("line4").classList.add("completed");
        document.getElementById("step5").classList.add("completed");
        banner.innerText = "🎉 Pesanan Selesai (Diterima dengan Segar!)";
    }
}

// ================= WIDGET MAP PINPOINT INTERAKTIF (LEAFLET.JS) =================
let checkoutMapInstance = null;
let checkoutMarkerInstance = null;

function initCheckoutMap() {
    const mapDiv = document.getElementById("checkoutMap");
    if (!mapDiv) return;

    // Jika peta sudah dibuat sebelumnya
    if (checkoutMapInstance) {
        const currentLat = customerCoords.lat;
        const currentLng = customerCoords.lng;
        checkoutMapInstance.setView([currentLat, currentLng], 15);
        if (checkoutMarkerInstance) {
            checkoutMarkerInstance.setLatLng([currentLat, currentLng]);
        }
        setTimeout(() => {
            checkoutMapInstance.invalidateSize();
        }, 150);
        
        updatePinpointCoordinates(currentLat, currentLng);
        return;
    }

    // Inisiasi koordinat default awal (Cipondoh Tangerang)
    let defaultLat = customerCoords.lat;
    let defaultLng = customerCoords.lng;

    // Buat objek peta
    checkoutMapInstance = L.map('checkoutMap').setView([defaultLat, defaultLng], 15);

    // Gunakan Google Maps Roadmap Tiles gratis (Visual persis Google Maps asli)
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps'
    }).addTo(checkoutMapInstance);

    // Marker pin merah draggable
    checkoutMarkerInstance = L.marker([defaultLat, defaultLng], {
        draggable: true
    }).addTo(checkoutMapInstance);

    // Event ketika pin diseret/di-drag
    checkoutMarkerInstance.on('dragend', function (e) {
        const position = checkoutMarkerInstance.getLatLng();
        updatePinpointCoordinates(position.lat, position.lng);
    });

    // Event ketika peta diklik (pindahkan marker ke titik klik)
    checkoutMapInstance.on('click', function (e) {
        checkoutMarkerInstance.setLatLng(e.latlng);
        updatePinpointCoordinates(e.latlng.lat, e.latlng.lng);
    });

    // SISTEM GEOLOCATION: Jika belum ada simpanan profil, pin langsung ke titik GPS pembeli saat ini
    const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
    if ((!savedProfile || !savedProfile.google_maps_link) && navigator.geolocation) {
        showToast("📍 Mencoba pinpoint ke titik GPS Anda saat ini...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const gpsLat = position.coords.latitude;
                const gpsLng = position.coords.longitude;
                
                checkoutMapInstance.setView([gpsLat, gpsLng], 16);
                checkoutMarkerInstance.setLatLng([gpsLat, gpsLng]);
                updatePinpointCoordinates(gpsLat, gpsLng);
                showToast("✔️ Pinpoint disesuaikan ke lokasi Anda!");
            },
            (error) => {
                console.warn("Akses GPS ditolak pembeli atau gagal, menggunakan lokasi default toko.", error);
                updatePinpointCoordinates(defaultLat, defaultLng);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else {
        updatePinpointCoordinates(defaultLat, defaultLng);
    }
    
    setTimeout(() => {
        checkoutMapInstance.invalidateSize();
    }, 250);
}

// Fungsi toggle ukuran tinggi peta (Perbesar / Perkecil)
function toggleMapSize() {
    const mapDiv = document.getElementById("checkoutMap");
    const btn = document.getElementById("btnToggleMapSize");
    if (!mapDiv || !btn) return;
    
    if (mapDiv.style.height === "220px") {
        mapDiv.style.height = "380px";
        btn.innerText = "🔍 Perkecil Peta";
    } else {
        mapDiv.style.height = "220px";
        btn.innerText = "🔍 Perbesar Peta";
    }
    
    // Paksa Leaflet merender ulang tiles agar pas dengan ukuran baru
    setTimeout(() => {
        if (checkoutMapInstance) {
            checkoutMapInstance.invalidateSize();
        }
    }, 320);
}

// Autocomplete Alamat Google Maps Style (Nominatim OpenStreetMap)
let searchTimeout = null;

function debouncedSearchSuggestions(val) {
    clearTimeout(searchTimeout);
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    if (!suggestionsDiv) return;

    if (!val || val.trim().length < 3) {
        suggestionsDiv.style.display = "none";
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            // Membatasi hasil hanya di Indonesia (&countrycodes=id) demi hasil pencarian lokal yang akurat
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=id`);
            const results = await response.json();
            
            if (results && results.length > 0) {
                suggestionsDiv.innerHTML = results.map(item => `
                    <div class="map-suggestion-item" 
                         onclick="selectMapSuggestion('${item.display_name.replace(/'/g, "\\'")}', ${item.lat}, ${item.lon})"
                         style="padding: 0.6rem 0.8rem; font-size: 0.78rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; color: var(--dark);"
                         onmouseover="this.style.backgroundColor='#f1f5f9'"
                         onmouseout="this.style.backgroundColor='#fff'">
                        🔍 ${item.display_name}
                    </div>
                `).join('');
                suggestionsDiv.style.display = "block";
            } else {
                suggestionsDiv.style.display = "none";
            }
        } catch (err) {
            console.error("Suggestions fetch failure:", err);
        }
    }, 450); // 450ms debounce
}

function selectMapSuggestion(name, lat, lon) {
    const queryInput = document.getElementById("mapSearchInput");
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    
    if (queryInput) queryInput.value = name;
    if (suggestionsDiv) suggestionsDiv.style.display = "none";

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (checkoutMapInstance) {
        checkoutMapInstance.setView([parsedLat, parsedLon], 16);
        if (checkoutMarkerInstance) {
            checkoutMarkerInstance.setLatLng([parsedLat, parsedLon]);
        }
    }
    updatePinpointCoordinates(parsedLat, parsedLon);
    showToast("📍 Lokasi dipilih!");
}

// Tutup suggestion list saat klik di luar area input pencarian
document.addEventListener("click", (e) => {
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    if (suggestionsDiv && !e.target.closest("#mapSearchInput") && !e.target.closest("#mapSearchSuggestions")) {
        suggestionsDiv.style.display = "none";
    }
});

// Fitur Google Maps Autocomplete Alamat (Geocoding OSM Nominatim Gratis)
async function searchAddressOnMap() {
    const queryInput = document.getElementById("mapSearchInput");
    if (!queryInput) return;
    
    const query = queryInput.value.trim();
    if (!query) {
        alert("Harap ketik nama jalan atau alamat terlebih dahulu!");
        return;
    }

    // Sembunyikan suggestions list
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    if (suggestionsDiv) suggestionsDiv.style.display = "none";
    
    showToast("🔎 Mencari lokasi...");
    try {
        // Tambahkan &countrycodes=id untuk memprioritaskan alamat di Indonesia
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=id`);
        const results = await response.json();
        
        if (results && results.length > 0) {
            const firstResult = results[0];
            const lat = parseFloat(firstResult.lat);
            const lng = parseFloat(firstResult.lon);
            
            checkoutMapInstance.setView([lat, lng], 16);
            checkoutMarkerInstance.setLatLng([lat, lng]);
            updatePinpointCoordinates(lat, lng);
            showToast("✔️ Lokasi berhasil ditemukan!");
        } else {
            alert("Lokasi tidak ditemukan! Coba masukkan kata kunci yang lebih spesifik (misal nama daerah, kelurahan, atau perumahan dan kota).");
        }
    } catch (err) {
        console.error("Nominatim geocoding error:", err);
        alert("Gagal menghubungi server pencarian lokasi!");
    }
}

function renderLocationPendingPlaceholder() {
    const deliveryGrid = document.getElementById("deliveryGrid");
    if (!deliveryGrid) return;

    selectedShipping = { method: "", cost: 0, name: "" };
    updateCheckoutTotals();
    hideShopPickupInfo();

    deliveryGrid.innerHTML = `
        <div id="deliveryPlaceholder" style="grid-column: 1/-1; text-align: center; padding: 1.5rem 1.25rem; background: #f8fafc; border: 1.5px dashed var(--gray-300); border-radius: 8px; font-size: 0.82rem; color: var(--gray-500); width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; line-height: 1.5;">
            <span style="font-size: 1.5rem;">📍</span>
            <span>Silakan klik tombol <strong style="color: var(--primary);">"📍 Konfirmasi Lokasi & Cek Ongkir"</strong> di atas terlebih dahulu untuk menampilkan pilihan kurir & menghitung ongkos kirim secara akurat.</span>
        </div>
    `;
}

function updatePinpointCoordinates(lat, lng) {
    customerCoords = { lat, lng };
    
    // Auto-update input link Google Maps untuk database order
    const mapsLinkInput = document.getElementById("customerMapsLink");
    if (mapsLinkInput) {
        mapsLinkInput.value = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    
    // Reset status konfirmasi dan tampilkan placeholder
    isLocationConfirmed = false;
    
    // Update confirm button styling to active state
    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.innerHTML = "📍 Konfirmasi Lokasi & Cek Ongkir";
        btnConfirm.style.background = "var(--primary)";
        btnConfirm.style.color = "white";
        btnConfirm.style.cursor = "pointer";
    }
    
    renderLocationPendingPlaceholder();
}

// ================= INTEGRASI TARIF EKSPEDISI BITESHIP REAL-TIME =================
let biteshipRates = [];

async function fetchBiteshipRates(lat, lng) {
    const deliveryGrid = document.getElementById("deliveryGrid");
    if (!deliveryGrid) return;

    // Loading State
    deliveryGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 1.5rem; color: var(--primary); font-size: 0.85rem; font-weight: 600; display:flex; flex-direction:column; align-items:center; gap:0.5rem; width:100%;">
            <div style="width: 28px; height: 28px; border: 3px solid rgba(0,138,62,0.1); border-top-color: var(--primary); border-radius: 50%; animation: biteshipSpin 0.8s linear infinite; margin-bottom: 0.25rem;"></div>
            <span>⏳ Menghitung Ongkir Real-time Biteship...</span>
            <style>
                @keyframes biteshipSpin {
                    to { transform: rotate(360deg); }
                }
            </style>
        </div>
    `;

    const subtotal = calculateCheckedSubtotal();

    try {
        // Melakukan fetch ke biteship_proxy (mendukung PHP maupun Supabase Edge Function)
        const headers = { "Content-Type": "application/json" };
        if (typeof BACKEND_URL !== 'undefined' && BACKEND_URL.includes("supabase.co/functions/v1/")) {
            headers["Authorization"] = "Bearer " + SUPABASE_KEY;
        }

        const response = await fetch(getProxyUrl("biteship_proxy"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                "origin_latitude": SHOP_COORDINATES.lat,
                "origin_longitude": SHOP_COORDINATES.lng,
                "destination_latitude": lat,
                "destination_longitude": lng,
                "couriers": "jne,sicepat,gojek,grab,anteraja,tiki,jnt",
                "items": [
                    {
                        "name": "Belanja Sayur Mbokde Mart",
                        "description": "Paket Sayuran Segar Harian",
                        "value": subtotal > 0 ? subtotal : 10000,
                        "weight": 1000,
                        "quantity": 1
                    }
                ]
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success || !result.pricing || result.pricing.length === 0) {
            throw new Error(result.error || result.message || "Gagal mendapatkan tarif");
        }

        biteshipRates = result.pricing;
        renderBiteshipRates();
    } catch (err) {
        console.warn("Biteship rates failure, falling back to local shop couriers:", err);
        let warningMsg = "Gagal memuat ekspedisi Biteship secara real-time. Menggunakan tarif toko standar.";
        if (err.message && (err.message.toLowerCase().includes("balance") || err.message.toLowerCase().includes("saldo"))) {
            warningMsg = "⚠️ <strong>Biteship Info:</strong> Saldo akun Biteship Anda Rp 0 (Habis). Sistem otomatis beralih ke tarif toko standar.";
        } else if (err.message) {
            // Tampilkan error deskriptif persis dari server Biteship (misal: kurir di luar jangkauan / no courier available)
            warningMsg = `⚠️ <strong>Biteship Info:</strong> ${err.message}`;
        }
        renderShopFallbackRates(warningMsg);
    }
}

function getHaversineDistance(coords1, coords2) {
    const R = 6371; // Radius bumi dalam Km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Jarak dalam Km
}

function isSamedayOrInstant(rate) {
    const code = (rate.courier_code || "").toLowerCase();
    const service = (rate.courier_service_code || "").toLowerCase();
    const type = (rate.service_type || "").toLowerCase();
    const unit = (rate.shipment_duration_unit || "").toLowerCase();
    
    return (
        type === "instant" || 
        type === "same_day" || 
        code === "gojek" || 
        code === "grab" || 
        code === "gosend" ||
        service.includes("sameday") || 
        service.includes("same_day") || 
        service.includes("instant") ||
        unit === "hours"
    );
}

function renderBiteshipRates() {
    const deliveryGrid = document.getElementById("deliveryGrid");
    if (!deliveryGrid) return;

    hideShopPickupInfo();

    const distance = getHaversineDistance(SHOP_COORDINATES, customerCoords);
    const subtotal = calculateCheckedSubtotal();

    // Validasi Kelayakan Kurir Lokal Toko
    let localCourierEligible = true;
    let localCourierReason = "";

    if (distance > shopMaxDistance) {
        localCourierEligible = false;
        localCourierReason = `Jarak > ${shopMaxDistance.toFixed(1)} km (Maks. ${shopMaxDistance} km)`;
    } else if (subtotal < shopMinPurchase) {
        localCourierEligible = false;
        localCourierReason = `Min. belanja ${formatRupiah(shopMinPurchase)}`;
    }

    let localCourierHtml = "";
    if (localCourierEligible) {
        localCourierHtml = `
            <div class="delivery-card" id="shipping-kurir-toko" 
                 onclick="selectFallbackCourier('kurir-toko', ${shopLocalCourierFee}, '🛵 Kurir Lokal Toko', this)"
                 style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); cursor: pointer; transition: var(--transition);">
                <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--dark);">🛵 Kurir Lokal Toko</span>
                <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem; margin-top:0.25rem;">
                    ${formatRupiah(shopLocalCourierFee)}
                </span>
            </div>
        `;
    } else {
        localCourierHtml = `
            <div class="delivery-card disabled" 
                 style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); opacity: 0.55; pointer-events: none; background: #fafafa;">
                <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--gray-400);">🛵 Kurir Lokal Toko</span>
                <span class="delivery-price" style="font-size: 0.72rem; color: #ef4444; font-weight: 700; margin-top:0.25rem;">
                    ⚠️ ${localCourierReason}
                </span>
            </div>
        `;
    }

    // Opsi Ambil Sendiri di Warung (Selalu Aktif)
    const pickupHtml = `
        <div class="delivery-card" id="shipping-ambil-sendiri" 
             onclick="selectAmbilSendiri(this)"
             style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); cursor: pointer; transition: var(--transition);">
            <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--dark);">🏪 Ambil Sendiri di Warung</span>
            <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem; margin-top:0.25rem;">Gratis (Rp 0)</span>
        </div>
    `;

    // Segmentasi Kurir Biteship: Regular vs Sameday/Instant
    const regularRates = biteshipRates.filter(rate => !isSamedayOrInstant(rate));
    const samedayRates = biteshipRates.filter(rate => isSamedayOrInstant(rate));

    // Ambil maksimal 3 termurah untuk masing-masing tipe
    const sortedRegular = [...regularRates].sort((a, b) => a.price - b.price).slice(0, 3);
    const sortedSameday = [...samedayRates].sort((a, b) => a.price - b.price).slice(0, 3);

    // Gabungkan
    const combinedRates = [...sortedRegular, ...sortedSameday];

    const biteshipHtml = combinedRates.map((rate) => {
        const cardId = `biteship-${rate.courier_code}-${rate.courier_service_code}`;
        const isSameday = isSamedayOrInstant(rate);
        
        // Terjemahkan unit durasi pengiriman
        let durationUnit = rate.shipment_duration_unit;
        if (durationUnit === 'days') durationUnit = 'Hari';
        else if (durationUnit === 'hours') durationUnit = 'Jam';

        return `
            <div class="delivery-card" 
                 id="${cardId}" 
                 onclick="selectBiteshipCourier('${rate.courier_name}', '${rate.courier_service_code}', ${rate.price}, this)"
                 style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); cursor: pointer; transition: var(--transition);">
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <strong class="delivery-name" style="font-size: 0.82rem; color:var(--dark); text-transform: uppercase;">
                        ${isSameday ? '⚡' : '🚚'} ${rate.courier_name}
                    </strong>
                    <span style="font-size: 0.65rem; background: ${isSameday ? '#e0f2fe' : 'var(--primary-light)'}; color: ${isSameday ? '#0369a1' : 'var(--primary-dark)'}; padding: 1px 6px; border-radius: 50px; font-weight: 700;">
                        ${rate.courier_service_code.toUpperCase()}
                    </span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 0.4rem; width:100%;">
                    <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem;">
                        ${formatRupiah(rate.price)}
                    </span>
                    <span style="font-size:0.7rem; color: var(--gray-500);">
                        ⏱️ ${rate.shipment_duration_range} ${durationUnit}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    deliveryGrid.innerHTML = localCourierHtml + pickupHtml + biteshipHtml;

    // Pilih kurir default pertama yang valid
    if (localCourierEligible) {
        const defaultEl = document.getElementById("shipping-kurir-toko");
        if (defaultEl) selectFallbackCourier('kurir-toko', shopLocalCourierFee, '🛵 Kurir Lokal Toko', defaultEl);
    } else {
        const defaultEl = document.getElementById("shipping-ambil-sendiri");
        if (defaultEl) selectAmbilSendiri(defaultEl);
    }
}

function renderShopFallbackRates(warningMsg = "") {
    const deliveryGrid = document.getElementById("deliveryGrid");
    if (!deliveryGrid) return;

    hideShopPickupInfo();

    let warningHtml = "";
    if (warningMsg) {
        warningHtml = `
            <div style="grid-column: 1/-1; font-size: 0.76rem; background: #fffbeb; color: #b45309; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 0.5rem; line-height: 1.45; display:flex; align-items:center; width:100%;">
                <span>${warningMsg}</span>
            </div>
        `;
    }

    const distance = getHaversineDistance(SHOP_COORDINATES, customerCoords);
    const subtotal = calculateCheckedSubtotal();

    // Validasi Kelayakan Kurir Lokal Toko
    let localCourierEligible = true;
    let localCourierReason = "";

    if (distance > shopMaxDistance) {
        localCourierEligible = false;
        localCourierReason = `Jarak > ${shopMaxDistance.toFixed(1)} km (Maks. ${shopMaxDistance} km)`;
    } else if (subtotal < shopMinPurchase) {
        localCourierEligible = false;
        localCourierReason = `Min. belanja ${formatRupiah(shopMinPurchase)}`;
    }

    let localCourierHtml = "";
    if (localCourierEligible) {
        localCourierHtml = `
            <div class="delivery-card" id="shipping-kurir-toko" 
                 onclick="selectFallbackCourier('kurir-toko', ${shopLocalCourierFee}, '🛵 Kurir Lokal Toko', this)">
                <span class="delivery-name">🛵 Kurir Lokal Toko</span>
                <span class="delivery-price">${formatRupiah(shopLocalCourierFee)}</span>
            </div>
        `;
    } else {
        localCourierHtml = `
            <div class="delivery-card disabled" 
                 style="opacity: 0.55; pointer-events: none; background: #fafafa;">
                <span class="delivery-name" style="color: var(--gray-400);">🛵 Kurir Lokal Toko</span>
                <span class="delivery-price" style="font-size: 0.72rem; color: #ef4444; font-weight: 700; margin-top:0.25rem;">
                    ⚠️ ${localCourierReason}
                </span>
            </div>
        `;
    }

    const pickupHtml = `
        <div class="delivery-card" id="shipping-ambil-sendiri" 
             onclick="selectAmbilSendiri(this)">
            <span class="delivery-name">🏪 Ambil Sendiri di Warung</span>
            <span class="delivery-price">Gratis (Rp 0)</span>
        </div>
    `;

    deliveryGrid.innerHTML = warningHtml + localCourierHtml + pickupHtml;

    // Pilih kurir default pertama yang valid
    if (localCourierEligible) {
        const defaultEl = document.getElementById("shipping-kurir-toko");
        if (defaultEl) selectFallbackCourier('kurir-toko', shopLocalCourierFee, '🛵 Kurir Lokal Toko', defaultEl);
    } else {
        const defaultEl = document.getElementById("shipping-ambil-sendiri");
        if (defaultEl) selectAmbilSendiri(defaultEl);
    }
}

function selectBiteshipCourier(courierName, courierService, price, element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    hideShopPickupInfo();

    selectedShipping = {
        method: `${courierName} (${courierService.toUpperCase()})`,
        cost: Number(price),
        name: `${courierName.toUpperCase()} - ${courierService.toUpperCase()}`
    };

    updateCheckoutTotals();
}

function selectFallbackCourier(method, cost, name, element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    hideShopPickupInfo();

    selectedShipping = {
        method: method,
        cost: Number(cost),
        name: name
    };

    updateCheckoutTotals();
}

function selectAmbilSendiri(element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    selectedShipping = {
        method: "ambil-sendiri",
        cost: 0,
        name: "🏪 Ambil Sendiri di Warung"
    };

    showShopPickupInfo();
    updateCheckoutTotals();
}

function showShopPickupInfo() {
    const pickupBox = document.getElementById("shopPickupInfo");
    const addressText = document.getElementById("shopPickupAddressText");
    const mapsLink = document.getElementById("shopPickupGmapsLink");
    if (pickupBox) {
        if (addressText) addressText.innerText = shopAddress;
        if (mapsLink) {
            mapsLink.href = shopGmapsLink;
        }
        pickupBox.style.display = "block";
    }
}

function hideShopPickupInfo() {
    const pickupBox = document.getElementById("shopPickupInfo");
    if (pickupBox) pickupBox.style.display = "none";
}

function updateCheckoutTotals() {
    const checkedSubtotal = calculateCheckedSubtotal();
    document.getElementById("stage1Total").innerText = formatRupiah(checkedSubtotal + selectedShipping.cost);
}

// ================= SISTEM NAVIGASI TAB DAN RESOLVER LINK GOOGLE MAPS =================
function selectMapOption(option) {
    const tabInteractive = document.getElementById("tabMapInteractive");
    const tabLink = document.getElementById("tabMapLink");
    const sectionInteractive = document.getElementById("mapInteractiveSection");
    const sectionLink = document.getElementById("mapLinkSection");
    const checkoutMap = document.getElementById("checkoutMap");
    const linkPreviewContainer = document.getElementById("checkoutMapLinkPreviewContainer");
    
    if (!tabInteractive || !tabLink || !sectionInteractive || !sectionLink || !checkoutMap) return;

    if (option === 'interactive') {
        tabInteractive.style.background = "var(--primary)";
        tabInteractive.style.color = "#fff";
        tabLink.style.background = "#e2e8f0";
        tabLink.style.color = "#475569";
        
        sectionInteractive.style.display = "block";
        sectionLink.style.display = "none";
        
        // Tampilkan peta Leaflet di opsi interactive pinpoint
        checkoutMap.style.display = "block";
        if (linkPreviewContainer) {
            linkPreviewContainer.style.display = "none";
        }
        
        // Pemicu render ulang ubin peta Leaflet
        setTimeout(() => {
            if (checkoutMapInstance) checkoutMapInstance.invalidateSize();
        }, 120);
    } else {
        tabLink.style.background = "var(--primary)";
        tabLink.style.color = "#fff";
        tabInteractive.style.background = "#e2e8f0";
        tabInteractive.style.color = "#475569";
        
        sectionInteractive.style.display = "none";
        sectionLink.style.display = "block";
        
        // Sembunyikan/Tampilkan peta berdasarkan apakah link Gmaps sudah valid/diterapkan
        const mapsLinkInput = document.getElementById("customerMapsLink");
        if (mapsLinkInput && mapsLinkInput.value.trim() !== "") {
            checkoutMap.style.display = "block";
            if (linkPreviewContainer) {
                linkPreviewContainer.style.display = "block";
            }
        } else {
            checkoutMap.style.display = "none";
            if (linkPreviewContainer) {
                linkPreviewContainer.style.display = "none";
            }
        }
        
        // Pemicu render ulang ubin peta Leaflet jika tampil
        setTimeout(() => {
            if (checkoutMapInstance) checkoutMapInstance.invalidateSize();
        }, 120);
    }
    
    // Toggle button visibility based on map visibility
    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.style.display = (checkoutMap.style.display === "block") ? "flex" : "none";
    }
}

async function resolveGmapsLinkInput() {
    const urlInput = document.getElementById("customerMapsPasteInput");
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    if (!url) {
        alert("Harap tempel / paste link Google Maps Anda terlebih dahulu!");
        return;
    }

    // Pola pengecekan sederhana validasi link Google Maps
    if (!url.includes("google.com/maps") && !url.includes("maps.app.goo.gl") && !url.includes("maps.google")) {
        alert("Format salah! Harap tempel link Google Maps yang valid.");
        return;
    }

    showToast("⏳ Memproses & memverifikasi lokasi...");
    try {
        const headers = { "Content-Type": "application/json" };
        if (typeof BACKEND_URL !== 'undefined' && BACKEND_URL.includes("supabase.co/functions/v1/")) {
            headers["Authorization"] = "Bearer " + SUPABASE_KEY;
        }

        const response = await fetch(getProxyUrl("biteship_proxy") + "?action=resolve", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal memproses link Google Maps");
        }

        const lat = parseFloat(result.latitude);
        const lng = parseFloat(result.longitude);

        // Update koordinat global
        customerCoords = { lat, lng };

        // Set value input final untuk Supabase
        const mapsLinkInput = document.getElementById("customerMapsLink");
        if (mapsLinkInput) {
            mapsLinkInput.value = url; // Link asli tetap kita simpan di Supabase
        }

        // Tampilkan peta dan preview container di bawah input link Gmaps
        const checkoutMap = document.getElementById("checkoutMap");
        const linkPreviewContainer = document.getElementById("checkoutMapLinkPreviewContainer");
        if (checkoutMap) {
            checkoutMap.style.display = "block";
        }
        if (linkPreviewContainer) {
            linkPreviewContainer.style.display = "block";
        }

        // Sinkronisasi/pindahkan pin peta di latar belakang secara otomatis
        if (checkoutMapInstance) {
            checkoutMapInstance.setView([lat, lng], 16);
            if (checkoutMarkerInstance) {
                checkoutMarkerInstance.setLatLng([lat, lng]);
            }
            setTimeout(() => {
                checkoutMapInstance.invalidateSize();
            }, 120);
        }

        isLocationConfirmed = false;
        
        // Update confirm button styling to active state
        const btnConfirm = document.getElementById("btnConfirmLocation");
        if (btnConfirm) {
            btnConfirm.style.display = "flex";
            btnConfirm.innerHTML = "📍 Konfirmasi Lokasi & Cek Ongkir";
            btnConfirm.style.background = "var(--primary)";
            btnConfirm.style.color = "white";
            btnConfirm.style.cursor = "pointer";
        }
        
        renderLocationPendingPlaceholder();
        showToast("✔️ Lokasi Google Maps terhubung! Silakan klik tombol konfirmasi di bawah.");
    } catch (err) {
        console.error("Gmaps link resolution error:", err);
        alert(err.message || "Gagal memproses link! Silakan gunakan metode pinpoint manual.");
    }
}

// ================= SISTEM AUTO-VERIFIKASI & SIMULATOR PEMBAYARAN INSTAN =================
let paymentPollingInterval = null;

function startPaymentPolling() {
    if (paymentPollingInterval) clearInterval(paymentPollingInterval);
    if (!currentOrder || !currentOrder.id) return;

    console.log("⚡ Memulai sinkronisasi status pembayaran untuk Order ID:", currentOrder.id);

    paymentPollingInterval = setInterval(async () => {
        try {
            const { data, error } = await supabaseClient
                .from('pesanan')
                .select('status')
                .eq('id', currentOrder.id)
                .single();

            if (error) throw error;

            if (data && (data.status === "Lunas" || data.status === "Sudah Dibayar" || data.status === "COD - Diproses")) {
                console.log("💰 Pembayaran dikonfirmasi via polling callback!");
                stopPaymentPolling();
                showToast("✔️ Pembayaran Berhasil Diterima!");
                setTimeout(() => {
                    navigateToStage(3);
                }, 1000);
            }
        } catch (err) {
            console.warn("Polling error checking status:", err);
        }
    }, 3000); // Polling every 3 seconds
}

function stopPaymentPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
        console.log("🛑 Polling status pembayaran dihentikan.");
    }
}

async function simulatePaymentSuccess() {
    if (!currentOrder || !currentOrder.id) {
        alert("Tidak ada pesanan aktif untuk dibayar!");
        return;
    }

    showToast("⚡ Mengirim sinyal konfirmasi bank...");
    try {
        const { error } = await supabaseClient
            .from('pesanan')
            .update({ status: "Lunas" })
            .eq('id', currentOrder.id);

        if (error) throw error;
        
        showToast("✔️ Callback webhook sukses! Status terupdate.");
    } catch (err) {
        console.error("Simulation failed:", err);
        alert("Gagal melakukan simulasi pembayaran!");
    }
}

// ================= INTEGRASI MIDTRANS SNAP SDK INLINE EMBED =================
function loadMidtransSnapLibrary() {
    return new Promise((resolve, reject) => {
        if (window.snap) return resolve();

        const isProd = typeof MIDTRANS_IS_PRODUCTION !== 'undefined' ? MIDTRANS_IS_PRODUCTION : false;
        const clientKey = typeof MIDTRANS_CLIENT_KEY !== 'undefined' ? MIDTRANS_CLIENT_KEY : "";

        if (!clientKey || clientKey.includes("SB-Mid-client-XXXXXX")) {
            console.warn("Client Key Midtrans belum dikonfigurasi.");
            return resolve(); // gracefully skip
        }

        const scriptUrl = isProd 
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js";

        const script = document.createElement("script");
        script.src = scriptUrl;
        script.setAttribute("data-client-key", clientKey);
        script.onload = () => {
            console.log("✔️ Midtrans Snap SDK loaded dynamically.");
            resolve();
        };
        script.onerror = (err) => {
            console.error("Gagal memuat SDK Midtrans:", err);
            reject(err);
        };
        document.head.appendChild(script);
    });
}

function destroyMidtransSnapLibrary() {
    window.snap = null;
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
        if (script.src && (script.src.includes("snap.js") || script.src.includes("snap.sandbox.midtrans.com") || script.src.includes("app.midtrans.com/snap"))) {
            script.remove();
            console.log("🗑️ SDK Midtrans Snap lama dibersihkan dari dokumen.");
        }
    });
}

async function triggerMidtransInlinePayment(paymentType, bankType = "") {
    if (!currentOrder || !currentOrder.id) return;

    // Hancurkan Snap SDK lama di awal pemuatan embed untuk mencegah eror status transisi
    destroyMidtransSnapLibrary();

    const snapLoading = document.getElementById("snap-loading");
    const snapContainer = document.getElementById("snap-container");

    if (snapLoading) snapLoading.style.display = "block";
    if (snapContainer) {
        snapContainer.innerHTML = ""; // Bersihkan embed sebelumnya
    }

    try {
        await loadMidtransSnapLibrary();

        if (!window.snap) {
            if (snapLoading) snapLoading.style.display = "none";
            alert("Gagal memuat SDK pembayaran Midtrans. Harap periksa Client Key Anda di config.js.");
            return;
        }

        // 1. Definisikan suffix dan filter saluran pembayaran secara presisi
        let suffix = "";
        let enabledPayments = [];
        if (paymentType === "qris") {
            suffix = "-Q";
            enabledPayments = ["gopay", "shopeepay", "other_qris"];
        } else if (paymentType === "va") {
            suffix = "-V-" + bankType.toUpperCase();
            if (bankType === "bca") enabledPayments = ["bca_va"];
            else if (bankType === "mandiri") enabledPayments = ["echannel", "mandiri_va"];
            else if (bankType === "bri") enabledPayments = ["bri_va"];
            else if (bankType === "bni") enabledPayments = ["bni_va"];
            else if (bankType === "permata") enabledPayments = ["permata_va"];
        }

        const midtransOrderId = currentOrder.id + suffix + "-" + (currentOrder.amountVersion || 1);
        const cacheKey = paymentType === "qris" ? "qrisToken" : "vaToken_" + bankType;

        // 2. Gunakan cache token jika sudah ada untuk menghindari duplikat request order id
        let token = currentOrder[cacheKey];

        if (!token) {
            console.log(`⏳ Mengambil token transaksi baru untuk ${paymentType.toUpperCase()} ${bankType.toUpperCase()} (ID: ${midtransOrderId})...`);
            
            const headers = { "Content-Type": "application/json" };
            if (typeof BACKEND_URL !== 'undefined' && BACKEND_URL.includes("supabase.co/functions/v1/")) {
                headers["Authorization"] = "Bearer " + SUPABASE_KEY;
            }

            const response = await fetch(getProxyUrl("midtrans_proxy"), {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    order_id: midtransOrderId,
                    gross_amount: currentOrder.total,
                    first_name: currentOrder.customerName || "Pelanggan Mbokde Mart",
                    phone: currentOrder.customerWhatsapp || "",
                    enabled_payments: enabledPayments
                })
            });

            const result = await response.json();

            if (!response.ok || !result.token) {
                throw new Error(result.message || "Gagal mendapatkan token transaksi.");
            }

            token = result.token;
            currentOrder[cacheKey] = token; // Simpan ke dalam cache
            if (typeof savePaymentSession === "function") {
                savePaymentSession();
            }
            console.log(`✔️ Token untuk ${paymentType.toUpperCase()} ${bankType.toUpperCase()} berhasil disimpan: ${token}`);
        } else {
            console.log(`⚡ Menggunakan kembali token dari cache untuk ${paymentType.toUpperCase()} ${bankType.toUpperCase()}: ${token}`);
        }

        if (snapLoading) snapLoading.style.display = "none";

        // 3. Render Snap Secara Inline di snap-container
        window.snap.embed(token, {
            embedId: "snap-container",
            onSuccess: async function(snapResult) {
                showToast("✔️ Pembayaran Berhasil!");
                const finalStatus = "Lunas";
                const methodLabel = paymentType.toUpperCase() + (bankType ? " - " + bankType.toUpperCase() : "");
                
                await supabaseClient.from('pesanan')
                    .update({ payment_method: methodLabel, status: finalStatus })
                    .eq('id', currentOrder.id);
                    
                currentOrder.paymentMethod = methodLabel;
                currentOrder.status = finalStatus;
                
                navigateToStage(3);
            },
            onPending: function(snapResult) {
                showToast("⏳ Menunggu Pembayaran...");
            },
            onError: function(snapResult) {
                alert("Pembayaran Gagal: " + snapResult.status_message);
            },
            onClose: function() {
                console.log("Pelanggan menutup antarmuka pembayaran embed.");
            }
        });

    } catch (err) {
        console.error("Midtrans Embed Snap error:", err);
        if (snapLoading) snapLoading.style.display = "none";
        if (snapContainer) {
            snapContainer.innerHTML = `<div style="text-align:center; padding:2.5rem 1rem; color:var(--accent); font-weight:700; font-size:0.9rem;">Gagal memuat pembayaran otomatis Midtrans: ${err.message}</div>`;
        }
    }
}

// BIND TOMBOL KONFIRMASI LOKASI & CEK ONGKIR
document.addEventListener("DOMContentLoaded", () => {
    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.addEventListener("click", () => {
            if (!customerCoords || !customerCoords.lat || !customerCoords.lng) {
                showToast("❌ Silakan pilih lokasi Anda terlebih dahulu!");
                return;
            }
            
            isLocationConfirmed = true;
            
            // Perbarui tampilan tombol ke status terkonfirmasi (hijau)
            btnConfirm.innerHTML = "✔️ Lokasi Terkonfirmasi";
            btnConfirm.style.background = "#059669"; // Green
            btnConfirm.style.color = "white";
            btnConfirm.style.cursor = "default";
            
            showToast("⏳ Mengambil tarif pengiriman...");
            fetchBiteshipRates(customerCoords.lat, customerCoords.lng);
        });
    }

    // BIND TOMBOL FILTER STATUS RIWAYAT PESANAN (PELANGGAN)
    const customerFilterContainer = document.getElementById("ordersFilterContainer");
    if (customerFilterContainer) {
        const filterButtons = customerFilterContainer.querySelectorAll(".filter-status-btn");
        filterButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                filterButtons.forEach(b => {
                    b.classList.remove("active");
                    b.style.border = "1px solid var(--gray-300)";
                    b.style.background = "white";
                    b.style.color = "var(--gray-600)";
                });

                btn.classList.add("active");
                btn.style.border = "none";
                btn.style.background = "var(--primary)";
                btn.style.color = "white";

                currentCustomerFilter = btn.getAttribute("data-status");

                // Ambil nomor WA aktif dari profil tersimpan
                const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
                const wa = savedProfile ? savedProfile.whatsapp : "";
                if (wa) {
                    applyCustomerOrdersFilter(wa);
                }
            });
        });
    }

    // Panggil updateMyOrdersMenuBadge saat pertama kali dimuat
    updateMyOrdersMenuBadge();
});
