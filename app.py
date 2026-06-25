from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
from collections import defaultdict
import json
import os
import requests
import db

app = Flask(__name__)

YKS_DATE = datetime(2027, 6, 19, 10, 0)

def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except: return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
DENEME_FILE = os.path.join(os.path.dirname(__file__), "denemeler.json")
GUNLUK_FILE = os.path.join(os.path.dirname(__file__), "gunluk.json")
UYKU_FILE = os.path.join(os.path.dirname(__file__), "uyku.json")
SAGLIK_FILE = os.path.join(os.path.dirname(__file__), "saglik.json")
HEDEF_FILE = os.path.join(os.path.dirname(__file__), "hedef.json")
NOT_DEFTERI_FILE = os.path.join(os.path.dirname(__file__), "notlar.json")
MOTIVASYON_FILE = os.path.join(os.path.dirname(__file__), "motivasyon.json")
AYARLAR_FILE = os.path.join(os.path.dirname(__file__), "ayarlar.json")
AI_HISTORY_FILE = os.path.join(os.path.dirname(__file__), "ai_history.json")
PROGRAM_FILE = os.path.join(os.path.dirname(__file__), "program.json")
CHALLENGE_FILE = os.path.join(os.path.dirname(__file__), "challenge.json")
FLASHCARD_FILE = os.path.join(os.path.dirname(__file__), "flashcards.json")
DIYET_FILE = os.path.join(os.path.dirname(__file__), "diyet.json")
AILE_FILE = os.path.join(os.path.dirname(__file__), "aile.json")
FOTO_DIR = os.path.join(os.path.dirname(__file__), "aile_fotograflar")
XP_FILE = os.path.join(os.path.dirname(__file__), "xp.json")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

def load_env():
    """.env dosyasini yukle"""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
load_env()

# ── Veri yönetimi ─────────────────────────────────────────────

def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_data():
    dersler = db.dersler_load()
    old = load_json(DATA_FILE, {})
    return {
        "dersler": dersler or [{"ad": "Matematik", "konular": 0, "tamamlanan": 0, "alt_konular": []}, {"ad": "Geometri", "konular": 0, "tamamlanan": 0, "alt_konular": []}],
        "gunluk_hedef": old.get("gunluk_hedef", {"soru": 200, "konu": 3}),
        "gunluk_ilerleme": old.get("gunluk_ilerleme", {"soru": 0, "konu": 0, "tarih": str(datetime.now().date())}),
    }

def load_config():
    cfg = load_json(CONFIG_FILE, {"api_key": "", "model": "deepseek-chat"})
    # Priority: env var > config file
    env_key = os.environ.get("DEEPSEEK_API_KEY", "")
    if env_key:
        cfg["api_key"] = env_key
    return cfg

# ── DeepSeek AI ───────────────────────────────────────────────

SISTEM_PROMPT = """Sen SeeOs Koçu adında, Türkiye'deki YKS sınavına hazırlanan öğrencilere 
koçluk yapan bir yapay zeka asistanısın. Her zaman Türkçe, samimi ve motive edici cevap ver.
Konuları basitçe açıkla, örneklerle destekle, kısa ve öz tut."""

def deepseek_chat(messages, api_key, model="deepseek-chat"):
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {"model": model, "messages": [{"role": "system", "content": SISTEM_PROMPT}] + messages,
            "temperature": 0.7, "max_tokens": 2048}
    try:
        r = requests.post(DEEPSEEK_URL, headers=headers, json=body, timeout=30)
        if r.status_code == 200:
            return {"ok": True, "reply": r.json()["choices"][0]["message"]["content"]}
        err = r.json().get("error", {}).get("message", r.text)
        return {"ok": False, "error": f"API hatası ({r.status_code}): {err}"}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "DeepSeek API zaman aşımı (30sn)."}
    except Exception as e:
        return {"ok": False, "error": f"Bağlantı hatası: {str(e)}"}

def build_context():
    data = load_data()
    now = datetime.now()
    kalan = YKS_DATE - now
    tamam = sum(d["tamamlanan"] for d in data["dersler"])
    toplam = sum(d["konular"] for d in data["dersler"])
    yuzde = round(tamam/toplam*100, 1) if toplam > 0 else 0
    ctx = f"[ÖĞRENCİ DURUMU]\nSınava kalan: {kalan.days} gün\nGenel ilerleme: %{yuzde} ({tamam}/{toplam} konu)\n"
    ctx += f"Bugün: {data['gunluk_ilerleme']['soru']} soru, {data['gunluk_ilerleme']['konu']} konu\n"
    for d in data["dersler"]:
        ctx += f"  {d['ad']}: {d['tamamlanan']}/{d['konular']}\n"
    return ctx

def build_rich_context():
    """Tüm kullanıcı verilerini (ders, deneme, uyku, sağlık, çalışma) toplayıp zengin bağlam oluşturur."""
    ctx = build_context()
    data = load_data()
    now = datetime.now()
    kalan = YKS_DATE - now

    # ── Deneme Geçmişi ──
    denemeler = load_json(DENEME_FILE, [])
    if denemeler:
        ctx += "\n[DENEME GEÇMİŞİ]\n"
        denemeler_sorted = sorted(denemeler, key=lambda d: d["tarih"])
        for d in denemeler_sorted[-10:]:
            ders_net = ", ".join(f"{k}: {v}" for k, v in d.get("dersler", {}).items())
            ctx += f"  {d['tarih']} | {d['ad']} | Net: {d.get('toplam_net',0)} | Puan: {d.get('puan',0)}"
            if ders_net:
                ctx += f" | Ders netleri: {ders_net}"
            ctx += "\n"

    # ── Son 7 Gün Çalışma ──
    gunluk = load_json(GUNLUK_FILE, {})
    ctx += "\n[SON 7 GÜN ÇALIŞMA]\n"
    for i in range(6, -1, -1):
        gun = str((now - timedelta(days=i)).date())
        kayit = gunluk.get(gun, {})
        ctx += f"  {gun}: {kayit.get('pomodoro',0)} pomodoro, {kayit.get('calisma_dk',0)} dk çalışma, {kayit.get('mola_dk',0)} dk mola\n"

    # ── Uyku Takibi ──
    uyku_list = load_json(UYKU_FILE, [])
    if uyku_list:
        ctx += "\n[UYKU TAKİBİ - Son 14 Kayıt]\n"
        for u in sorted(uyku_list, key=lambda r: r["tarih"])[-14:]:
            ctx += f"  {u['tarih']}: {u.get('uyku_saati','?')} → {u.get('kalkis_saati','?')} ({u.get('saat',0)} saat) | Kalite: {u.get('kalite','?')}/5"
            if u.get("not"):
                ctx += f" | Not: {u['not']}"
            ctx += "\n"

    # ── Sağlık Profili ──
    saglik_data = load_json(SAGLIK_FILE, {"profil": {}, "kayitlar": []})
    profil = saglik_data.get("profil", {})
    if profil.get("boy") or profil.get("cinsiyet"):
        ctx += f"\n[SAĞLIK PROFİLİ]\n  Boy: {profil.get('boy','?')} cm | Cinsiyet: {profil.get('cinsiyet','?')}\n"
    kilo_kayitlar = saglik_data.get("kayitlar", [])
    if kilo_kayitlar:
        ctx += "  Kilo/BMI geçmişi (son 10):\n"
        for k in sorted(kilo_kayitlar, key=lambda r: r["tarih"])[-10:]:
            ctx += f"    {k['tarih']}: {k.get('kilo','?')} kg | BMI: {k.get('bmi','?')} | Su: {k.get('su',0)} bardak\n"

    # ── Hedef Üniversiteler ──
    hedef_data = load_json(HEDEF_FILE, {"universiteler": []})
    if hedef_data.get("universiteler"):
        ctx += "\n[HEDEF ÜNİVERSİTELER]\n"
        for h in hedef_data["universiteler"]:
            ctx += f"  {h['uni']} - {h['bolum']} (Puan: {h.get('puan',0)}, Sıralama: {h.get('siralama',0)})\n"

    # ── Günlük Hedef ──
    ctx += f"\n[GÜNLÜK HEDEF]\n  Soru: {data['gunluk_hedef']['soru']} | Konu: {data['gunluk_hedef']['konu']}\n"

    # ── Sınava kalan süre ──
    ctx += f"\n[SINAVA KALAN]\n  {kalan.days} gün, {kalan.seconds // 3600} saat\n"

    return ctx

# ── Ana Routes ─────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/status")
def status():
    data = load_data()
    now = datetime.now()
    kalan = YKS_DATE - now
    gunluk = data["gunluk_ilerleme"]
    today_str = str(now.date())
    if gunluk["tarih"] != today_str:
        gunluk = {"soru": 0, "konu": 0, "tarih": today_str}
        data["gunluk_ilerleme"] = gunluk
        save_data(data)
    toplam = sum(d["konular"] for d in data["dersler"])
    tamam = sum(d["tamamlanan"] for d in data["dersler"])
    yuzde = round((tamam / toplam * 100), 1) if toplam > 0 else 0
    return jsonify({
        "kalan_gun": kalan.days, "kalan_saat": kalan.seconds // 3600,
        "kalan_dakika": (kalan.seconds % 3600) // 60,
        "toplam_konu": toplam, "tamamlanan_konu": tamam, "yuzde": yuzde,
        "dersler": data["dersler"], "gunluk_hedef": data["gunluk_hedef"],
        "gunluk_ilerleme": gunluk,
    })

def save_data(data):
    """Verileri kaydet — Supabase varsa oraya da yaz"""
    save_json(DATA_FILE, data)
    if supabase and data.get("dersler"):
        try:
            for ders in data["dersler"]:
                supabase.table("dersler").upsert({
                    "ad": ders["ad"], "konular": ders.get("konular", 0),
                    "tamamlanan": ders.get("tamamlanan", 0),
                    "alt_konular": ders.get("alt_konular", []),
                    "user_id": "default"
                }, on_conflict="ad").execute()
        except Exception as e:
            print(f"Supabase sync: {e}")


# Konu güncelleme
@app.route("/api/konu-guncelle", methods=["POST"])
def konu_guncelle():
    data = load_data()
    body = request.get_json()
    data["dersler"][body["ders_idx"]]["tamamlanan"] = body["tamamlanan"]
    db.dersler_save(data.get("dersler", []))
    return jsonify({"ok": True})

@app.route("/api/alt-konu-guncelle", methods=["POST"])
def alt_konu_guncelle():
    """Tek bir alt konuyu tikle/aç"""
    data = load_data()
    body = request.get_json()
    ders = data["dersler"][body["ders_idx"]]
    if "tamamlanan_alt" not in ders:
        ders["tamamlanan_alt"] = []
    if body["tamamlandi"]:
        if body["konu_idx"] not in ders["tamamlanan_alt"]:
            ders["tamamlanan_alt"].append(body["konu_idx"])
    else:
        ders["tamamlanan_alt"] = [i for i in ders.get("tamamlanan_alt", []) if i != body["konu_idx"]]
    ders["tamamlanan"] = len(ders["tamamlanan_alt"])
    save_json(DATA_FILE, data)
    return jsonify({"ok": True, "tamamlanan": ders["tamamlanan"]})

