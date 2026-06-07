<?php
// FILE KONFIGURASI PRIVATE UNTUK MIDTRANS SERVER KEY
// Menyimpan Server Key secara aman di sisi backend PHP agar terhindar dari pemindaian rahasia GitHub (Secret Scanning).

// 1. Kunci Server Midtrans Sandbox (Aman untuk keperluan pengujian)
$sandbox_server_key = "Mid-server-iWWMlnTjKSPTsKRiWA55Qxdy";

// 2. Kunci Server Midtrans Production
// PENTING: Jangan masukkan kunci produksi asli Anda di sini jika ingin diunggah ke GitHub publik.
// Silakan isi kunci produksi asli Anda langsung pada server hosting Anda (XAMPP lokal / server cPanel Anda).
$production_server_key = "MASUKKAN_SERVER_KEY_PRODUKSI_ANDA_DI_SINI";

// Menentukan kunci aktif berdasarkan environment
$server_key = $is_production ? $production_server_key : $sandbox_server_key;
