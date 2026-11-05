import argparse
import asyncio
import json
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path
from urllib.parse import urlparse

# =====================================================================
# 1. AUTO-INSTALLER (PYTHON + REMOTION REACT ZERO-SETUP BOOTSTRAPER)
# =====================================================================
SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
REMOTION_DIR = SKILL_DIR / "remotion_app"
PUBLIC_DIR = REMOTION_DIR / "public"
SETUP_MARKER = SCRIPT_DIR / ".setup_remotion_complete"

NPM_CMD = "npm.cmd" if os.name == "nt" else "npm"
NPX_CMD = "npx.cmd" if os.name == "nt" else "npx"

def ensure_dependencies(force=False):
    missing_pkgs = []
    for mod_name, pkg_name in [
        ("playwright", "playwright"),
        ("edge_tts", "edge-tts"),
        ("imageio_ffmpeg", "imageio-ffmpeg")
    ]:
        try:
            __import__(mod_name)
        except ImportError:
            missing_pkgs.append(pkg_name)

    if missing_pkgs or force or not SETUP_MARKER.exists():
        print("[Auto-Setup] Menyiapkan komponen Python & Browser...")
        if missing_pkgs or force:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install", "--quiet",
                "playwright", "edge-tts", "imageio-ffmpeg"
            ])
        subprocess.check_call([
            sys.executable, "-m", "playwright", "install", "chromium"
        ])

    if not (REMOTION_DIR / "node_modules").exists() or force:
        print("[Auto-Setup] Menginstal engine React Remotion di dalam folder skill...")
        subprocess.check_call(
            [NPM_CMD, "install", "--no-audit", "--no-fund"],
            cwd=str(REMOTION_DIR)
        )
        esbuild_script = REMOTION_DIR / "node_modules" / "esbuild" / "install.js"
        if esbuild_script.exists():
            subprocess.run(["node", str(esbuild_script)], cwd=str(REMOTION_DIR))

    SETUP_MARKER.write_text("ok", encoding="utf-8")

ensure_dependencies()

from playwright.async_api import async_playwright
import edge_tts
import imageio_ffmpeg

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

VOICE_MAP = {
    "id_female": "id-ID-GadisNeural",
    "id_male": "id-ID-ArdiNeural",
    "en_female": "en-US-AriaNeural",
    "en_male": "en-US-ChristopherNeural",
    "id-ID-GadisNeural": "id-ID-GadisNeural",
    "id-ID-ArdiNeural": "id-ID-ArdiNeural",
    "en-US-AriaNeural": "en-US-AriaNeural",
    "en-US-ChristopherNeural": "en-US-ChristopherNeural",
    "none": None
}

# =====================================================================
# 2. AUDIO SYNTH: AMBIENT BGM & PROCEDURAL SOUND EFFECTS (FOLEY & SFX)
# =====================================================================
def generate_pro_sfx(click_path: str, whoosh_path: str, pop_path: str, riser_path: str, sample_rate: int = 24000):
    with wave.open(click_path, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sample_rate)
        buf = bytearray()
        samples = int(sample_rate * 0.1)
        for i in range(samples):
            t = i / sample_rate
            env = math.exp(-t * 60)
            val = math.sin(2 * math.pi * 1750 * t) * env
            s = int(val * 24000)
            buf.extend(struct.pack("<h", max(-32767, min(32767, s))))
        wf.writeframes(buf)

    with wave.open(whoosh_path, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sample_rate)
        buf = bytearray()
        dur = 0.55
        samples = int(sample_rate * dur)
        for i in range(samples):
            t = i / sample_rate
            p = t / dur
            freq = 150 + 520 * math.sin(math.pi * p)
            env = (math.sin(math.pi * p) ** 2.0)
            val = math.sin(2 * math.pi * freq * t) * env
            s = int(val * 18000)
            buf.extend(struct.pack("<h", max(-32767, min(32767, s))))
        wf.writeframes(buf)

    with wave.open(pop_path, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sample_rate)
        buf = bytearray()
        samples = int(sample_rate * 0.15)
        for i in range(samples):
            t = i / sample_rate
            env = math.exp(-t * 32)
            val = math.sin(2 * math.pi * 1050 * (1.0 + 0.4 * math.exp(-t * 80)) * t) * env
            s = int(val * 17000)
            buf.extend(struct.pack("<h", max(-32767, min(32767, s))))
        wf.writeframes(buf)

    with wave.open(riser_path, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sample_rate)
        buf = bytearray()
        dur = 1.2
        samples = int(sample_rate * dur)
        for i in range(samples):
            t = i / sample_rate
            p = t / dur
            freq = 60 + 420 * (p ** 2.2)
            env = p ** 1.8
            val = math.sin(2 * math.pi * freq * t) * env
            s = int(val * 16000)
            buf.extend(struct.pack("<h", max(-32767, min(32767, s))))
        wf.writeframes(buf)

