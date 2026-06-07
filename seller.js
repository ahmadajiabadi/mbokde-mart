// SELLER FULL-SCREEN DASHBOARD & CRUD CATALOG
let sellerOrdersCache = [];
let currentSellerFilter = "semua";

function openSellerDashboard() {
    const sellerPinSection = document.getElementById("sellerPinSection");
    const sellerControlPanel = document.getElementById("sellerControlPanel");
    const sellerDashboardPage = document.getElementById("sellerDashboardPage");
    
    if (localStorage.getItem("mbokde_seller_logged") === "true") {
        sellerPinSection.style.display = "none";
        sellerControlPanel.style.display = "flex";
        selectAdminTab("tabSellerDashboard");
    } else {
        sellerPinSection.style.display = "flex";
        sellerControlPanel.style.display = "none";
    }
    document.getElementById("sellerPinInput").value = "";
    sellerDashboardPage.classList.add("open");
    toggleBodyScroll(true);
}

function verifySellerPin() {
    const pin = document.getElementById("sellerPinInput").value.trim();
    const sellerPinSection = document.getElementById("sellerPinSection");
    const sellerControlPanel = document.getElementById("sellerControlPanel");
    
    if (pin === SELLER_PIN) {
        localStorage.setItem("mbokde_seller_logged", "true");
        sellerPinSection.style.display = "none";
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
    document.getElementById("sellerPinSection").style.display = "flex";
    document.getElementById("sellerPinInput").value = "";
    document.getElementById("sellerDashboardPage").classList.remove("open");
    toggleBodyScroll(false);
    showToast("🚪 Berhasil keluar dari Dashboard.");
}

function selectAdminTab(tabId) {
    const tabOverview = document.getElementById("sellerDashboardOverview");
    const tabOrders = document.getElementById("sellerOrdersView");
    const tabProducts = document.getElementById("sellerProductsView");
    const tabSettings = document.getElementById("sellerSettingsView");
    
    const btnOverview = document.getElementById("tabSellerDashboard");
    const btnOrders = document.getElementById("tabSellerOrders");
    const btnProducts = document.getElementById("tabSellerProducts");
    const btnSettings = document.getElementById("tabSellerSettings");
    const adminPageTitle = document.getElementById("adminPageTitle");

    // Remove active from all sidebar buttons
    [btnOverview, btnOrders, btnProducts, btnSettings].forEach(btn => { if (btn) btn.classList.remove("active"); });
    
    // Hide all sections
    [tabOverview, tabOrders, tabProducts, tabSettings].forEach(sec => { if (sec) sec.style.display = "none"; });

    if (tabId === "tabSellerDashboard") {
        btnOverview.classList.add("active");
        tabOverview.style.display = "block";
        adminPageTitle.innerText = "📊 Ringkasan Dasbor";
        updateDashboardMetrics();
    } else if (tabId === "tabSellerOrders") {
        btnOrders.classList.add("active");
        tabOrders.style.display = "block";
        adminPageTitle.innerText = "📦 Pesanan Masuk";

        // Reset admin filter status
        currentSellerFilter = "semua";
        const filterContainer = document.getElementById("adminOrdersFilterContainer");
        if (filterContainer) {
            const buttons = filterContainer.querySelectorAll(".admin-filter-status-btn");
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

        loadAllOrdersFromSheet();
    } else if (tabId === "tabSellerProducts") {
        btnProducts.classList.add("active");
        tabProducts.style.display = "block";
        adminPageTitle.innerText = "🥦 Katalog Produk";
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
    if (activeBtn) {
        selectAdminTab(activeBtn.id);
    }
}

async function updateDashboardMetrics() {
    try {
        const { data: pesanan, error: errOrders } = await supabaseClient.from('pesanan').select('total, status');
        if (errOrders) throw errOrders;

        const { count: prodCount, error: errProds } = await supabaseClient.from('produk').select('*', { count: 'exact', head: true });
        if (errProds) throw errProds;

        // Calculate Revenue (Lunas / COD Terkonfirmasi)
        let totalRevenue = 0;
        let newOrdersCount = 0;

        (pesanan || []).forEach(order => {
            if (order.status === "Lunas" || order.status === "Sudah Dibayar" || order.status === "Selesai") {
                totalRevenue += Number(order.total);
            } else if (order.status === "Menunggu Pembayaran") {
                newOrdersCount++;
            }
        });

        document.getElementById("analyticTotalRevenue").innerText = formatRupiah(totalRevenue);
        document.getElementById("analyticNewOrders").innerText = newOrdersCount + " Pesanan";
        document.getElementById("analyticActiveProducts").innerText = (prodCount || 0) + " Sayur";
    } catch (err) {
        console.error("Failed to update dashboard analytics metrics:", err);
    }
}

function updateSellerFilterBadges() {
    const filterContainer = document.getElementById("adminOrdersFilterContainer");
    if (!filterContainer) return;

    // Hitung jumlah pesanan berdasarkan cache
    const countSemua = sellerOrdersCache.length;
    const countBelumBayar = sellerOrdersCache.filter(o => o.status === "Menunggu Pembayaran").length;
    
    // Status diproses untuk seller: Lunas, Sudah Dibayar, COD - Diproses, Sedang Disiapkan
    const countDiproses = sellerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan").length;
    const countDikirim = sellerOrdersCache.filter(o => o.status === "Sedang Dikirim").length;
    const countSelesai = sellerOrdersCache.filter(o => o.status === "Selesai").length;

    // Helper untuk lencana bulat premium
    const getBadge = (count, color = "var(--primary)") => {
        if (count === 0) return "";
        return ` <span style="background:${color}; color:white; border-radius:50%; padding:0.15rem 0.35rem; font-size:0.65rem; font-weight:800; min-width:16px; text-align:center; line-height:1; display:inline-block; margin-left:0.25rem;">${count}</span>`;
    };

    const btnSemua = filterContainer.querySelector('[data-status="semua"]');
    const btnBelumBayar = filterContainer.querySelector('[data-status="belum-bayar"]');
    const btnDiproses = filterContainer.querySelector('[data-status="diproses"]');
    const btnDikirim = filterContainer.querySelector('[data-status="dikirim"]');
    const btnSelesai = filterContainer.querySelector('[data-status="selesai"]');

    if (btnSemua) btnSemua.innerHTML = `Semua${getBadge(countSemua, "var(--primary)")}`;
    if (btnBelumBayar) btnBelumBayar.innerHTML = `Belum Bayar${getBadge(countBelumBayar, "var(--gray-500)")}`;
    if (btnDiproses) btnDiproses.innerHTML = `Diproses${getBadge(countDiproses, "#d97706")}`; // Oranye/amber (#d97706) untuk diproses
    if (btnDikirim) btnDikirim.innerHTML = `Dikirim${getBadge(countDikirim, "var(--primary)")}`;
    if (btnSelesai) btnSelesai.innerHTML = `Selesai${getBadge(countSelesai, "var(--gray-500)")}`;
}

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

function applySellerOrdersFilter() {
    const sellerOrdersList = document.getElementById("sellerOrdersList");
    if (!sellerOrdersList) return;

    let filtered = [...sellerOrdersCache];
    if (currentSellerFilter === "belum-bayar") {
        filtered = sellerOrdersCache.filter(o => o.status === "Menunggu Pembayaran");
    } else if (currentSellerFilter === "diproses") {
        filtered = sellerOrdersCache.filter(o => o.status === "Lunas" || o.status === "Sudah Dibayar" || o.status === "COD - Diproses" || o.status === "Sedang Disiapkan");
    } else if (currentSellerFilter === "dikirim") {
        filtered = sellerOrdersCache.filter(o => o.status === "Sedang Dikirim");
    } else if (currentSellerFilter === "selesai") {
        filtered = sellerOrdersCache.filter(o => o.status === "Selesai");
    }

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
        else if (currentSellerFilter === "dikirim") filterLabel = "Dikirim";
        else if (currentSellerFilter === "selesai") filterLabel = "Selesai";

        sellerOrdersList.innerHTML = `
            <div style="text-align:center; padding:4rem 1rem; color:var(--gray-500);">
                <span style="font-size: 2.5rem; display:block; margin-bottom:0.5rem;">📦</span>
                <p style="font-weight:700; margin-bottom:0.25rem;">Tidak Ada Pesanan</p>
                <p style="font-size:0.9rem;">Tidak ada pesanan masuk dengan status "${filterLabel}".</p>
            </div>
        `;
    }
}

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

function loadAllProductsForSeller() {
    const sellerProductsList = document.getElementById("sellerProductsList");
    sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--gray-500);">Memuat katalog sayuran...</div>`;
    
    supabaseClient.from('produk')
    .select('*')
    .then(({ data, error }) => {
        if (error) throw error;
        
        if (data && data.length > 0) {
            products = data; 
            renderProducts(products); 
            
            sellerProductsList.innerHTML = data.map(prod => `
                <div style="background:#fff; border:1px solid var(--gray-200); border-radius:12px; padding:1rem; display:flex; gap:0.75rem; align-items:center; box-shadow:var(--shadow-sm);">
                    <img src="${prod.images[0]}" alt="${prod.name}" style="width:60px; height:60px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                    <div style="flex:1; overflow:hidden;">
                        <strong style="font-size:0.9rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--dark);">${prod.name}</strong>
                        <span style="font-size:0.8rem; color:var(--primary); font-weight:700;">${formatRupiah(prod.variants[0].price)}</span>
                        <span style="font-size:0.72rem; color:var(--gray-400); display:block;">Kategori: ${prod.category}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.35rem; flex-shrink:0;">
                        <button onclick="openEditProductModal('${prod.id}')" style="background:var(--primary-light); color:var(--primary); border:none; padding:0.35rem 0.6rem; font-size:0.75rem; font-weight:700; border-radius:6px; cursor:pointer;">Edit</button>
                        <button onclick="deleteProductFromSheet('${prod.id}')" style="background:#fff1f2; color:#f43f5e; border:none; padding:0.35rem 0.6rem; font-size:0.75rem; font-weight:700; border-radius:6px; cursor:pointer;">Hapus</button>
                    </div>
                </div>
            `).join('');
        } else {
            sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--gray-500);">Katalog kosong.</div>`;
        }
    })
    .catch(err => {
        console.error("Error loading products for seller:", err);
        sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#f43f5e;">Gagal memuat produk dari database.</div>`;
    });
}

