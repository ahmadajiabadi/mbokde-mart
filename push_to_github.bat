@echo off
title GitHub Uploader - Mbokde Mart
color 0b

echo ====================================================================
echo                GITHUB UPLOADER - MBOKDE MART
echo ====================================================================
echo.
echo Langkah ini akan membantu Anda mengunggah kode Mbokde Mart
echo ke repository GitHub Anda dengan aman.
echo.
echo ====================================================================
echo.

:: 1. Inisialisasi Git
if not exist ".git" (
    echo [Langkah 1] Menginisialisasi repositori Git lokal...
    git init
    git branch -M main
) else (
    echo Repositori Git lokal sudah diinisialisasi.
)
echo.

:: 2. Set Konfigurasi Identitas Git Lokal (jika belum ada)
git config user.name >nul 2>&1
if %errorlevel% neq 0 (
    echo [Langkah 2] Konfigurasi Identitas Git
    set /p GIT_USER="Masukkan nama user GitHub Anda: "
    set /p GIT_EMAIL="Masukkan email GitHub Anda: "
    git config --local user.name "%GIT_USER%"
    git config --local user.email "%GIT_EMAIL%"
)
echo.

:: 3. Tambahkan File & Commit
echo [Langkah 3] Menambahkan file dan membuat Commit...
git add .
git commit -m "Level up: Dark Mode, mobile scroll fix, dan peningkatan UI/UX premium"
echo.

:: 4. Hubungkan ke GitHub & Push
echo [Langkah 4] Konfigurasi Remote & Pushing...
echo.
echo Repository URL Anda: https://github.com/ahmadajiabadi/mbokde-mart.git
echo.
echo Demi keamanan (agar token tidak dinonaktifkan otomatis oleh GitHub Secret Scanning),
echo silakan tempel (paste) Personal Access Token (PAT) Anda di bawah ini.
echo.
set /p GH_TOKEN="Masukkan Github Token Anda (ghp_...): "
if "%GH_TOKEN%"=="" (
    echo.
    echo [Eror] Token tidak boleh kosong. Proses dibatalkan.
    pause
    exit /b
)

:: Hapus origin lama jika ada
git remote remove origin >nul 2>&1

:: Tambahkan remote origin baru dengan token tersemat
git remote add origin https://%GH_TOKEN%@github.com/ahmadajiabadi/mbokde-mart.git

echo.
echo Mengunggah file ke GitHub (Cabang main)...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ====================================================================
    echo [SELESAI] Kode Mbokde Mart berhasil diunggah ke GitHub!
    echo ====================================================================
) else (
    echo.
    echo [Gagal] Terjadi kesalahan saat mengunggah. Pastikan token Anda valid dan memiliki izin write.
)
echo.
pause
