// =====================================================================
// js/seller-products.js — MODUL CRUD PRODUK SELLER
// Tanggung jawab: Tampilkan daftar produk, form edit/tambah, simpan,
//                 hapus, dan upload gambar ke Supabase Storage.
// Dependensi: config.js (supabaseClient, products),
//             utils.js (formatRupiah, showToast),
//             catalog.js (renderProducts, loadProductsFromSheet)
// =====================================================================

// =====================================================================
// TAMPILKAN DAFTAR PRODUK DI PANEL ADMIN
// =====================================================================
function loadAllProductsForSeller() {
    const sellerProductsList = document.getElementById("sellerProductsList");
    sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--gray-500);">Memuat katalog sayuran...</div>`;

    if (typeof renderCategoryDropdownOptions === 'function') {
        renderCategoryDropdownOptions();
    }

    hideBulkMoveActionBar();

    supabaseClient.from('produk')
        .select('*')
        .then(({ data, error }) => {
            if (error) throw error;

            if (data && data.length > 0) {
                products = data;
                renderProducts(products);

                let accordionHtml = categories.map(cat => {
                    const catProducts = products.filter(p => p.category === cat.id);
                    const prodCount = catProducts.length;

                    let productRows = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--gray-400); font-size: 0.85rem;">Belum ada produk di kategori ini.</div>`;

                    if (prodCount > 0) {
                        productRows = catProducts.map(prod => `
                            <div style="background:#fff; border:1px solid var(--gray-200); border-radius:12px; padding:0.85rem 1rem; display:flex; gap:0.75rem; align-items:center; box-shadow:var(--shadow-sm); transition: var(--transition);">
                                <div class="product-check-wrapper">
                                    <input type="checkbox" class="product-checkbox" data-id="${prod.id}" onchange="onProductSelectChange()">
                                </div>
                                <img src="${prod.images[0]}" alt="${prod.name}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                                <div style="flex:1; overflow:hidden;">
                                    <strong style="font-size:0.85rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--dark);">${prod.name}</strong>
                                    <span style="font-size:0.78rem; color:var(--primary); font-weight:700;">${formatRupiah(prod.variants[0].price)}</span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.3rem; flex-shrink:0;">
                                    <button onclick="openEditProductModal('${prod.id}')" style="background:var(--primary-light); color:var(--primary); border:none; padding:0.3rem 0.5rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer;">Edit</button>
                                    <button onclick="deleteProductFromSheet('${prod.id}')" style="background:#fff1f2; color:#f43f5e; border:none; padding:0.3rem 0.5rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer;">Hapus</button>
                                </div>
                            </div>
                        `).join('');
                    }

                    return `
                        <div class="category-accordion" id="accordion-${cat.id}">
                            <div class="accordion-header" onclick="toggleAccordion('accordion-${cat.id}')">
                                <div class="accordion-title">
                                    <span>${cat.icon}</span>
                                    <span>${cat.name}</span>
                                    <span class="accordion-badge">${prodCount}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <button onclick="openEditProductModal(null, '${cat.id}'); event.stopPropagation();" style="background:var(--primary); color:#fff; border:none; padding:0.3rem 0.6rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer; display:flex; align-items:center; gap:0.25rem;">
                                        ➕ Tambah
                                    </button>
                                    <span class="accordion-arrow">▼</span>
                                </div>
                            </div>
                            <div class="accordion-body">
                                ${productRows}
                            </div>
                        </div>
                    `;
                }).join('');

                const activeCatIds = categories.map(c => c.id);
                const otherProducts = products.filter(p => !activeCatIds.includes(p.category));
                if (otherProducts.length > 0) {
                    let otherRows = otherProducts.map(prod => `
                        <div style="background:#fff; border:1px solid var(--gray-200); border-radius:12px; padding:0.85rem 1rem; display:flex; gap:0.75rem; align-items:center; box-shadow:var(--shadow-sm);">
                            <div class="product-check-wrapper">
                                <input type="checkbox" class="product-checkbox" data-id="${prod.id}" onchange="onProductSelectChange()">
                            </div>
                            <img src="${prod.images[0]}" alt="${prod.name}" style="width:50px; height:50px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                            <div style="flex:1; overflow:hidden;">
                                <strong style="font-size:0.85rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--dark);">${prod.name}</strong>
                                <span style="font-size:0.78rem; color:var(--primary); font-weight:700;">${formatRupiah(prod.variants[0].price)}</span>
                                <span style="font-size:0.68rem; color:#f43f5e; display:block;">Kategori tidak valid: ${prod.category}</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.3rem; flex-shrink:0;">
                                <button onclick="openEditProductModal('${prod.id}')" style="background:var(--primary-light); color:var(--primary); border:none; padding:0.3rem 0.5rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer;">Edit</button>
                                <button onclick="deleteProductFromSheet('${prod.id}')" style="background:#fff1f2; color:#f43f5e; border:none; padding:0.3rem 0.5rem; font-size:0.72rem; font-weight:700; border-radius:6px; cursor:pointer;">Hapus</button>
                            </div>
                        </div>
                    `).join('');

                    accordionHtml += `
                        <div class="category-accordion" id="accordion-other">
                            <div class="accordion-header" onclick="toggleAccordion('accordion-other')">
                                <div class="accordion-title">
                                    <span>📦</span>
                                    <span>Kategori Lainnya (Perlu Pindahan)</span>
                                    <span class="accordion-badge" style="background:#f43f5e;">${otherProducts.length}</span>
                                </div>
                                <span class="accordion-arrow">▼</span>
                            </div>
                            <div class="accordion-body">
                                ${otherRows}
                            </div>
                        </div>
                    `;
                }

                sellerProductsList.innerHTML = accordionHtml;

                if (categories.length > 0) {
                    toggleAccordion(`accordion-${categories[0].id}`, true);
                }
            } else {
                sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--gray-500);">Katalog kosong.</div>`;
            }
        })
        .catch(err => {
            console.error("Error loading products for seller:", err);
            sellerProductsList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#f43f5e;">Gagal memuat produk dari database.</div>`;
        });
}

