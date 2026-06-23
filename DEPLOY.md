# 🎓 SeeOs — Tam Kurulum Rehberi

> YKS Çalışma Asistanı — localhost + Supabase + DeepSeek AI

---

## 📦 GEREKSİNİMLER

- **Python 3.10+** → [python.org/downloads](https://python.org/downloads)
- **Git** → [git-scm.com/downloads](https://git-scm.com/downloads)
- **Supabase hesabı** → [supabase.com](https://supabase.com) (ücretsiz)
- **DeepSeek hesabı** → [platform.deepseek.com](https://platform.deepseek.com) (ücretsiz, 1M token)
- **GitHub hesabı** → [github.com](https://github.com)

---

## 🚀 ADIM 1: Projeyi Çalıştır

### 1.1 Klasörü aç
```bash
cd SeeOs
```

### 1.2 Bağımlılıkları yükle
```bash
pip install -r requirements.txt
```

### 1.3 Çalıştır
```bash
python app.py
```

### 1.4 Tarayıcıda aç
```
http://localhost:5050
```

> ✅ Bu noktada uygulama çalışıyor! Tüm modüller aktif, sadece AI kapalı.

---

## 🤖 ADIM 2: DeepSeek AI Bağlantısı

### 2.1 API anahtarı al
1. [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) adresine git
2. "Create new API key" butonuna tıkla
3. Anahtarı kopyala (sk- ile başlar)

### 2.2 Anahtarı gir
1. SeeOs uygulamasında **AI Koç** sekmesine tıkla
2. "DeepSeek API Bağlantısı" kutusuna anahtarı yapıştır
3. **💾 Kaydet** butonuna tıkla

### 2.3 Ne oldu?
- Anahtarın `.env` dosyasına yazıldı (gizli)
- `config.json`'da sadece `***` placeholder var
- Tüm AI özellikleri aktif oldu:
  - 🧠 AI Sohbet — soru sor, konu anlat
  - 📊 AI Analiz — verilerini analiz et
  - 📅 AI Program — haftalık program oluştur
  - 🎯 AI Tahmin — YKS puan tahmini
  - 💬 AI Spider — tüm modüllere bağlı

---

## 🐙 ADIM 3: GitHub'a Yükleme

### 3.1 Repo oluştur
```bash
cd SeeOs
git init
git add .
git commit -m "🎓 SeeOs v1 — YKS Çalışma Asistanı"
```

### 3.2 GitHub'da yeni repo aç
1. [github.com/new](https://github.com/new)
2. İsim: `SeeOs`
3. "Create repository" tıkla
4. Çıkan komutları kopyala

### 3.3 Push yap
```bash
git remote add origin https://github.com/KULLANICI_ADIN/SeeOs.git
git branch -M main
git push -u origin main
```

> ⚠️ `.gitignore` sayesinde `.env` (API anahtarın) ve `.json` (verilerin) git'e GİTMEZ!

---

## 🗄️ ADIM 4: Supabase Kurulumu

### 4.1 Proje oluştur
1. [supabase.com](https://supabase.com) → **Start your project**
2. GitHub ile giriş yap
3. **New project** butonu
4. İsim: `seeos`
5. Database password: **güçlü bir şifre belirle** (aklında tut!)
6. Region: **Frankfurt** (en yakın, en hızlı)
7. **Create project** — 2 dakika bekle

### 4.2 Tabloları oluştur
Sol menüden **SQL Editor** → **New query** → şunu yapıştır ve **Run**:

```sql
-- Dersler ve ilerleme
CREATE TABLE dersler (
  id SERIAL PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  ad TEXT NOT NULL,
  konular INT DEFAULT 0,
  tamamlanan INT DEFAULT 0,
  alt_konular JSONB DEFAULT '[]'::jsonb,
  tamamlanan_alt JSONB DEFAULT '[]'::jsonb
);

-- Deneme sınavları
CREATE TABLE denemeler (
  id SERIAL PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  tarih TEXT NOT NULL,
  tyt_tr FLOAT DEFAULT 0, tyt_sos FLOAT DEFAULT 0,
  tyt_mat FLOAT DEFAULT 0, tyt_fen FLOAT DEFAULT 0,
  ayt_mat FLOAT DEFAULT 0, ayt_fiz FLOAT DEFAULT 0,
  ayt_kim FLOAT DEFAULT 0, ayt_biy FLOAT DEFAULT 0,
  puan FLOAT DEFAULT 0, toplam_net FLOAT DEFAULT 0
);

-- Uyku takibi
CREATE TABLE uyku (
  id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
  tarih TEXT, yatis TEXT, kalkis TEXT, kalite INT, not TEXT
);

-- Sağlık takibi
CREATE TABLE saglik (
  id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
  boy FLOAT, cinsiyet TEXT, kayitlar JSONB DEFAULT '[]'::jsonb
);

-- Diyet takibi
CREATE TABLE diyet (
  id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
  gunluk_kalori INT DEFAULT 2000, hedef_kilo FLOAT,
  kayitlar JSONB DEFAULT '[]'::jsonb
);

-- XP ve seviye
CREATE TABLE xp (
  id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
  xp INT DEFAULT 0, level INT DEFAULT 1, toplam_xp INT DEFAULT 0
);

-- Günlük ilerleme
CREATE TABLE gunluk (
  id SERIAL PRIMARY KEY, user_id TEXT DEFAULT 'default',
  tarih TEXT, soru INT DEFAULT 0, konu INT DEFAULT 0, pomodoro INT DEFAULT 0
);
```

### 4.3 Bağlantı bilgilerini al
1. Sol menü → **Settings** → **API**
2. **Project URL** kopyala (https://xxxxx.supabase.co)
3. **anon public** key'i kopyala (eyJ... ile başlar)

### 4.4 `.env` dosyasına ekle
```bash
echo "SUPABASE_URL=https://xxxxx.supabase.co" >> .env
echo "SUPABASE_KEY=eyJhbGciOi..." >> .env
```

> `.env` dosyan şu anda şöyle olmalı:
> ```
> DEEPSEEK_API_KEY=sk-......
> SUPABASE_URL=https://xxxxx.supabase.co
> SUPABASE_KEY=eyJ......
> ```

### 4.5 Supabase SDK yükle
```bash
pip install supabase
```

---

## 🔗 ADIM 5: app.py'yi Supabase'e Bağla

> Bu adımı benimle yaparsan daha kolay. "Knk Supabase'e bağla" dersen hallederim.
> Kendin yapmak istersen:

`app.py` dosyasının en üstüne (import'lardan sonra) şunu ekle:
```python
from supabase import create_client
import os

supabase_url = os.environ.get("SUPABASE_URL", "")
supabase_key = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(supabase_url, supabase_key) if supabase_url else None
```

---

## 📁 DOSYA YAPISI

```
SeeOs/
├── app.py              ← Ana uygulama
├── templates/
│   └── index.html      ← Tüm sayfalar
├── static/
│   ├── css/style.css   ← Tasarım
│   └── js/app.js       ← Fonksiyonlar
├── .env                ← API ANAHTARIN (GİZLİ!)
├── .gitignore          ← Git'e gitmeyecekler
├── requirements.txt    ← Python paketleri
├── run.bat             ← Windows başlat
├── run.sh              ← Mac/Linux başlat
├── DEPLOY.md           ← Bu rehber
└── START.md            ← Kısa kurulum
```

---

## ❓ SIK SORULAN

**Q: API anahtarım güvende mi?**
A: Evet. `.env` dosyasında durur, `.gitignore` ile Git'e gitmez, `config.json`'da sadece `***` yazar.

**Q: Supabase ücretsiz mi?**
A: Evet. 500MB database, ayda 2GB transfer ücretsiz. Tek kişi için fazlasıyla yeter.

**Q: DeepSeek ücretsiz mi?**
A: Kayıt olunca 1 milyon token ücretsiz. Sonra kullandıkça öde (ucuz, ~$0.14/1M token).

**Q: Telefondan kullanabilir miyim?**
A: Aynı WiFi'deysen `http://PC_IP:5050`. Dışarıdan kullanmak için ngrok veya Supabase hosting gerekir.

---

🎓 **Hazırsın!** `python app.py` yaz, tarayıcını aç, çalışmaya başla!
