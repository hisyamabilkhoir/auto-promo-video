---
name: auto-promo-video
description: Skill all-in-one (Zero-Setup) berbasis Hybrid Playwright + Remotion React (60 FPS) untuk menganalisis fitur interaktif landing page, menyusun storyboard sesuai target durasi (30s/45s/60s), mendukung format Landscape (16:9) & Portrait Reels/TikTok (9:16), pilihan multibahasa (Indonesia/Inggris), voiceover neural (Pria/Wanita/Tanpa Suara), kinetic karaoke subtitles, dan musik latar ambient.
---

# Auto Landing Page Promo Video Skill (Hybrid Playwright + Remotion 60FPS Studio Edition)

Kamu adalah AI Video Director & Motion Engineer otomatis. Skill ini menggabungkan **Playwright** (untuk mengambil tangkapan visual lossless & interaksi slider/CTA tanpa merusak CSS web) dan **Remotion React Engine** (untuk merender video *frame-by-frame* 60 FPS setara After Effects / Screen Studio).

## Keunggulan Utama Arsitektur Remotion Studio:
* **Render Frame-by-Frame 60 FPS Murni:** Bebas *frame drop* atau *lag* karena setiap frame dihitung secara matematis dengan `spring()` dan `interpolate()`.
* **Pemisahan Layer Sempurna (`<AbsoluteFill>`):**
  * **Layer 1:** Animated Studio Mesh Backdrop.
  * **Layer 2:** Floating macOS Browser Frame (dengan traffic lights & URL bar yang berada di atas halaman, tidak menutupi navbar web).
  * **Layer 3:** Kamera `spring()` dengan *Ken Burns Push-in Drift*, *Spotlight Ring* tajam (tanpa memburamkan teks), dan kursor kurva Bezier + aksi klik slider live.
  * **Layer 4:** *Kinetic Word-by-Word Karaoke Subtitles* di layer teratas (tidak pernah kabur atau tergulung saat scroll).
  * **Layer 5:** *3D Studio Intro & Outro CTA Cards*.
* **Dukungan Multi-Format (`16:9` & `9:16` Reels) dan Multi-Durasi (`30s`, `45s`, `60s`).**

---

## Alur Kerja Wajib (2 Fase Interaktif)

### Fase 1: Analisis Halaman & Konfirmasi 5 Preferensi User
1. Saat user memberikan URL landing page, jalankan perintah analisis:
   ```bash
   python .agent/skills/auto-promo-video/scripts/promo_engine.py --analyze "<URL_LANDING_PAGE>" --out analysis.json
   ```

2. Baca `analysis.json`, lalu tampilkan ringkasan singkat ke user:
   * **Keunggulan Utama Halaman**
   * **Fitur Interaktif Terdeteksi** (Slider, Carousel, Tabs, CTA)
   * **Draf Storyboard**

3. **Wajib Tanyakan 5 Pilihan Konfigurasi** berikut (gunakan tool `ask_question` jika tersedia):
   * **1. Durasi Video:**
     * `30 Detik` *(Singkat & padat — 3–4 scene)*
     * `45 Detik` *(Standar ideal — 5 scene)*
     * `60 Detik` *(Lengkap & mendalam — 6–7 scene)*
   * **2. Format / Rasio Video:**
     * `Landscape (16:9 - 1920x1080)` *(Untuk YouTube, Website, Presentasi)*
     * `Portrait / Reels (9:16 - 1080x1920)` *(Untuk Instagram Reels, TikTok, Shorts)*
   * **3. Bahasa Video:**
     * `Bahasa Indonesia`
     * `Bahasa Inggris (English)`
   * **4. Pilihan Suara (Voiceover):**
     * `Suara Wanita` (`id_female` / `en_female`)
     * `Suara Pria` (`id_male` / `en_male`)
     * `Tanpa Suara Orang` (`none` - hanya musik latar, gerakan kamera, dan subtitle)
   * **5. Fitur Tambahan:**
     * `Subtitle Otomatis + Musik Latar` (Aktif / Nonaktif)

