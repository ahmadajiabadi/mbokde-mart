// =====================================================================
// js/seller-categories.js — MODUL CRUD KATEGORI SELLER
// Tanggung jawab: Kelola tambah kategori baru, upload foto banner kategori,
//                 dan sinkronisasi dropdown kategori dinamis.
// Dependensi: config.js (supabaseClient, categories),
//             utils.js (showToast),
//             catalog.js (loadCategoriesFromSupabase)
// =====================================================================

// =====================================================================
// SINKRONISASI DROPDOWN & CHECKBOX KATEGORI
// =====================================================================
function renderCategoryDropdownOptions() {
    const editProdCategory = document.getElementById("editProdCategory");
    const bulkMoveTargetCategory = document.getElementById("bulkMoveTargetCategory");

    if (editProdCategory) {
        editProdCategory.innerHTML = categories.map(cat => `
            <option value="${cat.id}">${cat.icon} ${cat.name}</option>
        `).join('');
    }

    if (bulkMoveTargetCategory) {
        bulkMoveTargetCategory.innerHTML = `
            <option value="" disabled selected>Pindahkan ke Kategori...</option>
            ` + categories.map(cat => `
                <option value="${cat.id}">${cat.icon} ${cat.name}</option>
            `).join('');
    }
}

// =====================================================================
// KONTROL MODAL KATEGORI
// =====================================================================
function openAddCategoryModal() {
    document.getElementById("newCategoryName").value = "";
    document.getElementById("newCategoryCode").value = "";
    document.getElementById("newCategoryIcon").value = "";
    document.getElementById("newCategoryImageFile").value = "";
    document.getElementById("newCategoryImageLink").value = "";
    document.getElementById("categoryUploadStatusText").innerText = "Pilih foto banner kategori untuk diunggah otomatis.";
    document.getElementById("categoryUploadStatusText").style.color = "var(--gray-500)";

    document.getElementById("categoryFormModal").classList.add("open");
}

function closeAddCategoryModal() {
    document.getElementById("categoryFormModal").classList.remove("open");
}

// Auto-fill category code based on name (slugify)
document.getElementById("newCategoryName")?.addEventListener("input", (e) => {
    const name = e.target.value;
    const codeInput = document.getElementById("newCategoryCode");
    if (codeInput) {
        codeInput.value = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
    }
});

// =====================================================================
// UPLOAD BANNER KATEGORI KE SUPABASE STORAGE
// =====================================================================
async function uploadCategoryBannerToSupabase(file) {
    const statusText = document.getElementById("categoryUploadStatusText");
    const imageLink = document.getElementById("newCategoryImageLink");

    statusText.innerText = "⏳ Sedang mengunggah ke Storage...";
    statusText.style.color = "var(--primary-dark)";

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `banner_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('foto-kategori')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: publicUrlData } = supabaseClient.storage
            .from('foto-kategori')
            .getPublicUrl(filePath);

        imageLink.value = publicUrlData.publicUrl;
        statusText.innerText = "✔️ Banner berhasil diunggah!";
        statusText.style.color = "var(--primary)";
        showToast("✔️ Banner kategori berhasil diunggah!");
    } catch (err) {
        console.error("Gagal mengunggah banner kategori:", err);
        statusText.innerText = "❌ Gagal mengunggah: " + err.message;
        statusText.style.color = "#f43f5e";
    }
}

// Setup input file listener
document.getElementById("newCategoryImageFile")?.addEventListener("change", function() {
    if (this.files && this.files[0]) {
        uploadCategoryBannerToSupabase(this.files[0]);
    }
});

// =====================================================================
// SIMPAN KATEGORI BARU KE DATABASE SUPABASE
// =====================================================================
async function saveCategoryToSupabase() {
    const id = document.getElementById("newCategoryCode").value.trim().toLowerCase();
    const name = document.getElementById("newCategoryName").value.trim();
    const icon = document.getElementById("newCategoryIcon").value.trim() || "📦";
    const image_url = document.getElementById("newCategoryImageLink").value.trim();

    if (!id || !name) {
        alert("Nama dan Kode Kategori wajib diisi!");
        return;
    }

    const newCat = { id, name, icon, image_url: image_url || null };

    showToast("Menyimpan kategori baru...");

    try {
        const { error } = await supabaseClient
            .from('kategori')
            .upsert([newCat]);

        if (error) throw error;

        showToast("✔️ Kategori berhasil disimpan!");
        closeAddCategoryModal();

        // Refresh dynamic components
        await loadCategoriesFromSupabase();
        
        // Reload seller products display to reflect new category
        if (typeof loadAllProductsForSeller === 'function') {
            loadAllProductsForSeller();
        }
    } catch (err) {
        console.error("Gagal menyimpan kategori:", err);
        alert("Gagal menyimpan kategori ke Supabase: " + err.message);
    }
}

// Bind Form Submit
document.getElementById("categoryAddForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    saveCategoryToSupabase();
});

// Bind Modal Close buttons
document.getElementById("closeCategoryFormBtn")?.addEventListener("click", closeAddCategoryModal);
document.getElementById("addNewCategoryBtn")?.addEventListener("click", openAddCategoryModal);
