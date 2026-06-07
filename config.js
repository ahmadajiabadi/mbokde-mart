// CONFIGURATION & GLOBAL STATES
const SUPABASE_URL = "https://gyowwceoycbwegogxxrk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3d3Y2VveWNid2Vnb2d4eHJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjkyMjAsImV4cCI6MjA5NTU0NTIyMH0.G8gmfcPIvjHAmPx69JFBd7ag3kT-aBCjDPKKSQpf8ts";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// URL BACKEND PHP PROXY (Kosongkan "" jika file PHP berada di server hosting/domain yang sama. Jika frontend ditaruh di GitHub Pages, isi dengan URL absolut server hosting PHP Anda, contoh: "https://domain-anda.com/Mbokde_Mart/")
const BACKEND_URL = "https://gyowwceoycbwegogxxrk.supabase.co/functions/v1/";

// BITESHIP LOGISTIK API CONFIGURATION
const BITESHIP_API_KEY = "biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiTWJva2RlIE1hcnQgVGVzdGluZyIsInVzZXJJZCI6IjZhMTk5ZDY2OWI2MGVhMWFjMjE2MjkzYyIsImlhdCI6MTc4MDA2NTg3OH0.FOHsrmXc1dEU6j3uP43O8pjQ2znyO_etkyX-9p7ucR0";

// Helper reader for settings
const getShopSetting = (key, defaultValue) => {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved : defaultValue;
};

// MIDTRANS PAYMENT GATEWAY CONFIGURATION
let shopMidtransMode = getShopSetting("mbokde_midtrans_mode", "sandbox");
let MIDTRANS_IS_PRODUCTION = shopMidtransMode === "production";
let MIDTRANS_CLIENT_KEY = MIDTRANS_IS_PRODUCTION 
    ? "Mid-client-THfaLj-TnpnkYgBO" 
    : "Mid-client-T5F6Sdyjp8w7msUu";

function syncMidtransConfig() {
    shopMidtransMode = getShopSetting("mbokde_midtrans_mode", "sandbox");
    MIDTRANS_IS_PRODUCTION = shopMidtransMode === "production";
    MIDTRANS_CLIENT_KEY = MIDTRANS_IS_PRODUCTION 
        ? "Mid-client-THfaLj-TnpnkYgBO" 
        : "Mid-client-T5F6Sdyjp8w7msUu";
}

// Reactive Shop Settings variables
let shopMinPurchase = Number(getShopSetting("mbokde_min_purchase", "0"));
let shopMaxDistance = Number(getShopSetting("mbokde_max_distance", "15"));
let shopLocalCourierFee = Number(getShopSetting("mbokde_local_courier_fee", "5000"));
let shopAddress = getShopSetting("mbokde_shop_address", "Jl. Tj. III No.1115, RT.001/RW.005, Cipondoh Indah, Kec. Cipondoh, Kota Tangerang, Banten 15148");
let shopGmapsLink = getShopSetting("mbokde_shop_gmaps", "https://maps.app.goo.gl/qys42TqnqBzgHY9x6");
let shopQrisImage = getShopSetting("mbokde_shop_qris_image", "");
let shopBankName = getShopSetting("mbokde_shop_bank_name", "BCA");
let shopBankAccountNo = getShopSetting("mbokde_shop_bank_account_no", "8801 2345 6789 0123");

// Konfigurasi Tambahan: Biaya Surcharge & Voucher Promo
let shopChargeAdminToBuyer = getShopSetting("mbokde_charge_admin", "true") === "true";
let shopVaAdminFee = Number(getShopSetting("mbokde_va_admin_fee", "4000"));
let shopAutoFreeAdmin = getShopSetting("mbokde_auto_free_admin", "false") === "true";
let shopAutoFreeAdminMin = Number(getShopSetting("mbokde_auto_free_admin_min", "50000"));
let shopAutoFreeOngkir = getShopSetting("mbokde_auto_free_ongkir", "false") === "true";
let shopAutoFreeOngkirMin = Number(getShopSetting("mbokde_auto_free_ongkir_min", "75000"));

