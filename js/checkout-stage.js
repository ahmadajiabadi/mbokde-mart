// =====================================================================
// js/checkout-stage.js — MODUL ALUR TAHAPAN CHECKOUT
// Tanggung jawab: Navigasi stage 1/2/3, kalkulasi biaya, dan kupon.
// Dependensi: config.js (currentOrder, selectedShipping, appliedCoupons),
//             utils.js (formatRupiah, showToast),
//             cart.js (calculateCheckedSubtotal),
//             payment.js (stopPaymentPolling, triggerMidtransInlinePayment)
// =====================================================================

// State Variabel Lokal Modul
let isLocationConfirmed = false;
let customerOrdersCache = [];
let currentCustomerFilter = "semua";

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

// Helper URL proxy (PHP lokal atau Supabase Edge Function)
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

// =====================================================================
// NAVIGASI STAGE CHECKOUT (1, 2, 3)
// =====================================================================
function navigateToStage(stageNum) {
    const modalTitle        = document.getElementById("modalTitle");
    const checkoutStage1    = document.getElementById("checkoutStage1");
    const checkoutStage2    = document.getElementById("checkoutStage2");
    const checkoutStage3    = document.getElementById("checkoutStage3");
    const successOrderId    = document.getElementById("successOrderId");
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
            document.getElementById("customerName").value    = savedProfile.name || "";
            document.getElementById("customerWhatsapp").value = savedProfile.whatsapp || "";
            document.getElementById("customerAddress").value  = savedProfile.address || "";
            if (document.getElementById("customerMapsLink") && savedProfile.google_maps_link) {
                document.getElementById("customerMapsLink").value = savedProfile.google_maps_link;
                const pasteInput = document.getElementById("customerMapsPasteInput");
                if (pasteInput) pasteInput.value = savedProfile.google_maps_link;
                const coordsMatch = savedProfile.google_maps_link.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (coordsMatch) {
                    customerCoords = { lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) };
                }
            }
        }
        initCheckoutMap();
        selectMapOption('interactive');

    } else if (stageNum === 2) {
        modalTitle.innerText = "💳 Tahap 2: Selesaikan Pembayaran";
        checkoutStage2.style.display = "block";
        startPaymentPolling();
        destroyMidtransSnapLibrary();

        const couponInput = document.getElementById("couponCodeInput");
        if (couponInput) couponInput.value = "";

        const paymentPlaceholderBox = document.getElementById("paymentPlaceholderBox");
        if (paymentPlaceholderBox) paymentPlaceholderBox.style.display = "none";

        const boxes = ["midtransQrisConfirmBox", "midtransVaConfirmBox", "midtransEmbedBox", "qrisPaymentBox", "vaPaymentBox", "codPaymentBox"];
        boxes.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        const confirmBtn = document.getElementById("confirmPaymentBtn");
        if (confirmBtn) confirmBtn.style.display = "none";

        // Cek sesi pembayaran tersimpan
        const savedSessionStr = localStorage.getItem("mbokde_payment_session_" + currentOrder.id);
        let savedSession = null;
        if (savedSessionStr) {
            try { savedSession = JSON.parse(savedSessionStr); }
            catch (e) { console.error("Error parsing saved payment session:", e); }
        }

        let paymentType = "";

        if (savedSession) {
            appliedCoupons = savedSession.appliedCoupons || {
                ongkir: false, ongkirCode: "", ongkirMaxDiscount: 0,
                admin: false, adminCode: "",
                diskon: false, diskonCode: "", diskonPercentage: 0, diskonMax: 0
            };
            if (savedSession.paymentType === "qris" && savedSession.token) {
                currentOrder.qrisToken = savedSession.token;
            } else if (savedSession.paymentType === "va" && savedSession.bankType && savedSession.token) {
                currentOrder["vaToken_" + savedSession.bankType] = savedSession.token;
            }
            selectedVaBank = savedSession.bankType || null;
            currentOrder.amountVersion = savedSession.amountVersion || 1;
            paymentType = savedSession.paymentType || "";

            // Sync Stage 1 radio buttons with saved session
            if (paymentType) {
                const radio = document.querySelector(`input[name="paymentType"][value="${paymentType}"]`);
                if (radio) {
                    radio.checked = true;
                    document.querySelectorAll(".payment-method-selector .delivery-card").forEach(c => c.classList.remove("selected"));
                    const card = radio.closest(".delivery-card");
                    if (card) card.classList.add("selected");
                }
            }
        } else {
            // No saved session: read payment method directly from Stage 1 selection
            const activeRadio = document.querySelector('input[name="paymentType"]:checked');
            paymentType = activeRadio ? activeRadio.value : "";
            selectedVaBank = null;
        }

        updateStage2UI();

        // Update coupon badge
        const badge = document.getElementById("voucherBadge");
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

        // Display correct payment UI box in Stage 2
        const isMidtransConfigured = typeof MIDTRANS_CLIENT_KEY !== "undefined" && !MIDTRANS_CLIENT_KEY.includes("SB-Mid-client-XXXXXX");
        const stage2PaymentMethodLabel = document.getElementById("stage2PaymentMethodLabel");

        if (paymentType === "qris") {
            if (stage2PaymentMethodLabel) stage2PaymentMethodLabel.innerText = "Scan QRIS Instan";
            if (isMidtransConfigured) {
                if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "block";
            } else {
                const qrisBox = document.getElementById("qrisPaymentBox");
                if (qrisBox) qrisBox.style.display = "block";
                if (confirmBtn) {
                    confirmBtn.style.display = "block";
                    confirmBtn.innerText = "Selesaikan Pembayaran ➔";
                }
            }
        } else if (paymentType === "va") {
            if (stage2PaymentMethodLabel) stage2PaymentMethodLabel.innerText = "Virtual Account (VA)";
            if (isMidtransConfigured) {
                if (typeof resetVaBankSelector === "function") resetVaBankSelector();
                if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "block";
            } else {
                const vaBox = document.getElementById("vaPaymentBox");
                if (vaBox) vaBox.style.display = "block";
                if (confirmBtn) {
                    confirmBtn.style.display = "block";
                    confirmBtn.innerText = "Selesaikan Pembayaran ➔";
                }
            }
        } else if (paymentType === "cod") {
            if (stage2PaymentMethodLabel) stage2PaymentMethodLabel.innerText = "COD (Bayar di Tempat)";
            const codBox = document.getElementById("codPaymentBox");
            if (codBox) codBox.style.display = "block";
            if (confirmBtn) {
                confirmBtn.style.display = "block";
                confirmBtn.innerText = "Selesaikan Pembayaran (COD) ➔";
            }
        } else {
            if (stage2PaymentMethodLabel) stage2PaymentMethodLabel.innerText = "-";
            if (paymentPlaceholderBox) paymentPlaceholderBox.style.display = "block";
        }

        // Auto trigger payment for midtrans if session already has token
        if (savedSession && savedSession.paymentType) {
            if (savedSession.paymentType === "qris" && savedSession.token) {
                const midtransEmbedBox = document.getElementById("midtransEmbedBox");
                if (midtransEmbedBox) midtransEmbedBox.style.display = "block";
                if (midtransQrisConfirmBox) midtransQrisConfirmBox.style.display = "none";
                triggerMidtransInlinePayment("qris");
            } else if (savedSession.paymentType === "va" && savedSession.bankType && savedSession.token) {
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
                if (midtransVaConfirmBox) midtransVaConfirmBox.style.display = "none";
                triggerMidtransInlinePayment("va", savedSession.bankType);
            }
        }

    } else if (stageNum === 3) {
        stopPaymentPolling();
        modalTitle.innerText = "🎉 Pesanan Selesai!";
        checkoutStage3.style.display = "block";

        successOrderId.innerText = currentOrder.id;
        successDeliveryTime.innerText = currentOrder.shippingMethod === "kurir-toko" ? "1-3 Jam" : "Ambil Sendiri di Warung";

        localStorage.removeItem("mbokde_payment_session_" + currentOrder.id);
        console.log("🧹 Sesi pembayaran dibersihkan karena pesanan telah lunas:", currentOrder.id);
    }
}

