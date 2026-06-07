// =====================================================================
// js/maps.js — MODUL PETA INTERAKTIF & LOGISTIK BITESHIP
// Tanggung jawab: Leaflet map pinpoint, Biteship rate fetch, geocoding,
//                 pilihan metode pengiriman.
// Dependensi: config.js (SHOP_COORDINATES, customerCoords, selectedShipping, ...),
//             utils.js (formatRupiah, showToast),
//             cart.js (calculateCheckedSubtotal)
// =====================================================================

let checkoutMapInstance  = null;
let checkoutMarkerInstance = null;
let biteshipRates        = [];
let searchTimeout        = null;

// =====================================================================
// INISIALISASI PETA LEAFLET
// =====================================================================
function initCheckoutMap() {
    const mapDiv = document.getElementById("checkoutMap");
    if (!mapDiv) return;

    if (checkoutMapInstance) {
        const currentLat = customerCoords.lat;
        const currentLng = customerCoords.lng;
        checkoutMapInstance.setView([currentLat, currentLng], 15);
        if (checkoutMarkerInstance) {
            checkoutMarkerInstance.setLatLng([currentLat, currentLng]);
        }
        setTimeout(() => { checkoutMapInstance.invalidateSize(); }, 150);
        updatePinpointCoordinates(currentLat, currentLng);
        return;
    }

    let defaultLat = customerCoords.lat;
    let defaultLng = customerCoords.lng;

    checkoutMapInstance = L.map('checkoutMap').setView([defaultLat, defaultLng], 15);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps'
    }).addTo(checkoutMapInstance);

    checkoutMarkerInstance = L.marker([defaultLat, defaultLng], {
        draggable: true
    }).addTo(checkoutMapInstance);

    checkoutMarkerInstance.on('dragend', function() {
        const position = checkoutMarkerInstance.getLatLng();
        updatePinpointCoordinates(position.lat, position.lng);
    });

    checkoutMapInstance.on('click', function(e) {
        checkoutMarkerInstance.setLatLng(e.latlng);
        updatePinpointCoordinates(e.latlng.lat, e.latlng.lng);
    });

    // Geolocation auto-pinpoint jika belum ada profil tersimpan
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

    setTimeout(() => { checkoutMapInstance.invalidateSize(); }, 250);
}

// Toggle ukuran peta (Perbesar / Perkecil)
function toggleMapSize() {
    const mapDiv = document.getElementById("checkoutMap");
    const btn    = document.getElementById("btnToggleMapSize");
    if (!mapDiv || !btn) return;

    if (mapDiv.style.height === "220px") {
        mapDiv.style.height = "380px";
        btn.innerText = "🔍 Perkecil Peta";
    } else {
        mapDiv.style.height = "220px";
        btn.innerText = "🔍 Perbesar Peta";
    }

    setTimeout(() => {
        if (checkoutMapInstance) checkoutMapInstance.invalidateSize();
    }, 320);
}

// =====================================================================
// GEOCODING & AUTOCOMPLETE (Nominatim OSM)
// =====================================================================
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
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=id`);
            const results  = await response.json();

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
    }, 450);
}

function selectMapSuggestion(name, lat, lon) {
    const queryInput     = document.getElementById("mapSearchInput");
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");

    if (queryInput)     queryInput.value          = name;
    if (suggestionsDiv) suggestionsDiv.style.display = "none";

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (checkoutMapInstance) {
        checkoutMapInstance.setView([parsedLat, parsedLon], 16);
        if (checkoutMarkerInstance) checkoutMarkerInstance.setLatLng([parsedLat, parsedLon]);
    }
    updatePinpointCoordinates(parsedLat, parsedLon);
    showToast("📍 Lokasi dipilih!");
}

// Tutup suggestions list saat klik di luar
document.addEventListener("click", (e) => {
    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    if (suggestionsDiv && !e.target.closest("#mapSearchInput") && !e.target.closest("#mapSearchSuggestions")) {
        suggestionsDiv.style.display = "none";
    }
});

async function searchAddressOnMap() {
    const queryInput = document.getElementById("mapSearchInput");
    if (!queryInput) return;

    const query = queryInput.value.trim();
    if (!query) {
        alert("Harap ketik nama jalan atau alamat terlebih dahulu!");
        return;
    }

    const suggestionsDiv = document.getElementById("mapSearchSuggestions");
    if (suggestionsDiv) suggestionsDiv.style.display = "none";

    showToast("🔎 Mencari lokasi...");
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=id`);
        const results  = await response.json();

        if (results && results.length > 0) {
            const firstResult = results[0];
            const lat = parseFloat(firstResult.lat);
            const lng = parseFloat(firstResult.lon);

            checkoutMapInstance.setView([lat, lng], 16);
            checkoutMarkerInstance.setLatLng([lat, lng]);
            updatePinpointCoordinates(lat, lng);
            showToast("✔️ Lokasi berhasil ditemukan!");
        } else {
            alert("Lokasi tidak ditemukan! Coba masukkan kata kunci yang lebih spesifik.");
        }
    } catch (err) {
        console.error("Nominatim geocoding error:", err);
        alert("Gagal menghubungi server pencarian lokasi!");
    }
}