@app.route("/api/ders-ekle", methods=["POST"])
def ders_ekle():
    data = load_data()
    body = request.get_json()
    data["dersler"].append({"ad": body["ad"], "konular": 0, "tamamlanan": 0, "alt_konular": []})
    save_json(DATA_FILE, data)
    return jsonify({"ok": True})

@app.route("/api/ders-guncelle/<int:idx>", methods=["POST"])
def ders_guncelle(idx):
    data = load_data()
    body = request.get_json()
    if 0 <= idx < len(data["dersler"]):
        if "ad" in body: data["dersler"][idx]["ad"] = body["ad"]
        save_data(data)
    return jsonify({"ok": True})

@app.route("/api/ders-sil/<int:idx>", methods=["DELETE"])
def ders_sil(idx):
    data = load_data()
    if 0 <= idx < len(data["dersler"]):
        data["dersler"].pop(idx)
        save_data(data)
    return jsonify({"ok": True})

@app.route("/api/konu-ekle", methods=["POST"])
def konu_ekle():
    data = load_data()
    body = request.get_json()
    ders = data["dersler"][body["ders_idx"]]
    ders["alt_konular"].append(body["konu_ad"])
    ders["konular"] = len(ders["alt_konular"])
    save_json(DATA_FILE, data)
    return jsonify({"ok": True, "konular": ders["konular"]})

@app.route("/api/konu-sil", methods=["POST"])
def konu_sil():
    data = load_data()
    body = request.get_json()
    ders = data["dersler"][body["ders_idx"]]
    if 0 <= body["konu_idx"] < len(ders["alt_konular"]):
        ders["alt_konular"].pop(body["konu_idx"])
        # Fix tamamlanan_alt indices
        if "tamamlanan_alt" in ders:
            ders["tamamlanan_alt"] = [i if i < body["konu_idx"] else i-1 for i in ders["tamamlanan_alt"] if i != body["konu_idx"]]
        ders["konular"] = len(ders["alt_konular"])
        ders["tamamlanan"] = len(ders.get("tamamlanan_alt", []))
        save_data(data)
    return jsonify({"ok": True, "konular": ders["konular"]})

@app.route("/api/gunluk-guncelle", methods=["POST"])
def gunluk_guncelle():
    data = load_data()
    body = request.get_json()
    data["gunluk_ilerleme"] = {"soru": body["soru"], "konu": body["konu"], "tarih": str(datetime.now().date())}
    save_json(DATA_FILE, data)
    return jsonify({"ok": True})

# ── Deneme Takvimi ────────────────────────────────────────────

@app.route("/api/denemeler", methods=["GET", "POST"])
def denemeler():
    if request.method == "GET":
        liste = load_json(DENEME_FILE, [])
        return jsonify(sorted(liste, key=lambda d: d["tarih"], reverse=True))
    else:
        body = request.get_json()
        liste = load_json(DENEME_FILE, [])
        yeni = {
            "id": str(datetime.now().timestamp()),
            "tarih": body["tarih"], "ad": body["ad"], "tur": body.get("tur", "TYT"),
            "dersler": body.get("dersler", {}),
            "toplam_net": body.get("toplam_net", 0), "puan": body.get("puan", 0),
        }
        liste.append(yeni)
        save_json(DENEME_FILE, liste)
        return jsonify({"ok": True, "deneme": yeni})

@app.route("/api/denemeler/<deneme_id>", methods=["DELETE"])
def deneme_sil(deneme_id):
    liste = load_json(DENEME_FILE, [])
    liste = [d for d in liste if d["id"] != deneme_id]
    save_json(DENEME_FILE, liste)
    return jsonify({"ok": True})

# ── Günlük Kayıt (Pomodoro + çalışma saati) ──────────────────

@app.route("/api/gunluk-kayit", methods=["GET", "POST"])
def gunluk_kayit():
    records = load_json(GUNLUK_FILE, {})
    today = str(datetime.now().date())
    
    if request.method == "GET":
        return jsonify({
            "bugun": records.get(today, {"pomodoro": 0, "calisma_dk": 0, "mola_dk": 0}),
            "gecmis": {k: v for k, v in sorted(records.items(), reverse=True)[:30]}
        })
    else:
        body = request.get_json()
        if today not in records:
            records[today] = {"pomodoro": 0, "calisma_dk": 0, "mola_dk": 0}
        if "pomodoro" in body:
            records[today]["pomodoro"] += body["pomodoro"]
        if "calisma_dk" in body:
            records[today]["calisma_dk"] += body["calisma_dk"]
        if "mola_dk" in body:
            records[today]["mola_dk"] += body["mola_dk"]
        save_json(GUNLUK_FILE, records)
        return jsonify({"ok": True, "bugun": records[today]})

# ── İstatistikler ─────────────────────────────────────────────

@app.route("/api/istatistik")
def istatistik():
    data = load_data()
    denemeler = load_json(DENEME_FILE, [])
    gunluk = load_json(GUNLUK_FILE, {})
    
    # Deneme puan grafiği için
    puan_gecmis = []
    for d in sorted(denemeler, key=lambda x: x["tarih"])[-15:]:
        puan_gecmis.append({"tarih": d["tarih"], "puan": d.get("puan", 0), "ad": d["ad"]})
    
    # Son 7 günlük çalışma
    son_7_gun = {}
    for i in range(6, -1, -1):
        gun = str(datetime.now().date() - timedelta(days=i))
        kayit = gunluk.get(gun, {})
        son_7_gun[gun] = {
            "pomodoro": kayit.get("pomodoro", 0),
            "calisma_dk": kayit.get("calisma_dk", 0),
        }
    
    # Toplam istatistik
    toplam_pomodoro = sum(v.get("pomodoro", 0) for v in gunluk.values())
    toplam_calisma_saat = round(sum(v.get("calisma_dk", 0) for v in gunluk.values()) / 60, 1)
    toplam_deneme = len(denemeler)
    son_puan = puan_gecmis[-1]["puan"] if puan_gecmis else 0
    
    # Haftalık rapor metni
    rapor = []
    if toplam_pomodoro > 0: rapor.append(f"Bu hafta {toplam_pomodoro} pomodoro yaptın.")
    if toplam_calisma_saat > 0: rapor.append(f"Toplam {toplam_calisma_saat} saat çalıştın.")
    if toplam_deneme > 0: rapor.append(f"{toplam_deneme} deneme çözdün, son puanın {son_puan}.")
    tamam_konu = sum(d["tamamlanan"] for d in load_data()["dersler"])
    if tamam_konu > 0: rapor.append(f"{tamam_konu} konu tamamladın.")
    gunluk_data = load_json(GUNLUK_FILE, {})
    bugun_pom = gunluk_data.get(str(datetime.now().date()), {}).get("pomodoro", 0)
    if bugun_pom > 0: rapor.append(f"Bugün {bugun_pom} pomodoro yaptın.")
    
    return jsonify({
        "toplam_pomodoro": toplam_pomodoro,
        "toplam_calisma_saat": toplam_calisma_saat,
        "toplam_deneme": toplam_deneme,
        "son_puan": son_puan,
        "puan_gecmis": puan_gecmis,
        "son_7_gun": son_7_gun,
        "konu_ilerleme": [{"ad": d["ad"], "yuzde": round(d["tamamlanan"]/d["konular"]*100) if d["konular"]>0 else 0} for d in data["dersler"]],
        "rapor": rapor,
    })

# ── AI / DeepSeek ────────────────────────────────────────────

@app.route("/api/ai/config", methods=["GET", "POST"])
def ai_config():
    if request.method == "GET":
        cfg = load_config()
        has_key = bool(cfg.get("api_key") and cfg["api_key"] != "***")
        return jsonify({"api_key": has_key, "model": cfg.get("model", "deepseek-chat")})
    else:
        body = request.get_json()
        cfg = load_config()
        if "api_key" in body:
            key_val = body["api_key"].strip()
            # .env dosyasina yaz
            env_path = os.path.join(os.path.dirname(__file__), ".env")
            with open(env_path, "w") as f:
                f.write(f"DEEPSEEK_API_KEY={key_val}\n")
            # Config'da sadece var/yok bilgisi
            cfg["api_key"] = "***"
        if "model" in body: cfg["model"] = body["model"]
        save_json(CONFIG_FILE, cfg)
        return jsonify({"ok": True})

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    body = request.get_json()
    messages = body.get("messages", [])
    if messages:
        messages[-1]["content"] = f"{build_context()}\n\n[KULLANICI MESAJI]\n{messages[-1]['content']}"
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

@app.route("/api/ai/preset", methods=["POST"])
def ai_preset():
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    body = request.get_json()
    preset, extra = body.get("preset", ""), body.get("extra", "")
    ctx = build_context()
    presets = {
        "konu-anlat": f"{ctx}\n\n'{extra}' konusunu detaylıca anlat. Formüller, örnek sorular, püf noktalar.",
        "soru-coz": f"{ctx}\n\nŞu soruyu adım adım çöz: {extra}",
        "program-yap": f"{ctx}\n\nBu öğrenci için kalan süre ve ilerlemeye göre detaylı haftalık çalışma programı hazırla.",
        "motive-et": f"{ctx}\n\nBu öğrenciye YKS yolculuğunda motive edici, gaz veren bir konuşma yap.",
        "deneme-analiz": f"{ctx}\n\nDeneme netleri: {extra}. Analiz et, eksik konuları söyle.",
        "strateji": f"{ctx}\n\nYKS sınav stratejisi: zaman yönetimi, soru seçimi, stres kontrolü.",
        "tercih": f"{ctx}\n\nBu öğrenciye puanına ve ilgi alanlarına göre üniversite ve bölüm tavsiyesi yap. Gelecek vaat eden bölümleri öner.",
        "kaygi": f"{ctx}\n\nSınav kaygısı yaşayan öğrenciye rahatlatıcı, motive edici tavsiyeler ver. Nefes egzersizleri öner.",
        "ozgecmis": f"{ctx}\n\nÜniversite başvurusu için güçlü bir özgeçmiş taslağı hazırla. Hangi aktiviteleri, başarıları öne çıkarmalı.",
    }
    return jsonify(deepseek_chat([{"role": "user", "content": presets.get(preset, extra)}], cfg["api_key"], cfg.get("model", "deepseek-chat")))

# ── Yeni AI Endpoint'leri ──────────────────────────────────────

