// =====================================================================
// js/seller-settings.js — MODUL PENGATURAN TOKO & VOUCHER
// Tanggung jawab: Load/simpan pengaturan toko, CRUD voucher, upload QRIS.
// Dependensi: config.js (supabaseClient, shopVouchers, shopAddress, ...),
//             utils.js (formatRupiah, showToast)
// =====================================================================

// =====================================================================
// NAVIGASI SUB-TAB PENGATURAN
// =====================================================================
function selectSubSettings(paneId) {
    document.querySelectorAll(".subsettings-pane").forEach(pane => {
        pane.style.display = "none";
    });
    const targetPane = document.getElementById(paneId);
    if (targetPane) targetPane.style.display = "block";

    document.querySelectorAll(".submenu-btn").forEach(btn => {
        btn.style.color           = "var(--gray-500)";
        btn.style.backgroundColor = "transparent";
    });

    let activeBtn = null;
    if (paneId === "subSettingsCourier") activeBtn = document.getElementById("btnSubCourier");
    else if (paneId === "subSettingsPayment") activeBtn = document.getElementById("btnSubPayment");
    else if (paneId === "subSettingsVoucher") activeBtn = document.getElementById("btnSubVoucher");
    else if (paneId === "subSettingsSecurity") activeBtn = document.getElementById("btnSubSecurity");

    if (activeBtn) {
        activeBtn.style.color           = "var(--primary-dark)";
        activeBtn.style.backgroundColor = "var(--primary-light)";
    }
}

// =====================================================================
// RENDER TABEL VOUCHER
// =====================================================================
function renderVouchersTable() {
    const tbody = document.getElementById("vouchersTableBody");
    if (!tbody) return;

    if (!shopVouchers || shopVouchers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--gray-400); padding:1rem;">Belum ada kode voucher aktif.</td></tr>`;
        return;
    }

    tbody.innerHTML = shopVouchers.map((v, index) => {
        let typeText = "❓ Lainnya";
        if (v.type === "ongkir")      typeText = "🟢 Gratis Ongkir (Biteship)";
        else if (v.type === "admin")  typeText = "🔵 Bebas Admin";
        else if (v.type === "diskon") typeText = `🛍️ Diskon Belanja (${v.percentage || 0}%)`;

        const maxDiscText = (v.type === "ongkir" || v.type === "diskon")
            ? (Number(v.maxDiscount) === 0 ? "Tanpa Batas" : formatRupiah(v.maxDiscount))
            : "-";

        return `
            <tr style="border-bottom: 1px solid var(--gray-100);">
                <td style="padding: 0.6rem 0.5rem; font-weight:700;"><code>${v.code}</code></td>
                <td style="padding: 0.6rem 0.5rem; font-size:0.8rem;">${typeText}</td>
                <td style="padding: 0.6rem 0.5rem; font-size:0.8rem;">${formatRupiah(v.minPurchase)}</td>
                <td style="padding: 0.6rem 0.5rem; font-size:0.8rem;">${maxDiscText}</td>
                <td style="padding: 0.6rem 0.5rem; text-align:center;">
                    <button type="button" onclick="deleteVoucher(${index})" style="background:#fff1f2; color:#f43f5e; border:1px solid #fecdd3; border-radius:4px; padding:0.25rem 0.5rem; font-size:0.75rem; cursor:pointer; font-weight:700;">Hapus</button>
                </td>
            </tr>
        `;
    }).join("");
}

// =====================================================================
// TAMBAH VOUCHER BARU
// =====================================================================
function addVoucher() {
    const codeInput  = document.getElementById("newVoucherCode");
    const typeSelect = document.getElementById("newVoucherType");
    const minInput   = document.getElementById("newVoucherMin");
    const maxInput   = document.getElementById("newVoucherMax");
    const pctInput   = document.getElementById("newVoucherPercentage");

    if (!codeInput || !typeSelect || !minInput || !maxInput) return;

    const code        = codeInput.value.trim().toUpperCase();
    const type        = typeSelect.value;
    const minPurchase = Number(minInput.value) || 0;
    const maxDiscount = Number(maxInput.value) || 0;
    const percentage  = pctInput ? (Number(pctInput.value) || 0) : 0;

    if (code === "") {
        alert("Kode voucher tidak boleh kosong!");
        return;
    }

    if (type === "diskon" && (percentage <= 0 || percentage > 100)) {
        alert("Persentase diskon harus di antara 1 dan 100!");
        return;
    }

    if (shopVouchers.some(v => v.code === code)) {
        alert(`Kode voucher "${code}" sudah terdaftar!`);
        return;
    }

    shopVouchers.push({ code, type, minPurchase, maxDiscount, percentage });
    localStorage.setItem("mbokde_vouchers", JSON.stringify(shopVouchers));

    codeInput.value = "";
    minInput.value  = "";
    maxInput.value  = "";
    if (pctInput) pctInput.value = "15";

    showToast("✔️ Voucher berhasil ditambahkan!");
    renderVouchersTable();
}