// =====================================================================
// UPDATE KOORDINAT PINPOINT
// =====================================================================
function updatePinpointCoordinates(lat, lng) {
    customerCoords = { lat, lng };

    const mapsLinkInput = document.getElementById("customerMapsLink");
    if (mapsLinkInput) {
        mapsLinkInput.value = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }

    isLocationConfirmed = false;

    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.innerHTML = "📍 Konfirmasi Lokasi & Cek Ongkir";
        btnConfirm.style.background = "var(--primary)";
        btnConfirm.style.color      = "white";
        btnConfirm.style.cursor     = "pointer";
    }

    renderLocationPendingPlaceholder();
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

function updateCheckoutTotals() {
    const checkedSubtotal = calculateCheckedSubtotal();
    document.getElementById("stage1Total").innerText = formatRupiah(checkedSubtotal + selectedShipping.cost);
}

// =====================================================================
// BITESHIP REAL-TIME RATES
// =====================================================================
async function fetchBiteshipRates(lat, lng) {
    const deliveryGrid = document.getElementById("deliveryGrid");
    if (!deliveryGrid) return;

    deliveryGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 1.5rem; color: var(--primary); font-size: 0.85rem; font-weight: 600; display:flex; flex-direction:column; align-items:center; gap:0.5rem; width:100%;">
            <div style="width: 28px; height: 28px; border: 3px solid rgba(0,138,62,0.1); border-top-color: var(--primary); border-radius: 50%; animation: biteshipSpin 0.8s linear infinite; margin-bottom: 0.25rem;"></div>
            <span>⏳ Menghitung Ongkir Real-time Biteship...</span>
            <style>@keyframes biteshipSpin { to { transform: rotate(360deg); } }</style>
        </div>
    `;

    const subtotal = calculateCheckedSubtotal();

    try {
        const headers = { "Content-Type": "application/json" };
        if (typeof BACKEND_URL !== 'undefined' && BACKEND_URL.includes("supabase.co/functions/v1/")) {
            headers["Authorization"] = "Bearer " + SUPABASE_KEY;
        }

        const response = await fetch(getProxyUrl("biteship_proxy"), {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                "origin_latitude":      SHOP_COORDINATES.lat,
                "origin_longitude":     SHOP_COORDINATES.lng,
                "destination_latitude": lat,
                "destination_longitude": lng,
                "couriers": "jne,sicepat,gojek,grab,anteraja,tiki,jnt",
                "items": [
                    {
                        "name":        "Belanja Sayur Mbokde Mart",
                        "description": "Paket Sayuran Segar Harian",
                        "value":       subtotal > 0 ? subtotal : 10000,
                        "weight":      1000,
                        "quantity":    1
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
            warningMsg = `⚠️ <strong>Biteship Info:</strong> ${err.message}`;
        }
        renderShopFallbackRates(warningMsg);
    }
}

// Helper: Jarak Haversine (km)
function getHaversineDistance(coords1, coords2) {
    const R = 6371;
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper: Deteksi Sameday/Instant
function isSamedayOrInstant(rate) {
    const code    = (rate.courier_code || "").toLowerCase();
    const service = (rate.courier_service_code || "").toLowerCase();
    const type    = (rate.service_type || "").toLowerCase();
    const unit    = (rate.shipment_duration_unit || "").toLowerCase();

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

    let localCourierEligible = true;
    let localCourierReason   = "";

    if (distance > shopMaxDistance) {
        localCourierEligible = false;
        localCourierReason = `Jarak > ${shopMaxDistance.toFixed(1)} km (Maks. ${shopMaxDistance} km)`;
    } else if (subtotal < shopMinPurchase) {
        localCourierEligible = false;
        localCourierReason = `Min. belanja ${formatRupiah(shopMinPurchase)}`;
    }

    const localCourierHtml = localCourierEligible
        ? `<div class="delivery-card" id="shipping-kurir-toko"
               onclick="selectFallbackCourier('kurir-toko', ${shopLocalCourierFee}, '🛵 Kurir Lokal Toko', this)"
               style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); cursor: pointer; transition: var(--transition);">
               <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--dark);">🛵 Kurir Lokal Toko</span>
               <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem; margin-top:0.25rem;">${formatRupiah(shopLocalCourierFee)}</span>
           </div>`
        : `<div class="delivery-card disabled"
               style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); opacity: 0.55; pointer-events: none; background: #fafafa;">
               <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--gray-400);">🛵 Kurir Lokal Toko</span>
               <span class="delivery-price" style="font-size: 0.72rem; color: #ef4444; font-weight: 700; margin-top:0.25rem;">⚠️ ${localCourierReason}</span>
           </div>`;

    const pickupHtml = `
        <div class="delivery-card" id="shipping-ambil-sendiri"
             onclick="selectAmbilSendiri(this)"
             style="display: flex; flex-direction: column; justify-content: center; padding: 0.75rem 1rem; border-radius: 8px; border: 1.5px solid var(--gray-200); cursor: pointer; transition: var(--transition);">
            <span class="delivery-name" style="font-weight: 700; font-size: 0.82rem; color:var(--dark);">🏪 Ambil Sendiri di Warung</span>
            <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem; margin-top:0.25rem;">Gratis (Rp 0)</span>
        </div>
    `;

    const regularRates = biteshipRates.filter(rate => !isSamedayOrInstant(rate));
    const samedayRates = biteshipRates.filter(rate => isSamedayOrInstant(rate));

    const sortedRegular = [...regularRates].sort((a, b) => a.price - b.price).slice(0, 3);
    const sortedSameday = [...samedayRates].sort((a, b) => a.price - b.price).slice(0, 3);
    const combinedRates = [...sortedRegular, ...sortedSameday];

    const biteshipHtml = combinedRates.map((rate) => {
        const cardId    = `biteship-${rate.courier_code}-${rate.courier_service_code}`;
        const isSameday = isSamedayOrInstant(rate);
        let durationUnit = rate.shipment_duration_unit;
        if (durationUnit === 'days')  durationUnit = 'Hari';
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
                    <span class="delivery-price" style="font-weight: 800; color: var(--primary); font-size: 0.88rem;">${formatRupiah(rate.price)}</span>
                    <span style="font-size:0.7rem; color: var(--gray-500);">⏱️ ${rate.shipment_duration_range} ${durationUnit}</span>
                </div>
            </div>
        `;
    }).join('');

    deliveryGrid.innerHTML = localCourierHtml + pickupHtml + biteshipHtml;

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

    const warningHtml = warningMsg
        ? `<div style="grid-column: 1/-1; font-size: 0.76rem; background: #fffbeb; color: #b45309; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 0.5rem; line-height: 1.45; display:flex; align-items:center; width:100%;"><span>${warningMsg}</span></div>`
        : "";

    const distance = getHaversineDistance(SHOP_COORDINATES, customerCoords);
    const subtotal = calculateCheckedSubtotal();

    let localCourierEligible = true;
    let localCourierReason   = "";

    if (distance > shopMaxDistance) {
        localCourierEligible = false;
        localCourierReason = `Jarak > ${shopMaxDistance.toFixed(1)} km (Maks. ${shopMaxDistance} km)`;
    } else if (subtotal < shopMinPurchase) {
        localCourierEligible = false;
        localCourierReason = `Min. belanja ${formatRupiah(shopMinPurchase)}`;
    }

    const localCourierHtml = localCourierEligible
        ? `<div class="delivery-card" id="shipping-kurir-toko" onclick="selectFallbackCourier('kurir-toko', ${shopLocalCourierFee}, '🛵 Kurir Lokal Toko', this)"><span class="delivery-name">🛵 Kurir Lokal Toko</span><span class="delivery-price">${formatRupiah(shopLocalCourierFee)}</span></div>`
        : `<div class="delivery-card disabled" style="opacity: 0.55; pointer-events: none; background: #fafafa;"><span class="delivery-name" style="color: var(--gray-400);">🛵 Kurir Lokal Toko</span><span class="delivery-price" style="font-size: 0.72rem; color: #ef4444; font-weight: 700; margin-top:0.25rem;">⚠️ ${localCourierReason}</span></div>`;

    const pickupHtml = `<div class="delivery-card" id="shipping-ambil-sendiri" onclick="selectAmbilSendiri(this)"><span class="delivery-name">🏪 Ambil Sendiri di Warung</span><span class="delivery-price">Gratis (Rp 0)</span></div>`;

    deliveryGrid.innerHTML = warningHtml + localCourierHtml + pickupHtml;

    if (localCourierEligible) {
        const defaultEl = document.getElementById("shipping-kurir-toko");
        if (defaultEl) selectFallbackCourier('kurir-toko', shopLocalCourierFee, '🛵 Kurir Lokal Toko', defaultEl);
    } else {
        const defaultEl = document.getElementById("shipping-ambil-sendiri");
        if (defaultEl) selectAmbilSendiri(defaultEl);
    }
}