@app.route("/api/ai/analiz", methods=["POST"])
def ai_analiz():
    """Kullanıcının tüm verilerini analiz edip kapsamlı rapor döndürür."""
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    ctx = build_rich_context()
    prompt = f"""{ctx}

Yukarıdaki verileri kullanarak bu öğrenci için KAPSAMLI bir analiz raporu hazırla.
Rapor şu başlıkları içermeli:
1. ZAYIF YÖNLER: Hangi derslerde/konularda geride? Uyku düzeni nasıl? Çalışma disiplini yeterli mi?
2. GÜÇLÜ YÖNLER: Hangi alanlarda iyi ilerliyor? Hangi alışkanlıkları olumlu?
3. ÖNÜMÜZDEKİ HAFTA İÇİN ÖNERİLER: Hangi konulara öncelik vermeli? Kaç soru/pomodoro hedeflemeli?
4. TAHMİNİ YKS PUANI: Mevcut deneme puanlarına ve ilerlemeye göre sınavda kaç puan alabilir?
Her başlık altında net, veriye dayalı yorumlar yap. Türkçe, motive edici ve yapıcı ol."""
    messages = [{"role": "user", "content": prompt}]
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

@app.route("/api/ai/program", methods=["POST"])
def ai_program():
    """Kullanıcının verilerine göre kişiselleştirilmiş haftalık çalışma programı oluşturur."""
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    ctx = build_rich_context()
    body = request.get_json(silent=True) or {}
    ekstra = body.get("ekstra", "")
    prompt = f"""{ctx}

Bu öğrenci için KİŞİSELLEŞTİRİLMİŞ bir haftalık çalışma programı hazırla.
Program şunları içermeli:
- Her gün için hangi derslere, hangi konulara çalışacak (sabah/öğle/akşam seansları)
- Günlük çözmesi gereken soru sayısı
- Deneme günleri
- Mola ve dinlenme zamanları
- Uyku düzeni tavsiyesi
Öğrencinin zayıf olduğu konulara öncelik ver. Sınava kalan gün sayısını dikkate al.
{f'Özel istek: {ekstra}' if ekstra else ''}"""
    messages = [{"role": "user", "content": prompt}]
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

@app.route("/api/ai/tahmin", methods=["GET"])
def ai_tahmin():
    """Mevcut deneme puanlarına göre AI'dan tahmini YKS puanı ve sıralama ister."""
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    ctx = build_rich_context()
    prompt = f"""{ctx}

Bu öğrencinin mevcut deneme puanlarını ve ilerleme durumunu analiz ederek şunları TAHMİN ET:
1. TAHMİNİ YKS PUANI: Gerçek sınavda yaklaşık kaç puan alabilir? (TYT, AYT SAY/EA/SÖZ ayrı ayrı)
2. TAHMİNİ SIRALAMA: Bu puanla yaklaşık kaçıncı olabilir? (SAY, EA, SÖZ için ayrı ayrı)
3. PUAN ARTIŞ POTANSİYELİ: Kalan günlerde ne kadar puan artırabilir? Hangi alanlara odaklanırsa en çok artış olur?
4. HEDEF TUTMA OLASILIĞI: Hedeflediği üniversite/bölümü kazanma ihtimali nedir?
Net sayılar ve gerçekçi tahminler ver. Aşırı iyimser veya kötümser olma."""
    messages = [{"role": "user", "content": prompt}]
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

@app.route("/api/ai/konu-anlat", methods=["POST"])
def ai_konu_anlat():
    """Belirli bir konunun detaylı anlatımını, formüllerini, örnek sorularını döndürür."""
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    body = request.get_json()
    konu = body.get("konu", "")
    if not konu:
        return jsonify({"ok": False, "error": "Konu adı gerekli (body: {konu:'Türev'})"}), 400
    ctx = build_context()
    prompt = f"""{ctx}

'{konu}' konusunu YKS seviyesinde DETAYLI bir şekilde anlat. Şunları içermeli:
1. KONU ANLATIMI: Temel kavramlar, mantığı, görsel/anlaşılır açıklamalar
2. ÖNEMLİ FORMÜLLER: Sınavda çıkabilecek tüm kritik formüller
3. PÜF NOKTALAR: Sınavda dikkat edilmesi gereken tuzaklar, kısa yollar
4. ÖRNEK SORULAR: En az 3 adet çözümlü YKS tarzı örnek soru (adım adım çözümleriyle)
5. BU KONUYU ÇALIŞMA STRATEJİSİ: Nasıl çalışmalı, hangi kaynakları kullanmalı, kaç soru çözmeli?"""
    messages = [{"role": "user", "content": prompt}]
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

@app.route("/api/ai/motivasyon-konusmasi", methods=["GET"])
def ai_motivasyon_konusmasi():
    """Kullanıcının verilerini kullanarak kişiselleştirilmiş motivasyon konuşması yapar."""
    cfg = load_config()
    if not cfg.get("api_key", "").strip():
        return jsonify({"ok": False, "error": "Önce API anahtarını gir!"}), 400
    ctx = build_rich_context()
    prompt = f"""{ctx}

Bu öğrenciye KİŞİSELLEŞTİRİLMİŞ, içten ve güçlü bir motivasyon konuşması yap.
Konuşmada şunlar olmalı:
- Öğrencinin şu ana kadarki başarılarına ve çabasına atıf yap (verilerden somut örneklerle)
- Zayıf yönlerini geliştirebileceğine dair inanç ver
- Sınava kalan süreyi en iyi şekilde değerlendirmesi için gaz ver
- YKS'nin hayatının sonu olmadığını ama önemli bir fırsat olduğunu vurgula
- Samimi, arkadaşça, bazen esprili ama her zaman motive edici bir ton kullan
- Konuşmayı güçlü bir kapanış sözüyle bitir (alıntı veya slogan)"""
    messages = [{"role": "user", "content": prompt}]
    return jsonify(deepseek_chat(messages, cfg["api_key"], cfg.get("model", "deepseek-chat")))

# ── Uyku Takibi ───────────────────────────────────────────────

@app.route("/api/uyku", methods=["GET", "POST"])
def uyku():
    records = load_json(UYKU_FILE, [])
    if request.method == "GET":
        return jsonify(sorted(records, key=lambda r: r["tarih"], reverse=True)[:30])
    else:
        body = request.get_json()
        yeni = {
            "id": str(datetime.now().timestamp()),
            "tarih": body.get("tarih", str(datetime.now().date())),
            "uyku_saati": body.get("uyku_saati", "23:00"),
            "kalkis_saati": body.get("kalkis_saati", "07:00"),
            "kalite": body.get("kalite", 3),
            "not": body.get("not", ""),
        }
        # Saat farkını hesapla
        try:
            u = datetime.strptime(yeni["uyku_saati"], "%H:%M")
            k = datetime.strptime(yeni["kalkis_saati"], "%H:%M")
            if k < u: k += timedelta(days=1)
            yeni["saat"] = round((k - u).total_seconds() / 3600, 1)
        except: yeni["saat"] = 0
        records.append(yeni)
        save_json(UYKU_FILE, records)
        return jsonify({"ok": True, "kayit": yeni})

@app.route("/api/uyku/<kayit_id>", methods=["DELETE"])
def uyku_sil(kayit_id):
    records = load_json(UYKU_FILE, [])
    records = [r for r in records if r["id"] != kayit_id]
    save_json(UYKU_FILE, records)
    return jsonify({"ok": True})

# ── Sağlık Takibi ─────────────────────────────────────────────

@app.route("/api/saglik", methods=["GET", "POST"])
def saglik():
    data = load_json(SAGLIK_FILE, {"profil": {"boy": 0, "cinsiyet": ""}, "kayitlar": []})
    if request.method == "GET":
        return jsonify(data)
    else:
        body = request.get_json()
        if "boy" in body:
            data["profil"] = {"boy": body.get("boy", 0), "cinsiyet": body.get("cinsiyet", "")}
        if "kilo" in body:
            tarih = body.get("tarih", str(datetime.now().date()))
            # Aynı tarih varsa güncelle
            mevcut = [k for k in data["kayitlar"] if k["tarih"] == tarih]
            kilo = body["kilo"]
            boy = data["profil"]["boy"]
            bmi = round(kilo / ((boy/100)**2), 1) if boy > 0 else 0
            kayit = {"tarih": tarih, "kilo": kilo, "bmi": bmi, "su": body.get("su", 0)}
            if mevcut:
                mevcut[0].update(kayit)
            else:
                kayit["id"] = str(datetime.now().timestamp())
                data["kayitlar"].append(kayit)
        save_json(SAGLIK_FILE, data)
        return jsonify({"ok": True, "data": data})

# ── Hedef Üniversite ──────────────────────────────────────────

@app.route("/api/hedef", methods=["GET", "POST"])
def hedef():
    data = load_json(HEDEF_FILE, {"universiteler": []})
    if request.method == "GET":
        # Mevcut puanı hesapla
        deneme = load_json(DENEME_FILE, [])
        deneme.sort(key=lambda d: d.get("puan", 0), reverse=True)
        son_puan = deneme[0]["puan"] if deneme else 0
        data["son_puan"] = son_puan
        return jsonify(data)
    else:
        body = request.get_json()
        yeni = {"id": str(datetime.now().timestamp()), "uni": body["uni"], "bolum": body["bolum"],
                "puan": body.get("puan", 0), "siralama": body.get("siralama", 0)}
        data["universiteler"].append(yeni)
        save_json(HEDEF_FILE, data)
        return jsonify({"ok": True, "hedef": yeni})

@app.route("/api/hedef/<hedef_id>", methods=["DELETE"])
def hedef_sil(hedef_id):
    data = load_json(HEDEF_FILE, {"universiteler": []})
    data["universiteler"] = [h for h in data["universiteler"] if h["id"] != hedef_id]
    save_json(HEDEF_FILE, data)
    return jsonify({"ok": True})

# ── Quiz ──────────────────────────────────────────────────────

