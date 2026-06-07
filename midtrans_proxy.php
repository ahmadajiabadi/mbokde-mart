<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Bypass preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Membaca status environment (Is Production) dari config.js
$config_file = "config.js";
$is_production = false;

if (file_exists($config_file)) {
    $config_content = file_get_contents($config_file);
    if (preg_match('/MIDTRANS_IS_PRODUCTION\s*=\s*(true|false)/', $config_content, $matches)) {
        $is_production = ($matches[1] === 'true');
    }
}

// Memuat kunci server secara aman dari file konfigurasi PHP lokal
$config_private_file = "midtrans_config.php";
$server_key = "";

if (file_exists($config_private_file)) {
    include($config_private_file);
} else {
    // Fallback jika file midtrans_config.php belum dibuat
    $sandbox_server_key = "Mid-server-iWWMlnTjKSPTsKRiWA55Qxdy";
    $production_server_key = "MASUKKAN_SERVER_KEY_PRODUKSI_ANDA_DI_SINI";
    $server_key = $is_production ? $production_server_key : $sandbox_server_key;
}

// Cek jika key masih menggunakan placeholder default atau kosong
if (empty($server_key) || strpos($server_key, "MASUKKAN_SERVER_KEY_PRODUKSI_ANDA_DI_SINI") !== false) {
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "message" => "Harap masukkan Server Key Midtrans Anda terlebih dahulu di midtrans_config.php!"
    ]);
    exit;
}

// Mendapatkan data input dari frontend
$raw_input = file_get_contents('php://input');
$data = json_decode($raw_input, true);

$order_id = isset($data['order_id']) ? trim($data['order_id']) : '';
$gross_amount = isset($data['gross_amount']) ? intval($data['gross_amount']) : 0;
$first_name = isset($data['first_name']) ? trim($data['first_name']) : 'Pelanggan';
$phone = isset($data['phone']) ? trim($data['phone']) : '';
$enabled_payments = isset($data['enabled_payments']) ? $data['enabled_payments'] : null;

if (empty($order_id) || $gross_amount <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Parameter order_id atau gross_amount tidak valid."]);
    exit;
}

// Payload request sesuai standard API Midtrans Snap
$payload = [
    "transaction_details" => [
        "order_id" => $order_id,
        "gross_amount" => $gross_amount
    ],
    "credit_card" => [
        "secure" => true
    ],
    "customer_details" => [
        "first_name" => $first_name,
        "phone" => $phone
    ]
];

// Sematkan filter enabled_payments jika dikirim dari frontend
if (!empty($enabled_payments) && is_array($enabled_payments)) {
    $payload['enabled_payments'] = $enabled_payments;
}

// Endpoint URL dependent on environment
$url = $is_production 
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

$auth_string = base64_encode($server_key . ":");

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Accept: application/json",
    "Authorization: Basic " . $auth_string
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($http_code);
echo $response;
