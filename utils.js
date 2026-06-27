// UTILITY FUNCTIONS & HELPERS
function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toastMsg");
    if (!toast || !toastMsg) return;
    toastMsg.innerText = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function generateRandomOrderId() {
    return "#MBK-" + Math.floor(10000 + Math.random() * 90000);
}

// HELPER PEMBERSIH & NORMALISASI NOMOR WA UNTUK COCOK LINDUNG
function cleanWa(num) {
    let clean = String(num).replace(/[^0-9]/g, '').trim();
    if (clean.indexOf('62') === 0) {
        clean = clean.substring(2);
    }
    if (clean.indexOf('0') === 0) {
        clean = clean.substring(1);
    }
    return clean;
}

// FUNGSI GANTI NOMOR WHATSAPP PADA MODAL RIWAYAT
function changeSavedWaNumber() {
    const noHpLoginBox = document.getElementById("noHpLoginBox");
    const ordersListBox = document.getElementById("ordersListBox");
    const searchWaNo = document.getElementById("searchWaNo");
    
    if (noHpLoginBox) noHpLoginBox.style.display = "block";
    if (ordersListBox) ordersListBox.style.display = "none";
    
    let savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile")) || {};
    savedProfile.whatsapp = "";
    localStorage.setItem("mbokde_customer_profile", JSON.stringify(savedProfile));
    
    if (searchWaNo) searchWaNo.value = "";
}

// Helper to lock body scroll when dialog is open
function toggleBodyScroll(lock) {
    if (lock) {
        document.documentElement.classList.add("body-no-scroll");
        document.body.classList.add("body-no-scroll");
    } else {
        document.documentElement.classList.remove("body-no-scroll");
        document.body.classList.remove("body-no-scroll");
    }
}