QUIZ_SORULARI = [
    {"s": "Türkiye'nin en yüksek dağı hangisidir?", "c": ["Ağrı Dağı", "Erciyes", "Uludağ", "Nemrut"], "d": 0, "ders": "Coğrafya"},
    {"s": "Hücre çekirdeğini ilk kez kim gözlemlemiştir?", "c": ["Robert Hooke", "Robert Brown", "Antonie van Leeuwenhoek", "Gregor Mendel"], "d": 1, "ders": "Biyoloji"},
    {"s": "f(x)=x² fonksiyonunun türevi nedir?", "c": ["x", "2x", "x²", "2"], "d": 1, "ders": "Matematik"},
    {"s": "Osmanlı Devleti hangi savaşla 1.Dünya Savaşı'na girmiştir?", "c": ["Çanakkale", "Trablusgarp", "Kafkas Cephesi", "Goeben ve Breslau olayı"], "d": 3, "ders": "Tarih"},
    {"s": "Su molekülünün formülü nedir?", "c": ["CO₂", "H₂O", "NaCl", "H₂SO₄"], "d": 1, "ders": "Kimya"},
    {"s": "Aşağıdakilerden hangisi basit makine değildir?", "c": ["Makara", "Kaldıraç", "Motor", "Eğik düzlem"], "d": 2, "ders": "Fizik"},
    {"s": "Bir üçgenin iç açıları toplamı kaç derecedir?", "c": ["90°", "180°", "270°", "360°"], "d": 1, "ders": "Geometri"},
    {"s": "\"Güneş balçıkla sıvanmaz\" deyimindeki söz sanatı nedir?", "c": ["Teşbih", "İstiare", "Mecaz-ı Mürsel", "Kinaye"], "d": 1, "ders": "Türkçe"},
    {"s": "DNA'nın yapı taşı nedir?", "c": ["Amino asit", "Nükleotit", "Glikoz", "Yağ asidi"], "d": 1, "ders": "Biyoloji"},
    {"s": "Hangi sayı asal değildir?", "c": ["2", "17", "21", "23"], "d": 2, "ders": "Matematik"},
    {"s": "İlk TBMM hangi yıl açılmıştır?", "c": ["1919", "1920", "1921", "1923"], "d": 1, "ders": "Tarih"},
    {"s": "Kovalent bağ nedir?", "c": ["Metal bağı", "Elektron ortaklaşması", "İyon alışverişi", "Hidrojen bağı"], "d": 1, "ders": "Kimya"},
    {"s": "pH değeri 7 olan madde için ne denir?", "c": ["Asit", "Baz", "Nötr", "Tuz"], "d": 2, "ders": "Kimya"},
    {"s": "Türkiye hangi iklim kuşağındadır?", "c": ["Ekvatoral", "Ilıman", "Kutup", "Tropikal"], "d": 1, "ders": "Coğrafya"},
    {"s": "Fotosentez sonucu ne üretilir?", "c": ["CO₂ ve H₂O", "Glikoz ve O₂", "ATP ve CO₂", "NADH ve FADH₂"], "d": 1, "ders": "Biyoloji"},
    {"s": "Mitoz bölünme sonucu kaç hücre oluşur?", "c": ["1", "2", "3", "4"], "d": 1, "ders": "Biyoloji"},
    {"s": "Üçgende yüksekliklerin kesim noktasına ne denir?", "c": ["Ağırlık merkezi", "Diklik merkezi", "İç teğet merkezi", "Çevrel merkezi"], "d": 1, "ders": "Geometri"},
    {"s": "Hangisi yenilenebilir enerji değildir?", "c": ["Güneş", "Rüzgar", "Doğalgaz", "Jeotermal"], "d": 2, "ders": "Coğrafya"},
    {"s": "Görmek fiilinin geniş zaman 3.tekil çekimi?", "c": ["Görür", "Görüyor", "Görecek", "Gördü"], "d": 0, "ders": "Türkçe"},
    {"s": "Işık hızı saniyede yaklaşık kaç km'dir?", "c": ["300.000", "150.000", "1.000.000", "30.000"], "d": 0, "ders": "Fizik"},
    {"s": "Kurtuluş Savaşı hangi yıl başlamıştır?", "c": ["1918", "1919", "1920", "1921"], "d": 1, "ders": "Tarih"},
    {"s": "sin²x + cos²x ifadesinin değeri nedir?", "c": ["0", "1", "sin2x", "2"], "d": 1, "ders": "Matematik"},
    {"s": "En küçük hücre organeli hangisidir?", "c": ["Mitokondri", "Ribozom", "Golgi", "Lizozom"], "d": 1, "ders": "Biyoloji"},
    {"s": "Altın Oran yaklaşık kaçtır?", "c": ["1.414", "1.618", "2.718", "3.141"], "d": 1, "ders": "Matematik"},
    {"s": "Hangisi geçişsiz fiildir?", "c": ["Okumak", "Yazmak", "Uyumak", "Sevmek"], "d": 2, "ders": "Türkçe"},
    {"s": "Periyodik tabloda elementler neye göre sıralanır?", "c": ["Kütle numarası", "Atom numarası", "Elektronegatiflik", "Yoğunluk"], "d": 1, "ders": "Kimya"},
    {"s": "Momentumun birimi nedir?", "c": ["kg·m/s", "N·m", "J/s", "kg/m²"], "d": 0, "ders": "Fizik"},
    {"s": "Türkiye'de kaç coğrafi bölge vardır?", "c": ["5", "6", "7", "8"], "d": 2, "ders": "Coğrafya"},
    {"s": "Lozan Antlaşması hangi yıl imzalandı?", "c": ["1922", "1923", "1924", "1925"], "d": 1, "ders": "Tarih"},
    {"s": "log₁₀100 kaçtır?", "c": ["1", "2", "10", "100"], "d": 1, "ders": "Matematik"},
]

@app.route("/api/quiz")
def quiz():
    import random
    ders = request.args.get("ders", "")
    sorular = [q for q in QUIZ_SORULARI if not ders or q["ders"] == ders]
    secilen = random.sample(sorular, min(10, len(sorular)))
    # Cevap anahtarını gizle
    return jsonify([{k: v for k, v in q.items() if k != "d"} for q in secilen])

@app.route("/api/quiz/kontrol", methods=["POST"])
def quiz_kontrol():
    body = request.get_json()
    soru = body["soru"]
    cevap = body["cevap"]
    # soruyu bul
    for q in QUIZ_SORULARI:
        if q["s"] == soru:
            return jsonify({"dogru": q["d"] == cevap, "dogru_cevap": q["c"][q["d"]]})
    return jsonify({"dogru": False, "dogru_cevap": "?"})

# ── Export ────────────────────────────────────────────────────

@app.route("/api/export")
def export_all():
    return jsonify({
        "data": load_data(),
        "denemeler": load_json(DENEME_FILE, []),
        "gunluk": load_json(GUNLUK_FILE, {}),
        "uyku": load_json(UYKU_FILE, []),
        "saglik": load_json(SAGLIK_FILE, {}),
        "hedef": load_json(HEDEF_FILE, {}),
        "notlar": load_json(NOT_DEFTERI_FILE, []),
        "motivasyon": load_json(MOTIVASYON_FILE, []),
        "export_tarih": str(datetime.now()),
    })

# ── Not Defteri ────────────────────────────────────────────────

@app.route("/api/notlar", methods=["GET", "POST"])
def notlar():
    records = load_json(NOT_DEFTERI_FILE, [])
    if request.method == "GET":
        return jsonify(sorted(records, key=lambda r: r.get("tarih",""), reverse=True))
    else:
        body = request.get_json()
        yeni = {"id": str(datetime.now().timestamp()), "tarih": str(datetime.now().date()),
                "baslik": body.get("baslik", ""), "icerik": body.get("icerik", ""),
                "renk": body.get("renk", "default")}
        records.append(yeni)
        save_json(NOT_DEFTERI_FILE, records)
        return jsonify({"ok": True, "not": yeni})

@app.route("/api/notlar/<not_id>", methods=["DELETE"])
def not_sil(not_id):
    records = load_json(NOT_DEFTERI_FILE, [])
    records = [r for r in records if r["id"] != not_id]
    save_json(NOT_DEFTERI_FILE, records)
    return jsonify({"ok": True})

# ── Motivasyon Duvarı ─────────────────────────────────────────

@app.route("/api/motivasyon", methods=["GET", "POST"])
def motivasyon():
    records = load_json(MOTIVASYON_FILE, [])
    if request.method == "GET":
        return jsonify(records)
    else:
        body = request.get_json()
        yeni = {"id": str(datetime.now().timestamp()), "tip": body.get("tip", "soz"),
                "icerik": body.get("icerik", ""), "tarih": str(datetime.now().date())}
        records.append(yeni)
        save_json(MOTIVASYON_FILE, records)
        return jsonify({"ok": True, "kayit": yeni})

@app.route("/api/motivasyon/<kayit_id>", methods=["DELETE"])
def motivasyon_sil(kayit_id):
    records = load_json(MOTIVASYON_FILE, [])
    records = [r for r in records if r["id"] != kayit_id]
    save_json(MOTIVASYON_FILE, records)
    return jsonify({"ok": True})

# ── Ayarlar ───────────────────────────────────────────────────

@app.route("/api/ayarlar", methods=["GET", "POST"])
def ayarlar():
    defaults = {"tema":"dark","bildirim":True,"pomodoro_calisma":25,"pomodoro_mola":5,"pomodoro_uzun":15,
                "gunluk_soru":200,"gunluk_konu":3,"gunluk_pomodoro":8,"ses":True,"odak_modu":False,
                "koc_adi":"SeeOs Koçu","koc_avatar":"🤖","koc_kisilik":"motive_edici","parcacik":True,"animasyon":True,"konfeti":True,"tema":"dark",
        "moduller":[
            {"id":"dashboard","ad":"Dashboard","aktif":True,"bolum":"yks"},
            {"id":"pomodoro","ad":"Pomodoro","aktif":True,"bolum":"yks"},
            {"id":"deneme","ad":"Deneme Takvimi","aktif":True,"bolum":"yks"},
            {"id":"puan","ad":"Puan Hesapla","aktif":True,"bolum":"yks"},
            {"id":"istatistik","ad":"İstatistikler","aktif":True,"bolum":"yks"},
            {"id":"ai-koc","ad":"AI Koç","aktif":True,"bolum":"yks"},
            {"id":"program","ad":"Ders Programı","aktif":True,"bolum":"yks"},
            {"id":"challenge","ad":"Günlük Görev","aktif":True,"bolum":"yks"},
            {"id":"flashcards","ad":"Flashcards","aktif":True,"bolum":"yks"},
            {"id":"hedef","ad":"Hedef Üniversite","aktif":True,"bolum":"yks"},
            {"id":"liderlik","ad":"Liderlik","aktif":True,"bolum":"yks"},
            {"id":"uyku","ad":"Uyku Takibi","aktif":True,"bolum":"hayat"},
            {"id":"saglik","ad":"Sağlık Takibi","aktif":True,"bolum":"hayat"},
            {"id":"diyet","ad":"Diyet","aktif":True,"bolum":"hayat"},
            {"id":"notlar","ad":"Not Defteri","aktif":True,"bolum":"hayat"},
            {"id":"motivasyon","ad":"Motivasyon Duvarı","aktif":True,"bolum":"hayat"},
            {"id":"yedek","ad":"Veri Yedekle","aktif":True,"bolum":"hayat"}
        ]}
    data = load_json(AYARLAR_FILE, defaults)
    if request.method == "GET":
        return jsonify(data)
    else:
        body = request.get_json()
        data.update(body)
        save_json(AYARLAR_FILE, data)
        return jsonify({"ok": True, "ayarlar": data})

# ── AI History ─────────────────────────────────────────────────

@app.route("/api/ai/history", methods=["GET", "POST", "DELETE"])
def ai_history():
    if request.method == "GET":
        msgs = load_json(AI_HISTORY_FILE, [])
        return jsonify(msgs[-50:])
    elif request.method == "DELETE":
        save_json(AI_HISTORY_FILE, [])
        return jsonify({"ok": True})
    else:
        body = request.get_json()
        msgs = load_json(AI_HISTORY_FILE, [])
        msgs.append({"role": body["role"], "content": body["content"][:500], "tarih": str(datetime.now())})
        if len(msgs) > 100: msgs = msgs[-100:]
        save_json(AI_HISTORY_FILE, msgs)
        return jsonify({"ok": True})

