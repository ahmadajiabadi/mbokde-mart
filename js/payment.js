// =====================================================================
// js/payment.js — MODUL INTEGRASI PEMBAYARAN
// Tanggung jawab: Midtrans Snap SDK, polling status, simulasi pembayaran.
// Dependensi: config.js (currentOrder, MIDTRANS_CLIENT_KEY, SUPABASE_KEY),
//             utils.js (showToast),
//             checkout-stage.js (navigateToStage, savePaymentSession)
// =====================================================================

let paymentPollingInterval = null;

// =====================================================================
// POLLING STATUS PEMBAYARAN (SUPABASE REALTIME CALLBACK)
// =====================================================================
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
    }, 3000); // Polling setiap 3 detik
}

function stopPaymentPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
        console.log("🛑 Polling status pembayaran dihentikan.");
    }
}

// =====================================================================
// SIMULASI PEMBAYARAN (Untuk testing)
// =====================================================================
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

// =====================================================================
// MIDTRANS SNAP SDK — LOAD & DESTROY
// =====================================================================
function loadMidtransSnapLibrary() {
    return new Promise((resolve, reject) => {
        if (window.snap) return resolve();

        const isProd      = typeof MIDTRANS_IS_PRODUCTION !== 'undefined' ? MIDTRANS_IS_PRODUCTION : false;
        const clientKey   = typeof MIDTRANS_CLIENT_KEY !== 'undefined' ? MIDTRANS_CLIENT_KEY : "";

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
    document.querySelectorAll('script').forEach(script => {
        if (script.src && (
            script.src.includes("snap.js") ||
            script.src.includes("snap.sandbox.midtrans.com") ||
            script.src.includes("app.midtrans.com/snap")
        )) {
            script.remove();
            console.log("🗑️ SDK Midtrans Snap lama dibersihkan dari dokumen.");
        }
    });
}

// =====================================================================
// MIDTRANS SNAP INLINE EMBED
// =====================================================================
async function triggerMidtransInlinePayment(paymentType, bankType = "") {
    if (!currentOrder || !currentOrder.id) return;

    destroyMidtransSnapLibrary();

    const snapLoading   = document.getElementById("snap-loading");
    const snapContainer = document.getElementById("snap-container");

    if (snapLoading) snapLoading.style.display = "block";
    if (snapContainer) snapContainer.innerHTML = ""; // Bersihkan embed sebelumnya

    try {
        await loadMidtransSnapLibrary();

        if (!window.snap) {
            if (snapLoading) snapLoading.style.display = "none";
            alert("Gagal memuat SDK pembayaran Midtrans. Harap periksa Client Key Anda di config.js.");
            return;
        }

        // Definisikan suffix dan filter saluran pembayaran
        let suffix = "";
        let enabledPayments = [];
        if (paymentType === "qris") {
            suffix = "-Q";
            enabledPayments = ["gopay", "shopeepay", "other_qris"];
        } else if (paymentType === "va") {
            suffix = "-V-" + bankType.toUpperCase();
            if (bankType === "bca")      enabledPayments = ["bca_va"];
            else if (bankType === "mandiri") enabledPayments = ["echannel", "mandiri_va"];
            else if (bankType === "bri")  enabledPayments = ["bri_va"];
            else if (bankType === "bni")  enabledPayments = ["bni_va"];
            else if (bankType === "permata") enabledPayments = ["permata_va"];
        }

        const midtransOrderId = currentOrder.id + suffix + "-" + (currentOrder.amountVersion || 1);
        const cacheKey = paymentType === "qris" ? "qrisToken" : "vaToken_" + bankType;

        // Gunakan token cache jika sudah ada
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
            currentOrder[cacheKey] = token;
            if (typeof savePaymentSession === "function") savePaymentSession();
            console.log(`✔️ Token untuk ${paymentType.toUpperCase()} ${bankType.toUpperCase()} berhasil disimpan: ${token}`);
        } else {
            console.log(`⚡ Menggunakan kembali token dari cache untuk ${paymentType.toUpperCase()} ${bankType.toUpperCase()}: ${token}`);
        }

        if (snapLoading) snapLoading.style.display = "none";

        // Render Snap inline di snap-container
        window.snap.embed(token, {
            embedId: "snap-container",
            onSuccess: async function(snapResult) {
                showToast("✔️ Pembayaran Berhasil!");
                const finalStatus  = "Lunas";
                const methodLabel  = paymentType.toUpperCase() + (bankType ? " - " + bankType.toUpperCase() : "");

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