// =====================================================================
// HAPUS VOUCHER
// =====================================================================
function deleteVoucher(index) {
    if (!shopVouchers[index]) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus kode voucher "${shopVouchers[index].code}"?`)) return;

    shopVouchers.splice(index, 1);
    localStorage.setItem("mbokde_vouchers", JSON.stringify(shopVouchers));

    showToast("🗑️ Voucher berhasil dihapus!");
    renderVouchersTable();
}

// =====================================================================
// LOAD PENGATURAN TOKO KE FORM
// =====================================================================
function loadShopSettingsInDashboard() {
    document.getElementById("inputMinPurchase").value      = localStorage.getItem("mbokde_min_purchase") !== null ? localStorage.getItem("mbokde_min_purchase") : "0";
    document.getElementById("inputMaxDistance").value      = localStorage.getItem("mbokde_max_distance") !== null ? localStorage.getItem("mbokde_max_distance") : "15";
    document.getElementById("inputLocalCourierFee").value  = localStorage.getItem("mbokde_local_courier_fee") !== null ? localStorage.getItem("mbokde_local_courier_fee") : "5000";
    document.getElementById("inputShopAddress").value      = localStorage.getItem("mbokde_shop_address") || "Jl. Tj. III No.1115, RT.001/RW.005, Cipondoh Indah, Kec. Cipondoh, Kota Tangerang, Banten 15148";
    document.getElementById("inputShopGmaps").value        = localStorage.getItem("mbokde_shop_gmaps") || "https://maps.app.goo.gl/qys42TqnqBzgHY9x6";
    document.getElementById("inputShopQrisUrl").value      = localStorage.getItem("mbokde_shop_qris_image") || "";
    document.getElementById("inputShopBankName").value     = localStorage.getItem("mbokde_shop_bank_name") || "BCA";
    document.getElementById("inputShopBankAccountNo").value = localStorage.getItem("mbokde_shop_bank_account_no") || "8801 2345 6789 0123";
    document.getElementById("inputMidtransMode").value     = localStorage.getItem("mbokde_midtrans_mode") || "sandbox";

    document.getElementById("inputChargeAdmin").checked     = (localStorage.getItem("mbokde_charge_admin") !== null ? localStorage.getItem("mbokde_charge_admin") : "true") === "true";
    document.getElementById("inputVaAdminFee").value        = localStorage.getItem("mbokde_va_admin_fee") !== null ? localStorage.getItem("mbokde_va_admin_fee") : "4000";
    document.getElementById("inputAutoFreeAdmin").checked   = localStorage.getItem("mbokde_auto_free_admin") === "true";
    document.getElementById("inputAutoFreeAdminMin").value  = localStorage.getItem("mbokde_auto_free_admin_min") !== null ? localStorage.getItem("mbokde_auto_free_admin_min") : "50000";
    document.getElementById("inputAutoFreeOngkir").checked  = localStorage.getItem("mbokde_auto_free_ongkir") === "true";
    document.getElementById("inputAutoFreeOngkirMin").value = localStorage.getItem("mbokde_auto_free_ongkir_min") !== null ? localStorage.getItem("mbokde_auto_free_ongkir_min") : "75000";

    selectSubSettings("subSettingsCourier");
    renderVouchersTable();
}

// =====================================================================
// SIMPAN PENGATURAN TOKO
// =====================================================================
function saveShopSettings() {
    const minPurchase       = document.getElementById("inputMinPurchase").value.trim();
    const maxDistance       = document.getElementById("inputMaxDistance").value.trim();
    const courierFee        = document.getElementById("inputLocalCourierFee").value.trim();
    const shopAddressVal    = document.getElementById("inputShopAddress").value.trim();
    const shopGmapsVal      = document.getElementById("inputShopGmaps").value.trim();
    const shopQrisVal       = document.getElementById("inputShopQrisUrl").value.trim();
    const shopBankNameVal   = document.getElementById("inputShopBankName").value.trim();
    const shopBankAccountNoVal = document.getElementById("inputShopBankAccountNo").value.trim();
    const midtransMode      = document.getElementById("inputMidtransMode").value;

    const chargeAdmin       = document.getElementById("inputChargeAdmin").checked ? "true" : "false";
    const vaAdminFee        = document.getElementById("inputVaAdminFee").value.trim();
    const autoFreeAdmin     = document.getElementById("inputAutoFreeAdmin").checked ? "true" : "false";
    const autoFreeAdminMin  = document.getElementById("inputAutoFreeAdminMin").value.trim();
    const autoFreeOngkir    = document.getElementById("inputAutoFreeOngkir").checked ? "true" : "false";
    const autoFreeOngkirMin = document.getElementById("inputAutoFreeOngkirMin").value.trim();

    localStorage.setItem("mbokde_min_purchase",         minPurchase || "0");
    localStorage.setItem("mbokde_max_distance",         maxDistance || "15");
    localStorage.setItem("mbokde_local_courier_fee",    courierFee || "5000");
    localStorage.setItem("mbokde_shop_address",         shopAddressVal);
    localStorage.setItem("mbokde_shop_gmaps",           shopGmapsVal);
    localStorage.setItem("mbokde_shop_qris_image",      shopQrisVal);
    localStorage.setItem("mbokde_shop_bank_name",       shopBankNameVal);
    localStorage.setItem("mbokde_shop_bank_account_no", shopBankAccountNoVal);
    localStorage.setItem("mbokde_midtrans_mode",        midtransMode);
    localStorage.setItem("mbokde_charge_admin",         chargeAdmin);
    localStorage.setItem("mbokde_va_admin_fee",         vaAdminFee || "4000");
    localStorage.setItem("mbokde_auto_free_admin",      autoFreeAdmin);
    localStorage.setItem("mbokde_auto_free_admin_min",  autoFreeAdminMin || "50000");
    localStorage.setItem("mbokde_auto_free_ongkir",     autoFreeOngkir);
    localStorage.setItem("mbokde_auto_free_ongkir_min", autoFreeOngkirMin || "75000");

    // Refresh global state langsung
    shopMinPurchase       = Number(minPurchase || 0);
    shopMaxDistance       = Number(maxDistance || 15);
    shopLocalCourierFee   = Number(courierFee || 5000);
    shopAddress           = shopAddressVal;
    shopGmapsLink         = shopGmapsVal;
    shopQrisImage         = shopQrisVal;
    shopBankName          = shopBankNameVal;
    shopBankAccountNo     = shopBankAccountNoVal;
    shopChargeAdminToBuyer = chargeAdmin === "true";
    shopVaAdminFee        = Number(vaAdminFee || 4000);
    shopAutoFreeAdmin     = autoFreeAdmin === "true";
    shopAutoFreeAdminMin  = Number(autoFreeAdminMin || 50000);
    shopAutoFreeOngkir    = autoFreeOngkir === "true";
    shopAutoFreeOngkirMin = Number(autoFreeOngkirMin || 75000);

    if (typeof syncMidtransConfig === "function") syncMidtransConfig();

    showToast("✔️ Pengaturan toko berhasil disimpan!");
}

// =====================================================================
// UPLOAD GAMBAR QRIS KE CDN
// =====================================================================
async function uploadQrisImageToCdn(input) {
    const file         = input.files[0];
    const statusText   = document.getElementById("qrisUploadStatus");
    const qrisUrlInput = document.getElementById("inputShopQrisUrl");
    if (!file || !statusText || !qrisUrlInput) return;

    statusText.innerText    = "⏳ Mengunggah gambar QRIS...";
    statusText.style.color  = "var(--primary)";

    try {
        const fileExt  = file.name.split('.').pop();
        const fileName = `qris_${Date.now()}.${fileExt}`;
        const filePath = `foto-produk/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('foto-produk')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (error) throw error;

        const { data: publicUrlData } = supabaseClient.storage
            .from('foto-produk')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;
        qrisUrlInput.value = publicUrl;

        statusText.innerText   = "✔️ QRIS berhasil diunggah ke CDN!";
        statusText.style.color = "var(--primary)";
        showToast("✔️ Gambar QRIS berhasil terunggah ke CDN!");
    } catch (err) {
        console.error("QRIS CDN upload failure:", err);
        statusText.innerText   = "❌ Gagal mengunggah QRIS: " + err.message;
        statusText.style.color = "#f43f5e";
    }
}

