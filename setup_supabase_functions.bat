@echo off
title Supabase Edge Functions Deployer - Mbokde Mart
color 0a

echo ====================================================================
echo          SUPABASE EDGE FUNCTIONS DEPLOYER - MBOKDE MART
echo ====================================================================
echo.
echo Langkah ini akan membantu Anda mengonfigurasi dan mengunggah 
echo jembatan keamanan (Biteship ^& Midtrans Proxy) langsung ke 
echo akun Supabase Anda secara aman dan gratis.
echo.
echo ====================================================================
echo.

:GET_ACCESS_TOKEN
echo [Langkah 1] Konfigurasi Otentikasi Supabase
echo Untuk menghindari kendala hak akses terminal, silakan buat dan
echo masukkan Supabase Personal Access Token Anda.
echo.
echo Cara membuat token:
echo 1. Buka browser ke: https://supabase.com/dashboard/account/tokens
echo 2. Klik "Generate new token", beri nama bebas, lalu SALIN tokennya.
echo 3. Tempel (Paste) token tersebut di bawah ini.
echo.
set /p SUPABASE_ACCESS_TOKEN="Tempel Supabase Access Token Anda (sbp_...): "
if "%SUPABASE_ACCESS_TOKEN%"=="" (
    echo.
    echo [Eror] Token tidak boleh kosong. Silakan jalankan ulang aplikasi.
    pause
    exit /b
)
echo.
echo Access Token berhasil dikonfigurasi secara lokal untuk sesi ini!
echo.
echo ====================================================================
echo.

:INIT_PROJECT
echo [Langkah 2] Menginisialisasi Konfigurasi Lokal...
if not exist "supabase\config.toml" (
    call npx supabase init
) else (
    echo Konfigurasi lokal sudah ada. Melewati...
)
echo.

:SET_SECRETS
echo [Langkah 3] Menyimpan Kunci API Rahasia ke Supabase Cloud (Sangat Aman)...
echo.
echo Mengirim kunci Biteship ^& Midtrans Sandbox...
call npx supabase secrets set BITESHIP_API_KEY="biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiTWJva2RlIE1hcnQgVGVzdGluZyIsInVzZXJJZCI6IjZhMTk5ZDY2OWI2MGVhMWFjMjE2MjkzYyIsImlhdCI6MTc4MDA2NTg3OH0.FOHsrmXc1dEU6j3uP43O8pjQ2znyO_etkyX-9p7ucR0" --project-ref gyowwceoycbwegogxxrk
call npx supabase secrets set MIDTRANS_SERVER_KEY_SANDBOX="Mid-server-iWWMlnTjKSPTsKRiWA55Qxdy" --project-ref gyowwceoycbwegogxxrk
call npx supabase secrets set MIDTRANS_IS_PRODUCTION="false" --project-ref gyowwceoycbwegogxxrk

echo.
echo Kunci keamanan Sandbox berhasil disimpan!
echo.
echo PENTING: Sangat direkomendasikan untuk memasukkan kunci Produksi sekarang
echo agar sistem nanti bisa langsung diganti ke mode Go-Live hanya dengan
echo mengubah satu saklar di config.js.
echo.
echo Berdasarkan dasbor Midtrans Anda:
echo Silakan siapkan Kunci Produksi Anda.
echo.
set /p set_prod="Apakah Anda ingin mendaftarkan kunci Produksi ini sekarang? (y/n): "
if /i "%set_prod%"=="y" (
    set /p PROD_KEY="Masukkan Midtrans Production Server Key Anda (Mid-server-...): "
    call npx supabase secrets set MIDTRANS_SERVER_KEY_PROD="%PROD_KEY%" --project-ref gyowwceoycbwegogxxrk
    echo Kunci produksi berhasil disimpan di Supabase!
)
echo.
echo ====================================================================
echo.

:DEPLOY_FUNCTIONS
echo [Langkah 4] Mengunggah (Deploy) Edge Functions ke Supabase Cloud...
echo.
echo Mengunggah biteship-proxy...
call npx supabase functions deploy biteship-proxy --project-ref gyowwceoycbwegogxxrk --no-verify-jwt
echo.
echo Mengunggah midtrans-proxy...
call npx supabase functions deploy midtrans-proxy --project-ref gyowwceoycbwegogxxrk --no-verify-jwt
echo.
echo ====================================================================
echo.
echo [SELESAI] Semua fungsi sukses dideploy!
echo.
echo Silakan ubah BACKEND_URL di config.js menjadi:
echo "https://gyowwceoycbwegogxxrk.supabase.co/functions/v1/"
echo.
echo Sekarang Anda sudah bisa mengaktifkan mode otomatis sepenuhnya di GitHub Pages!
echo.
pause