function openEditProductModal(prodId = null) {
    formVariantsContainer.innerHTML = "";
    document.getElementById("editProdImageFile").value = ""; 
    document.getElementById("uploadStatusText").innerText = "Pilih foto sayuran untuk diupload otomatis.";
    document.getElementById("uploadStatusText").style.color = "var(--gray-500)";
    
    const productFormModal = document.getElementById("productFormModal");
    const productFormTitle = document.getElementById("productFormTitle");
    const editProdId = document.getElementById("editProdId");
    const editProdName = document.getElementById("editProdName");
    const editProdCategory = document.getElementById("editProdCategory");
    const editProdImages = document.getElementById("editProdImages");
    const editProdDesc = document.getElementById("editProdDesc");
    const editProdBadge = document.getElementById("editProdBadge");

    if (prodId) {
        productFormTitle.innerText = "🥦 Edit Produk Sayur";
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;
        
        editProdId.value = prod.id;
        editProdName.value = prod.name;
        editProdCategory.value = prod.category;
        editProdImages.value = prod.images.join(', ');
        editProdDesc.value = prod.desc;
        editProdBadge.value = prod.badge || "";
        
        prod.variants.forEach(variant => addVariantRowToForm(variant.name, variant.price, variant.label));
    } else {
        productFormTitle.innerText = "➕ Tambah Sayuran Baru";
        editProdId.value = "p" + Date.now();
        editProdName.value = "";
        editProdCategory.value = "daun";
        editProdImages.value = "";
        editProdDesc.value = "";
        editProdBadge.value = "";
        
        addVariantRowToForm("1 Ikat", 5000, "");
    }
    
    productFormModal.classList.add("open");
}