// =====================================================================
// DOMContentLoaded: Listener Tab Settings, Filter Admin, Voucher Type
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    const btnSettings = document.getElementById("tabSellerSettings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            selectAdminTab("tabSellerSettings");
        });
    }

    // Bind filter status pesanan masuk (admin)
    const adminFilterContainer = document.getElementById("adminOrdersFilterContainer");
    if (adminFilterContainer) {
        const filterButtons = adminFilterContainer.querySelectorAll(".admin-filter-status-btn");
        filterButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                filterButtons.forEach(b => {
                    b.classList.remove("active");
                    b.style.border     = "1px solid var(--gray-300)";
                    b.style.background = "white";
                    b.style.color      = "var(--gray-600)";
                });

                btn.classList.add("active");
                btn.style.border     = "none";
                btn.style.background = "var(--primary)";
                btn.style.color      = "white";

                currentSellerFilter = btn.getAttribute("data-status");
                applySellerOrdersFilter();
            });
        });
    }

    // Bind perubahan tipe voucher baru
    const newVoucherTypeSelect = document.getElementById("newVoucherType");
    if (newVoucherTypeSelect) {
        newVoucherTypeSelect.addEventListener("change", (e) => {
            const type      = e.target.value;
            const pctGroup  = document.getElementById("percentageInputGroup");
            const maxLabel  = document.getElementById("newVoucherMaxLabel");

            if (type === "diskon") {
                if (pctGroup) pctGroup.style.display = "block";
                if (maxLabel) maxLabel.innerText      = "Maks. Potongan Diskon (Rp)";
            } else {
                if (pctGroup) pctGroup.style.display = "none";
                if (maxLabel) maxLabel.innerText      = type === "ongkir" ? "Maks. Potongan Ongkir (Rp)" : "Maks. Potongan (Rp)";
            }
        });
    }

    // Bind submit form PIN Keamanan
    const securitySettingsForm = document.getElementById("securitySettingsForm");
    if (securitySettingsForm) {
        securitySettingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            changeSellerPin();
        });
    }
});