// =====================================================================
// UPDATE UI TAHAP 2 (Rincian Harga & QRIS/VA Display)
// =====================================================================
function updateStage2UI() {
    if (!currentOrder) return;

    const paymentOrderId = document.getElementById("paymentOrderId");
    const qrisCodeImg    = document.getElementById("qrisCodeImg");
    const vaBankTitle    = document.getElementById("vaBankNameTitle");
    const vaAccountDisplay = document.getElementById("vaAccountNumberDisplay");

    paymentOrderId.innerText = currentOrder.id;

    if (shopQrisImage && shopQrisImage.trim() !== "") {
        qrisCodeImg.src = shopQrisImage;
    } else {
        const qrisRawData = `qris://mbokdemart?orderid=${currentOrder.id}&amount=${currentOrder.total}`;
        qrisCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrisRawData)}`;
    }

    if (vaBankTitle) vaBankTitle.innerText = "Virtual Account " + (shopBankName || "BCA");
    if (vaAccountDisplay) vaAccountDisplay.innerText = (shopBankAccountNo || "8801 2345 6789 0123");

    calculateStage2Costs();
}

// =====================================================================
// KALKULASI BIAYA TAHAP 2 (Ongkir, Admin, Diskon)
// =====================================================================
function calculateStage2Costs() {
    if (!currentOrder) return;

    if (typeof getShopSetting === "function") {
        shopVouchers = JSON.parse(getShopSetting("mbokde_vouchers", JSON.stringify(DEFAULT_VOUCHERS)));
    }

    const subtotal     = Number(currentOrder.subtotal);
    const baseOngkir   = Number(currentOrder.shippingCost);
    const isLocalCourier = currentOrder.shippingMethod === "kurir-toko";

    // 1. Ongkos Kirim
    let finalOngkir = baseOngkir;
    let ongkirDiscount = 0;
    let ongkirFreeReason = "";

    if (!isLocalCourier) {
        if (shopAutoFreeOngkir && subtotal >= shopAutoFreeOngkirMin) {
            let maxAutoDiscount = 10000;
            const defaultOngkirVoucher = shopVouchers.find(v => v.type === "ongkir");
            if (defaultOngkirVoucher) {
                maxAutoDiscount = Number(defaultOngkirVoucher.maxDiscount) || baseOngkir;
                if (maxAutoDiscount === 0) maxAutoDiscount = baseOngkir;
            }
            ongkirDiscount = Math.min(baseOngkir, maxAutoDiscount);
            ongkirFreeReason = "PROMO_AUTO";
        } else if (appliedCoupons.ongkir) {
            let cap = Number(appliedCoupons.ongkirMaxDiscount) || baseOngkir;
            if (cap === 0) cap = baseOngkir;
            ongkirDiscount = Math.min(baseOngkir, cap);
            ongkirFreeReason = "VOUCHER";
        }
        finalOngkir = Math.max(0, baseOngkir - ongkirDiscount);
    }

    // 2. Biaya Admin
    let baseAdminFee = 0;
    const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || "";

    if (paymentType === "qris")     baseAdminFee = Math.round(subtotal * 0.007);
    else if (paymentType === "va")  baseAdminFee = shopVaAdminFee;
    else if (paymentType === "cod") baseAdminFee = 0;

    let finalAdminFee = baseAdminFee;
    let adminDiscount = 0;
    let adminFreeReason = "";

    if (paymentType === "qris" || paymentType === "va") {
        if (!shopChargeAdminToBuyer) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "SELLER_ABSORBED";
        } else if (shopAutoFreeAdmin && subtotal >= shopAutoFreeAdminMin) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "PROMO_AUTO";
        } else if (appliedCoupons.admin) {
            finalAdminFee = 0;
            adminDiscount = baseAdminFee;
            adminFreeReason = "VOUCHER";
        }
    }

    // 3. Diskon Belanja
    let diskonDiscount = 0;
    if (appliedCoupons.diskon) {
        diskonDiscount = Math.round(subtotal * (Number(appliedCoupons.diskonPercentage) / 100));
        if (Number(appliedCoupons.diskonMax) > 0) {
            diskonDiscount = Math.min(diskonDiscount, Number(appliedCoupons.diskonMax));
        }
    }

    const finalTotal = Math.max(0, subtotal + finalOngkir + finalAdminFee - diskonDiscount);
    currentOrder.total = finalTotal;

    // 4. Render Rincian di DOM
    const breakdownSubtotal   = document.getElementById("breakdownSubtotal");
    const breakdownOngkir     = document.getElementById("breakdownOngkir");
    const breakdownAdmin      = document.getElementById("breakdownAdmin");
    const breakdownDiskonRow  = document.getElementById("breakdownDiskonRow");
    const breakdownDiskon     = document.getElementById("breakdownDiskon");
    const stage2Total         = document.getElementById("stage2Total");

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

    const stage1Total         = document.getElementById("stage1Total");
    if (stage1Total) stage1Total.innerText = formatRupiah(finalTotal);
    if (stage2Total) stage2Total.innerText = formatRupiah(finalTotal);

    const midtransQrisFinalPrice = document.getElementById("midtransQrisFinalPrice");
    const midtransVaFinalPrice   = document.getElementById("midtransVaFinalPrice");
    if (midtransQrisFinalPrice) midtransQrisFinalPrice.innerText = formatRupiah(finalTotal);
    if (midtransVaFinalPrice)   midtransVaFinalPrice.innerText   = formatRupiah(finalTotal);
}

// =====================================================================
// SIMPAN SESI PEMBAYARAN DI LOCALSTORAGE
// =====================================================================
function savePaymentSession() {
    if (!currentOrder) return;

    const paymentRadio = document.querySelector('input[name="paymentType"]:checked');
    const paymentType  = paymentRadio ? paymentRadio.value : "";

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

// =====================================================================
// APPLY KODE KUPON / VOUCHER
// =====================================================================
function applyCouponCode() {
    const input    = document.getElementById("couponCodeInput");
    const badge    = document.getElementById("voucherBadge");
    const errorMsg = document.getElementById("voucherErrorMessage");

    if (!input || !currentOrder) return;

    if (typeof getShopSetting === "function") {
        shopVouchers = JSON.parse(getShopSetting("mbokde_vouchers", JSON.stringify(DEFAULT_VOUCHERS)));
    }

    const code     = input.value.trim().toUpperCase();
    const subtotal = Number(currentOrder.subtotal);

    if (errorMsg) { errorMsg.style.display = "none"; errorMsg.innerText = ""; }

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

        currentOrder.amountVersion = (currentOrder.amountVersion || 1) + 1;
        currentOrder.qrisToken = null;
        for (let key in currentOrder) {
            if (key.startsWith("vaToken_")) currentOrder[key] = null;
        }

        if (badge) badge.style.display = "none";
        calculateStage2Costs();
        if (typeof savePaymentSession === "function") savePaymentSession();

        const activeRadio = document.querySelector('input[name="paymentType"]:checked');
        if (activeRadio) {
            if (activeRadio.value === "qris") triggerMidtransInlinePayment("qris");
            else if (activeRadio.value === "va" && selectedVaBank) triggerMidtransInlinePayment("va", selectedVaBank);
        }
        return;
    }

    let couponApplied = false;
    let errorText = "";

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
        currentOrder.amountVersion = (currentOrder.amountVersion || 1) + 1;
        currentOrder.qrisToken = null;
        for (let key in currentOrder) {
            if (key.startsWith("vaToken_")) currentOrder[key] = null;
        }

        if (badge) {
            const activeCodes = [];
            if (appliedCoupons.ongkir) activeCodes.push(appliedCoupons.ongkirCode);
            if (appliedCoupons.admin)  activeCodes.push(appliedCoupons.adminCode);
            if (appliedCoupons.diskon) activeCodes.push(appliedCoupons.diskonCode);
            if (activeCodes.length > 0) {
                badge.style.display = "inline-block";
                badge.innerText = `🎟️ Voucher ${activeCodes.join(", ")} Terpasang`;
            } else {
                badge.style.display = "none";
            }
        }
        showToast(`🎟️ Voucher ${code} berhasil dipasang!`);
        input.value = "";
    } else {
        if (errorMsg) { errorMsg.style.display = "block"; errorMsg.innerText = errorText; }
        showToast("❌ Gagal memasang voucher!");
    }

    calculateStage2Costs();
    if (typeof savePaymentSession === "function") savePaymentSession();

    const activeRadio = document.querySelector('input[name="paymentType"]:checked');
    if (activeRadio) {
        if (activeRadio.value === "qris") triggerMidtransInlinePayment("qris");
        else if (activeRadio.value === "va" && selectedVaBank) triggerMidtransInlinePayment("va", selectedVaBank);
    }
}