// =====================================================================
// BUKA FORM EDIT / TAMBAH PRODUK
// =====================================================================
function openEditProductModal(prodId = null, categoryId = null) {
    const formVariantsContainer = document.getElementById("formVariantsContainer");
    formVariantsContainer.innerHTML = "";
    document.getElementById("editProdImageFile").value = "";
    document.getElementById("uploadStatusText").innerText = "Pilih foto sayuran untuk diupload otomatis.";
    document.getElementById("uploadStatusText").style.color = "var(--gray-500)";

    const productFormModal = document.getElementById("productFormModal");
    const productFormTitle = document.getElementById("productFormTitle");
    const editProdId       = document.getElementById("editProdId");
    const editProdName     = document.getElementById("editProdName");
    const editProdCategory = document.getElementById("editProdCategory");
    const editProdImages   = document.getElementById("editProdImages");
    const editProdDesc     = document.getElementById("editProdDesc");
    const editProdBadge    = document.getElementById("editProdBadge");

    if (prodId) {
        productFormTitle.innerText = "🥦 Edit Produk Sayur";
        const prod = products.find(p => p.id === prodId);
        if (!prod) return;

        editProdId.value       = prod.id;
        editProdName.value     = prod.name;
        editProdCategory.value = prod.category;
        editProdImages.value   = prod.images.join(', ');
        editProdDesc.value     = prod.desc;
        editProdBadge.value    = prod.badge || "";

        prod.variants.forEach(variant => addVariantRowToForm(variant.name, variant.price, variant.label));
    } else {
        productFormTitle.innerText = "➕ Tambah Sayuran Baru";
        editProdId.value       = "p" + Date.now();
        editProdName.value     = "";
        editProdCategory.value = categoryId || (categories[0] ? categories[0].id : "daun");
        editProdImages.value   = "";
        editProdDesc.value     = "";
        editProdBadge.value    = "";

        addVariantRowToForm("1 Ikat", 5000, "");
    }

    productFormModal.classList.add("open");
}

// =====================================================================
// TAMBAH BARIS VARIAN DI FORM PRODUK
// =====================================================================
function addVariantRowToForm(name = "", price = "", label = "") {
    const formVariantsContainer = document.getElementById("formVariantsContainer");
    const row = document.createElement("div");
    row.className   = "variant-form-row";
    row.style.display = "flex";
    row.style.gap   = "0.25rem";
    row.style.marginBottom = "0.25rem";
    row.innerHTML = `
        <input type="text"   placeholder="Varian (ex: 1 Kg)" value="${name}"  class="form-input" style="flex:2; padding:0.4rem; font-size:0.8rem;" required>
        <input type="number" placeholder="Harga Rp"          value="${price}" class="form-input" style="flex:2; padding:0.4rem; font-size:0.8rem;" required>
        <input type="text"   placeholder="Promo Label"       value="${label}" class="form-input" style="flex:1.5; padding:0.4rem; font-size:0.8rem;">
        <button type="button" onclick="this.parentElement.remove()" style="background:#fff1f2; color:#f43f5e; border:1px solid #fecdd3; border-radius:4px; padding:0 0.5rem; font-weight:bold; cursor:pointer;">X</button>
    `;
    formVariantsContainer.appendChild(row);
}

