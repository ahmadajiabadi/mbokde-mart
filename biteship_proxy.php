<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Bypass preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 1. ACTION: RESOLVE GOOGLE MAPS LINK TO COORDINATES
if (isset($_GET['action']) && $_GET['action'] === 'resolve') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(["success" => false, "message" => "Method not allowed"]);
        exit;
    }

    $raw_input = file_get_contents('php://input');
    $data = json_decode($raw_input, true);
    $gmaps_url = isset($data['url']) ? trim($data['url']) : '';

    if (empty($gmaps_url)) {
        echo json_encode(["success" => false, "message" => "Google Maps URL is empty"]);
        exit;
    }

    // Ikuti redirect cURL untuk memecahkan URL pendek (maps.app.goo.gl) ke URL panjang
    $ch = curl_init($gmaps_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    $response = curl_exec($ch);
    $final_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);

    // Coba cari koordinat menggunakan beberapa pola regex Google Maps
    $lat = null;
    $lng = null;

    // Pola 1: @-6.1828405,106.6853165
    if (preg_match('/@(-?\d+\.\d+),(-?\d+\.\d+)/', $final_url, $matches)) {
        $lat = floatval($matches[1]);
        $lng = floatval($matches[2]);
    } 
    // Pola 2: query=-6.1828405,106.6853165
    elseif (preg_match('/query=(-?\d+\.\d+),(-?\d+\.\d+)/', $final_url, $matches)) {
        $lat = floatval($matches[1]);
        $lng = floatval($matches[2]);
    } 
    // Pola 3: !3d-6.1828405!4d106.6853165 (Bentuk link bagikan Mbokde Mart)
    elseif (preg_match('/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/', $final_url, $matches)) {
        $lat = floatval($matches[1]);
        $lng = floatval($matches[2]);
    }

    if ($lat !== null && $lng !== null) {
        echo json_encode([
            "success" => true,
            "latitude" => $lat,
            "longitude" => $lng,
            "resolved_url" => $final_url
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Gagal mengekstrak koordinat GPS dari link Google Maps tersebut.",
            "resolved_url" => $final_url
        ]);
    }
    exit;
}

// 2. ACTION: GET BITESHIP RATES (DEFAULT ACTION)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

$api_key = "biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiTWJva2RlIE1hcnQgVGVzdGluZyIsInVzZXJJZCI6IjZhMTk5ZDY2OWI2MGVhMWFjMjE2MjkzYyIsImlhdCI6MTc4MDA2NTg3OH0.FOHsrmXc1dEU6j3uP43O8pjQ2znyO_etkyX-9p7ucR0";
$url = "https://api.biteship.com/v1/rates/couriers";
$raw_body = file_get_contents("php://input");

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $raw_body);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: " . $api_key,
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($http_code);
echo $response;