function addVariantRowToForm(name = "", price = "", label = "") {
    const row = document.createElement("div");
    row.className = "variant-form-row";
    row.style.display = "flex";
    row.style.gap = "0.25rem";
    row.style.marginBottom = "0.25rem";
    row.innerHTML = `
        <input type="text" placeholder="Varian (ex: 1 Kg)" value="${name}" class="form-input" style="flex:2; padding:0.4rem; font-size:0.8rem;" required>
        <input type="number" placeholder="Harga Rp" value="${price}" class="form-input" style="flex:2; padding:0.4rem; font-size:0.8rem;" required>
        <input type="text" placeholder="Promo Label" value="${label}" class="form-input" style="flex:1.5; padding:0.4rem; font-size:0.8rem;">
        <button type="button" onclick="this.parentElement.remove()" style="background:#fff1f2; color:#f43f5e; border:1px solid #fecdd3; border-radius:4px; padding:0 0.5rem; font-weight:bold; cursor:pointer;">X</button>
    `;
    document.getElementById("formVariantsContainer").appendChild(row);
}

function saveProductToSheet() {
    const id = document.getElementById("editProdId").value;
    const name = document.getElementById("editProdName").value.trim();
    const category = document.getElementById("editProdCategory").value;
    const desc = document.getElementById("editProdDesc").value.trim();
    const badge = document.getElementById("editProdBadge").value.trim();
    
    // Clean and split image URLs to avoid trailing comma or double commas causing blank images
    const rawImagesString = document.getElementById("editProdImages").value;
    const images = rawImagesString.split(',')
        .map(url => url.trim())
        .filter(url => url !== "" && url !== "https://drive.google.com/uc?");
    
    const formVariantsContainer = document.getElementById("formVariantsContainer");
    
    const variantRows = formVariantsContainer.querySelectorAll(".variant-form-row");
    const variants = [];
    
    variantRows.forEach(row => {
        const inputs = row.querySelectorAll("input");
        variants.push({
            name: inputs[0].value.trim(),
            price: Number(inputs[1].value),
            label: inputs[2].value.trim()
        });
    });

    if (variants.length === 0) {
        alert("Minimal harus ada 1 variasi ukuran & harga!");
        return;
    }

    const savedProd = {
        id, name, category, desc, badge, images, variants
    };

    showToast("Menyimpan ke database Supabase...");

    supabaseClient.from('produk')
    .upsert([savedProd])
    .then(({ error }) => {
        if (error) throw error;
        showToast("✔️ Produk berhasil disimpan!");
        document.getElementById("productFormModal").classList.remove("open");
        loadProductsFromSheet(); 
        loadAllProductsForSeller(); 
    })
    .catch(err => {
        console.error("Error saving product to Supabase:", err);
        alert("Gagal menghubungkan ke database Supabase!");
    });
}