const DEFAULT_VOUCHERS = [
    { code: "ONGKIRGRATIS", type: "ongkir", minPurchase: 50000, maxDiscount: 10000 },
    { code: "BEBASADMIN", type: "admin", minPurchase: 30000 }
];
let shopVouchers = JSON.parse(getShopSetting("mbokde_vouchers", JSON.stringify(DEFAULT_VOUCHERS)));

const SHOP_COORDINATES = { lat: -6.1828405, lng: 106.6853165 };
const SHOP_ADDRESS = "Jl. Tj. III No.1115, RT.001/RW.005, Cipondoh Indah, Kec. Cipondoh, Kota Tangerang, Banten 15148";

// GOOGLE APPS SCRIPT URL UNTUK FILE UPLOAD DRIVE GRATIS
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxE77qzLTWzBju2GLCaIkxdKXuahEDQYW8O4dIFfliTvMQnqco7GLLdrdipUwNPIWToGw/exec";

// PIN DASHBOARD PENJUAL
const SELLER_PIN = "1234";

// DATA PRODUK FALLBACK
const MOCK_PRODUCTS = [
    {
        id: "p1",
        name: "Bayam Hijau Organik",
        category: "daun",
        images: [
            "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1551308990-2f1643841448?w=500&auto=format&fit=crop&q=80"
        ],
        desc: "Bayam hijau segar pilihan yang ditanam secara organik tanpa pestisida kimia. Kaya akan zat besi, kalsium, dan vitamin A. Sangat baik untuk sup bening masakan keluarga.",
        variants: [
            { name: "1 Ikat Besar", price: 4500, label: "Populer" },
            { name: "3 Ikat (Bundle)", price: 12000, label: "Promo Rp12rb" },
            { name: "1 Kg (Grosir)", price: 20000, label: "Hemat Banyak" }
        ],
        badge: "Organik"
    },
    {
        id: "p2",
        name: "Tomat Merah Ranum",
        category: "buah",
        images: [
            "https://images.unsplash.com/photo-1595855759920-86582396756a?w=500&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80"
        ],
        desc: "Tomat merah segar dipetik saat matang pohon. Rasanya manis-asam segar, padat dagingnya, dan kaya antioksidan likopen. Cocok untuk jus segar, sambal, atau sup.",
        variants: [
            { name: "500 gram", price: 6500, label: "" },
            { name: "1 Kg", price: 12000, label: "Bestseller" },
            { name: "2 Kg (Dus)", price: 22000, label: "Hemat Rp2rb" }
        ],
        badge: "Segar"
    },
    {
        id: "p3",
        name: "Cabai Rawit Merah Brebes",
        category: "bumbu",
        images: [
            "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500&auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1564683214966-263a23a7fca5?w=500&auto=format&fit=crop&q=80"
        ],
        desc: "Cabai rawit merah Brebes dengan tingkat kepedasan maksimal. Dipetik segar langsung dari pohon, bersih, dan bebas busuk. Bumbu wajib bagi pecinta makanan pedas.",
        variants: [
            { name: "100 gram", price: 7500, label: "" },
            { name: "250 gram", price: 18000, label: "Promo Rp18rb" },
            { name: "1 Kg", price: 65000, label: "Grosir" }
        ],
        badge: "Pedas!"
    }
];

// GLOBAL STATES
let products = [...MOCK_PRODUCTS];
let cart = [];
let selectedShipping = {
    method: "kurir-toko",
    cost: 5000,
    name: "🛵 Kurir Lokal Toko"
};

// Maps State
let map = null;
let marker = null;
let currentCoords = { lat: -6.1828405, lng: 106.6853165 }; // Default: Cipondoh Tangerang (Mbokde Mart)
let customerCoords = { lat: -6.1828405, lng: 106.6853165 }; // Customer coordinates captured from Leaflet Map pinpoint

// Active Product State in Bottom Sheet
let activeProduct = null;
let activeVariantIndex = 0;
let sheetQty = 1;
let carouselIndex = 0;

// Current Active Order State (For Stage 2 & 3)
let currentOrder = null;
let selectedVaBank = null;