# ── Streak ────────────────────────────────────────────────────

@app.route("/api/streak")
def streak():
    gunluk = load_json(GUNLUK_FILE, {})
    tarihler = sorted(gunluk.keys())
    if not tarihler: return jsonify({"streak": 0, "en_uzun": 0})
    streak_count = 0; max_streak = 0; prev = None
    for t in sorted(set(str(datetime.now().date() - timedelta(days=i)) for i in range(365)) & set(tarihler)):
        if prev is None:
            streak_count = 1
        elif (datetime.strptime(t, "%Y-%m-%d") - datetime.strptime(prev, "%Y-%m-%d")).days == 1:
            streak_count += 1
        else:
            streak_count = 1
        max_streak = max(max_streak, streak_count)
        prev = t
    return jsonify({"streak": streak_count, "en_uzun": max_streak})


# ── Ders Programı ─────────────────────────────────────────────

@app.route("/api/program", methods=["GET", "POST"])
def program():
    data = load_json(PROGRAM_FILE, {})
    if request.method == "GET":
        return jsonify(data)
    else:
        body = request.get_json()
        data.update(body)
        save_json(PROGRAM_FILE, data)
        return jsonify({"ok": True})

# ── Günlük Challenge ─────────────────────────────────────────

CHALLENGES = [
    "Bugün 50 paragraf sorusu çöz 📖", "20 geometri sorusu çöz 📐", "1 saat matematik tekrarı yap 🧮",
    "Ezber kartlarını gözden geçir 🃏", "Deneme sınavı analizi yap 📊", "Kimya formüllerini tekrar et 🧪",
    "İngilizce 20 kelime öğren 🌍", "30 dakika yürüyüş yap 🚶", "Bol su iç - en az 8 bardak 💧",
    "Tarih kronolojisi çalış 🏛️", "Fizik problem çözümü izle ⚡", "Biyoloji şema çiz 🧬",
]

@app.route("/api/challenge", methods=["GET", "POST"])
def challenge():
    import random
    data = load_json(CHALLENGE_FILE, {"tarih": str(datetime.now().date()), "gorevler": [], "tamamlanan": []})
    today = str(datetime.now().date())
    if data["tarih"] != today or not data.get("gorevler"):
        data = {"tarih": today, "gorevler": random.sample(CHALLENGES, 3), "tamamlanan": []}
        save_json(CHALLENGE_FILE, data)
    if request.method == "GET":
        return jsonify(data)
    else:
        body = request.get_json()
        if body.get("tamamla"):
            idx = body["idx"]
            if idx not in data["tamamlanan"]: data["tamamlanan"].append(idx)
        if body.get("ozel"):
            data["gorevler"].append(body["ozel"])
        if body.get("tamamla") or body.get("ozel"):
            save_json(CHALLENGE_FILE, data)
        return jsonify({"ok": True, "data": data})

# ── Flashcards ────────────────────────────────────────────────

@app.route("/api/flashcards", methods=["GET", "POST"])
def flashcards():
    records = load_json(FLASHCARD_FILE, [])
    if request.method == "GET":
        return jsonify(sorted(records, key=lambda r: r.get("tarih",""), reverse=True))
    else:
        body = request.get_json()
        yeni = {"id": str(datetime.now().timestamp()), "on": body["on"], "arka": body["arka"],
                "ders": body.get("ders", "Genel"), "tarih": str(datetime.now().date()),
                "kutu": body.get("kutu", 1), "son_calisma": None}
        records.append(yeni)
        save_json(FLASHCARD_FILE, records)
        return jsonify({"ok": True, "kart": yeni})

@app.route("/api/flashcards/<kart_id>", methods=["DELETE", "PATCH"])
def flashcard_islem(kart_id):
    records = load_json(FLASHCARD_FILE, [])
    if request.method == "DELETE":
        records = [r for r in records if r["id"] != kart_id]
        save_json(FLASHCARD_FILE, records)
        return jsonify({"ok": True})
    else:
        body = request.get_json()
        for r in records:
            if r["id"] == kart_id:
                if "kutu" in body:
                    kutu = body["kutu"]
                    r["kutu"] = max(1, min(5, kutu))  # 1-5 arası
                # Eski seviye alanını geriye dönük destekle
                if "seviye" in body:
                    r["seviye"] = body["seviye"]
                r["son_calisma"] = str(datetime.now().date())
        save_json(FLASHCARD_FILE, records)
        return jsonify({"ok": True})

# ── Leitner Flashcard Çalışma ──────────────────────────────────
# Kutu aralıkları (gün): Kutu1=1, Kutu2=2, Kutu3=4, Kutu4=7, Kutu5=14

@app.route("/api/flashcards/study", methods=["GET"])
def flashcard_study():
    """Leitner algoritmasıyla bugün çalışılması gereken kartları döndür"""
    records = load_json(FLASHCARD_FILE, [])
    today = datetime.now().date()
    kutu_aralik = {1: 1, 2: 2, 3: 4, 4: 7, 5: 14}
    calisilacak = []
    
    for r in records:
        kutu = r.get("kutu", r.get("seviye", 1))
        son = r.get("son_calisma")
        if son is None:
            # Hiç çalışılmamış kart → bugün çalış
            calisilacak.append(r)
        else:
            try:
                son_tarih = datetime.strptime(son, "%Y-%m-%d").date()
            except:
                son_tarih = None
            if son_tarih is None:
                calisilacak.append(r)
            else:
                gecen_gun = (today - son_tarih).days
                aralik = kutu_aralik.get(kutu, 1)
                if gecen_gun >= aralik:
                    calisilacak.append(r)
    
    # Önce düşük kutular, sonra yüksek kutular
    calisilacak.sort(key=lambda r: r.get("kutu", r.get("seviye", 1)))
    
    return jsonify({
        "bugun": str(today),
        "toplam": len(calisilacak),
        "kartlar": calisilacak,
    })


# ═══════════════════════════════════════════════════════════════
# ── XP / Level Sistemi ────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════

AKSIYON_XP = {
    "pomodoro": 25,
    "deneme": 50,
    "konu": 20,
    "gunluk": 15,
}

@app.route("/api/xp", methods=["GET", "POST"])
def xp_system():
    """XP/Level sistemi: GET mevcut durumu, POST XP ekler"""
    xp_data = load_json(XP_FILE, {"xp": 0, "level": 1, "toplam_xp": 0})

    if request.method == "GET":
        return jsonify(xp_data)

    # POST: XP ekle
    body = request.get_json()
    action = body.get("action", "")
    miktar = body.get("miktar", 0)

    if action not in AKSIYON_XP:
        return jsonify({"ok": False, "error": f"Geçersiz aksiyon: {action}. Geçerli: {list(AKSIYON_XP.keys())}"}), 400

    kazanc = AKSIYON_XP[action] * miktar
    if kazanc <= 0:
        kazanc = AKSIYON_XP[action]  # miktar verilmezse varsayılan 1

    xp_data["xp"] += kazanc
    xp_data["toplam_xp"] += kazanc

    # Level hesapla: her level için level * 100 XP gerekir
    # level 1→2 = 100, 2→3 = 200, 3→4 = 300, ...
    while True:
        gerekli_xp = xp_data["level"] * 100
        if xp_data["xp"] >= gerekli_xp:
            xp_data["xp"] -= gerekli_xp
            xp_data["level"] += 1
        else:
            break

    save_json(XP_FILE, xp_data)
    return jsonify({
        "ok": True,
        "kazanc": kazanc,
        "action": action,
        **xp_data,
        "sonraki_level_xp": xp_data["level"] * 100,  # Bir sonraki level için gereken
    })


# ═══════════════════════════════════════════════════════════════
# ── Deneme Karşılaştırma / Analiz ─────────────────────────────
# ═══════════════════════════════════════════════════════════════

@app.route("/api/deneme-analiz", methods=["GET"])
def deneme_analiz():
    """Denemeleri analiz et: en zayıf 5 konu, son 2 deneme karşılaştırması"""
    denemeler = load_json(DENEME_FILE, [])

    if not denemeler:
        return jsonify({"ok": False, "error": "Henüz deneme kaydı yok"}), 404

    # Tarihe göre sırala
    denemeler.sort(key=lambda d: d["tarih"])

    # ── Ders bazında net ortalaması ──
    ders_netleri = defaultdict(lambda: {"toplam": 0.0, "sayi": 0})

    for d in denemeler:
        for ders_ad, net in d.get("dersler", {}).items():
            ders_netleri[ders_ad]["toplam"] += net
            ders_netleri[ders_ad]["sayi"] += 1

    zayif_konular = []
    for ders_ad, veri in ders_netleri.items():
        if veri["sayi"] > 0:
            net_ort = round(veri["toplam"] / veri["sayi"], 2)
            zayif_konular.append({"ders": ders_ad, "net_ort": net_ort, "deneme_sayisi": veri["sayi"]})

    # En düşük net ortalamasına göre sırala
    zayif_konular.sort(key=lambda x: x["net_ort"])
    zayif_konular = zayif_konular[:5]

    # ── Son iki deneme karşılaştırması ──
    son_karsilastirma = None
    if len(denemeler) >= 2:
        d1, d2 = denemeler[-2], denemeler[-1]
        fark_dersler = {}
        tum_dersler = set()
        if d1.get("dersler"):
            tum_dersler.update(d1["dersler"].keys())
        if d2.get("dersler"):
            tum_dersler.update(d2["dersler"].keys())

        for ders_ad in sorted(tum_dersler):
            n1 = d1.get("dersler", {}).get(ders_ad, 0)
            n2 = d2.get("dersler", {}).get(ders_ad, 0)
            fark_dersler[ders_ad] = {
                "onceki": n1,
                "son": n2,
                "fark": round(n2 - n1, 2),
            }

        son_karsilastirma = {
            "deneme1": {"tarih": d1["tarih"], "ad": d1["ad"], "toplam_net": d1.get("toplam_net", 0), "puan": d1.get("puan", 0)},
            "deneme2": {"tarih": d2["tarih"], "ad": d2["ad"], "toplam_net": d2.get("toplam_net", 0), "puan": d2.get("puan", 0)},
            "toplam_fark": round(d2.get("toplam_net", 0) - d1.get("toplam_net", 0), 2),
            "puan_fark": round(d2.get("puan", 0) - d1.get("puan", 0), 2),
            "ders_farklari": fark_dersler,
        }

    # ── Genel trend ──
    trend = []
    for d in denemeler:
        trend.append({
            "tarih": d["tarih"],
            "ad": d["ad"],
            "toplam_net": d.get("toplam_net", 0),
            "puan": d.get("puan", 0),
        })

    return jsonify({
        "ok": True,
        "toplam_deneme": len(denemeler),
        "zayif_konular": zayif_konular,
        "son_karsilastirma": son_karsilastirma,
        "trend": trend,
    })