---

### Fase 2: Aturan Copywriting Iklan Motion & Render Video Remotion

1. **ATURAN WAJIB COPYWRITING ("Punchy Commercial Micro-Copy"):**
   * **DILARANG KERAS** menulis kalimat panjang dan formal seperti laporan/berita (misal: *"Selamat datang di website resmi kami yang dirancang untuk..."*). Kalimat panjang membuat intonasi TTS menjadi datar dan membosankan.
   * **Gunakan maksimal 6–10 kata per scene** yang dipecah menjadi **2 klausa berirama** menggunakan tanda baca ekspresif (`!`, `?`, atau `—`):
     * **Klausa 1 (Hook / Pertanyaan Pemicu):** 2–4 kata pembuka yang memancing rasa penasaran (Engine otomatis menaikkan *Pitch* `+5Hz` s/d `+7Hz` & *Tempo* `+25%`).
     * **Klausa 2 (Punchline / Call-to-Action):** 3–6 kata penutup yang tegas dan *to-the-point* (Engine memberi jeda nafas mikro 75ms lalu menutup dengan intonasi tegas).
   * **Contoh Buruk (Kaku & Membosankan):** `"Selamat datang di SMA Negeri 1 Nusantara, membentuk generasi cerdas, berkarakter, dan berdaya saing."`
   * **Contoh Bagus (Hidup & Komersial):** `"Inilah SMAN 1 Nusantara! Rumah bagi generasi cerdas dan berdaya saing."` atau `"Penasaran serunya fasilitas kami? Putar video profilnya hanya satu klik!"`

2. Buat file `storyboard.json` dengan format berikut:
```json
{
  "url": "https://school.abynsstudio.com/",
  "duration_preset": 45,
  "aspect_ratio": "16:9",
  "language": "id",
  "voice": "id_female",
  "subtitles": true,
  "bgm": true,
  "output": "promo_school_final.mp4",
  "scenes": [
    {
      "id": "scene_1",
      "selector": "h1.hero-title",
      "badge": "SMAN 1 NUSANTARA",
      "action": "overview",
      "zoom": 1.24,
      "voiceover": "Inilah SMAN 1 Nusantara! Rumah bagi generasi cerdas dan berdaya saing."
    },
    {
      "id": "scene_2",
      "selector": "button.btn-video-pill",
      "badge": "TUR INTERAKTIF",
      "action": "highlight_cta",
      "zoom": 1.48,
      "voiceover": "Penasaran serunya fasilitas kami? Putar video profilnya hanya satu klik!"
    },
    {
      "id": "scene_3",
      "selector": "div.programs-carousel-outer",
      "badge": "PROGRAM UNGGULAN",
      "action": "slide_programs",
      "zoom": 1.26,
      "voiceover": "Dari Kelas Riset hingga Robotika—geser dan pilih program impianmu!"
    },
    {
      "id": "scene_4",
      "selector": "div.prestasi-carousel-outer",
      "badge": "REKOR JUARA",
      "action": "slide_prestasi",
      "zoom": 1.28,
      "voiceover": "Ratusan medali provinsi hingga nasional! Bukti nyata mental juara."
    },
    {
      "id": "scene_5",
      "selector": "a.btn-ppdb",
      "badge": "DAFTAR SEKARANG",
      "action": "highlight_cta",
      "zoom": 1.65,
      "voiceover": "PPDB resmi dibuka! Klik daftar sekarang dan raih masa depanmu!"
    }
  ]
}
```

3. Jalankan perintah render:
   ```bash
   python .agent/skills/auto-promo-video/scripts/promo_engine.py --render storyboard.json
   ```

4. Beritahukan user bahwa file `.mp4` (beserta `.srt`) telah selesai dirender dengan kualitas studio 60 FPS.