// =====================================================================
// UBAH PIN KEAMANAN
// =====================================================================
function changeSellerPin() {
    const currentPinInput = document.getElementById("inputCurrentPin");
    const newPinInput = document.getElementById("inputNewPin");
    const confirmNewPinInput = document.getElementById("inputConfirmNewPin");

    if (!currentPinInput || !newPinInput || !confirmNewPinInput) return;

    const currentPinVal = currentPinInput.value.trim();
    const newPinVal = newPinInput.value.trim();
    const confirmNewPinVal = confirmNewPinInput.value.trim();

    const activePin = localStorage.getItem("mbokde_seller_pin") || SELLER_PIN;

    if (currentPinVal !== activePin) {
        alert("PIN Lama salah!");
        return;
    }

    if (newPinVal.length !== 4 || isNaN(newPinVal)) {
        alert("PIN Baru harus berupa 4 digit angka!");
        return;
    }

    if (newPinVal !== confirmNewPinVal) {
        alert("Konfirmasi PIN baru tidak cocok!");
        return;
    }

    localStorage.setItem("mbokde_seller_pin", newPinVal);
    showToast("🔑 PIN Keamanan berhasil diubah!");

    // Clear form
    currentPinInput.value = "";
    newPinInput.value = "";
    confirmNewPinInput.value = "";

    // Kembalikan sub settings tab ke awal
    selectSubSettings("subSettingsCourier");
}