# ═══════════════════════════════════════════════════════════════
# ── Gerçek YKS Puan Hesaplama (2024 ÖSYM katsayıları) ───────
# ═══════════════════════════════════════════════════════════════

# 2024 ÖSYM Yaklaşık Ağırlık Katsayıları (standart puana dönüştürülmüş)
# TYT: Her testten 40 soru, toplam 120 soru. TYT puanı 100-500 arası.
# Ham puan = Her test için standart puan * ağırlık toplamı
# Basitleştirilmiş model: net → standart puan dönüşümü
def _tyt_standart(net, max_soru=40):
    """Net sayısını yaklaşık TYT standart puana dönüştür (ortalama 50, std 10)"""
    if max_soru == 0:
        return 0
    oran = net / max_soru
    # Yaklaşık: 0 net → 40, 40 net → 80+ bandı
    # Ortalama 15 net civarı 50 standart puan
    return round(40 + oran * 60, 4)  # 40-100 arası

def _ayt_standart(net, max_soru=40):
    """AYT standart puan dönüşümü"""
    if max_soru == 0:
        return 0
    oran = net / max_soru
    return round(40 + oran * 60, 4)

@app.route("/api/yks-puan", methods=["POST"])
def yks_puan_hesapla():
    """
    2024 ÖSYM katsayılarıyla gerçek YKS puanı hesapla.
    Body: {
        tyt: {tr, sos, mat, fen},
        ayt: {mat, fiz, kim, biy},   # SAY için
        obp: 80  (opsiyonel, varsayılan 80)
    }
    SAY/EA/SÖZ/DİL için ayrı ayrı hesaplar.
    """
    body = request.get_json()
    tyt = body.get("tyt", {})
    ayt = body.get("ayt", {})
    obp = body.get("obp", 80)

    # ── TYT Standart Puanlar ──
    tyt_tr = _tyt_standart(tyt.get("tr", 0), 40)
    tyt_sos = _tyt_standart(tyt.get("sos", 0), 20)  # TYT Sosyal 20 soru
    tyt_mat = _tyt_standart(tyt.get("mat", 0), 40)
    tyt_fen = _tyt_standart(tyt.get("fen", 0), 20)  # TYT Fen 20 soru

    # TYT Ham Puan (her test %25 ağırlık)
    TYT_AGIRLIK = {"tr": 0.25, "sos": 0.25, "mat": 0.25, "fen": 0.25}

    tyt_ham = (
        tyt_tr * TYT_AGIRLIK["tr"] +
        tyt_sos * TYT_AGIRLIK["sos"] +
        tyt_mat * TYT_AGIRLIK["mat"] +
        tyt_fen * TYT_AGIRLIK["fen"]
    )

    # TYT yerleştirme puanı: TYT ham + OBP katkısı
    def tyt_puan_500(t_ham):
        """TYT ham puanı 100-500 skalasına dönüştür"""
        return round(100 + (t_ham - 40) * (400 / 60), 4)

    tyt_puan = tyt_puan_500(tyt_ham)
    tyt_puan_obp = round(tyt_puan + obp * 0.6, 4)

    # ── AYT Standart Puanlar ──
    ayt_mat = _ayt_standart(ayt.get("mat", 0), 40)
    ayt_fiz = _ayt_standart(ayt.get("fiz", 0), 14)
    ayt_kim = _ayt_standart(ayt.get("kim", 0), 13)
    ayt_biy = _ayt_standart(ayt.get("biy", 0), 13)
    ayt_edb = _ayt_standart(ayt.get("edb", 0), 24)     # EA/SÖZ
    ayt_tar1 = _ayt_standart(ayt.get("tar1", 0), 10)   # EA/SÖZ
    ayt_cog1 = _ayt_standart(ayt.get("cog1", 0), 6)    # EA/SÖZ
    ayt_tar2 = _ayt_standart(ayt.get("tar2", 0), 11)   # SÖZ
    ayt_cog2 = _ayt_standart(ayt.get("cog2", 0), 11)   # SÖZ
    ayt_fel = _ayt_standart(ayt.get("fel", 0), 12)     # SÖZ
    ayt_din = _ayt_standart(ayt.get("din", 0), 6)      # SÖZ

    ydt = _ayt_standart(ayt.get("ydt", 0), 80)  # DİL

    # ── Yerleştirme Puanı Hesaplama ──
    # TYT %40 + AYT %60 ağırlıkla
    def hesapla_yerlestirme(tyt_p, ayt_p):
        ham = round(tyt_p * 0.4 + ayt_p * 0.6, 4)
        yerlestirme = round(ham + obp * 0.6, 4)
        return {"ham": ham, "yerlestirme": yerlestirme}

    # SAY: AYT Mat(%30) + Fiz(%10) + Kim(%10) + Biy(%10) → AYT %60 içinde
    # Basitleştirilmiş: AYT testlerinin ortalaması
    ayt_say_ham = round((ayt_mat + ayt_fiz + ayt_kim + ayt_biy) / 4, 4)
    ayt_say_500 = tyt_puan_500(ayt_say_ham)
    say = hesapla_yerlestirme(tyt_puan, ayt_say_500)

    # EA: AYT Mat(%30) + Edebiyat(%18) + Tarih-1(%7) + Coğrafya-1(%5)
    ayt_ea_ham = round((ayt_mat + ayt_edb + ayt_tar1 + ayt_cog1) / 4, 4)
    ayt_ea_500 = tyt_puan_500(ayt_ea_ham)
    ea = hesapla_yerlestirme(tyt_puan, ayt_ea_500)

    # SÖZ: Edebiyat(%18) + Tarih-1(%7) + Coğrafya-1(%5) + Tarih-2(%8) + Coğrafya-2(%8) + Felsefe(%9) + Din(%5)
    ayt_soz_ham = round((ayt_edb + ayt_tar1 + ayt_cog1 + ayt_tar2 + ayt_cog2 + ayt_fel + ayt_din) / 7, 4)
    ayt_soz_500 = tyt_puan_500(ayt_soz_ham)
    soz = hesapla_yerlestirme(tyt_puan, ayt_soz_500)

    # DİL: YDT
    ayt_dil_500 = tyt_puan_500(ydt)
    dil = hesapla_yerlestirme(tyt_puan, ayt_dil_500)

    return jsonify({
        "ok": True,
        "tyt": {
            "netler": tyt,
            "standart_puanlar": {"tr": tyt_tr, "sos": tyt_sos, "mat": tyt_mat, "fen": tyt_fen},
            "ham_puan": tyt_puan,
            "yerlestirme_puan": tyt_puan_obp,
        },
        "ayt_netler": ayt,
        "obp": obp,
        "puanlar": {
            "SAY": say,
            "EA": ea,
            "SOZ": soz,
            "DIL": dil,
        },
        "not": "Bu hesaplama yaklaşık 2024 ÖSYM katsayılarına dayanır. Gerçek sınavda standart sapma ve ortalama değişebilir.",
    })


# ── Diyet Takibi ──────────────────────────────────────────────

YIYECEKLER = {
    "Yulaf (100g)":370,"Tam Buğday Ekmek (1 dilim)":70,"Beyaz Ekmek (1 dilim)":80,"Yumurta (haşlanmış)":78,"Peynir (beyaz, 30g)":90,
    "Süt (1 bardak)":120,"Yoğurt (1 kase)":100,"Muz":105,"Elma":52,"Portakal":62,"Ceviz (5 adet)":100,"Badem (10 adet)":70,
    "Tavuk Göğsü (100g)":165,"Köfte (100g)":250,"Balık (100g)":180,"Pilav (1 porsiyon)":250,"Makarna (1 porsiyon)":300,
    "Mercimek Çorbası":140,"Tarhana Çorbası":120,"Zeytinyağlı (1 porsiyon)":150,"Salata (sade)":30,"Çikolata (1 kare)":55,
    "Simit":270,"Poğaça":300,"Börek (1 dilim)":280,"Su (1 bardak)":0,"Çay (şekersiz)":0,"Türk Kahvesi":5,
    "Kola (1 kutu)":140,"Ayran":80,"Kumpir":500,"Döner (1 porsiyon)":450,"Lahmacun":280,"Pide (1 dilim)":350,
}

@app.route("/api/diyet", methods=["GET", "POST"])
def diyet():
    data = load_json(DIYET_FILE, {"hedef_kilo":0,"gunluk_kalori":2000,"baslangic_kilo":0,"kayitlar":[]})
    if request.method == "GET":
        today = str(datetime.now().date())
        bugun = next((k for k in data["kayitlar"] if k["tarih"]==today), None)
        data["bugun_kalori"] = sum(o["kalori"] for o in bugun["ogunler"]) if bugun else 0
        data["kalan_kalori"] = data["gunluk_kalori"] - data["bugun_kalori"]
        # Kilo geçmişi
        data["kilo_gecmis"] = [{"tarih":k["tarih"],"kilo":k.get("kilo",0)} for k in data["kayitlar"] if k.get("kilo")][-30:]
        if data["hedef_kilo"] and data["baslangic_kilo"]:
            data["kilo_fark"] = round(data["baslangic_kilo"] - data["hedef_kilo"],1)
            data["gidilen_yol"] = round(data["baslangic_kilo"] - (data["kilo_gecmis"][-1]["kilo"] if data["kilo_gecmis"] else data["baslangic_kilo"]),1)
        return jsonify(data)
    else:
        body = request.get_json()
        if "hedef_kilo" in body: data["hedef_kilo"]=body["hedef_kilo"]
        if "gunluk_kalori" in body: data["gunluk_kalori"]=body["gunluk_kalori"]
        if "baslangic_kilo" in body: data["baslangic_kilo"]=body["baslangic_kilo"]
        if "ogun" in body:
            today = str(datetime.now().date())
            bugun = next((k for k in data["kayitlar"] if k["tarih"]==today), None)
            if not bugun:
                bugun = {"tarih":today,"ogunler":[],"kilo":0}
                data["kayitlar"].append(bugun)
            bugun["ogunler"].append({"ogun":body["ogun"],"yemek":body["yemek"],"kalori":body["kalori"]})
            # Kalori hedef aşımı kontrolü - negatif kalori gönderme
            toplam = sum(o["kalori"] for o in bugun["ogunler"])
            if data["gunluk_kalori"] > 0 and toplam > data["gunluk_kalori"]:
                data["uyari"] = f"Dikkat! Günlük kalori hedefini {toplam-data['gunluk_kalori']} kalori aştın!"
        if "kilo" in body:
            today = str(datetime.now().date())
            bugun = next((k for k in data["kayitlar"] if k["tarih"]==today), None)
            if not bugun:
                bugun = {"tarih":today,"ogunler":[],"kilo":0}
                data["kayitlar"].append(bugun)
            bugun["kilo"] = body["kilo"]
        save_json(DIYET_FILE, data)
        return jsonify({"ok":True,"data":data})