def generate_ambient_bgm_samples(total_samples: int, sample_rate: int = 24000) -> list:
    """
    Menghasilkan musik latar 'Upbeat Commercial Motion Groove' (124 BPM):
    - Soft 4-on-the-floor kick pulse + crisp 16th-note shaker groove
    - Pluck arpeggio cerah & warm synth pad (Fmaj9 -> G6 -> Em7 -> Am9)
    """
    chords = [
        [174.61, 220.00, 261.63, 329.63, 392.00],  # Fmaj9
        [196.00, 246.94, 293.66, 329.63, 392.00],  # G6
        [164.81, 246.94, 293.66, 392.00, 493.88],  # Em7
        [220.00, 261.63, 329.63, 392.00, 493.88],  # Am9
    ]
    bpm = 124.0
    beat_sec = 60.0 / bpm          # ~0.4838s per ketukan
    step_sec = beat_sec / 2.0      # 8th note pluck arpeggio
    bar_sec = beat_sec * 4.0       # ~1.935s per bar
    duration_sec = total_samples / sample_rate
    bgm_samples = [0.0] * total_samples
    rng = random.Random(108)

    for i in range(total_samples):
        t = i / sample_rate
        chord_idx = int(t / bar_sec) % len(chords)
        freqs = chords[chord_idx]
        fade = min(1.0, t / 0.8, max(0.0, (duration_sec - t) / 1.2))

        # 1. Warm stereo-like pad
        pad_val = 0.0
        for idx_f, f in enumerate(freqs[:4]):
            detune = 1.0 + (0.0012 * idx_f * math.sin(2 * math.pi * 0.35 * t))
            pad_val += math.sin(2 * math.pi * f * detune * t)
        pad_val = (pad_val / 4.0) * 0.38

        # 2. Bright Commercial Pluck Arpeggio (8th notes)
        step_idx = int(t / step_sec)
        step_t = t % step_sec
        arp_freq = freqs[(step_idx * 2 + (step_idx // 4)) % len(freqs)] * 2.0
        pluck_env = math.exp(-step_t * 14.0)
        pluck_val = (
            math.sin(2 * math.pi * arp_freq * t) * 0.75 +
            math.sin(2 * math.pi * arp_freq * 2.0 * t) * 0.25
        ) * pluck_env * 0.42

        # 3. Soft Commercial Kick Pulse (on every beat)
        beat_t = t % beat_sec
        kick_env = math.exp(-beat_t * 26.0)
        kick_freq = 48.0 + 75.0 * math.exp(-beat_t * 45.0)
        kick_val = math.sin(2 * math.pi * kick_freq * beat_t) * kick_env * 0.35

        # 4. Crisp Off-beat Hi-Hat / Shaker (on 8th off-beats)
        hat_val = 0.0
        if step_idx % 2 == 1 and step_t < 0.06:
            hat_env = math.exp(-step_t * 55.0)
            hat_val = rng.uniform(-1, 1) * hat_env * 0.12

        bgm_samples[i] = (pad_val + pluck_val + kick_val + hat_val) * fade
    return bgm_samples

def trim_audio_silence(samples: list, threshold: float = 0.015, pad_samples: int = 360) -> list:
    """Memotong dead-air / hening bawaan TTS di awal & akhir klip agar tempo bicara rapat dan responsif."""
    if not samples:
        return samples
    start_idx = 0
    end_idx = len(samples) - 1
    while start_idx < len(samples) and abs(samples[start_idx]) < threshold:
        start_idx += 1
    while end_idx > start_idx and abs(samples[end_idx]) < threshold:
        end_idx -= 1
    start_idx = max(0, start_idx - pad_samples)
    end_idx = min(len(samples), end_idx + pad_samples)
    trimmed = samples[start_idx:end_idx]
    return trimmed if len(trimmed) > 400 else samples

def enhance_vocal_presence(samples: list) -> list:
    """Memberikan sentuhan broadcast vocal exciter & soft saturation agar suara terdengar tegas dan hidup."""
    if not samples:
        return samples
    out = []
    prev = 0.0
    norm_tanh = math.tanh(1.32)
    for s in samples:
        # High-frequency air presence boost + soft-knee studio exciter
        high_diff = s - prev
        prev = s
        boosted = s + high_diff * 0.38
        saturated = math.tanh(boosted * 1.32) / norm_tanh
        out.append(max(-0.98, min(0.98, saturated)))
    return out

async def synthesize_expressive_scene_vo(
    text: str,
    resolved_voice: str,
    work_dir: Path,
    scene_idx: int,
    sample_rate: int = 24000
) -> list:
    """
    Dynamic Prosody Director ("Seni Ngomong Iklan"):
    Memecah kalimat menjadi frasa-frasa pendek (Hook, Bridge, Punchline/CTA) dan mengatur
    kontur Pitch + Tempo + Volume berbeda di setiap frasa, lalu memotong jeda mati.
    """
    # Pecah kalimat berdasarkan tanda baca ekspresif sambil mempertahankan tanda bacanya
    raw_parts = re.split(r'([!?—–…,;:]|\.\.\.|\.)', text)
    clauses = []
    buf = ""
    for part in raw_parts:
        if not part:
            continue
        buf += part
        if re.match(r'^([!?—–…,;:]|\.\.\.|\.)$', part.strip()):
            if buf.strip():
                clauses.append(buf.strip())
            buf = ""
    if buf.strip():
        clauses.append(buf.strip())

    # Gabungkan klausa yang terlalu pendek (1 kata) dengan klausa berikutnya agar tetap natural
    merged_clauses = []
    for cl in clauses:
        if merged_clauses and len(merged_clauses[-1].split()) < 2:
            merged_clauses[-1] = merged_clauses[-1] + " " + cl
        else:
            merged_clauses.append(cl)
    if not merged_clauses:
        merged_clauses = [text]

    scene_samples = []
    breath_pause_samples = [0.0] * int(0.075 * sample_rate)  # 75ms jeda nafas mikro antar-klausa

    for c_i, clause in enumerate(merged_clauses):
        is_first = (c_i == 0)
        is_last = (c_i == len(merged_clauses) - 1)
        is_question = clause.endswith("?")
        is_exclaim = clause.endswith("!")

        # Atur kontur intonasi (Pitch, Rate, Gain) ala Voice Actor Iklan Motion
        if is_question:
            pitch = "+7Hz"
            rate = "+24%"
            gain = 1.10
        elif is_first:
            # Hook pembuka: nada antusias & tempo sigap
            pitch = "+5Hz"
            rate = "+25%"
            gain = 1.08
        elif is_last or is_exclaim:
            # Punchline penutup: tegas & meyakinkan
            pitch = "+3Hz"
            rate = "+20%"
            gain = 1.06
        else:
            # Frasa penghubung: mengalir cepat
            pitch = "+1Hz"
            rate = "+24%"
            gain = 1.02

        c_mp3 = str(work_dir / f"vo_{scene_idx}_c{c_i}.mp3")
        c_wav = str(work_dir / f"vo_{scene_idx}_c{c_i}.wav")
        communicate = edge_tts.Communicate(clause, resolved_voice, rate=rate, pitch=pitch)
        await communicate.save(c_mp3)
        subprocess.run([
            FFMPEG_EXE, "-y", "-i", c_mp3,
            "-ar", str(sample_rate), "-ac", "1", c_wav
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        _, raw_clause_samples = read_wav_samples(c_wav)
        clean_clause = trim_audio_silence(raw_clause_samples, threshold=0.015, pad_samples=320)
        if gain != 1.0:
            clean_clause = [s * gain for s in clean_clause]

        if scene_samples:
            scene_samples.extend(breath_pause_samples)
        scene_samples.extend(clean_clause)

    return enhance_vocal_presence(scene_samples)

def read_wav_samples(wav_path: str) -> tuple:
    with wave.open(wav_path, "r") as wf:
        rate = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
        samples = struct.unpack(f"<{n_frames}h", raw)
        return rate, [s / 32768.0 for s in samples]

def get_audio_duration(file_path: str) -> float:
    res = subprocess.run(
        [FFMPEG_EXE, "-i", file_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
    if match:
        h, m, s = float(match.group(1)), float(match.group(2)), float(match.group(3))
        return h * 3600 + m * 60 + s
    return 4.0

def format_srt_time(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    msecs = int((seconds - int(seconds)) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{msecs:03d}"

# =====================================================================
# 3. DOM ANALYZER (UNTUK FASE 1)
# =====================================================================
ANALYZE_DOM_JS = """
() => {
    const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 30 && rect.height > 20 &&
               style.visibility !== 'hidden' &&
               style.display !== 'none' &&
               parseFloat(style.opacity) > 0.1;
    };

    const headings = [];
    document.querySelectorAll('h1, h2, h3').forEach(el => {
        if (isVisible(el) && el.innerText.trim().length > 3) {
            const rect = el.getBoundingClientRect();
            headings.push({
                tag: el.tagName.toLowerCase(),
                text: el.innerText.trim().slice(0, 100),
                selector: el.className ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase(),
                y_position: Math.round(rect.top + window.scrollY)
            });
        }
    });

    const sliders = [];
    document.querySelectorAll('.programs-carousel-outer, .prestasi-carousel-outer, [class*="carousel"], [class*="slider"]').forEach(el => {
        if (!isVisible(el)) return;
        const nextBtn = el.querySelector('.prog-next, .prestasi-next, [class*="next"]');
        sliders.push({
            selector: el.className ? '.' + el.className.trim().split(/\\s+/)[0] : 'div',
            has_next: !!nextBtn,
            next_selector: nextBtn && nextBtn.className ? '.' + nextBtn.className.trim().split(/\\s+/)[0] : ''
        });
    });

    const ctas = [];
    document.querySelectorAll('.btn-ppdb, .btn-primary-pill, .btn-video-pill, a.cta, button.cta').forEach(el => {
        if (!isVisible(el)) return;
        ctas.push({
            text: el.innerText.trim().slice(0, 40),
            selector: el.className ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\\s+/)[0] : 'a'
        });
    });

    return {
        page_title: document.title,
        meta_description: document.querySelector('meta[name="description"]')?.content || '',
        total_height: document.documentElement.scrollHeight,
        Headings_And_Sections: headings.slice(0, 12),
        Interactive_Sliders: sliders,
        Primary_CTAs: ctas.slice(0, 8)
    };
}
"""

async def analyze_page(url: str, output_json: str):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await page.evaluate("""async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 600) {
                window.scrollTo(0, y);
                await new Promise(r => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
        }""")
        await asyncio.sleep(0.8)
        data = await page.evaluate(ANALYZE_DOM_JS)
        data["url"] = url
        await browser.close()

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"[OK] Analisis fitur halaman disimpan di {output_json}")

# =====================================================================
# 4. HYBRID PLAYWRIGHT ASSET EXTRACTOR + REMOTION 60FPS STUDIO RENDERER
# =====================================================================
async def render_promo(config_path: str):
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    url = config["url"]
    domain = urlparse(url).hostname or "localhost"
    raw_voice_choice = str(config.get("voice", "id_female")).strip()
    resolved_voice = VOICE_MAP.get(raw_voice_choice, "id-ID-GadisNeural")
    use_subtitles = bool(config.get("subtitles", True))
    use_bgm = bool(config.get("bgm", True))
    aspect_ratio = str(config.get("aspect_ratio", "16:9")).strip()
    if aspect_ratio not in ["16:9", "9:16"]:
        aspect_ratio = "16:9"
    duration_preset = int(config.get("duration_preset", 45))
    output_file = str(Path(config.get("output", "promo_school_final.mp4")).resolve())
    scenes = config["scenes"]

    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    work_dir = SKILL_DIR / ".tmp_promo_build"
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    # Sesuaikan kecepatan bicara agar pas dengan target durasi (30s / 45s / 60s)
    tts_rate = "+18%" if duration_preset <= 30 else ("+14%" if duration_preset <= 45 else "+12%")

    # 1. Buka halaman web secara MURNI (Clean Capture) & ambil koordinat serta screenshot lossless
    print(f"[Clean Capture] Mengambil aset visual beresolusi tinggi dari {url}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1
        )
        page = await context.new_page()
        await page.goto(url, wait_until="networkidle", timeout=60000)

        # Trigger semua animasi scroll, counter, dan lazy-load image
        await page.evaluate("""async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 500) {
                window.scrollTo(0, y);
                await new Promise(r => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
        }""")
        await asyncio.sleep(1.0)

        page_meta = await page.evaluate("""() => ({
            title: document.title || 'Official Website',
            desc: document.querySelector('meta[name="description"]')?.content || '',
            height: document.documentElement.scrollHeight
        })""")

        page_height = int(page_meta["height"])

        # Ukur bounding box tiap scene secara presisi (pilih elemen yang benar-benar visible di layar!)
        for idx, sc in enumerate(scenes):
            sel = sc.get("selector", "h1")
            action = sc.get("action", "overview")
            rect_info = await page.evaluate("""([selector, act]) => {
                const els = Array.from(document.querySelectorAll(selector));
                const el = els.find(e => {
                    const r = e.getBoundingClientRect();
                    const s = window.getComputedStyle(e);
                    return r.width > 10 && r.height > 10 && s.visibility !== 'hidden' && s.display !== 'none';
                }) || els[0];
                if (!el) return { x: 460, y: 260, width: 1000, height: 220, isFixed: false, interactRect: null };
                const r = el.getBoundingClientRect();
                let isFixed = false;
                let curr = el;
                while (curr && curr !== document.body) {
                    const pos = window.getComputedStyle(curr).position;
                    if (pos === 'fixed' || pos === 'sticky') { isFixed = true; break; }
                    curr = curr.parentElement;
                }
                const docRect = {
                    x: Math.round(r.left + window.scrollX),
                    y: Math.round(isFixed ? r.top : r.top + window.scrollY),
                    width: Math.round(r.width),
                    height: Math.round(r.height),
                    isFixed: isFixed
                };

                let interactRect = null;
                if (act === 'slide_programs') {
                    const btn = document.querySelector('.programs-carousel-outer .prog-next');
                    if (btn) {
                        const br = btn.getBoundingClientRect();
                        interactRect = { x: Math.round(br.left), y: Math.round(br.top + window.scrollY), width: Math.round(br.width), height: Math.round(br.height) };
                    }
                } else if (act === 'slide_prestasi') {
                    const btn = document.querySelector('.prestasi-carousel-outer .prestasi-next');
                    if (btn) {
                        const br = btn.getBoundingClientRect();
                        interactRect = { x: Math.round(br.left), y: Math.round(br.top + window.scrollY), width: Math.round(br.width), height: Math.round(br.height) };
                    }
                }
                return { ...docRect, interactRect };
            }""", [sel, action])

            sc["targetRect"] = {
                "x": rect_info["x"],
                "y": rect_info["y"],
                "width": rect_info["width"],
                "height": rect_info["height"],
                "isFixed": rect_info["isFixed"]
            }
            sc["interactRect"] = rect_info["interactRect"]

        # Tangkap Sticky Navbar (96px teratas) secara terpisah
        navbar_file = "navbar.png"
        await page.screenshot(
            path=str(PUBLIC_DIR / navbar_file),
            clip={"x": 0, "y": 0, "width": 1920, "height": 96}
        )

        # Sembunyikan elemen fixed sementara agar tidak berulang di tengah halaman saat full-page capture
        await page.evaluate("""() => {
            document.querySelectorAll('header, nav, .navbar, .back-to-top-btn').forEach(el => {
                const pos = window.getComputedStyle(el).position;
                if (pos === 'fixed' || pos === 'sticky') {
                    el.setAttribute('data-orig-vis', el.style.visibility || '');
                    el.style.visibility = 'hidden';
                }
            });
        }""")

        base_img_file = "page_base.png"
        await page.screenshot(path=str(PUBLIC_DIR / base_img_file), full_page=True)

        # Tangkap juga state interaktif setelah klik slider (untuk animasi live carousel!)
        for idx, sc in enumerate(scenes):
            act = sc.get("action", "")
            if act == "slide_programs":
                btn = await page.query_selector(".programs-carousel-outer .prog-next")
                if btn:
                    await btn.click()
                    await asyncio.sleep(0.65)
                    after_name = f"scene_{idx}_after.png"
                    await page.screenshot(path=str(PUBLIC_DIR / after_name), full_page=True)
                    sc["afterImageFile"] = after_name
            elif act == "slide_prestasi":
                btn = await page.query_selector(".prestasi-carousel-outer .prestasi-next")
                if btn:
                    await btn.click()
                    await asyncio.sleep(0.65)
                    after_name = f"scene_{idx}_after.png"
                    await page.screenshot(path=str(PUBLIC_DIR / after_name), full_page=True)
                    sc["afterImageFile"] = after_name

        await browser.close()

    # 2. Sintesis Voiceover & Susun Timeline Frame (60 FPS - Snappy Commercial Pacing)
    FPS = 60
    SAMPLE_RATE = 24000
    INTRO_SEC = 1.25
    OUTRO_SEC = 1.50
    TRANSITION_SEC = 0.42
    POST_PAUSE_SEC = 0.14

    click_wav = str(work_dir / "sfx_click.wav")
    whoosh_wav = str(work_dir / "sfx_whoosh.wav")
    pop_wav = str(work_dir / "sfx_pop.wav")
    riser_wav = str(work_dir / "sfx_riser.wav")
    generate_pro_sfx(click_wav, whoosh_wav, pop_wav, riser_wav, sample_rate=SAMPLE_RATE)
    _, click_samples = read_wav_samples(click_wav)
    _, whoosh_samples = read_wav_samples(whoosh_wav)
    _, pop_samples = read_wav_samples(pop_wav)
    _, riser_samples = read_wav_samples(riser_wav)

    print("[Audio Engine] Menyiapkan narasi voiceover ekspresif (Multi-Clause Prosody), foley SFX & 124 BPM Groove BGM...")
    remotion_scenes = []
    audio_events = []
    current_sec = INTRO_SEC

    for idx, sc in enumerate(scenes):
        text = sc.get("voiceover", "").strip()
        action = sc.get("action", "overview")
        badge = sc.get("badge", f"HIGHLIGHT {idx+1}")
        zoom = float(sc.get("zoom", 1.3))

        if resolved_voice and text:
            vo_data = await synthesize_expressive_scene_vo(
                text=text,
                resolved_voice=resolved_voice,
                work_dir=work_dir,
                scene_idx=idx,
                sample_rate=SAMPLE_RATE
            )
            dur = max(1.6, round(len(vo_data) / SAMPLE_RATE, 3))
        else:
            word_count = max(1, len(text.split()))
            dur = max(2.2, round(word_count * 0.30, 2))
            vo_data = [0.0] * int(dur * SAMPLE_RATE)

        start_sec = current_sec
        arrive_sec = start_sec + TRANSITION_SEC
        end_sec = arrive_sec + dur
        next_sec = end_sec + POST_PAUSE_SEC

        remotion_scenes.append({
            "id": sc.get("id", f"scene_{idx+1}"),
            "badge": badge,
            "voiceover": text,
            "action": action,
            "zoom": zoom,
            "startFrame": int(round(start_sec * FPS)),
            "arriveFrame": int(round(arrive_sec * FPS)),
            "endFrame": int(round(end_sec * FPS)),
            "nextStartFrame": int(round(next_sec * FPS)),
            "targetRect": sc["targetRect"],
            "interactRect": sc.get("interactRect"),
            "afterImageFile": sc.get("afterImageFile")
        })

        audio_events.append({
            "start_sec": start_sec,
            "arrive_sec": arrive_sec,
            "end_sec": end_sec,
            "action": action,
            "has_interact": bool(sc.get("interactRect")),
            "vo_samples": vo_data
        })
        current_sec = next_sec

    total_sec = current_sec + OUTRO_SEC
    total_frames = int(round(total_sec * FPS))
    total_samples = int(total_sec * SAMPLE_RATE)
    master_samples = [0.0] * total_samples
    voice_mask = [0.0] * total_samples

    # Mix Intro Whoosh
    intro_w = int((INTRO_SEC - 0.30) * SAMPLE_RATE)
    for s_i, s_val in enumerate(whoosh_samples):
        if 0 <= intro_w + s_i < total_samples:
            master_samples[intro_w + s_i] += s_val * 0.62

    for ev in audio_events:
        w_pos = int(ev["start_sec"] * SAMPLE_RATE)
        for s_i, s_val in enumerate(whoosh_samples):
            if w_pos + s_i < total_samples:
                master_samples[w_pos + s_i] += s_val * 0.58

        p_pos = int(ev["arrive_sec"] * SAMPLE_RATE)
        for s_i, s_val in enumerate(pop_samples):
            if p_pos + s_i < total_samples:
                master_samples[p_pos + s_i] += s_val * 0.48

        v_pos = int(ev["arrive_sec"] * SAMPLE_RATE)
        for s_i, s_val in enumerate(ev["vo_samples"]):
            if v_pos + s_i < total_samples:
                master_samples[v_pos + s_i] += s_val * 1.08
                voice_mask[v_pos + s_i] = 1.0

        if ev["has_interact"] or ev["action"] in ["highlight_cta", "zoom_in"]:
            click_offset_sec = 0.40 if ev["has_interact"] else 0.33
            c_pos = int((ev["arrive_sec"] + click_offset_sec) * SAMPLE_RATE)
            for s_i, s_val in enumerate(click_samples):
                if c_pos + s_i < total_samples:
                    master_samples[c_pos + s_i] += s_val * 0.85

    riser_pos = int((current_sec - 0.45) * SAMPLE_RATE)
    for s_i, s_val in enumerate(riser_samples):
        if 0 <= riser_pos + s_i < total_samples:
            master_samples[riser_pos + s_i] += s_val * 0.65

    if use_bgm:
        bgm_raw = generate_ambient_bgm_samples(total_samples, sample_rate=SAMPLE_RATE)
        for i in range(total_samples):
            t_s = i / SAMPLE_RATE
            fade_out = max(0.0, min(1.0, (total_sec - t_s) / 1.1))
            vol = (0.14 if voice_mask[i] > 0.1 else 0.38) * fade_out
            master_samples[i] += bgm_raw[i] * vol

    master_audio_name = "master_audio.wav"
    master_audio_path = str(PUBLIC_DIR / master_audio_name)
    with wave.open(master_audio_path, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SAMPLE_RATE)
        buf = bytearray()
        for s in master_samples:
            sc_val = max(-1.0, min(1.0, s))
            buf.extend(struct.pack("<h", int(sc_val * 32767)))
        wf.writeframes(buf)

    # Simpan file .srt
    if use_subtitles:
        srt_path = Path(output_file).with_suffix(".srt")
        srt_lines = []
        for idx, ev in enumerate(audio_events):
            srt_lines.append(
                f"{idx+1}\n"
                f"{format_srt_time(ev['arrive_sec'])} --> {format_srt_time(ev['end_sec'])}\n"
                f"{remotion_scenes[idx]['voiceover']}\n"
            )
        srt_path.write_text("\n".join(srt_lines), encoding="utf-8")

    # 3. Tulis props.json dan panggil Remotion 60FPS Renderer
    remotion_props = {
        "url": url,
        "domain": domain,
        "pageTitle": page_meta["title"],
        "metaDescription": page_meta["desc"],
        "aspectRatio": aspect_ratio,
        "durationPreset": duration_preset,
        "subtitles": use_subtitles,
        "pageWidth": 1920,
        "pageHeight": page_height,
        "viewportHeight": 1080,
        "baseImageFile": base_img_file,
        "navbarImageFile": navbar_file,
        "navbarHeight": 96,
        "audioFile": master_audio_name,
        "introFrames": int(round(INTRO_SEC * FPS)),
        "outroFrames": int(round(OUTRO_SEC * FPS)),
        "totalFrames": total_frames,
        "scenes": remotion_scenes
    }

    props_file = work_dir / "remotion_props.json"
    with open(props_file, "w", encoding="utf-8") as f:
        json.dump(remotion_props, f, indent=2, ensure_ascii=False)

    print(f"[Remotion Engine] Merender video {aspect_ratio} ({total_frames} frames @ 60fps = {total_sec:.1f}s)...")
    render_cmd = [
        NPX_CMD,
        "remotion",
        "render",
        "src/index.ts",
        "PromoVideo",
        output_file,
        f"--props={props_file.resolve()}",
        "--codec=h264",
        "--crf=18",
        "--pixel-format=yuv420p"
    ]
    res = subprocess.run(render_cmd, cwd=str(REMOTION_DIR))
    # Bersihkan folder build sementara setelah proses selesai
    shutil.rmtree(work_dir, ignore_errors=True)
    shutil.rmtree(PUBLIC_DIR, ignore_errors=True)
    if res.returncode != 0:
        raise RuntimeError("Remotion render gagal dijalankan.")

    print(f"[SELESAI] Video promosi Remotion Studio berhasil dibuat: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--setup", action="store_true", help="Instal otomatis semua dependensi")
    parser.add_argument("--analyze", help="URL landing page yang ingin dianalisis")
    parser.add_argument("--out", default="analysis.json", help="File output JSON hasil analisis")
    parser.add_argument("--render", help="Path ke file storyboard.json untuk dirender")
    args = parser.parse_args()

    if args.setup:
        ensure_dependencies(force=True)
    elif args.analyze:
        asyncio.run(analyze_page(args.analyze, args.out))
    elif args.render:
        asyncio.run(render_promo(args.render))