// =====================================================================
// SIMPAN PRODUK KE SUPABASE (INSERT / UPDATE)
// =====================================================================
function saveProductToSheet() {
    const id       = document.getElementById("editProdId").value;
    const name     = document.getElementById("editProdName").value.trim();
    const category = document.getElementById("editProdCategory").value;
    const desc     = document.getElementById("editProdDesc").value.trim();
    const badge    = document.getElementById("editProdBadge").value.trim();

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
            name:  inputs[0].value.trim(),
            price: Number(inputs[1].value),
            label: inputs[2].value.trim()
        });
    });

    if (variants.length === 0) {
        alert("Minimal harus ada 1 variasi ukuran & harga!");
        return;
    }

    const savedProd = { id, name, category, desc, badge, images, variants };

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

// =====================================================================
// HAPUS PRODUK DARI SUPABASE
// =====================================================================
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

// =====================================================================
// UPLOAD GAMBAR PRODUK KE SUPABASE STORAGE CDN
// =====================================================================
async function uploadImageToSupabaseStorage(file) {
    const uploadStatusText = document.getElementById("uploadStatusText");
    const editProdImages   = document.getElementById("editProdImages");

    uploadStatusText.innerText    = "⏳ Sedang mengunggah ke Supabase CDN...";
    uploadStatusText.style.color  = "var(--primary-dark)";

    try {
        const fileExt  = file.name.split('.').pop();
        const fileName = `sayur_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('foto-produk')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: publicUrlData } = supabaseClient.storage
            .from('foto-produk')
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        let currentImages = editProdImages.value.trim();
        if (currentImages.endsWith(',')) currentImages = currentImages.slice(0, -1).trim();

        if (currentImages === "" || currentImages.includes("https://drive.google.com/uc?")) {
            editProdImages.value = publicUrl;
        } else {
            editProdImages.value = currentImages + ", " + publicUrl;
        }

        uploadStatusText.innerText   = "✔️ Berhasil diunggah ke Supabase CDN!";
        uploadStatusText.style.color = "var(--primary)";
        showToast("✔️ Gambar berhasil terunggah ke CDN!");
    } catch (err) {
        console.error("Supabase CDN upload failure:", err);
        uploadStatusText.innerText   = "❌ Gagal mengunggah: " + err.message;
        uploadStatusText.style.color = "#f43f5e";
    }
}

// =====================================================================
// HELPER DAN EVENT HANDLER ACCORDION & BULK ACTIONS
// =====================================================================

function toggleAccordion(accordionId, forceOpen = false) {
    const accordion = document.getElementById(accordionId);
    if (!accordion) return;

    if (forceOpen) {
        accordion.classList.add("open");
    } else {
        accordion.classList.toggle("open");
    }
}

function onProductSelectChange() {
    const checkedBoxes = document.querySelectorAll(".product-checkbox:checked");
    const count = checkedBoxes.length;

    const bulkMoveActionBar = document.getElementById("bulkMoveActionBar");
    const bulkMoveSelectedText = document.getElementById("bulkMoveSelectedText");

    if (count > 0) {
        if (bulkMoveSelectedText) bulkMoveSelectedText.innerText = `${count} produk terpilih`;
        if (bulkMoveActionBar) bulkMoveActionBar.classList.add("show");
    } else {
        hideBulkMoveActionBar();
    }
}

function hideBulkMoveActionBar() {
    const bulkMoveActionBar = document.getElementById("bulkMoveActionBar");
    if (bulkMoveActionBar) bulkMoveActionBar.classList.remove("show");

    // Uncheck all boxes
    document.querySelectorAll(".product-checkbox").forEach(cb => cb.checked = false);
}

async function executeBulkMove() {
    const targetCategorySelect = document.getElementById("bulkMoveTargetCategory");
    const targetCategory = targetCategorySelect.value;

    if (!targetCategory) {
        alert("Pilih kategori tujuan terlebih dahulu!");
        return;
    }

    const checkedBoxes = document.querySelectorAll(".product-checkbox:checked");
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));

    if (selectedIds.length === 0) {
        alert("Pilih produk yang ingin dipindahkan terlebih dahulu!");
        return;
    }

    showToast(`Memindahkan ${selectedIds.length} produk...`);

    try {
        // Bulk update category for selected products in Supabase
        const { error } = await supabaseClient
            .from('produk')
            .update({ category: targetCategory })
            .in('id', selectedIds);

        if (error) throw error;

        showToast("✔️ Produk berhasil dipindahkan!");
        hideBulkMoveActionBar();

        // Refresh lists
        await loadProductsFromSheet();
        loadAllProductsForSeller();
    } catch (err) {
        console.error("Gagal melakukan bulk move:", err);
        alert("Gagal memindahkan produk ke kategori lain: " + err.message);
    }
}

// Bind Bulk Actions UI buttons
document.getElementById("confirmBulkMoveBtn")?.addEventListener("click", executeBulkMove);
document.getElementById("cancelBulkMoveBtn")?.addEventListener("click", hideBulkMoveActionBar);

