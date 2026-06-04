# Nibokuu Anime Scraper API 🚀

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vercel](https://img.shields.io/badge/Platform-Vercel-black?logo=vercel)](https://vercel.com/)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black?logo=nextjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Puppeteer](https://img.shields.io/badge/Scraping-Puppeteer%20%26%20Cheerio-lightgrey?logo=puppeteer)](https://pptr.dev/)

Nibokuu Anime Scraper API adalah portal API scraper anime berkinerja tinggi yang dibangun di atas Next.js (App Router), TypeScript, Puppeteer (dengan Stealth plugin), dan Cheerio. Aplikasi ini dilengkapi dengan Edge-caching, Request Coalescing (Single Flight), penyesuaian domain dinamis (Domain Resolver), serta Developer Monitor Dashboard premium untuk melacak statistik server secara real-time.

---

## 📌 Fitur Utama

1. **Dynamic Domain Resolver:** Secara otomatis memperbarui domain target Samehadaku melalui deteksi halaman mendarat (landing page) untuk mencegah kegagalan akibat domain provider yang sering diblokir atau diubah.
2. **Server-Side Puppeteer Scraping:** Menembus proteksi Cloudflare dan JavaScript-heavy sites menggunakan instansi browser Puppeteer di latar belakang dengan user agent kustom dan penanganan kegagalan otomatis.
3. **Interactive API Sandbox:** Halaman utama (`/`) memiliki area sandbox interaktif berdesain premium untuk membangun parameter request secara visual dan menampilkan hasil output JSON secara real-time.
4. **Multi-tier Caching System:** Penyimpanan cache data di server-side yang terintegrasi dengan Firebase Realtime Database (atau Vercel KV/Redis) untuk menyinkronkan data antar-kontainer dan mengurangi overhead beban ke situs target.
5. **Single-Flight Request Coalescing:** Menjamin bahwa ketika beberapa pengguna meminta data scraping yang sama secara bersamaan, server hanya akan meluncurkan satu instansi browser Chrome (menghindari duplikasi spawn dan penghematan memori RAM).
6. **Developer Monitor Dashboard (`/monitor`):** Telemetry dashboard real-time yang memantau hitungan request, rasio cache hit, status database, grafik interaktif, dan visual log transaksi server secara live.

---

## ⚙️ Persyaratan Sistem

- **Node.js** >= 18.x
- **npm** atau **yarn** / **pnpm**
- Akun **Firebase** (untuk Realtime Database gratis) atau **Vercel KV** (Redis) untuk mencatat log aktivitas developer (opsional, jika kosong sistem akan menggunakan memori lokal RAM sebagai fallback).

---

## 🚀 Panduan Memulai & Menjalankan Aplikasi

### 1. Kloning Repositori
```bash
git clone https://github.com/username/anime-scraper-api.git
cd anime-scraper-api
```

### 2. Instalasi Dependensi
```bash
npm install
```
*Catatan: Proses ini juga akan mengunduh paket Puppeteer beserta biner Chrome yang sesuai.*

### 3. Konfigurasi Environment Variables
Salin file template `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Buka file `.env.local` dan isi nilainya secara aman:
```env
# Firebase Realtime Database Configuration
# Hubungkan ke Realtime Database Anda (Region Default atau Singapore)
FIREBASE_DATABASE_URL=https://nama-database-anda.firebaseio.com/

# (Opsional) Jika database Anda diproteksi dengan read/write rules secret:
FIREBASE_DATABASE_SECRET=rahasia-token-firebase-anda

# Secret Key untuk masuk ke Dashboard Developer Monitor (?key=...)
# Contoh: http://localhost:3000/monitor?key=kunciRahasiaAnda
ADMIN_SECRET_KEY=kunciRahasiaMonitorAnda

# Remote Puppeteer Browser URL (Wajib untuk Vercel / Serverless hosting)
# Contoh: wss://chrome.browserless.io?token=KUNCI-API-ANDA
REMOTE_BROWSER_URL=
```

### 4. Jalankan Development Server
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda untuk melihat Landing Page & API Sandbox.

### 5. Bangun untuk Produksi (Build & Start)
```bash
npm run build
npm run start
```

---

## 🛡️ Panduan Kolaborasi Git yang Aman

Untuk bekerja sama dengan tim developer lain secara aman dan menjaga agar kredensial API tidak bocor ke publik:

1. **Jangan Pernah Commit File Lingkungan Lokal:** File `.env.local` dan `.env` sudah secara otomatis dikecualikan di dalam file `.gitignore`. Pastikan Anda tidak menghapus baris tersebut.
2. **Gunakan `.env.example` sebagai Referensi:** Jika Anda menambahkan variabel lingkungan baru pada kode sumber Anda, tulis nama variabel tersebut beserta nilai dummy pada file [.env.example](file:///.env.example) dan commit perubahan file tersebut ke Git.
3. **Alur Kerja Git Branching:**
   - Gunakan branch `master` atau `main` sebagai branch stabil untuk deployment.
   - Buat branch baru untuk setiap fitur atau perbaikan bug: `git checkout -b feature/nama-fitur` atau `git checkout -b bugfix/nama-bug`.
   - Lakukan Pull Request (PR) ke branch utama setelah memastikan build produksi lolos secara lokal (`npm run build`).
4. **Deploy Aman di Cloud (Vercel / Heroku / VPS):**
   - Masukkan environment variables (`FIREBASE_DATABASE_URL`, `ADMIN_SECRET_KEY`, dll.) pada pengaturan panel dashboard hosting Anda (Vercel Project Settings > Environment Variables), **jangan** dimasukkan ke dalam kode atau repositori.

---

## 🛰️ Referensi Rute API (REST API Reference)

Semua respons API dikembalikan dalam format JSON standard.

### 1. Get Recent Updates
Mengambil daftar anime rilis terbaru.
- **Rute:** `GET /api/recent`
- **Cache CDN:** 5 Menit (`s-maxage=300`)
- **Contoh Respons:**
  ```json
  {
    "status": "success",
    "project": "Nibokuu API",
    "total_data": 20,
    "data": [
      {
        "title": "One Piece Episode 1110",
        "episode": "1110",
        "thumbnail": "https://img.samehadaku.vip/cover.jpg",
        "link": "https://samehadaku.email/one-piece-episode-1110/"
      }
    ]
  }
  ```

### 2. Get Filtered Anime List (Daftar Anime)
Mengambil daftar seluruh anime yang ada dengan opsi pencarian filter yang lengkap.
- **Rute:** `GET /api/anime`
- **Parameter Query (Opsional):**
  - `title` (string): Kata kunci judul anime.
  - `status` (string): Filter status rilis (`ongoing`, `completed`).
  - `type` (string): Filter tipe anime (`tv`, `movie`, `special`, `ova`, `ona`).
  - `order` (string): Pengurutan data (`title`, `title-asc`, `update`, `popular`, `score`).
  - `genres` (string): Daftar genre dipisahkan tanda koma (contoh: `action,adventure,fantasy`).
  - `page` (number): Halaman pagination (default: `1`).
- **Cache CDN:** 4 Jam (`s-maxage=14400`)
- **Contoh Request:** `/api/anime?status=ongoing&type=tv&genres=action,fantasy&page=1`

### 3. Search Anime (Pencarian Cepat)
Melakukan pencarian anime berdasarkan kata kunci nama.
- **Rute:** `GET /api/search`
- **Parameter Query:**
  - `q` (string, **Wajib**): Kata kunci judul anime yang ingin dicari.
- **Cache CDN:** 24 Jam (`s-maxage=86400`)
- **Contoh Request:** `/api/search?q=naruto`

### 4. Get Episode & Download Details
Mengambil informasi lengkap suatu episode atau halaman anime, termasuk link streaming iframe, server alternatif (mirrors), daftar kualitas file download, dan daftar episode.
- **Rute:** `GET /api/episode`
- **Parameter Query:**
  - `url` (string, **Wajib**): URL target absolut halaman Samehadaku (diambil dari bidang `link` endpoint `/api/recent` atau `/api/anime`).
- **Cache CDN:** 24 Jam (`s-maxage=86400`)
- **Contoh Request:** `/api/episode?url=https://samehadaku.email/one-piece-episode-1110/`

### 5. Get Batch Downloads
Mengambil daftar rilis anime Batch (unduhan paket penuh seluruh episode dalam satu file).
- **Rute:** `GET /api/batch`
- **Parameter Query (Opsional):**
  - `page` (number): Halaman pagination (default: `1`).
- **Cache CDN:** 4 Jam (`s-maxage=14400`)

### 6. Get Release Schedule (Jadwal Rilis)
Mengambil jadwal rilis mingguan anime.
- **Rute:** `GET /api/schedule`
- **Parameter Query (Opsional):**
  - `day` (string): Hari tertentu (`monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`). Jika dikosongkan, API akan mengembalikan daftar seluruh hari yang dikelompokkan secara terstruktur.
- **Cache CDN:** 4 Jam (`s-maxage=14400`)

### 7. Get Download Mirror Size (Deteksi Ukuran File)
Mengambil ukuran file (file size) dari tautan mirror download pihak ketiga secara dinamis.
- **Rute:** `GET /api/mirror-size`
- **Parameter Query:**
  - `url` (string, **Wajib**): Tautan mirror download target (saat ini mendukung: `krakenfiles.com`, `acefile.co`, dan `mediafire.com`).
- **Contoh Request:** `/api/mirror-size?url=https://krakenfiles.com/view/xxxxxxxxx/file.html`

### 8. System Monitor & Telemetry Statistics
- **Rute Admin (Wajib Key):** `GET /api/monitor/stats?key=ADMIN_SECRET_KEY`
  - Menyediakan ringkasan log server lengkap dan metrik cache untuk Developer Dashboard.
- **Rute Publik (Bebas Akses):** `GET /api/monitor/public-stats`
  - Menyediakan status sistem umum yang aman (tidak mengekspos log transaksi pengguna/pengembang lain).

---

## 📊 Developer Monitor Dashboard

Anda dapat mengakses panel admin monitor real-time dengan mengunjungi rute halaman berikut pada browser Anda:
```
http://localhost:3000/monitor?key=ADMIN_SECRET_KEY
```
*Ganti `ADMIN_SECRET_KEY` dengan kunci rahasia yang Anda tetapkan pada `.env.local`.*

### Fitur Dashboard Monitor:
- **Metrics Grid:** Memperlihatkan Total Requests, Cache Hit Ratio, Success Requests (2xx/3xx), dan Failed Requests (4xx/5xx).
- **Active Provider Domain Status:** Menampilkan domain target penyedia data yang sedang aktif digunakan dan di-resolve oleh server.
- **Real-Time Request Logger:** Menampilkan tabel log aktivitas HTTP server yang mencakup metode, path rute, kode status (status code), latensi pengerjaan dalam milidetik (`ms`), stempel waktu waktu lokal, serta indikator status cache hit/miss.

---

## 🎨 Catatan Panduan Visual & Desain Kode (Untuk Kontributor)

Bagi developer yang ingin berkontribusi memodifikasi antarmuka visual (UI) Nibokuu:

1. **Estetika Mode Gelap Premium:** Konsisten menggunakan warna latar belakang gelap `#0a0a0a` untuk kanvas utama, `#121212` untuk kartu kontainer, dan `#222222` / `#262626` untuk pembatas garis tipis.
2. **Locking Scrollbar Dashboard:** Dashboard monitor (`/monitor`) dirancang sebagai aplikasi satu layar penuh (*fit-to-viewport*). Gunakan React `useEffect` untuk menyembunyikan scrollbar global hanya saat halaman monitor aktif untuk menjaga kegunaan tata letak.
3. **Gunakan CustomSelect Dropdown:** Untuk menjaga konsistensi visual gelap, hindari elemen `<select>` bawaan HTML. Gunakan modul dropdown kustom yang telah dibuat menggunakan state trigger tombol React.
4. **Scrolling Halus:** Halaman dokumentasi utama didesain untuk kenyamanan pembaca dengan scrollbar tipis kustom berukuran `6px` yang diatur pada file CSS global.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **Lisensi MIT** - lihat file [LICENSE](Nibokuu/anime-scraper-api/LICENSE) untuk informasi lebih detail.