// =====================================================================
// PILIHAN KURIR
// =====================================================================
function selectBiteshipCourier(courierName, courierService, price, element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    hideShopPickupInfo();
    selectedShipping = {
        method: `${courierName} (${courierService.toUpperCase()})`,
        cost:   Number(price),
        name:   `${courierName.toUpperCase()} - ${courierService.toUpperCase()}`
    };
    updateCheckoutTotals();
}

function selectFallbackCourier(method, cost, name, element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    hideShopPickupInfo();
    selectedShipping = { method, cost: Number(cost), name };
    updateCheckoutTotals();
}

function selectAmbilSendiri(element) {
    document.querySelectorAll('#deliveryGrid .delivery-card').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedShipping = { method: "ambil-sendiri", cost: 0, name: "🏪 Ambil Sendiri di Warung" };
    showShopPickupInfo();
    updateCheckoutTotals();
}

function showShopPickupInfo() {
    const pickupBox   = document.getElementById("shopPickupInfo");
    const addressText = document.getElementById("shopPickupAddressText");
    const mapsLink    = document.getElementById("shopPickupGmapsLink");
    if (pickupBox) {
        if (addressText) addressText.innerText = shopAddress;
        if (mapsLink)    mapsLink.href         = shopGmapsLink;
        pickupBox.style.display = "block";
    }
}