@app.route("/api/yemekler")
def yemekler():
    ara = request.args.get("ara","").lower()
    sonuc = {k:v for k,v in YIYECEKLER.items() if ara in k.lower()} if ara else YIYECEKLER
    return jsonify(dict(sorted(sonuc.items(), key=lambda x: x[1])[:20]))

# ── Aile Modülü ───────────────────────────────────────────────

@app.route("/api/aile", methods=["GET", "POST"])
def aile():
    data = load_json(AILE_FILE, {"uyeler":[]})
    if request.method == "GET":
        return jsonify(data)
    else:
        body = request.get_json()
        if body.get("sil"):
            data["uyeler"] = [u for u in data["uyeler"] if u["id"] != body["sil"]]
        else:
            uye = {"id":str(datetime.now().timestamp()),"ad":body["ad"],"rol":body.get("rol","Aile"),
                   "not":body.get("not",""),"foto":"","tarih":str(datetime.now().date()),
                   "bagli":body.get("bagli","")}
            data["uyeler"].append(uye)
        save_json(AILE_FILE, data)
        return jsonify({"ok":True,"data":data})

@app.route("/api/aile/foto/<uye_id>", methods=["POST"])
def aile_foto(uye_id):
    data = load_json(AILE_FILE, {"uyeler":[]})
    uye = next((u for u in data["uyeler"] if u["id"]==uye_id), None)
    if not uye: return jsonify({"ok":False,"error":"Üye bulunamadı"}), 404
    body = request.get_json()
    foto_data = body.get("foto","")
    if foto_data and foto_data.startswith("data:image"):
        import base64, re
        img_data = re.sub('^data:image/.+;base64,','',foto_data)
        filename = f"{uye_id}.jpg"
        filepath = os.path.join(FOTO_DIR, filename)
        with open(filepath, "wb") as f: f.write(base64.b64decode(img_data))
        uye["foto"] = f"/api/aile/foto/{uye_id}"
    save_json(AILE_FILE, data)
    return jsonify({"ok":True})

@app.route("/api/aile/foto/<uye_id>", methods=["GET"])
def aile_foto_getir(uye_id):
    from flask import send_file
    filepath = os.path.join(FOTO_DIR, f"{uye_id}.jpg")
    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/jpeg')
    return "", 404

# ═══════════════════════════════════════════════════════════════
# ── Wayback Machine ───────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════

@app.route("/api/wayback", methods=["GET"])
def wayback():
    """Belirtilen tarihteki tüm verileri yeniden oluşturur."""
    tarih_str = request.args.get("tarih", str(datetime.now().date()))
    try:
        target_date = datetime.strptime(tarih_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"ok": False, "error": "Geçersiz tarih formatı. Örnek: ?tarih=2026-06-15"}), 400

    # ── Ders ilerlemesi (mevcut durum - geçmişe dönük iz yok) ──
    data = load_data()
    dersler = data.get("dersler", [])

    # O günkü günlük ilerleme
    gunluk_ilerleme = data.get("gunluk_ilerleme", {})
    if gunluk_ilerleme.get("tarih") == tarih_str:
        o_gun_ilerleme = gunluk_ilerleme
    else:
        o_gun_ilerleme = {"soru": 0, "konu": 0, "tarih": tarih_str}

    # ── Denemeler (o tarihe kadar olanlar) ──
    denemeler = load_json(DENEME_FILE, [])
    o_tarih_denemeler = [d for d in denemeler if d.get("tarih", "") <= tarih_str]
    o_tarih_denemeler.sort(key=lambda d: d.get("tarih", ""))

    # ── Günlük kayıtlar (o tarihe kadar) ──
    gunluk = load_json(GUNLUK_FILE, {})
    o_gun_gunluk = gunluk.get(tarih_str, {})
    o_tarih_gunluk = {k: v for k, v in gunluk.items() if k <= tarih_str}

    # ── Uyku (o tarihe kadar) ──
    uyku_list = load_json(UYKU_FILE, [])
    o_tarih_uyku = [u for u in uyku_list if u.get("tarih", "") <= tarih_str]
    o_tarih_uyku.sort(key=lambda r: r.get("tarih", ""))

    # ── Sağlık (o tarihe kadar) ──
    saglik_data = load_json(SAGLIK_FILE, {"profil": {}, "kayitlar": []})
    o_tarih_saglik_kayit = [k for k in saglik_data.get("kayitlar", []) if k.get("tarih", "") <= tarih_str]
    o_tarih_saglik_kayit.sort(key=lambda r: r.get("tarih", ""))

    # ── Diyet (o tarihe kadar) ──
    diyet_data = load_json(DIYET_FILE, {"hedef_kilo": 0, "gunluk_kalori": 2000, "baslangic_kilo": 0, "kayitlar": []})
    o_tarih_diyet_kayit = [k for k in diyet_data.get("kayitlar", []) if k.get("tarih", "") <= tarih_str]
    o_tarih_diyet_kayit.sort(key=lambda r: r.get("tarih", ""))

    # ── XP (mevcut durum - geçmişe dönük iz yok) ──
    xp_data = load_json(XP_FILE, {"xp": 0, "level": 1, "toplam_xp": 0})

    # ── Notlar (o tarihe kadar) ──
    notlar = load_json(NOT_DEFTERI_FILE, [])
    o_tarih_notlar = [n for n in notlar if n.get("tarih", "") <= tarih_str]

    # ── Motivasyon (o tarihe kadar) ──
    motivasyon_list = load_json(MOTIVASYON_FILE, [])
    o_tarih_motivasyon = [m for m in motivasyon_list if m.get("tarih", "") <= tarih_str]

    # ── Program (mevcut durum) ──
    program_data = load_json(PROGRAM_FILE, {})

    # ── Challenge (o günkü) ──
    challenge_data = load_json(CHALLENGE_FILE, {"tarih": "", "gorevler": [], "tamamlanan": []})
    if challenge_data.get("tarih") == tarih_str:
        o_gun_challenge = challenge_data
    else:
        o_gun_challenge = {"tarih": tarih_str, "gorevler": [], "tamamlanan": []}

    # ── Hedef (mevcut durum) ──
    hedef_data = load_json(HEDEF_FILE, {"universiteler": []})

    # ── İstatistikler (o tarihe göre) ──
    toplam_pomodoro = sum(v.get("pomodoro", 0) for v in o_tarih_gunluk.values())
    toplam_calisma_dk = sum(v.get("calisma_dk", 0) for v in o_tarih_gunluk.values())
    toplam_calisma_saat = round(toplam_calisma_dk / 60, 1)

    return jsonify({
        "ok": True,
        "tarih": tarih_str,
        "dersler": dersler,
        "gunluk_ilerleme": o_gun_ilerleme,
        "gunluk_kayit": o_gun_gunluk,
        "denemeler": o_tarih_denemeler,
        "deneme_sayisi": len(o_tarih_denemeler),
        "uyku": o_tarih_uyku[-14:] if o_tarih_uyku else [],
        "saglik": {
            "profil": saglik_data.get("profil", {}),
            "kayitlar": o_tarih_saglik_kayit[-10:],
        },
        "diyet": {
            "hedef_kilo": diyet_data.get("hedef_kilo", 0),
            "gunluk_kalori": diyet_data.get("gunluk_kalori", 2000),
            "baslangic_kilo": diyet_data.get("baslangic_kilo", 0),
            "kayitlar": o_tarih_diyet_kayit[-10:],
        },
        "xp": xp_data,
        "notlar": o_tarih_notlar[-20:],
        "motivasyon": o_tarih_motivasyon[-20:],
        "program": program_data,
        "challenge": o_gun_challenge,
        "hedef": hedef_data,
        "istatistik": {
            "toplam_pomodoro": toplam_pomodoro,
            "toplam_calisma_saat": toplam_calisma_saat,
            "toplam_calisma_dk": toplam_calisma_dk,
            "toplam_deneme": len(o_tarih_denemeler),
            "gun_sayisi": len(o_tarih_gunluk),
        },
        "surec_bilgisi": {
            "soru_cozulen": sum(v.get("soru", 0) for v in o_tarih_gunluk.values()),
            "konu_calisilan": sum(v.get("konu", 0) for v in o_tarih_gunluk.values()),
        },
    })


# ═══════════════════════════════════════════════════════════════
# ── PDF Export Verisi ─────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════

