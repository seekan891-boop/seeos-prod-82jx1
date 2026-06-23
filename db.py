"""SeeOs Veri Katmanı — Supabase varsa onu, yoksa JSON kullanır."""
import json, os

DATA_DIR = os.path.dirname(__file__)

# Supabase client (lazy init)
_supabase = None

def get_supabase():
    global _supabase
    if _supabase is None:
        try:
            from supabase import create_client
            url = os.environ.get("SUPABASE_URL", "")
            key = os.environ.get("SUPABASE_KEY", "")
            if url and key:
                _supabase = create_client(url, key)
                return _supabase
        except: pass
        _supabase = False
    return _supabase if _supabase else None

def _json_read(filename, default):
    try:
        with open(os.path.join(DATA_DIR, filename), "r", encoding="utf-8") as f:
            return json.load(f)
    except: return default

def _json_write(filename, data):
    with open(os.path.join(DATA_DIR, filename), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ═══ DERSLER ═══════════════════════════════
def dersler_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("dersler").select("*").execute()
            if res.data:
                return [{"ad": r["ad"], "konular": r["konular"], "tamamlanan": r["tamamlanan"], "alt_konular": r.get("alt_konular", [])} for r in res.data]
        except: pass
    return _json_read("data.json", {"dersler": [{"ad": "Matematik", "konular": 0, "tamamlanan": 0, "alt_konular": []}, {"ad": "Geometri", "konular": 0, "tamamlanan": 0, "alt_konular": []}]}).get("dersler", [])

def dersler_save(dersler):
    data = {"dersler": dersler, "gunluk_hedef": {"soru": 200, "konu": 3}, "gunluk_ilerleme": {"soru": 0, "konu": 0, "tarih": ""}}
    # Mevcut hedef/ilerleme verilerini koru
    try:
        old = _json_read("data.json", data)
        data["gunluk_hedef"] = old.get("gunluk_hedef", data["gunluk_hedef"])
        data["gunluk_ilerleme"] = old.get("gunluk_ilerleme", data["gunluk_ilerleme"])
    except: pass
    _json_write("data.json", data)
    sb = get_supabase()
    if sb:
        try:
            for d in dersler:
                sb.table("dersler").upsert({"ad": d["ad"], "konular": d["konular"], "tamamlanan": d["tamamlanan"], "alt_konular": d.get("alt_konular", []), "user_id": "default"}, on_conflict="ad").execute()
        except: pass

# ═══ DENEMELER ═════════════════════════════
def denemeler_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("denemeler").select("*").order("tarih", desc=True).execute()
            if res.data: return res.data
        except: pass
    return _json_read("denemeler.json", [])

def denemeler_save(data):
    _json_write("denemeler.json", data)
    sb = get_supabase()
    if sb and data:
        try:
            for d in data:
                sb.table("denemeler").upsert(d, on_conflict="id").execute()
        except: pass

# ═══ UYKU ══════════════════════════════════
def uyku_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("uyku").select("*").order("tarih", desc=True).execute()
            if res.data: return {"kayitlar": res.data}
        except: pass
    return _json_read("uyku.json", {"kayitlar": []})

def uyku_save(data):
    _json_write("uyku.json", data)
    sb = get_supabase()
    if sb and data.get("kayitlar"):
        try:
            for k in data["kayitlar"]:
                sb.table("uyku").upsert(k, on_conflict="id").execute()
        except: pass

# ═══ SAĞLIK ════════════════════════════════
def saglik_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("saglik").select("*").limit(1).execute()
            if res.data: return res.data[0]
        except: pass
    return _json_read("saglik.json", {"boy": 0, "cinsiyet": "", "kayitlar": []})

def saglik_save(data):
    _json_write("saglik.json", data)
    sb = get_supabase()
    if sb:
        try:
            sb.table("saglik").upsert({"id": 1, "user_id": "default", "boy": data.get("boy", 0), "cinsiyet": data.get("cinsiyet", ""), "kayitlar": data.get("kayitlar", [])}, on_conflict="id").execute()
        except: pass

# ═══ DİYET ═════════════════════════════════
def diyet_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("diyet").select("*").limit(1).execute()
            if res.data: return res.data[0]
        except: pass
    return _json_read("diyet.json", {"gunluk_kalori": 2000, "hedef_kilo": 0, "kayitlar": []})

def diyet_save(data):
    _json_write("diyet.json", data)
    sb = get_supabase()
    if sb:
        try:
            sb.table("diyet").upsert({"id": 1, "user_id": "default", "gunluk_kalori": data.get("gunluk_kalori", 2000), "hedef_kilo": data.get("hedef_kilo", 0), "kayitlar": data.get("kayitlar", [])}, on_conflict="id").execute()
        except: pass

# ═══ XP ════════════════════════════════════
def xp_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("xp").select("*").limit(1).execute()
            if res.data: return res.data[0]
        except: pass
    return _json_read("xp.json", {"xp": 0, "level": 1, "toplam_xp": 0})

def xp_save(data):
    _json_write("xp.json", data)
    sb = get_supabase()
    if sb:
        try:
            sb.table("xp").upsert({"id": 1, "user_id": "default", "xp": data.get("xp", 0), "level": data.get("level", 1), "toplam_xp": data.get("toplam_xp", 0)}, on_conflict="id").execute()
        except: pass

# ═══ GÜNLÜK ════════════════════════════════
def gunluk_load():
    sb = get_supabase()
    if sb:
        try:
            res = sb.table("gunluk").select("*").order("tarih", desc=True).execute()
            if res.data: return res.data
        except: pass
    return _json_read("gunluk.json", [])

def gunluk_save(data):
    _json_write("gunluk.json", data)
    sb = get_supabase()
    if sb and data:
        try:
            for d in data:
                sb.table("gunluk").upsert({"user_id": "default", "tarih": d.get("tarih", ""), "soru": d.get("soru", 0), "konu": d.get("konu", 0), "pomodoro": d.get("pomodoro", 0)}, on_conflict="tarih").execute()
        except: pass

# ═══ BASİT JSON (notlar, motivasyon, hedef, aile, program, ayarlar) ═══
def simple_load(filename, default):
    return _json_read(filename, default)

def simple_save(filename, data):
    _json_write(filename, data)