function hideShopPickupInfo() {
    const pickupBox = document.getElementById("shopPickupInfo");
    if (pickupBox) pickupBox.style.display = "none";
}

// =====================================================================
// NAVIGASI TAB PETA (Interaktif vs Link)
// =====================================================================
function selectMapOption(option) {
    const tabInteractive  = document.getElementById("tabMapInteractive");
    const tabLink         = document.getElementById("tabMapLink");
    const sectionInteractive = document.getElementById("mapInteractiveSection");
    const sectionLink     = document.getElementById("mapLinkSection");
    const checkoutMap     = document.getElementById("checkoutMap");
    const linkPreviewContainer = document.getElementById("checkoutMapLinkPreviewContainer");

    if (!tabInteractive || !tabLink || !sectionInteractive || !sectionLink || !checkoutMap) return;

    if (option === 'interactive') {
        tabInteractive.style.background = "var(--primary)";
        tabInteractive.style.color      = "#fff";
        tabLink.style.background        = "#e2e8f0";
        tabLink.style.color             = "#475569";
        sectionInteractive.style.display = "block";
        sectionLink.style.display        = "none";
        checkoutMap.style.display        = "block";
        if (linkPreviewContainer) linkPreviewContainer.style.display = "none";
        setTimeout(() => { if (checkoutMapInstance) checkoutMapInstance.invalidateSize(); }, 120);
    } else {
        tabLink.style.background         = "var(--primary)";
        tabLink.style.color              = "#fff";
        tabInteractive.style.background  = "#e2e8f0";
        tabInteractive.style.color       = "#475569";
        sectionInteractive.style.display = "none";
        sectionLink.style.display        = "block";

        const mapsLinkInput = document.getElementById("customerMapsLink");
        if (mapsLinkInput && mapsLinkInput.value.trim() !== "") {
            checkoutMap.style.display = "block";
            if (linkPreviewContainer) linkPreviewContainer.style.display = "block";
        } else {
            checkoutMap.style.display = "none";
            if (linkPreviewContainer) linkPreviewContainer.style.display = "none";
        }
        setTimeout(() => { if (checkoutMapInstance) checkoutMapInstance.invalidateSize(); }, 120);
    }

    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.style.display = (checkoutMap.style.display === "block") ? "flex" : "none";
    }
}

