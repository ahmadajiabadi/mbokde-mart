// =====================================================================
// js/catalog.js — MODUL KATALOG PRODUK & BOTTOM SHEET
// Tanggung jawab: Menampilkan grid produk, detail produk (bottom sheet),
//                 dan navigasi carousel gambar.
// Dipanggil oleh: events.js (DOMContentLoaded), app.js (warisan)
// =====================================================================

// REAL-TIME PRODUCT CATALOG SYNC WITH SUPABASE
async function loadProductsFromSheet() {
    try {
        // Load categories dynamically first
        await loadCategoriesFromSupabase();

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

async function loadCategoriesFromSupabase() {
    try {
        const { data, error } = await supabaseClient.from('kategori').select('*').order('name');
        if (error) throw error;

        if (data && data.length > 0) {
            categories = data;
            console.log("Categories successfully synchronized from Supabase!");
        }
    } catch (err) {
        console.error("Failed to load categories from Supabase, using local fallback:", err);
    }
    renderCategoryChips();
    // Pre-fill dropdowns in product edit form
    if (typeof renderCategoryDropdownOptions === 'function') {
        renderCategoryDropdownOptions();
    }
}

function renderCategoryChips() {
    const categoryList = document.getElementById("categoryList");
    if (!categoryList) return;

    let html = `<div class="category-chip active" data-category="semua">🌱 Semua Sayur</div>`;
    html += categories.map(cat => `
        <div class="category-chip" data-category="${cat.id}">${cat.icon} ${cat.name}</div>
    `).join('');

    categoryList.innerHTML = html;

    // Bind event listeners to newly created category chips
    if (typeof setupCategoryChipListeners === 'function') {
        setupCategoryChipListeners();
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

// BOTTOM SHEET — DETAIL & VARIANT POPUP (Sayurbox-style)
function openProductBottomSheet(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    activeProduct = product;
    activeVariantIndex = 0;
    sheetQty = 1;
    carouselIndex = 0;

    const sheetProdName     = document.getElementById("sheetProdName");
    const sheetProdDesc     = document.getElementById("sheetProdDesc");
    const sheetProdPrice    = document.getElementById("sheetProdPrice");
    const sheetQtyVal       = document.getElementById("sheetQtyVal");
    const carouselSlides    = document.getElementById("carouselSlides");
    const carouselDots      = document.getElementById("carouselDots");
    const sheetVariantGrid  = document.getElementById("sheetVariantGrid");
    const bottomSheetOverlay = document.getElementById("bottomSheetOverlay");
    const productBottomSheet = document.getElementById("productBottomSheet");

    sheetProdName.innerText  = product.name;
    sheetProdDesc.innerText  = product.desc;
    sheetProdPrice.innerText = formatRupiah(product.variants[0].price);
    sheetQtyVal.innerText    = "1";

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

// CAROUSEL
function setCarouselIndex(idx) {
    carouselIndex = idx;
    updateCarouselTransform();
}

function updateCarouselTransform() {
    const carouselSlides = document.getElementById("carouselSlides");
    carouselSlides.style.transform = `translateX(-${carouselIndex * 100}%)`;
    document.querySelectorAll(".carousel-dot").forEach((dot, idx) => {
        dot.classList.toggle("active", idx === carouselIndex);
    });
}

function selectSheetVariant(idx) {
    activeVariantIndex = idx;
    const selectedVariant = activeProduct.variants[idx];

    document.getElementById("sheetProdPrice").innerText = formatRupiah(selectedVariant.price * sheetQty);

    document.querySelectorAll(".variant-chip-card").forEach((chip, i) => {
        chip.classList.toggle("selected", i === idx);
    });
}