@app.route("/api/export/pdf", methods=["GET"])
def export_pdf():
    """Frontend'de PDF oluşturmak için tüm veriyi yapılandırılmış formatta döndürür."""
    data = load_data()
    denemeler = load_json(DENEME_FILE, [])
    gunluk = load_json(GUNLUK_FILE, {})
    uyku_list = load_json(UYKU_FILE, [])
    saglik_data = load_json(SAGLIK_FILE, {"profil": {}, "kayitlar": []})
    hedef_data = load_json(HEDEF_FILE, {"universiteler": []})
    program_data = load_json(PROGRAM_FILE, {})
    xp_data = load_json(XP_FILE, {"xp": 0, "level": 1, "toplam_xp": 0})
    challenge_data = load_json(CHALLENGE_FILE, {"tarih": "", "gorevler": [], "tamamlanan": []})

    now = datetime.now()
    today_str = str(now.date())

    # ── Haftalık Program ──
    gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
    if program_data:
        # Program JSON varsa onu kullan
        program_list = []
        for i, gun in enumerate(gunler):
            gun_key = str(i)  # "0"-"6" veya gun adı
            gun_data = program_data.get(gun_key) or program_data.get(gun) or {}
            saatler = []
            if isinstance(gun_data, dict):
                for saat, ders in sorted(gun_data.items()):
                    saatler.append({"saat": saat, "ders": ders})
            elif isinstance(gun_data, list):
                for item in gun_data:
                    if isinstance(item, dict):
                        saatler.append({"saat": item.get("saat", ""), "ders": item.get("ders", "")})
            program_list.append({"gun": gun, "saatler": saatler})
    else:
        # Varsayılan boş program
        program_list = [{"gun": g, "saatler": []} for g in gunler]

    # ── İstatistikler ──
    toplam_konu = sum(d["konular"] for d in data["dersler"])
    tamam_konu = sum(d["tamamlanan"] for d in data["dersler"])
    kalan = YKS_DATE - now

    toplam_pomodoro = sum(v.get("pomodoro", 0) for v in gunluk.values())
    toplam_calisma_dk = sum(v.get("calisma_dk", 0) for v in gunluk.values())
    toplam_mola_dk = sum(v.get("mola_dk", 0) for v in gunluk.values())

    son_deneme = denemeler[-1] if denemeler else None

    # Son 7 gün çalışma
    son_7_gun = {}
    for i in range(6, -1, -1):
        gun = str((now - timedelta(days=i)).date())
        kayit = gunluk.get(gun, {})
        son_7_gun[gun] = {
            "pomodoro": kayit.get("pomodoro", 0),
            "calisma_dk": kayit.get("calisma_dk", 0),
            "mola_dk": kayit.get("mola_dk", 0),
        }

    # Konu ilerleme yüzdeleri
    konu_ilerleme = []
    for d in data["dersler"]:
        konu_ilerleme.append({
            "ad": d["ad"],
            "konu_sayisi": d["konular"],
            "tamamlanan": d["tamamlanan"],
            "yuzde": round(d["tamamlanan"] / d["konular"] * 100, 1) if d["konular"] > 0 else 0,
        })

    istatistikler = {
        "sinava_kalan_gun": kalan.days,
        "toplam_konu": toplam_konu,
        "tamamlanan_konu": tamam_konu,
        "genel_ilerleme_yuzde": round(tamam_konu / toplam_konu * 100, 1) if toplam_konu > 0 else 0,
        "toplam_pomodoro": toplam_pomodoro,
        "toplam_calisma_saat": round(toplam_calisma_dk / 60, 1),
        "toplam_mola_saat": round(toplam_mola_dk / 60, 1),
        "toplam_deneme": len(denemeler),
        "son_deneme_puan": son_deneme.get("puan", 0) if son_deneme else 0,
        "son_deneme_tarih": son_deneme.get("tarih", "") if son_deneme else "",
        "gunluk_hedef_soru": data["gunluk_hedef"]["soru"],
        "gunluk_hedef_konu": data["gunluk_hedef"]["konu"],
        "level": xp_data.get("level", 1),
        "toplam_xp": xp_data.get("toplam_xp", 0),
        "konu_ilerleme": konu_ilerleme,
        "son_7_gun": son_7_gun,
    }

    # ── Deneme geçmişi ──
    deneme_list = []
    for d in sorted(denemeler, key=lambda x: x.get("tarih", "")):
        deneme_list.append({
            "tarih": d.get("tarih", ""),
            "ad": d.get("ad", ""),
            "tur": d.get("tur", "TYT"),
            "toplam_net": d.get("toplam_net", 0),
            "puan": d.get("puan", 0),
            "dersler": d.get("dersler", {}),
        })

    # ── Uyku özeti ──
    uyku_ozet = {
        "toplam_kayit": len(uyku_list),
        "son_kayitlar": sorted(uyku_list, key=lambda r: r.get("tarih", ""))[-7:],
    }

    # ── Sağlık özeti ──
    saglik_ozet = {
        "profil": saglik_data.get("profil", {}),
        "son_kilo": saglik_data.get("kayitlar", [])[-1] if saglik_data.get("kayitlar") else None,
    }

    # ── Hedef karşılaştırma ──
    hedef_karsilastirma = []
    son_puan = son_deneme.get("puan", 0) if son_deneme else 0
    for h in hedef_data.get("universiteler", []):
        fark = son_puan - h.get("puan", 0)
        hedef_karsilastirma.append({
            "uni": h.get("uni", ""),
            "bolum": h.get("bolum", ""),
            "hedef_puan": h.get("puan", 0),
            "son_puan": son_puan,
            "puan_farki": fark,
            "durum": "Yeterli ✅" if fark >= 0 else f"Eksik: {abs(fark)} puan 📉",
        })

    return jsonify({
        "baslik": "YKS Koçu - Öğrenci Raporu",
        "tarih": today_str,
        "olusturma_zamani": str(now),
        "program": program_list,
        "istatistikler": istatistikler,
        "denemeler": deneme_list,
        "uyku_ozet": uyku_ozet,
        "saglik_ozet": saglik_ozet,
        "hedef_karsilastirma": hedef_karsilastirma,
        "challenge": challenge_data,
        "imza_alani": True,
    })


# ═══════════════════════════════════════════════════════════════
# ── Liderlik Sıralama ─────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════

@app.route("/api/liderlik-siralama", methods=["GET"])
def liderlik_siralama():
    """Deneme puanlarına göre yaklaşık YKS sıralaması ve yüzdelik dilim hesaplar."""
    denemeler = load_json(DENEME_FILE, [])
    hedef_data = load_json(HEDEF_FILE, {"universiteler": []})
    xp_data = load_json(XP_FILE, {"xp": 0, "level": 1, "toplam_xp": 0})
    data = load_data()

    if not denemeler:
        return jsonify({
            "ok": False,
            "error": "Henüz deneme kaydı yok. Sıralama hesaplamak için en az bir deneme gerekli."
        }), 404

    # Son denemeyi bul
    denemeler_sorted = sorted(denemeler, key=lambda d: d.get("tarih", ""))
    son_deneme = denemeler_sorted[-1]
    puan = son_deneme.get("puan", 0)

    # ── Sıralama formülü: 500000 * 0.96^((puan-250)/10) ──
    def puan_to_siralama(p):
        """Puanı yaklaşık sıralamaya çevirir."""
        if p <= 0:
            return 500000
        us = (p - 250) / 10
        siralama = int(500000 * (0.96 ** us))
        return max(1, min(siralama, 500000))

    def puan_to_yuzdelik(p):
        """Puanı yüzdelik dilime çevirir."""
        s = puan_to_siralama(p)
        yuzdelik = round(s / 500000 * 100, 2)
        return min(yuzdelik, 100)

    siralama = puan_to_siralama(puan)
    yuzdelik = puan_to_yuzdelik(puan)

    # ── Tüm denemelerin sıralama trendi ──
    trend = []
    for d in denemeler_sorted:
        dp = d.get("puan", 0)
        trend.append({
            "tarih": d.get("tarih", ""),
            "ad": d.get("ad", ""),
            "puan": dp,
            "siralama": puan_to_siralama(dp),
            "yuzdelik": puan_to_yuzdelik(dp),
        })

    # ── Hedef üniversite karşılaştırması ──
    hedef_karsilastirma = []
    for h in hedef_data.get("universiteler", []):
        hedef_puan = h.get("puan", 0)
        hedef_siralama = puan_to_siralama(hedef_puan)
        hedef_yuzdelik = puan_to_yuzdelik(hedef_puan)
        puan_farki = puan - hedef_puan
        siralama_farki = siralama - hedef_siralama

        if puan_farki >= 0:
            durum = "HEDEF_TUTTU ✅"
            detay = f"Hedef puanın {puan_farki} puan üzerindesin!"
        else:
            # Ne kadar puan/çalışma gerekli?
            gerekli_puan_artis = abs(puan_farki)
            # Her 10 puan için yaklaşık 1 net gerekli (kabaca)
            gerekli_net = round(gerekli_puan_artis / 10, 1)
            durum = "HEDEF_TUTMADI 📉"
            detay = f"{abs(puan_farki)} puan eksiğin var. Yaklaşık {gerekli_net} net artırman gerekli."

        hedef_karsilastirma.append({
            "uni": h.get("uni", ""),
            "bolum": h.get("bolum", ""),
            "hedef_puan": hedef_puan,
            "hedef_siralama": hedef_siralama,
            "hedef_yuzdelik": hedef_yuzdelik,
            "mevcut_puan": puan,
            "mevcut_siralama": siralama,
            "puan_farki": puan_farki,
            "siralama_farki": siralama_farki,
            "durum": durum,
            "detay": detay,
        })

    # ── Level bazlı başarı rozetleri ──
    level = xp_data.get("level", 1)
    rozetler = []
    if level >= 10:
        rozetler.append({"ad": "🏆 Efsane", "aciklama": "Level 10+ — YKS'nin efsanesi!"})
    elif level >= 7:
        rozetler.append({"ad": "🌟 Uzman", "aciklama": "Level 7+ — Uzman seviyesinde ilerliyorsun."})
    elif level >= 5:
        rozetler.append({"ad": "🔥 Savaşçı", "aciklama": "Level 5+ — Savaşçı ruhuyla çalışıyorsun."})
    elif level >= 3:
        rozetler.append({"ad": "💪 Çırak", "aciklama": "Level 3+ — Yolun başında ama kararlısın."})
    else:
        rozetler.append({"ad": "🌱 Acemi", "aciklama": "Yolculuğun henüz başında. Devam et!"})

    # Puan aralığı rozetleri
    if puan >= 450:
        rozetler.append({"ad": "🎯 Keskin Nişancı", "aciklama": "450+ puan — hedefi 12'den vuruyorsun!"})
    elif puan >= 400:
        rozetler.append({"ad": "📈 Yükselen Yıldız", "aciklama": "400+ puan bandındasın, harika gidiyorsun!"})
    elif puan >= 350:
        rozetler.append({"ad": "🚀 Gelişimci", "aciklama": "350+ puan — istikrarlı gelişim!"})
    elif puan >= 300:
        rozetler.append({"ad": "🔧 İnşaatçı", "aciklama": "Temelleri sağlam atıyorsun, devam!"})

    return jsonify({
        "ok": True,
        "son_deneme": {
            "tarih": son_deneme.get("tarih", ""),
            "ad": son_deneme.get("ad", ""),
            "tur": son_deneme.get("tur", "TYT"),
            "puan": puan,
            "toplam_net": son_deneme.get("toplam_net", 0),
            "dersler": son_deneme.get("dersler", {}),
        },
        "siralama_hesaplama": {
            "formul": "500000 * 0.96^((puan-250)/10)",
            "siralama": siralama,
            "yuzdelik_dilim": f"%{yuzdelik}",
            "aciklama": f"Yaklaşık {siralama:,}. sıradasın. Bu, tüm adayların %{yuzdelik}'lik diliminde olduğun anlamına gelir.",
        },
        "trend": trend,
        "hedef_karsilastirma": hedef_karsilastirma,
        "rozetler": rozetler,
        "seviye": {
            "level": level,
            "toplam_xp": xp_data.get("toplam_xp", 0),
            "mevcut_xp": xp_data.get("xp", 0),
            "sonraki_level_xp": level * 100,
        },
        "not": "Bu hesaplama yaklaşık bir tahmindir. Gerçek YKS sıralaması sınavın zorluk derecesine, kontenjanlara ve aday sayısına göre değişiklik gösterebilir. Formül: 500000 * 0.96^((puan-250)/10)",
    })


@app.route("/api/ai/spider", methods=["POST"])
def ai_spider():
    cfg = load_config()
    key = cfg.get("api_key","")
    if not key or key == "***": return jsonify({"ok":False,"error":"API anahtari gerekli"}), 400
    body = request.get_json() or {}
    ctx = build_rich_context()
    prompt = body.get("prompt", "Tum verileri analiz et ve kapsamli bir rapor ver.")
    try:
        r = requests.post(DEEPSEEK_URL, headers={"Authorization":f"Bearer {key}","Content-Type":"application/json"},
            json={"model":"deepseek-chat","messages":[{"role":"system","content":SISTEM_PROMPT},{"role":"user","content":f"{ctx}\\n\\n{prompt}"}],"temperature":0.7}, timeout=30)
        data = r.json()
        if "choices" in data:
            reply = data["choices"][0]["message"]["content"]
            return jsonify({"ok":True,"reply":reply})
        return jsonify({"ok":False,"error":data.get("error",{}).get("message","API hatası")})
    except Exception as e: return jsonify({"ok":False,"error":str(e)})

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    app.run(host="0.0.0.0", port=port, debug=False)