// =====================================================================
// RESOLVER LINK GOOGLE MAPS (melalui Supabase Edge / PHP Proxy)
// =====================================================================
async function resolveGmapsLinkInput() {
    const urlInput = document.getElementById("customerMapsPasteInput");
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url) {
        alert("Harap tempel / paste link Google Maps Anda terlebih dahulu!");
        return;
    }

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

        customerCoords = { lat, lng };

        const mapsLinkInput = document.getElementById("customerMapsLink");
        if (mapsLinkInput) mapsLinkInput.value = url;

        const checkoutMap = document.getElementById("checkoutMap");
        const linkPreviewContainer = document.getElementById("checkoutMapLinkPreviewContainer");
        if (checkoutMap) checkoutMap.style.display = "block";
        if (linkPreviewContainer) linkPreviewContainer.style.display = "block";

        if (checkoutMapInstance) {
            checkoutMapInstance.setView([lat, lng], 16);
            if (checkoutMarkerInstance) checkoutMarkerInstance.setLatLng([lat, lng]);
            setTimeout(() => { checkoutMapInstance.invalidateSize(); }, 120);
        }

        isLocationConfirmed = false;

        const btnConfirm = document.getElementById("btnConfirmLocation");
        if (btnConfirm) {
            btnConfirm.style.display = "flex";
            btnConfirm.innerHTML     = "📍 Konfirmasi Lokasi & Cek Ongkir";
            btnConfirm.style.background = "var(--primary)";
            btnConfirm.style.color   = "white";
            btnConfirm.style.cursor  = "pointer";
        }

        renderLocationPendingPlaceholder();
        showToast("✔️ Lokasi Google Maps terhubung! Silakan klik tombol konfirmasi di bawah.");
    } catch (err) {
        console.error("Gmaps link resolution error:", err);
        alert(err.message || "Gagal memproses link! Silakan gunakan metode pinpoint manual.");
    }
}

// =====================================================================
// DOMContentLoaded: Listener Konfirmasi Lokasi & Filter Pelanggan
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    const btnConfirm = document.getElementById("btnConfirmLocation");
    if (btnConfirm) {
        btnConfirm.addEventListener("click", () => {
            if (!customerCoords || !customerCoords.lat || !customerCoords.lng) {
                showToast("❌ Silakan pilih lokasi Anda terlebih dahulu!");
                return;
            }

            isLocationConfirmed = true;
            btnConfirm.innerHTML    = "✔️ Lokasi Terkonfirmasi";
            btnConfirm.style.background = "#059669";
            btnConfirm.style.color   = "white";
            btnConfirm.style.cursor  = "default";

            showToast("⏳ Mengambil tarif pengiriman...");
            fetchBiteshipRates(customerCoords.lat, customerCoords.lng);
        });
    }

    // Filter status riwayat pesanan pelanggan
    const customerFilterContainer = document.getElementById("ordersFilterContainer");
    if (customerFilterContainer) {
        const filterButtons = customerFilterContainer.querySelectorAll(".filter-status-btn");
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

                currentCustomerFilter = btn.getAttribute("data-status");

                const savedProfile = JSON.parse(localStorage.getItem("mbokde_customer_profile"));
                const wa = savedProfile ? savedProfile.whatsapp : "";
                if (wa) applyCustomerOrdersFilter(wa);
            });
        });
    }
});
