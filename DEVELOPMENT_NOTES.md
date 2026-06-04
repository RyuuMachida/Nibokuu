# Catatan Arsitektur & Panduan Pengembangan Nibokuu API

Dokumen ini berisi rangkuman keputusan desain, arsitektur backend, kustomisasi visual, serta solusi masalah (gotchas) yang sering terlupakan selama pengembangan portal Nibokuu.

---

## 1. Panduan Visual & Desain UI Premium
- **Skema Warna Dark-Mode:** Selalu gunakan warna dasar `#0a0a0a` untuk kanvas utama, `#121212` untuk kartu/kontainer, `#222222` / `#262626` untuk border tipis, dan `#fafafa` / `#a3a3a3` untuk kontras teks.
- **Kustomisasi Dropdown (CustomSelect):** Jangan menggunakan tag bawaan `<select>` HTML karena visual drop-down bawaan browser (OS default) merusak estetika antarmuka gelap. Gunakan komponen `CustomSelect` kustom berbasis tombol, SVG chevron, dan menu absolut dengan state React.
- **Tinggi Symmetrical Sandbox:** Area Interactive API Sandbox di halaman utama (`/`) memadukan parameter builder dinamis (`h-auto` / tanpa tinggi tetap) di kiri dengan Response Console berukuran tetap (`lg:h-[430px]`) di kanan. Parameter builder dilengkapi panel "Endpoint Info" & "Request Path Preview" interaktif untuk menghilangkan kekosongan visual, dan diatur dengan `p-5` padding agar spasi bawah tombol selalu simetris dan tombol tidak meluber keluar dari kartu.
- **Desain Responsif Mobile Ultra-Compact:** Untuk layar HP/mobile, hindari teks raksasa, gap terlalu renggang, atau padding tebal. Kurangi gap layout utama dari `gap-24` ke `gap-10 sm:gap-16`, perkecil heading utama dari `text-4xl` ke `text-2xl sm:text-4xl`, serta atur elemen statistik dan status komponen agar otomatis bertransisi menjadi **2 kolom responsif** (`grid-cols-2`) daripada menumpuk 1 kolom memanjang.


---

## 2. Pengelolaan Scrollbar & Viewport
- **Landing Page vs Dashboard:** 
  - Halaman utama `/` membutuhkan scrollbar untuk membaca dokumentasi dan FAQ.
  - Dashboard monitor `/monitor` dirancang fit-to-viewport (`h-screen overflow-hidden`) untuk meniadakan scrollbar halaman utama.
- **Solusi Locking Dinamis:** Jangan mengunci overflow pada CSS global `html, body`. Sebagai gantinya, gunakan React `useEffect` di [page.tsx (monitor)](file:///c:/INFOKOM/project/Nibokuu/anime-scraper-api/app/monitor/page.tsx) untuk mengunci overflow saat mounting dan mengembalikannya ke normal saat unmounting:
  ```tsx
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, []);
  ```
- **Scrollbar Kustom Tipis:** Diatur di [globals.css](file:///c:/INFOKOM/project/Nibokuu/anime-scraper-api/app/globals.css) dengan lebar `6px`, thumb rounded, dan warna gelap menyatu untuk mengganti scrollbar default browser yang tebal dan kontras.

---

## 3. Optimasi Latensi & Caching (Bypass Block)
- **Edge Cache & Firebase Sync:** Caching berlapis menggunakan Edge CDN Cache Control (5 menit untuk `/api/recent`, 4 jam untuk anime list/jadwal, 24 jam untuk detail/episode). Database Firebase menyinkronkan data cache antar-container.
- **Single Flight Coalescing:** Setiap request scraping browser dibungkus fungsi `coalesceScrape` untuk memetakan request kembar yang sedang berjalan. Menghindari spawn Puppeteer duplikat saat halaman di-refresh berkali-kali secara tidak sengaja.
- **Dynamic AJAX Video Resolver:** Mirror player Samehadaku di-resolve asinkron di server-side via AJAX calls `/wp-admin/admin-ajax.php` dengan parameter `action=player_ajax` di Puppeteer untuk memecahkan iframe asli (Blogger, Wibufile, Mega, dsb.) sebelum dikembalikan ke dashboard.
- **Firestore DB Capped Query:** Untuk optimasi bandwidth dan biaya gratis Firebase, query history log selalu dibatasi di server-side menggunakan cap `limitToLast=20` serta increment atomic `ServerValue.increment` agar hitungan berhasil/gagal tidak mengalami race condition.