function deleteProductFromSheet(productId) {
    if (!confirm("Apakah Anda yakin ingin menghapus produk ini dari katalog database Supabase?")) return;

    showToast("Menghapus produk...");

    supabaseClient.from('produk')
    .delete()
    .eq('id', productId)
    .then(({ error }) => {
        if (error) throw error;
        showToast("✔️ Produk berhasil dihapus!");
        loadProductsFromSheet();
        loadAllProductsForSeller();
    })
    .catch(err => {
        console.error("Error deleting product from Supabase:", err);
        alert("Koneksi gagal saat menghapus produk!");
    });
}

async function uploadImageToSupabaseStorage(file) {
    const uploadStatusText = document.getElementById("uploadStatusText");
    const editProdImages = document.getElementById("editProdImages");
    
    uploadStatusText.innerText = "⏳ Sedang mengunggah ke Supabase CDN...";
    uploadStatusText.style.color = "var(--primary-dark)";
    
    try {
        // Generate a uniquely clean file name using timestamp
        const fileExt = file.name.split('.').pop();
        const fileName = `sayur_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Direct upload to Supabase 'foto-produk' bucket
        const { data, error } = await supabaseClient
            .storage
            .from('foto-produk')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Retrieve public CDN URL for the uploaded file
        const { data: publicUrlData } = supabaseClient
            .storage
            .from('foto-produk')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        let currentImages = editProdImages.value.trim();
        // Clean trailing commas
        if (currentImages.endsWith(',')) {
            currentImages = currentImages.slice(0, -1).trim();
        }

        if (currentImages === "" || currentImages.includes("https://drive.google.com/uc?")) {
            editProdImages.value = publicUrl;
        } else {
            editProdImages.value = currentImages + ", " + publicUrl;
        }

        uploadStatusText.innerText = "✔️ Berhasil diunggah ke Supabase CDN!";
        uploadStatusText.style.color = "var(--primary)";
        showToast("✔️ Gambar berhasil terunggah ke CDN!");
    } catch (err) {
        console.error("Supabase CDN upload failure:", err);
        uploadStatusText.innerText = "❌ Gagal mengunggah: " + err.message;
        uploadStatusText.style.color = "#f43f5e";
    }
}

// Navigasi Sub-Tab Pengaturan Toko
function selectSubSettings(paneId) {
    document.querySelectorAll(".subsettings-pane").forEach(pane => {
        pane.style.display = "none";
    });
    const targetPane = document.getElementById(paneId);
    if (targetPane) {
        targetPane.style.display = "block";
    }

    document.querySelectorAll(".submenu-btn").forEach(btn => {
        btn.style.color = "var(--gray-500)";
        btn.style.backgroundColor = "transparent";
    });

    let activeBtn = null;
    if (paneId === "subSettingsCourier") activeBtn = document.getElementById("btnSubCourier");
    else if (paneId === "subSettingsPayment") activeBtn = document.getElementById("btnSubPayment");
    else if (paneId === "subSettingsVoucher") activeBtn = document.getElementById("btnSubVoucher");

    if (activeBtn) {
        activeBtn.style.color = "var(--primary-dark)";
        activeBtn.style.backgroundColor = "var(--primary-light)";
    }
}

// Render Vouchers Table Dynamically
function renderVouchersTable() {
    const tbody = document.getElementById("vouchersTableBody");
    if (!tbody) return;

    if (!shopVouchers || shopVouchers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--gray-400); padding:1rem;">Belum ada kode voucher aktif.</td></tr>`;
        return;
    }

    tbody.innerHTML = shopVouchers.map((v, index) => {
        let typeText = "❓ Lainnya";
        if (v.type === "ongkir") typeText = "🟢 Gratis Ongkir (Biteship)";
        else if (v.type === "admin") typeText = "🔵 Bebas Admin";
        else if (v.type === "diskon") typeText = `🛍️ Diskon Belanja (${v.percentage || 0}%)`;

        const maxDiscText = v.type === "ongkir" || v.type === "diskon" 
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

// Add New Voucher dynamically
function addVoucher() {
    const codeInput = document.getElementById("newVoucherCode");
    const typeSelect = document.getElementById("newVoucherType");
    const minInput = document.getElementById("newVoucherMin");
    const maxInput = document.getElementById("newVoucherMax");
    const pctInput = document.getElementById("newVoucherPercentage");

    if (!codeInput || !typeSelect || !minInput || !maxInput) return;

    const code = codeInput.value.trim().toUpperCase();
    const type = typeSelect.value;
    const minPurchase = Number(minInput.value) || 0;
    const maxDiscount = Number(maxInput.value) || 0;
    const percentage = pctInput ? (Number(pctInput.value) || 0) : 0;

    if (code === "") {
        alert("Kode voucher tidak boleh kosong!");
        return;
    }

    if (type === "diskon" && (percentage <= 0 || percentage > 100)) {
        alert("Persentase diskon harus di antara 1 dan 100!");
        return;
    }

    // Mencegah duplikasi kode
    if (shopVouchers.some(v => v.code === code)) {
        alert(`Kode voucher "${code}" sudah terdaftar!`);
        return;
    }

    shopVouchers.push({ code, type, minPurchase, maxDiscount, percentage });
    localStorage.setItem("mbokde_vouchers", JSON.stringify(shopVouchers));

    // Reset fields
    codeInput.value = "";
    minInput.value = "";
    maxInput.value = "";
    if (pctInput) pctInput.value = "15";

    showToast("✔️ Voucher berhasil ditambahkan!");
    renderVouchersTable();
}

// Delete Voucher dynamically
function deleteVoucher(index) {
    if (!shopVouchers[index]) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus kode voucher "${shopVouchers[index].code}"?`)) return;

    shopVouchers.splice(index, 1);
    localStorage.setItem("mbokde_vouchers", JSON.stringify(shopVouchers));

    showToast("🗑️ Voucher berhasil dihapus!");
    renderVouchersTable();
}

function loadShopSettingsInDashboard() {
    document.getElementById("inputMinPurchase").value = localStorage.getItem("mbokde_min_purchase") !== null ? localStorage.getItem("mbokde_min_purchase") : "0";
    document.getElementById("inputMaxDistance").value = localStorage.getItem("mbokde_max_distance") !== null ? localStorage.getItem("mbokde_max_distance") : "15";
    document.getElementById("inputLocalCourierFee").value = localStorage.getItem("mbokde_local_courier_fee") !== null ? localStorage.getItem("mbokde_local_courier_fee") : "5000";
    document.getElementById("inputShopAddress").value = localStorage.getItem("mbokde_shop_address") || "Jl. Tj. III No.1115, RT.001/RW.005, Cipondoh Indah, Kec. Cipondoh, Kota Tangerang, Banten 15148";
    document.getElementById("inputShopGmaps").value = localStorage.getItem("mbokde_shop_gmaps") || "https://maps.app.goo.gl/qys42TqnqBzgHY9x6";
    document.getElementById("inputShopQrisUrl").value = localStorage.getItem("mbokde_shop_qris_image") || "";
    document.getElementById("inputShopBankName").value = localStorage.getItem("mbokde_shop_bank_name") || "BCA";
    document.getElementById("inputShopBankAccountNo").value = localStorage.getItem("mbokde_shop_bank_account_no") || "8801 2345 6789 0123";
    document.getElementById("inputMidtransMode").value = localStorage.getItem("mbokde_midtrans_mode") || "sandbox";

    // Load new voucher settings
    document.getElementById("inputChargeAdmin").checked = (localStorage.getItem("mbokde_charge_admin") !== null ? localStorage.getItem("mbokde_charge_admin") : "true") === "true";
    document.getElementById("inputVaAdminFee").value = localStorage.getItem("mbokde_va_admin_fee") !== null ? localStorage.getItem("mbokde_va_admin_fee") : "4000";
    document.getElementById("inputAutoFreeAdmin").checked = localStorage.getItem("mbokde_auto_free_admin") === "true";
    document.getElementById("inputAutoFreeAdminMin").value = localStorage.getItem("mbokde_auto_free_admin_min") !== null ? localStorage.getItem("mbokde_auto_free_admin_min") : "50000";
    document.getElementById("inputAutoFreeOngkir").checked = localStorage.getItem("mbokde_auto_free_ongkir") === "true";
    document.getElementById("inputAutoFreeOngkirMin").value = localStorage.getItem("mbokde_auto_free_ongkir_min") !== null ? localStorage.getItem("mbokde_auto_free_ongkir_min") : "75000";

    // Reset ke subsettings pertama (Kurir & Lokasi) dan render tabel voucher
    selectSubSettings("subSettingsCourier");
    renderVouchersTable();
}

function saveShopSettings() {
    const minPurchase = document.getElementById("inputMinPurchase").value.trim();
    const maxDistance = document.getElementById("inputMaxDistance").value.trim();
    const courierFee = document.getElementById("inputLocalCourierFee").value.trim();
    const shopAddressVal = document.getElementById("inputShopAddress").value.trim();
    const shopGmapsVal = document.getElementById("inputShopGmaps").value.trim();
    const shopQrisVal = document.getElementById("inputShopQrisUrl").value.trim();
    const shopBankNameVal = document.getElementById("inputShopBankName").value.trim();
    const shopBankAccountNoVal = document.getElementById("inputShopBankAccountNo").value.trim();

    // Read new settings
    const chargeAdmin = document.getElementById("inputChargeAdmin").checked ? "true" : "false";
    const vaAdminFee = document.getElementById("inputVaAdminFee").value.trim();
    const autoFreeAdmin = document.getElementById("inputAutoFreeAdmin").checked ? "true" : "false";
    const autoFreeAdminMin = document.getElementById("inputAutoFreeAdminMin").value.trim();
    const autoFreeOngkir = document.getElementById("inputAutoFreeOngkir").checked ? "true" : "false";
    const autoFreeOngkirMin = document.getElementById("inputAutoFreeOngkirMin").value.trim();
    const midtransMode = document.getElementById("inputMidtransMode").value;

    localStorage.setItem("mbokde_min_purchase", minPurchase || "0");
    localStorage.setItem("mbokde_max_distance", maxDistance || "15");
    localStorage.setItem("mbokde_local_courier_fee", courierFee || "5000");
    localStorage.setItem("mbokde_shop_address", shopAddressVal);
    localStorage.setItem("mbokde_shop_gmaps", shopGmapsVal);
    localStorage.setItem("mbokde_shop_qris_image", shopQrisVal);
    localStorage.setItem("mbokde_shop_bank_name", shopBankNameVal);
    localStorage.setItem("mbokde_shop_bank_account_no", shopBankAccountNoVal);
    localStorage.setItem("mbokde_midtrans_mode", midtransMode);

    // Save new settings
    localStorage.setItem("mbokde_charge_admin", chargeAdmin);
    localStorage.setItem("mbokde_va_admin_fee", vaAdminFee || "4000");
    localStorage.setItem("mbokde_auto_free_admin", autoFreeAdmin);
    localStorage.setItem("mbokde_auto_free_admin_min", autoFreeAdminMin || "50000");
    localStorage.setItem("mbokde_auto_free_ongkir", autoFreeOngkir);
    localStorage.setItem("mbokde_auto_free_ongkir_min", autoFreeOngkirMin || "75000");

    // Refresh active global settings instantly
    shopMinPurchase = Number(minPurchase || 0);
    shopMaxDistance = Number(maxDistance || 15);
    shopLocalCourierFee = Number(courierFee || 5000);
    shopAddress = shopAddressVal;
    shopGmapsLink = shopGmapsVal;
    shopQrisImage = shopQrisVal;
    shopBankName = shopBankNameVal;
    shopBankAccountNo = shopBankAccountNoVal;

    // Refresh new global states
    shopChargeAdminToBuyer = chargeAdmin === "true";
    shopVaAdminFee = Number(vaAdminFee || 4000);
    shopAutoFreeAdmin = autoFreeAdmin === "true";
    shopAutoFreeAdminMin = Number(autoFreeAdminMin || 50000);
    shopAutoFreeOngkir = autoFreeOngkir === "true";
    shopAutoFreeOngkirMin = Number(autoFreeOngkirMin || 75000);

    // Sync Midtrans dynamic keys
    if (typeof syncMidtransConfig === "function") {
        syncMidtransConfig();
    }

    showToast("✔️ Pengaturan toko berhasil disimpan!");
}

async function uploadQrisImageToCdn(input) {
    const file = input.files[0];
    const statusText = document.getElementById("qrisUploadStatus");
    const qrisUrlInput = document.getElementById("inputShopQrisUrl");
    if (!file || !statusText || !qrisUrlInput) return;

    statusText.innerText = "⏳ Mengunggah gambar QRIS...";
    statusText.style.color = "var(--primary)";

    try {
        const fileExt = file.name.split('.').pop();
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

        statusText.innerText = "✔️ QRIS berhasil diunggah ke CDN!";
        statusText.style.color = "var(--primary)";
        showToast("✔️ Gambar QRIS berhasil terunggah ke CDN!");
    } catch (err) {
        console.error("QRIS CDN upload failure:", err);
        statusText.innerText = "❌ Gagal mengunggah QRIS: " + err.message;
        statusText.style.color = "#f43f5e";
    }
}

// Bind Settings Sidebar Click Event Listener dynamically
document.addEventListener("DOMContentLoaded", () => {
    const btnSettings = document.getElementById("tabSellerSettings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            selectAdminTab("tabSellerSettings");
        });
    }

    // BIND TOMBOL FILTER STATUS PESANAN MASUK (ADMIN)
    const adminFilterContainer = document.getElementById("adminOrdersFilterContainer");
    if (adminFilterContainer) {
        const filterButtons = adminFilterContainer.querySelectorAll(".admin-filter-status-btn");
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

                currentSellerFilter = btn.getAttribute("data-status");
                applySellerOrdersFilter();
            });
        });
    }

    // BIND EVENT UNTUK JENIS VOUCHER BARU (PERSENTASE DISKON)
    const newVoucherTypeSelect = document.getElementById("newVoucherType");
    if (newVoucherTypeSelect) {
        newVoucherTypeSelect.addEventListener("change", (e) => {
            const type = e.target.value;
            const pctGroup = document.getElementById("percentageInputGroup");
            const maxLabel = document.getElementById("newVoucherMaxLabel");
            
            if (type === "diskon") {
                if (pctGroup) pctGroup.style.display = "block";
                if (maxLabel) maxLabel.innerText = "Maks. Potongan Diskon (Rp)";
            } else {
                if (pctGroup) pctGroup.style.display = "none";
                if (maxLabel) maxLabel.innerText = type === "ongkir" ? "Maks. Potongan Ongkir (Rp)" : "Maks. Potongan (Rp)";
            }
        });
    }
});
