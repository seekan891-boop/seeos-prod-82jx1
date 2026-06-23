// ═══════════════════════════════════════════════
// YKS Koçu v2 - Tüm Modüller
// ═══════════════════════════════════════════════

const API = '/api';
const EMOJI = ['📐','📏','⚡','🧪','🧬','📖','🏛️','🌍'];
const MOT = ['Her gün bir adım daha. Vazgeçme! 💪','Başarı, her gün tekrarlanan küçük çabaların toplamıdır.',
    'Bugünün çalışması, yarının başarısıdır.','Sınava değil, hayallerine hazırlanıyorsun.',
    'Disiplin, motivasyondan daha önemlidir.','Kendine inan, gerisi gelir.'];

let data = null, aiOk = false, sending = false, chatHistory = [];
let kocProfil = {adi:'SeeOs Koçu',avatar:'🤖',kisilik:'motive_edici'};
let kocTaglines = {motive_edici:'Seninle gurur duyuyorum! 💪',disiplinli:'Disiplin başarının anahtarıdır.',arkadas_canlisi:'Naber knk! Bugün neler yapalım? 🎉',komik:'Sınav mı? O bizden korksun! 😎'};

// ═══ POMODORO ════════════════════════════════
let pomodoro = {timer: null, total: 0, mode: 'calisma', running: false,
    modes: {calisma: 25*60, 'kisa-mola': 5*60, 'uzun-mola': 15*60}};

// ═══ INIT ════════════════════════════════════

function toggleSideSection(el) {
    const section = el.dataset.section;
    const collapsed = el.classList.toggle('collapsed');
    // Hide all side-btns until next section-title
    let next = el.nextElementSibling;
    while (next && !next.classList.contains('side-section-title') && !next.classList.contains('sidebar-footer')) {
        next.style.display = collapsed ? 'none' : '';
        next = next.nextElementSibling;
    }
    localStorage.setItem('side-'+section, collapsed?'collapsed':'open');
}
// Load saved state
(function() {
    document.querySelectorAll('.side-section-title').forEach(el => {
        const saved = localStorage.getItem('side-'+el.dataset.section);
        if (saved === 'collapsed') {
            el.classList.add('collapsed');
            let next = el.nextElementSibling;
            while (next && !next.classList.contains('side-section-title') && !next.classList.contains('sidebar-footer')) {
                next.style.display = 'none';
                next = next.nextElementSibling;
            }
        }
    });
})();

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const burger = document.querySelector('.burger-btn');
    const isOpen = sidebar.classList.contains('open') || (!sidebar.classList.contains('closed') && window.innerWidth > 768);
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
        burger.classList.toggle('open');
    } else {
        sidebar.classList.toggle('closed');
        document.querySelector('.main-content').classList.toggle('expanded');
        burger.classList.toggle('open');
    }
}

async function init() {
    document.getElementById('chat-input').addEventListener('input', function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'});
    document.getElementById('deneme-tarih').value = new Date().toISOString().split('T')[0];
    await checkAI(); await fetchStatus(); await fetchIstatistik(); if(!aiOk) showOfflineTips(); else loadAIInsight();
    // Load settings
    try {
        const r = await fetch(`${API}/ayarlar`); appAyarlar = await r.json();
        pomodoro.modes.calisma = (appAyarlar.pomodoro_calisma||25)*60;
        pomodoro.modes['kisa-mola'] = (appAyarlar.pomodoro_mola||5)*60;
        pomodoro.modes['uzun-mola'] = (appAyarlar.pomodoro_uzun||15)*60;
        document.querySelectorAll('.mode-btn').forEach(b => {
            const m = b.dataset.mode;
            if (m==='calisma') b.textContent = `📖 Çalışma (${appAyarlar.pomodoro_calisma||25}dk)`;
            else if (m==='kisa-mola') b.textContent = `☕ Kısa Mola (${appAyarlar.pomodoro_mola||5}dk)`;
            else if (m==='uzun-mola') b.textContent = `😴 Uzun Mola (${appAyarlar.pomodoro_uzun||15}dk)`;
        });
        updateTimerDisplay(pomodoro.modes[pomodoro.mode]);
        if (data) { data.gunluk_hedef.soru = appAyarlar.gunluk_soru||200; data.gunluk_hedef.konu = appAyarlar.gunluk_konu||3; }
        // Apply saved theme
        if (appAyarlar.tema && appAyarlar.tema !== 'dark') {
            document.documentElement.setAttribute('data-theme', appAyarlar.tema);
            document.querySelector('.theme-toggle').textContent = {light:'☀️ Aydınlık',oled:'🌑 OLED',minimal:'⬛ Minimal'}[appAyarlar.tema]||'🌓 Tema1';
        }
    if (appAyarlar.moduller) { modulListesi = appAyarlar.moduller; setTimeout(modulSidebarGuncelle, 500); }
    } catch(e) {}
    
}

async function loadAIHistory() {
    try {
        const r = await fetch(`${API}/ai/history`); const msgs = await r.json();
        if (msgs.length > 0) {
            const container = document.getElementById('chat-messages');
            container.innerHTML = '<div class="chat-msg assistant"><div class="msg-content">Merhaba! Sohbet geçmişin yüklendi. 🎓</div></div>';
            msgs.forEach(m => chatAdd(m.role, m.content));
        }
    } catch(e) {}
}

function showOfflineTips() {
    const tips = [
        "📚 Pomodoro tekniğini kullan: 25 dakika çalış, 5 dakika mola ver.",
        "🎯 Her gün en az 1 deneme sorusu çöz. Küçük adımlar büyük sonuçlar doğurur.",
        "💤 Günde 7-8 saat uyu. İyi uyku öğrenmenin temelidir.",
        "📝 Yanlış yaptığın soruları not al. Hatalarından öğrenmek en hızlı yoldur.",
        "🏃 Her gün 30 dakika yürü. Fiziksel aktivite beyin fonksiyonlarını artırır.",
        "🍎 Sağlıklı beslen. Omega-3 ve B vitaminleri hafızayı güçlendirir.",
        "📅 Haftalık hedefler belirle. Büyük hedefi küçük parçalara böl.",
        "🧘 Stresini yönet. Derin nefes egzersizleri sınav anında işe yarar.",
        "📖 Farklı kaynaklardan çalış. Her kaynak farklı bakış açısı sunar.",
        "💪 Kendine inan. Bu sınavı kazanabilirsin!",
    ];
    document.getElementById('offline-tips').innerHTML = tips[Math.floor(Math.random()*tips.length)];
}

async function checkAI() {
    try {
        const r = await fetch(`${API}/ai/config`); const cfg = await r.json();
        aiOk = cfg.configured;
        document.getElementById('ai-badge').style.display = aiOk ? 'inline' : 'none';
        document.getElementById('api-setup-ai').style.display = aiOk ? 'none' : '';
        document.getElementById('ai-panel-active').style.display = aiOk ? '' : 'none';
        if (aiOk) { kocProfilYukle(); kocInsightsGuncelle(); }
    } catch(e) { console.error(e); }
}

// ═══ TABS ════════════════════════════════════

function switchTab(name) {
    document.querySelectorAll('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
    const titles = {dashboard:'📊 Dashboard',pomodoro:'⏱️ Pomodoro',deneme:'📝 Deneme Takvimi',puan:'🧮 Puan Hesapla',istatistik:'📈 İstatistikler','ai-koc':'🤖 AI Koç',uyku:'😴 Uyku Takibi',saglik:'💪 Sağlık Takibi',hedef:'🎯 Hedef Üniversite',yedek:'💾 Veri Yedekle',notlar:'📓 Not Defteri',motivasyon:'🌟 Motivasyon Duvarı',program:'📅 Ders Programı',challenge:'🎯 Günlük Görev',flashcards:'🃏 Flashcards',liderlik:'🏅 Liderlik',diyet:'🥗 Diyet Takibi',quiz:'❓ Mini Test',muzik:'🎵 Müzik',aile:'👨‍👩‍👧‍👦 Ailem'};
    document.getElementById('page-title').textContent = titles[name] || name;
    if (name === 'deneme') fetchDenemeler();
    if (name === 'istatistik') fetchIstatistik();
    if (name === 'ai-koc') document.getElementById('chat-input')?.focus();
    if (name === 'uyku') fetchUyku();
    if (name === 'saglik') fetchSaglik();
    if (name === 'hedef') fetchHedef();
    if (name === 'notlar') fetchNotlar();
    if (name === 'motivasyon') fetchMotivasyon();
    if (name === 'program') renderProgram();
    if (name === 'challenge') fetchChallenge();
    if (name === 'flashcards') fetchFlashcards();
    if (name === 'liderlik') renderLeaderboard();
    if (name === 'diyet') fetchDiyet();
    if (name === 'muzik') muzikCal('lofi');
    if (name === 'aile') fetchAile();
    if (name === 'ai-koc') { if (!aiOk) showOfflineTips(); else kocAcilista(); }
    // Mobilde sidebar'ı kapat
    if (window.innerWidth <= 768) toggleSidebar();
}

// ═══ DASHBOARD ═══════════════════════════════

async function fetchStatus() {
    try { const r = await fetch(`${API}/status`); data = await r.json(); renderDash(); }
    catch(e) { console.error(e); }
}
function renderDash() {
    if (!data) return;
    document.getElementById('kalan-gun').textContent = data.kalan_gun;
    document.getElementById('kalan-saat').textContent = data.kalan_saat;
    document.getElementById('kalan-dakika').textContent = data.kalan_dakika;
    document.getElementById('motivasyon').textContent = MOT[Math.floor(Math.random()*MOT.length)];
    document.getElementById('overall-yuzde').textContent = '%'+data.yuzde;
    const r=15.9155, c=2*Math.PI*r;
    document.getElementById('progress-fill').style.strokeDasharray = `${c} ${c}`;
    document.getElementById('progress-fill').style.strokeDashoffset = c - (data.yuzde/100)*c;
    document.getElementById('ders-listesi').innerHTML = data.dersler.map((d,i) => {
        const y = d.konular>0 ? Math.round(d.tamamlanan/d.konular*100) : 0;
        return `<div class="subject-item"><span class="subject-emoji" onclick="konuDuzenle(${i})">${EMOJI[i]||'📚'}</span><div class="subject-info" onclick="konuDuzenle(${i})"><div class="subject-name">${d.ad}</div><div class="subject-bar-bg"><div class="subject-bar-fill" style="width:${y}%"></div></div></div><div class="subject-stats" onclick="konuDuzenle(${i})">${d.tamamlanan}/${d.konular||0}</div><button onclick="event.stopPropagation();dersAdDegistir(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 4px;" title="Ad değiştir">✏️</button><button onclick="event.stopPropagation();dersSil(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px;opacity:.4;">✕</button></div>`;
    }).join('');
    document.getElementById('hedef-soru').textContent = data.gunluk_hedef.soru;
    document.getElementById('hedef-konu').textContent = data.gunluk_hedef.konu;
    document.getElementById('input-soru').value = data.gunluk_ilerleme.soru;
    document.getElementById('input-konu').value = data.gunluk_ilerleme.konu;
    document.getElementById('input-hedef-soru').value = data.gunluk_hedef.soru;
    document.getElementById('input-hedef-konu').value = data.gunluk_hedef.konu;
    // Progress bars
    const spct = Math.min((data.gunluk_ilerleme.soru/data.gunluk_hedef.soru)*100,100);
    const kpct = Math.min((data.gunluk_ilerleme.konu/data.gunluk_hedef.konu)*100,100);
    document.getElementById('dash-bar-soru').style.width=spct+'%';
    document.getElementById('dash-bar-konu').style.width=kpct+'%';
    document.getElementById('dash-soru-text').textContent=`${data.gunluk_ilerleme.soru}/${data.gunluk_hedef.soru}`;
    document.getElementById('dash-konu-text').textContent=`${data.gunluk_ilerleme.konu}/${data.gunluk_hedef.konu}`;
    // Zayıf/güçlü
    const sirali = [...data.dersler].sort((a,b)=>(b.tamamlanan/b.konular)-(a.tamamlanan/a.konular));
    const enGuclu = sirali[0]; const enZayif = sirali[sirali.length-1];
    const zgEl = document.getElementById('dash-zayif-guclu');
    if (zgEl) zgEl.innerHTML = `
        <div class="dash-zg-card zayif"><div class="zg-label">⚠️ En Zayıf</div><div class="zg-ders">${enZayif.ad}</div><div class="zg-net">${enZayif.tamamlanan}/${enZayif.konular} konu</div></div>
        <div class="dash-zg-card guclu"><div class="zg-label">🏆 En Güçlü</div><div class="zg-ders">${enGuclu.ad}</div><div class="zg-net">${enGuclu.tamamlanan}/${enGuclu.konular} konu</div></div>`;
    // Motivasyon
    document.getElementById('dash-motivasyon-text').textContent = enZayif.tamamlanan===0?`Bugün ${enZayif.ad} ile başla! 💪`:enGuclu.tamamlanan===enGuclu.konular?`🎉 ${enGuclu.ad} tamam! Sırada ${enZayif.ad} var.`:'Her gün bir adım daha!';
}

function konuEkle(){} // removed

function hedefGuncelle() {
    const soru = parseInt(document.getElementById('input-hedef-soru').value)||200;
    const konu = parseInt(document.getElementById('input-hedef-konu').value)||3;
    if (data) { data.gunluk_hedef.soru = soru; data.gunluk_hedef.konu = konu; }
    document.getElementById('hedef-soru').textContent = soru;
    document.getElementById('hedef-konu').textContent = konu;
}

function soruEkle(){} // deprecated
async function gunlukKaydet(){
    const s=parseInt(document.getElementById('input-soru').value)||0;
    const k=parseInt(document.getElementById('input-konu').value)||0;
    await fetch(`${API}/gunluk-guncelle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({soru:s,konu:k})});
    await fetchStatus(); toast('✅ Günlük ilerleme kaydedildi!');xpEkle('gunluk');if(data.gunluk_ilerleme.soru>=data.gunluk_hedef.soru)sesBasari();
}

let editIdx = null;
function konuDuzenle(i){ 
    editIdx=i; const d=data.dersler[i];
    document.getElementById('alt-modal-ders-ad').textContent = d.ad;
    const tamamlanan = d.tamamlanan_alt || [];
    const liste = document.getElementById('alt-konu-listesi');
    liste.innerHTML = d.alt_konular.map((konu, j) => {
        const done = tamamlanan.includes(j);
        return `<div class="alt-konu-item${done?' done':''}">
            <input type="checkbox" ${done?'checked':''} onclick="altKonuTikle(${i},${j})"><label>${konu}</label>
            <button onclick="konuSilModal(${i},${j})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 6px;margin-left:auto;">✕</button></div>`;
    }).join('');
    if (!d.alt_konular.length) liste.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:8px;">Henüz konu eklenmedi. Alttaki kutudan ekleyin.</p>' + (d.alt_konular.length ? '' : '');
    const konuSayisi = d.alt_konular.length;
    document.getElementById('alt-modal-sayac').textContent = `${tamamlanan.length}/${konuSayisi||d.alt_konular.length}`;
    document.getElementById('alt-konu-modal').classList.add('active');
}
async function altKonuTikle(dersIdx, konuIdx){
    const d = data.dersler[dersIdx];
    const tamamlanan = d.tamamlanan_alt || [];
    const zatenVar = tamamlanan.includes(konuIdx);
    const r = await fetch(`${API}/alt-konu-guncelle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ders_idx:dersIdx, konu_idx:konuIdx, tamamlandi:!zatenVar})});
    const res = await r.json();
    if (!d.tamamlanan_alt) d.tamamlanan_alt = [];
    if (!zatenVar) d.tamamlanan_alt.push(konuIdx);
    else d.tamamlanan_alt = d.tamamlanan_alt.filter(x => x !== konuIdx);
    d.tamamlanan = res.tamamlanan;
    document.getElementById('alt-modal-sayac').textContent = `${d.tamamlanan_alt.length}/${d.alt_konular.length}`;
    // Update checkbox
    const items = document.querySelectorAll('#alt-konu-listesi .alt-konu-item');
    items[konuIdx].classList.toggle('done', !zatenVar);
    items[konuIdx].querySelector('input').checked = !zatenVar;
    fetchStatus();
}
function altModalKapat(){ document.getElementById('alt-konu-modal').classList.remove('active'); }

function konuKaydet(){} // deprecated
function modalKapat(){ altModalKapat(); }

async function dersEkle() {
    const ad = document.getElementById('yeni-ders-ad').value.trim();
    if (!ad) return toast('⚠️ Ders adı girin.');
    await fetch(`${API}/ders-ekle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ad})});
    document.getElementById('yeni-ders-ad').value='';
    fetchStatus(); toast('✅ Ders eklendi!');
}

async function dersAdDegistir(idx) {
    if (!data || !data.dersler) { await fetchStatus(); }
    if (!data || !data.dersler) return toast('⚠️ Veri yüklenemedi.');
    const ders = data.dersler[idx];
    const yeni = prompt('Ders adı:', ders.ad);
    if (yeni && yeni.trim() && yeni.trim() !== ders.ad) {
        await fetch(`${API}/ders-guncelle/${idx}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ad:yeni.trim()})});
        fetchStatus(); toast('✅ Ders adı güncellendi!');
    }
}

async function dersSil(idx) {
    await fetch(`${API}/ders-sil/${idx}`,{method:'DELETE'});
    fetchStatus(); toast('🗑 Ders silindi.');
}

async function konuEkleModal() {
    const ad = document.getElementById('yeni-konu-ad').value.trim();
    if (!ad) return toast('⚠️ Konu adı girin.');
    await fetch(`${API}/konu-ekle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ders_idx:editIdx,konu_ad:ad})});
    document.getElementById('yeni-konu-ad').value='';
    // Refresh modal
    konuDuzenle(editIdx);
    fetchStatus(); toast('✅ Konu eklendi!');
}

async function konuSilModal(dersIdx, konuIdx) {
    await fetch(`${API}/konu-sil`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ders_idx:dersIdx,konu_idx:konuIdx})});
    konuDuzenle(dersIdx);
    fetchStatus(); toast('🗑 Konu silindi.');
}

async function konuKaydetModal() {
    altModalKapat();
    fetchStatus(); toast('✅ Kaydedildi!');
}

// ═══ AYARLAR ═════════════════════════════════
let appAyarlar = {tema:'dark',bildirim:true,pomodoro_calisma:25,pomodoro_mola:5,pomodoro_uzun:15,gunluk_soru:200,gunluk_konu:3,gunluk_pomodoro:8,ses:true,odak_modu:false};

async function ayarlarAc() {
    try {
        const r = await fetch(`${API}/ayarlar`); appAyarlar = await r.json();
        document.getElementById('ayar-soru').value = appAyarlar.gunluk_soru;
        document.getElementById('ayar-konu').value = appAyarlar.gunluk_konu;
        document.getElementById('ayar-pomodoro').value = appAyarlar.gunluk_pomodoro||8;
        gorselEfektUygula();
        document.getElementById('ayar-calisma').value = appAyarlar.pomodoro_calisma;
        document.getElementById('ayar-mola').value = appAyarlar.pomodoro_mola;
        document.getElementById('ayar-uzun').value = appAyarlar.pomodoro_uzun;
        document.getElementById('ayar-ses').checked = appAyarlar.ses!==false;
        document.getElementById('ayar-bildirim').checked = appAyarlar.bildirim!==false;
        document.getElementById('ayar-tema').value = appAyarlar.tema || 'dark';
        document.getElementById('ayar-parcacik').checked = appAyarlar.parcacik!==false;
        document.getElementById('ayar-animasyon').checked = appAyarlar.animasyon!==false;
        document.getElementById('ayar-konfeti').checked = appAyarlar.konfeti!==false;
    } catch(e) { console.error(e); }
    document.getElementById('ayarlar-modal').classList.add('active');
}
async function ayarlarKaydet() {
    appAyarlar.gunluk_soru = parseInt(document.getElementById('ayar-soru').value)||200;
    appAyarlar.gunluk_konu = parseInt(document.getElementById('ayar-konu').value)||3;
    appAyarlar.gunluk_pomodoro = parseInt(document.getElementById('ayar-pomodoro').value)||8;
    appAyarlar.pomodoro_calisma = parseInt(document.getElementById('ayar-calisma').value)||25;
    appAyarlar.pomodoro_mola = parseInt(document.getElementById('ayar-mola').value)||5;
    appAyarlar.pomodoro_uzun = parseInt(document.getElementById('ayar-uzun').value)||15;
    appAyarlar.ses = document.getElementById('ayar-ses').checked;
    appAyarlar.bildirim = document.getElementById('ayar-bildirim').checked;
    appAyarlar.tema = document.getElementById('ayar-tema').value;
    appAyarlar.parcacik = document.getElementById('ayar-parcacik').checked;
    appAyarlar.animasyon = document.getElementById('ayar-animasyon').checked;
    appAyarlar.konfeti = document.getElementById('ayar-konfeti').checked;
    gorselEfektUygula();
    // Apply theme
    const t = appAyarlar.tema || 'dark';
    document.documentElement.setAttribute('data-theme', t==='dark'?null:t);
    const icons = {dark:'🌓 Tema1',light:'☀️ Aydınlık',oled:'🌑 OLED',minimal:'⬛ Minimal'};
    document.querySelector('.theme-toggle').textContent = icons[t]||'🌓 Tema1';
    localStorage.setItem('yks-theme', t==='dark'?null:t);
    await fetch(`${API}/ayarlar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(appAyarlar)});
    pomodoro.modes.calisma = appAyarlar.pomodoro_calisma * 60;
    pomodoro.modes['kisa-mola'] = appAyarlar.pomodoro_mola * 60;
    pomodoro.modes['uzun-mola'] = appAyarlar.pomodoro_uzun * 60;
    pomodoroSifirla();
    document.querySelectorAll('.mode-btn').forEach(b => {
        const m = b.dataset.mode;
        if (m==='calisma') b.textContent = `📖 Çalışma (${appAyarlar.pomodoro_calisma}dk)`;
        else if (m==='kisa-mola') b.textContent = `☕ Kısa Mola (${appAyarlar.pomodoro_mola}dk)`;
        else if (m==='uzun-mola') b.textContent = `😴 Uzun Mola (${appAyarlar.pomodoro_uzun}dk)`;
    });
    updateTimerDisplay(pomodoro.modes[pomodoro.mode]);
    if (data) { data.gunluk_hedef.soru = appAyarlar.gunluk_soru; data.gunluk_hedef.konu = appAyarlar.gunluk_konu; renderDash(); }
    document.getElementById('ayarlar-modal').classList.remove('active');
    toast('✅ Ayarlar kaydedildi!');
}
function ayarlarKapat() { document.getElementById('ayarlar-modal').classList.remove('active'); }

// ═══ MODÜL YÖNETİM ═════════════════════════

let modulListesi = [];

async function modulYonetAc(refresh = false) {
    if (!modulListesi.length || refresh) {
        try {
            const r = await fetch(`${API}/ayarlar`); const a = await r.json();
            modulListesi = a.moduller || [];
        } catch(e) { return toast('⚠️ Ayarlar yüklenemedi'); }
    }
    const el = document.getElementById('modul-listesi');
    el.innerHTML = modulListesi.map((m,i) => `
        <div class="modul-item${m.aktif?'':' inaktif'}">
            <div class="modul-sira">
                <button onclick="modulYukari(${i})" ${i===0?'disabled':''}>▲</button>
                <button onclick="modulAsagi(${i})" ${i===modulListesi.length-1?'disabled':''}>▼</button>
            </div>
            <div class="modul-toggle${m.aktif?' aktif':''}" onclick="modulToggle(${i})"></div>
            <div class="modul-ad"><input value="${esc(m.ad)}" onchange="modulListesi[${i}].ad=this.value"></div>
            <span class="modul-bolum">${m.bolum==='yks'?'📚 YKS':'🌟 Hayat'}</span>
        </div>
    `).join('');
    document.getElementById('modul-modal').classList.add('active');
    // Hazır modüller
    const hazir = [
        {id:'quiz',ad:'Mini Test',bolum:'yks',icon:'❓'},
        
        {id:'muzik',ad:'Çalışma Müziği',bolum:'hayat',icon:'🎵'},
        {id:'aile',ad:'Ailem',bolum:'hayat',icon:'👨‍👩‍👧‍👦'},
    ];
    const eklenenIds = modulListesi.map(m=>m.id);
    const hazirEl = document.getElementById('hazir-moduller');
    hazirEl.innerHTML = hazir.filter(h=>!eklenenIds.includes(h.id)).map(h => 
        `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border:1px dashed var(--border);border-radius:8px;">
            <span style="font-size:18px;">${h.icon}</span>
            <span style="flex:1;font-size:13px;">${h.ad}</span>
            <span style="font-size:10px;color:var(--text-muted);">${h.bolum==='yks'?'📚 YKS':'🌟 Hayat'}</span>
            <button class="btn-outline" onclick="hazirModulEkle('${h.id}','${h.ad}','${h.bolum}')" style="font-size:11px;padding:4px 12px;">➕ Ekle</button>
        </div>`
    ).join('') || '<p style="color:var(--text-muted);font-size:12px;">Tüm modüller eklenmiş!</p>';
}

function hazirModulEkle(id, ad, bolum) {
    modulListesi.push({id,ad,aktif:true,bolum});
    modulYonetAc();
}

// Müzik çalar
function muzikCal(tur) {
    document.querySelectorAll('#tab-muzik .mode-btn').forEach(b=>b.classList.remove('active'));
    event?.target?.classList.add('active');
    const urls = {
        lofi:'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1',
        ambient:'https://www.youtube.com/embed/lTRiuFIWV54?autoplay=1',
        classical:'https://www.youtube.com/embed/WFayL2DyYx0?autoplay=1',
        nature:'https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1'
    };
    document.getElementById('muzik-player').innerHTML = `<iframe width="100%" height="200" src="${urls[tur]}" frameborder="0" allow="autoplay" style="border-radius:12px;"></iframe>`;
}

// Hava durumu detay
let quizState = {sorular:[], idx:0, dogru:0, yanlis:0, bitti:false};
async function quizBaslat(ders) {
    const r = await fetch(`${API}/quiz${ders?'?ders='+ders:''}`); quizState.sorular = await r.json();
    quizState.idx=0; quizState.dogru=0; quizState.yanlis=0; quizState.bitti=false;
    quizGoster();
}
function quizGoster() {
    if (quizState.idx >= quizState.sorular.length) { quizBitir(); return; }
    const s = quizState.sorular[quizState.idx];
    document.getElementById('quiz-alani').innerHTML = `<div class="quiz-soru"><div class="quiz-soru-num">Soru ${quizState.idx+1}/${quizState.sorular.length}</div><div class="quiz-soru-metin">${esc(s.s)}</div><div class="quiz-secenekler">${s.c.map((c,i)=>`<button class="quiz-secenek" onclick="quizCevapla(${i})">${String.fromCharCode(65+i)}) ${esc(c)}</button>`).join('')}</div></div>`;
}
async function quizCevapla(cevap) {
    if (quizState.bitti) return; const s = quizState.sorular[quizState.idx];
    const r = await fetch(`${API}/quiz/kontrol`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({soru:s.s,cevap})});
    const sonuc = await r.json(); const btns = document.querySelectorAll('.quiz-secenek');
    btns.forEach(b=>b.disabled=true);
    if (sonuc.dogru) { btns[cevap].classList.add('dogru'); quizState.dogru++; }
    else { btns[cevap].classList.add('yanlis'); quizState.yanlis++; s.c.forEach((c,i)=>{ if (c===sonuc.dogru_cevap) btns[i].classList.add('dogru'); }); }
    quizState.idx++; setTimeout(quizGoster, 800);
}
function quizBitir() {
    quizState.bitti = true; const toplam = quizState.dogru+quizState.yanlis;
    const puan = toplam?Math.round((quizState.dogru/toplam)*100):0;
    document.getElementById('quiz-alani').innerHTML=`<div class="quiz-sonuc"><div class="quiz-sonuc-puan">%${puan}</div><div class="quiz-sonuc-text">${quizState.dogru} doğru · ${quizState.yanlis} yanlış</div><button class="btn-outline" onclick="quizBaslat('')" style="margin-top:12px;">🔄 Tekrar</button></div>`;
}

// ═══ AİLE ═══════════════════════════════════
let aileFotoData = null;

function aileFotoSec(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        aileFotoData = ev.target.result;
        document.getElementById('aile-foto-onizle').innerHTML = `<img src="${aileFotoData}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid var(--primary);">`;
    };
    reader.readAsDataURL(file);
}

async function aileEkle() {
    const ad = document.getElementById('aile-ad').value.trim();
    if (!ad) return toast('⚠️ İsim girin.');
    const rol = document.getElementById('aile-rol').value;
    const not = document.getElementById('aile-not').value;
    const bagli = document.getElementById('aile-bagli')?.value || '';
    const r = await fetch(`${API}/aile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ad,rol,not,bagli})});
    const d = await r.json();
    if (d.ok && aileFotoData && d.data.uyeler.length) {
        const uye = d.data.uyeler[d.data.uyeler.length-1];
        await fetch(`${API}/aile/foto/${uye.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({foto:aileFotoData})});
    }
    document.getElementById('aile-ad').value='';document.getElementById('aile-not').value='';
    document.getElementById('aile-foto-onizle').innerHTML='';aileFotoData=null;
    fetchAile(); toast('✅ Eklendi!');
}

async function fetchAile() {
    const r = await fetch(`${API}/aile`); const d = await r.json();
    const el = document.getElementById('aile-grid');
    if (!d.uyeler.length) { el.innerHTML='<p style="color:var(--text-muted);">Henüz üye eklenmedi.</p>'; return; }
    // Update bagli dropdown
    const bagliSelect = document.getElementById('aile-bagli');
    if (bagliSelect) {
        bagliSelect.innerHTML = '<option value="">-- Yok --</option>' + d.uyeler.map(u => `<option value="${u.id}">${esc(u.ad)} (${esc(u.rol)})</option>`).join('');
    }
    // Soy ağacı
    renderSoyAgaci(d.uyeler);
    
    el.innerHTML = d.uyeler.map(u => `
        <div class="aile-kart">
            <div class="aile-foto">
                ${u.foto?`<img src="${u.foto}" alt="${esc(u.ad)}">`:'👤'}
                <button class="aile-sil" onclick="aileSil('${u.id}')">✕</button>
            </div>
            <div class="aile-bilgi">
                <div class="aile-ad">${esc(u.ad)}</div>
                <span class="aile-rol">${esc(u.rol)}</span>
                ${u.not?`<div class="aile-not">${esc(u.not)}</div>`:''}
            </div>
        </div>
    `).join('');
}

function renderSoyAgaci(uyeler) {
    const el = document.getElementById('soy-agaci');
    if (uyeler.length < 2) { el.innerHTML = '<p style="color:var(--text-muted);">En az 2 üye ekleyince soy ağacı oluşur.</p>'; return; }
    // Kökleri bul (bagli olmayanlar)
    const kokler = uyeler.filter(u => !u.bagli);
    if (!kokler.length) { el.innerHTML = '<p style="color:var(--text-muted);">İlişki ekleyin.</p>'; return; }
    let html = '<div class="tree">';
    kokler.forEach(kok => {
        html += `<div class="tree-node"><div class="tree-person">${kok.foto?`<img src="${kok.foto}" class="tree-avatar">`:'👤'}<span>${esc(kok.ad)}</span><small>${esc(kok.rol)}</small></div>`;
        // Çocukları bul
        const cocuklar = uyeler.filter(u => u.bagli === kok.id);
        if (cocuklar.length) {
            html += '<div class="tree-children">';
            cocuklar.forEach(c => {
                html += `<div class="tree-node"><div class="tree-line"></div><div class="tree-person">${c.foto?`<img src="${c.foto}" class="tree-avatar">`:'👤'}<span>${esc(c.ad)}</span><small>${esc(c.rol)}</small></div></div>`;
            });
            html += '</div>';
        }
        html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

async function aileSil(id) {
    await fetch(`${API}/aile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sil:id})});
    fetchAile(); toast('🗑 Silindi.');
}

async function fetchHavaDetay() {
    havaSehirDoldur();
    const loc = havaKonum + (havaIlce ? '+' + havaIlce : '');
    try {
        const r = await fetch(`https://wttr.in/${encodeURIComponent(loc)}?format=j1`);
        const d = await r.json();
        const c = d.current_condition[0];
        document.getElementById('hava-detay').innerHTML = `
            <div style="font-size:48px;">${c.temp_C}°C</div>
            <div>${c.weatherDesc[0].value}</div>
            <div style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                💨 Rüzgar: ${c.windspeedKmph} km/s · 💧 Nem: ${c.humidity}%
            </div>
            <div style="margin-top:12px;font-size:14px;color:var(--primary-light);">
                ${c.temp_C>25?'☀️ Sıcak! Bol su iç, gölgede çalış.':c.temp_C<10?'❄️ Soğuk! Sıcak çayla çalış.':'🌤️ Çalışmak için ideal hava!'}
            </div>`;
    } catch(e) { document.getElementById('hava-detay').innerHTML='Yüklenemedi'; }
}

function modulToggle(i) {
    modulListesi[i].aktif = !modulListesi[i].aktif;
    modulYonetAc();
}

function modulYukari(i) {
    if (i<=0) return;
    [modulListesi[i], modulListesi[i-1]] = [modulListesi[i-1], modulListesi[i]];
    modulYonetAc();
}

function modulAsagi(i) {
    if (i>=modulListesi.length-1) return;
    [modulListesi[i], modulListesi[i+1]] = [modulListesi[i+1], modulListesi[i]];
    modulYonetAc();
}

async function modulKaydet() {
    // Read current names from inputs
    document.querySelectorAll('#modul-listesi .modul-ad input').forEach((inp,i) => {
        modulListesi[i].ad = inp.value.trim() || modulListesi[i].ad;
    });
    await fetch(`${API}/ayarlar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({moduller:modulListesi})});
    document.getElementById('modul-modal').classList.remove('active');
    modulSidebarGuncelle();
    toast('✅ Modüller güncellendi!');
}

function modulSidebarGuncelle() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || !modulListesi.length) return;
    
    const hayatTitle = nav.querySelector('[data-section="hayat"]');
    
    // Create missing buttons for newly added modules
    modulListesi.forEach(m => {
        if (!m.aktif) return;
        let btn = nav.querySelector(`.side-btn[data-tab="${m.id}"]`);
        if (!btn) {
            const iconMap = {quiz:'❓',hava:'🌤️',muzik:'🎵',aile:'👨‍👩‍👧‍👦'};
            btn = document.createElement('button');
            btn.className = 'side-btn';
            btn.dataset.tab = m.id;
            btn.onclick = () => switchTab(m.id);
            const icon = iconMap[m.id] || '📦';
            btn.innerHTML = `<span class="side-icon">${icon}</span> ${m.ad}`;
            nav.appendChild(btn);
        }
        btn.style.display = '';
    });
    
    // Hide inactive modules
    const allBtns = nav.querySelectorAll('.side-btn[data-tab]');
    allBtns.forEach(b => {
        const mod = modulListesi.find(m => m.id === b.dataset.tab);
        if (mod && !mod.aktif) b.style.display = 'none';
        if (mod) {
            // Update name - find the text after the icon span
            const iconSpan = b.querySelector('.side-icon');
            if (iconSpan) {
                // Remove text after the span and re-add
                while (b.lastChild && b.lastChild !== iconSpan) b.removeChild(b.lastChild);
                b.appendChild(document.createTextNode(' ' + mod.ad));
            }
        }
    });
    
    // Reorder
    const yksBtns = modulListesi.filter(m=>m.aktif&&m.bolum==='yks').map(m=>nav.querySelector(`.side-btn[data-tab="${m.id}"]`)).filter(Boolean);
    const hayatBtns = modulListesi.filter(m=>m.aktif&&m.bolum==='hayat').map(m=>nav.querySelector(`.side-btn[data-tab="${m.id}"]`)).filter(Boolean);
    
    const yksTitle = nav.querySelector('[data-section="yks"]');
    let insertAfter = yksTitle;
    yksBtns.forEach(b => { b.remove(); insertAfter.after(b); insertAfter = b; });
    
    insertAfter = hayatTitle;
    hayatBtns.forEach(b => { b.remove(); insertAfter.after(b); insertAfter = b; });
    
    // Clear inline display:none from tab panels
    modulListesi.filter(m=>m.aktif).forEach(m => {
        const panel = document.getElementById('tab-'+m.id);
        if (panel) panel.style.display = '';
    });
}

function gorselEfektUygula() {
    // Parçacıklar
    const pb = document.getElementById('particles-bg');
    if (pb) pb.style.display = appAyarlar.parcacik ? '' : 'none';
    // Animasyonlar
    document.documentElement.style.setProperty('--anim-duration', appAyarlar.animasyon ? '' : '0s');
    if (!appAyarlar.animasyon) {
        document.documentElement.style.setProperty('--anim-duration', '0s');
        document.querySelectorAll('.card:hover').forEach(c=>c.style.transform='none');
    }
    // Konfeti
    window._konfetiAcik = appAyarlar.konfeti;
}
function konfetiPatlat() {
    if (window._konfetiAcik === false) return;
    for (let i=0;i<50;i++) {
        const p = document.createElement('div');
        p.style.cssText = `position:fixed;top:-10px;left:${Math.random()*100}%;width:8px;height:${8+Math.random()*12}px;background:hsl(${Math.random()*360},80%,60%);border-radius:2px;z-index:999;animation:konfeti ${1+Math.random()*2}s ease forwards;animation-delay:${Math.random()*0.5}s;pointer-events:none;`;
        document.body.appendChild(p);setTimeout(()=>p.remove(),3000);
    }
}

// ═══ POMODORO ════════════════════════════════

function pomodoroMod(m) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    pomodoro.mode = m; pomodoroSifirla();
}
function pomodoroSifirla() {
    clearInterval(pomodoro.timer); pomodoro.running = false;
    document.getElementById('timer-start').style.display = ''; document.getElementById('timer-pause').style.display = 'none';
    updateTimerDisplay(pomodoro.modes[pomodoro.mode]);
    document.getElementById('timer-fill').style.strokeDashoffset = '0';
}
function pomodoroBaslat() {
    if (pomodoro.running) return; pomodoro.running = true;
    document.getElementById('timer-start').style.display = 'none'; document.getElementById('timer-pause').style.display = '';
    const total = pomodoro.modes[pomodoro.mode], circumference = 2*Math.PI*54;
    document.getElementById('timer-fill').style.strokeDasharray = `${circumference} ${circumference}`;
    let remaining = total;
    updateTimerDisplay(remaining);
    pomodoro.timer = setInterval(() => {
        remaining--;
        updateTimerDisplay(remaining);
        document.getElementById('timer-fill').style.strokeDashoffset = (1 - remaining/total) * circumference;
        if (remaining <= 0) {
            clearInterval(pomodoro.timer); pomodoro.running = false;
            document.getElementById('timer-start').style.display = ''; document.getElementById('timer-pause').style.display = 'none';
            if (pomodoro.mode === 'calisma') {
                pomodoro.total++;
                const hedef = appAyarlar.gunluk_pomodoro || 8;
    document.getElementById('pomodoro-count').textContent = `🍅 ${pomodoro.total}/${hedef} pomodoro bugün`;
                fetch(`${API}/gunluk-kayit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pomodoro:1,calisma_dk:25})});xpEkle('pomodoro');
                toast('🍅 Pomodoro tamam! Mola zamanı!');
                notify('🍅 Pomodoro Tamam!', '25 dakikalık çalışma bitti. Mola zamanı!');
                pomodoroMod('kisa-mola');
            } else {
                toast(pomodoro.mode==='kisa-mola' ? '⏰ Mola bitti! Çalışmaya devam.' : '⏰ Uzun mola bitti!');
                notify('⏰ Mola Bitti', 'Hadi tekrar çalışmaya başla!');
                pomodoroMod('calisma');
            }
            updateTimerDisplay(pomodoro.modes[pomodoro.mode]); document.getElementById('timer-fill').style.strokeDashoffset = '0';
        }
    }, 1000);
}
function pomodoroDuraklat() { clearInterval(pomodoro.timer); pomodoro.running = false;
    document.getElementById('timer-start').style.display = ''; document.getElementById('timer-pause').style.display = 'none'; }
function updateTimerDisplay(s) { const m=Math.floor(s/60), sec=s%60;
    document.getElementById('timer-display').textContent = `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }

// ═══ DENEME ══════════════════════════════════

async function denemeEkle() {
    const ad = document.getElementById('deneme-ad').value.trim();
    if (!ad) return toast('⚠️ Deneme adı gerekli!');
    const dersler = {};
    ['tyt-turkce','tyt-mat','tyt-fen','tyt-sosyal','ayt-mat','ayt-fiz','ayt-kim','ayt-biy'].forEach(k => {
        const v = parseFloat(document.getElementById('net-'+k).value) || 0;
        if (v > 0) dersler[k] = v;
    });
    const tytNet = (dersler['tyt-turkce']||0)+(dersler['tyt-mat']||0)+(dersler['tyt-fen']||0)+(dersler['tyt-sosyal']||0);
    const aytNet = (dersler['ayt-mat']||0)+(dersler['ayt-fiz']||0)+(dersler['ayt-kim']||0)+(dersler['ayt-biy']||0);
    const toplamNet = tytNet + aytNet;
    const puan = Math.round(100 + tytNet*3.8 + aytNet*4.2);
    const r = await fetch(`${API}/denemeler`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ad, tarih: document.getElementById('deneme-tarih').value,
            tur: document.getElementById('deneme-tur').value, dersler, toplam_net: toplamNet, puan,
            tyt_net: tytNet, ayt_net: aytNet})});
    if (r.ok) { fetchDenemeler(); ['deneme-ad','net-tyt-turkce','net-tyt-mat','net-tyt-fen','net-tyt-sosyal','net-ayt-mat','net-ayt-fiz','net-ayt-kim','net-ayt-biy'].forEach(id => document.getElementById(id).value='');
        document.getElementById('deneme-tarih').value = new Date().toISOString().split('T')[0]; toast('✅ Deneme kaydedildi!'); xpEkle('deneme'); sesBasari(); }
}
async function fetchDenemeler() {
    const r = await fetch(`${API}/denemeler`); const liste = await r.json();
    const el = document.getElementById('deneme-listesi');
    if (!liste.length) { el.innerHTML = '<p style="color:var(--text-muted);">Henüz deneme kaydı yok.</p>'; return; }
    el.innerHTML = liste.map((d,i) => {
        // Trend: compare with next (older) entry
        const onceki = liste[i+1];
        let trend = '';
        if (onceki && d.puan && onceki.puan) {
            const fark = d.puan - onceki.puan;
            trend = fark > 0 ? `<span style="color:#10b981;">↑${fark}</span>` : fark < 0 ? `<span style="color:#ef4444;">↓${Math.abs(fark)}</span>` : `<span style="color:var(--text-muted);">=</span>`;
        }
        const dersDetay = d.dersler ? Object.entries(d.dersler).map(([k,v])=>`${k}:${v}`).join(' ') : '';
        return `<div class="deneme-item">
            <div class="deneme-info"><span class="deneme-ad">${esc(d.ad)} ${trend}</span><span class="deneme-meta">${d.tarih} · ${d.tur} · TYT:${d.tyt_net||'?'} AYT:${d.ayt_net||'?'} · Top:${d.toplam_net} net</span>${dersDetay?`<span class="deneme-meta" style="color:var(--primary-light);">${dersDetay}</span>`:''}</div>
            <div style="display:flex;align-items:center;gap:12px;"><span class="deneme-puan">${d.puan} p</span><button class="deneme-sil" onclick="denemeSil('${d.id}')">🗑</button></div>
        </div>`;
    }).join('');
}
async function denemeSil(id) { await fetch(`${API}/denemeler/${id}`,{method:'DELETE'}); fetchDenemeler(); toast('🗑 Deneme silindi.'); }

// ═══ PUAN HESAPLA ════════════════════════════

function puanHesapla() {
    const tyt = {tr:pf('ph-tyt-tr'), sos:pf('ph-tyt-sos'), mat:pf('ph-tyt-mat'), fen:pf('ph-tyt-fen')};
    const ayt = {mat:pf('ph-ayt-mat'), fiz:pf('ph-ayt-fiz'), kim:pf('ph-ayt-kim'), biy:pf('ph-ayt-biy')};
    const obp = parseFloat(document.getElementById('ph-obp')?.value) || 80;
    const tur = document.getElementById('ph-tur')?.value || 'SAY';
    const tytNet = tyt.tr+tyt.sos+tyt.mat+tyt.fen, aytNet = ayt.mat+ayt.fiz+ayt.kim+ayt.biy;
    const tytPuan = Math.round(100 + tytNet*3.8), aytPuan = Math.round(100 + aytNet*4.2);
    const obpKatki = Math.round(obp * 0.6);
    // Puan türüne göre ağırlık
    const agirlik = {SAY:[0.4,0.6,0], EA:[0.5,0,0.5], SÖZ:[0.5,0,0.5], DİL:[0.6,0,0.4]};
    const [tw,aw,ew] = agirlik[tur]||[0.4,0.6,0];
    const hamPuan = Math.round(tytPuan*tw + aytPuan*aw);
    const yerPuan = hamPuan + obpKatki;
    const siralama = yerPuan > 400 ? Math.round(500000 * Math.pow(0.96, (yerPuan-250)/10)) : '---';
    document.getElementById('sonuc-tyt').textContent = tytPuan.toFixed(1);
    document.getElementById('sonuc-ayt').textContent = aytPuan.toFixed(1);
    document.getElementById('sonuc-say').textContent = yerPuan.toFixed(1);
    document.getElementById('sonuc-siralama').textContent = typeof siralama === 'number' ? siralama.toLocaleString() : siralama;
}
function pf(id) { return parseFloat(document.getElementById(id).value) || 0; }

async function osymHesapla() {
    const tyt = {tr:pf('ph-tyt-tr'),sos:pf('ph-tyt-sos'),mat:pf('ph-tyt-mat'),fen:pf('ph-tyt-fen')};
    const ayt = {mat:pf('ph-ayt-mat'),fiz:pf('ph-ayt-fiz'),kim:pf('ph-ayt-kim'),biy:pf('ph-ayt-biy')};
    const obp = parseFloat(document.getElementById('ph-obp')?.value)||80;
    const r = await fetch(`${API}/yks-puan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tyt,ayt,obp})});
    const d = await r.json();
    if (d.ok) {
        document.getElementById('sonuc-tyt').textContent = d.tyt.ham_puan.toFixed(1);
        document.getElementById('sonuc-ayt').textContent = d.puanlar.SAY.ham.toFixed(1);
        document.getElementById('sonuc-say').textContent = d.puanlar.SAY.yerlestirme.toFixed(1);
        const siralama = d.puanlar.SAY.yerlestirme > 400 ? Math.round(500000*Math.pow(0.96,(d.puanlar.SAY.yerlestirme-250)/10)) : '---';
        document.getElementById('sonuc-siralama').textContent = typeof siralama==='number'?siralama.toLocaleString():siralama;
        toast('✅ ÖSYM 2024 katsayılarıyla hesaplandı!');
    }
}

// ═══ İSTATİSTİK ══════════════════════════════

async function fetchIstatistik() {
    try {
        const r = await fetch(`${API}/istatistik`); const s = await r.json();
        // Rapor
        if (s.rapor && s.rapor.length) {
            document.getElementById('rapor-kart').style.display='';
            document.getElementById('rapor-metin').textContent = s.rapor.join(' · ');
        }
        // Streak
        try {
            const sr = await fetch(`${API}/streak`); const st = await sr.json();
            if (st.streak > 0) {
                document.getElementById('streak-kart').style.display='';
                document.getElementById('streak-gun').textContent = st.streak;
                document.getElementById('streak-max').textContent = st.en_uzun;
            }
        } catch(e) {}
        document.getElementById('ist-toplam-pomodoro').textContent = s.toplam_pomodoro;
        document.getElementById('ist-toplam-saat').textContent = s.toplam_calisma_saat;
        document.getElementById('ist-toplam-deneme').textContent = s.toplam_deneme;
        document.getElementById('ist-son-puan').textContent = s.son_puan;

        // Deneme analiz
        try {
            const ar = await fetch(`${API}/deneme-analiz`); const ad = await ar.json();
            if (ad.ok && ad.zayif_konular) {
                document.getElementById('rapor-kart').style.display='';
                document.getElementById('rapor-metin').textContent = '⚠️ Zayıf konular: ' + ad.zayif_konular.map(z=>z.ders+'('+z.net_ort+' net)').join(', ');
            }
        } catch(e) {}
    // Chart.js grafikleri
        setTimeout(() => { renderPuanChart(s.puan_gecmis); renderHaftalikChart(s.son_7_gun); renderKonuChart(s.konu_ilerleme); }, 100);
    } catch(e) { console.error(e); }
}

// ═══ AI ═══════════════════════════════════════

async function apiKeyKaydet() {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) return toast('⚠️ API anahtarını gir.');
    if (!key.startsWith('sk-')) return toast('⚠️ Geçersiz anahtar. "sk-" ile başlamalı.');
    const r = await fetch(`${API}/ai/config`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key})});
    if (r.ok) { await checkAI(); toast('✅ DeepSeek API bağlandı!'); document.getElementById('api-key-input').value=''; }
}
async function mesajGonder() {
    if (sending) return; const input = document.getElementById('chat-input'), text = input.value.trim();
    if (!text) return; sending = true; document.getElementById('send-btn').disabled = true;
 input.value = ''; input.style.height = 'auto';
 document.getElementById('koc-typing').style.display = 'flex';
 chatAdd('user', text);chatHistory.push({role:'user',content:text});
    const lm = chatAdd('assistant','Düşünüyorum...','loading');
    try {
        const r = await fetch(`${API}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:chatHistory})});
        const d = await r.json(); lm.remove();
        if (d.ok) { chatHistory.push({role:'assistant',content:d.reply}); chatAdd('assistant',d.reply);
        fetch(`${API}/ai/history`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'user',content:text})}).catch(()=>{});
        fetch(`${API}/ai/history`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'assistant',content:d.reply})}).catch(()=>{}); }
        else { chatAdd('assistant',d.error||'Hata.','error'); if(d.error&&d.error.includes('API anahtar')) switchTab('ai-koc'); }
    } catch(e) { lm.remove(); chatAdd('assistant','Bağlantı hatası.','error'); }
    document.getElementById('koc-typing').style.display = 'none';
    sending = false; document.getElementById('send-btn').disabled = false; input.focus();
}
function chatKeydown(e) { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); mesajGonder(); } }
function chatAdd(role, content, cls='') {
    const c = document.getElementById('chat-messages'), d = document.createElement('div');
    const now = new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    const avatar = role==='assistant'?kocProfil.avatar:'👤';
    d.className = `chat-msg ${role} ${cls}`;
    d.innerHTML = `<div class="msg-avatar">${avatar}</div><div><div class="msg-bubble">${esc(content)}</div><div class="msg-time">${now}</div></div>`;
    c.appendChild(d); c.scrollTop = c.scrollHeight;
    // Hide welcome
    const welcome = document.getElementById('koc-welcome');
    if (welcome && role==='user') welcome.style.display='none';
    return d;
}
async function presetGonder(preset, extra='') {
    if (!extra && ['konu-anlat','soru-coz','deneme-analiz'].includes(preset)) return;
    if (sending) return; sending = true; document.getElementById('send-btn').disabled = true; document.getElementById('koc-typing').style.display='flex';
    const labels = {'konu-anlat':'📖 Konu Anlat','soru-coz':'✏️ Soru Çöz','program-yap':'📅 Program Yap','motive-et':'💪 Motive Et','deneme-analiz':'📊 Deneme Analiz','strateji':'🎯 Strateji'};
    chatAdd('user', `${labels[preset]||preset}${extra?': '+extra:''}`);
    const lm = chatAdd('assistant','Hazırlanıyor...','loading');
    switchTab('ai-koc');
    try {
        const r = await fetch(`${API}/ai/preset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preset,extra})});
        const d = await r.json(); lm.remove();
        if (d.ok) chatAdd('assistant',d.reply);
        else { chatAdd('assistant',d.error||'Hata.','error'); if(d.error&&d.error.includes('API anahtar')) switchTab('ai-koc'); }
    } catch(e) { lm.remove(); chatAdd('assistant','Bağlantı hatası.','error'); }
    sending = false; document.getElementById('send-btn').disabled = false;
}

// ═══ UTILS ═══════════════════════════════════

function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t=document.createElement('div'); t.id='toast';
        t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--success);color:#fff;padding:12px 24px;border-radius:50px;font-weight:600;font-size:14px;z-index:200;transition:opacity .3s;font-family:inherit;';
        document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2500);
}

// ═══ TEMA ════════════════════════════════════
function toggleTheme() {
    const body = document.documentElement;
    const current = body.getAttribute('data-theme') || 'dark';
    const order = ['dark','light','oled','minimal'];
    const idx = order.indexOf(current);
    const next = order[(idx+1)%order.length];
    body.setAttribute('data-theme', next==='dark'?null:next);
    const icons = {dark:'🌓 Tema1',light:'☀️ Aydınlık',oled:'🌑 OLED',minimal:'⬛ Minimal'};
    document.querySelector('.theme-toggle').textContent = icons[next];
    localStorage.setItem('yks-theme', next==='dark'?null:next);
}
(function loadTheme() {
    const saved = localStorage.getItem('yks-theme');
    const icons = {dark:'🌓 Tema1',light:'☀️ Aydınlık',oled:'🌑 OLED',minimal:'⬛ Minimal'};
    if (saved && saved !== 'dark') {
        document.documentElement.setAttribute('data-theme', saved);
        document.querySelector('.theme-toggle').textContent = icons[saved]||'🌓 Tema1';
    }
})();

// ═══ BİLDİRİM ════════════════════════════════
function notify(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, {body, icon: '🎓'});
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p==='granted') new Notification(title, {body, icon:'🎓'}); });
    }
}

// ═══ KLAVYE KISAYOLLARI ════════════════════
document.addEventListener('keydown', e => {
    if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (e.ctrlKey && key==='1') { e.preventDefault(); switchTab('dashboard'); }
    if (e.ctrlKey && key==='2') { e.preventDefault(); switchTab('pomodoro'); }
    if (e.ctrlKey && key==='3') { e.preventDefault(); switchTab('deneme'); }
    if (e.ctrlKey && key==='4') { e.preventDefault(); switchTab('puan'); }
    if (e.ctrlKey && key==='5') { e.preventDefault(); switchTab('istatistik'); }
    if (e.ctrlKey && key==='p') { e.preventDefault(); pomodoro.running ? pomodoroDuraklat() : pomodoroBaslat(); }
    if (e.ctrlKey && key==='b') { e.preventDefault(); toggleSidebar(); }
});

// İlk etkileşimde bildirim izni iste
document.addEventListener('click', () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, {once: true});

// ═══ UYKU ════════════════════════════════════

async function uykuEkle() {
    const body = {
        tarih: document.getElementById('uyku-tarih').value || new Date().toISOString().split('T')[0],
        uyku_saati: document.getElementById('uyku-saat').value || '23:00',
        kalkis_saati: document.getElementById('uyku-kalkis').value || '07:00',
        kalite: parseInt(document.getElementById('uyku-kalite').value),
        not: document.getElementById('uyku-not').value
    };
    const r = await fetch(`${API}/uyku`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (r.ok) { document.getElementById('uyku-not').value = ''; fetchUyku(); toast('😴 Uyku kaydedildi!'); }
}
async function fetchUyku() {
    const r = await fetch(`${API}/uyku`); const records = await r.json();
    const liste = document.getElementById('uyku-listesi');
    if (!records.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz kayıt yok.</p>'; }
    else liste.innerHTML = records.slice(0,20).map(r => {
        const yildiz = '⭐'.repeat(r.kalite) + '☆'.repeat(5-r.kalite);
        return `<div class="uyku-item">
            <div class="uyku-item-left"><span class="uyku-saat">${r.uyku_saati} → ${r.kalkis_saati}</span><span class="uyku-meta">${r.tarih}${r.not?' · '+r.not:''}</span></div>
            <div style="display:flex;align-items:center;gap:8px;"><span class="uyku-sure">${r.saat} saat</span><span class="uyku-kalite">${yildiz.split('').map((s,i)=>`<span>${s}</span>`).join('')}</span><button class="uyku-sil" onclick="uykuSil('${r.id}')">🗑</button></div>
        </div>`;
    }).join('');
    // İstatistikler
    const son7 = records.slice(0,7).reverse();
    const ort = son7.length ? (son7.reduce((a,b)=>a+b.saat,0)/son7.length).toFixed(1) : '--';
    document.getElementById('uyku-ortalama').textContent = ort;
    document.getElementById('uyku-son-kalite').textContent = records.length ? '⭐'.repeat(records[0].kalite) : '--';
    setTimeout(() => renderUykuChart(son7), 100);
}
async function uykuSil(id) { await fetch(`${API}/uyku/${id}`,{method:'DELETE'}); fetchUyku(); toast('🗑 Silindi.'); }

// ═══ SAĞLIK ══════════════════════════════════

async function saglikProfilKaydet() {
    const boy = parseFloat(document.getElementById('saglik-boy').value)||0;
    const cinsiyet = document.getElementById('saglik-cinsiyet').value;
    if (!boy) return toast('⚠️ Boy girin.');
    await fetch(`${API}/saglik`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({boy,cinsiyet})});
    fetchSaglik(); toast('✅ Profil kaydedildi!');
}
async function saglikKaydet() {
    const kilo = parseFloat(document.getElementById('saglik-kilo').value)||0;
    if (!kilo) return toast('⚠️ Kilo girin.');
    const tarih = document.getElementById('saglik-tarih').value || new Date().toISOString().split('T')[0];
    const su = parseInt(document.getElementById('saglik-su').value)||0;
    await fetch(`${API}/saglik`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kilo,tarih,su})});
    document.getElementById('saglik-kilo').value=''; document.getElementById('saglik-su').value=''; fetchSaglik(); toast('✅ Ölçüm kaydedildi!');
}
async function fetchSaglik() {
    const r = await fetch(`${API}/saglik`); const d = await r.json();
    // Tarih input'unu bugüne ayarla
    document.getElementById('saglik-tarih').value = new Date().toISOString().split('T')[0];
    // Profil
    if (d.profil.boy) {
        document.getElementById('saglik-boy').value = d.profil.boy;
        document.getElementById('saglik-cinsiyet').value = d.profil.cinsiyet||'';
    }
    // BMI
    const son = d.kayitlar.length ? d.kayitlar.sort((a,b)=>b.tarih.localeCompare(a.tarih))[0] : null;
    const bmiDeger = document.getElementById('bmi-deger');
    const bmiKat = document.getElementById('bmi-kategori');
    const bmiBar = document.getElementById('bmi-bar-fill');
    if (son && son.bmi > 0) {
        bmiDeger.textContent = son.bmi;
        let kat, renk; const b=son.bmi;
        if (b<18.5){kat='Zayıf';renk='#3b82f6'}else if(b<25){kat='Normal';renk='#10b981'}else if(b<30){kat='Fazla Kilolu';renk='#f59e0b'}else{kat='Obez';renk='#ef4444'}
        bmiKat.textContent=kat; bmiKat.style.color=renk;
        bmiBar.style.width = Math.min(100 - (b/40)*100, 95)+'%';
    } else { bmiDeger.textContent='--'; bmiKat.textContent='Boy ve kilo girin'; bmiKat.style.color='var(--text-muted)'; bmiBar.style.width='0%'; }
    const kayitlar = d.kayitlar.sort((a,b)=>a.tarih.localeCompare(b.tarih)).slice(-10);
    setTimeout(() => renderKiloChart(kayitlar), 100);
    // Liste
    const liste = document.getElementById('saglik-listesi');
    if (!d.kayitlar.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz kayıt yok.</p>'; }
    else liste.innerHTML = d.kayitlar.sort((a,b)=>b.tarih.localeCompare(a.tarih)).slice(0,20).map(k =>
        `<div class="saglik-item"><span>${k.tarih}</span><span class="kilo">${k.kilo} kg</span><span class="bmi">BMI: ${k.bmi||'--'}</span><span style="color:var(--text-muted);">💧${k.su||0}</span></div>`
    ).join('');
}

// ═══ HEDEF ÜNİVERSİTE ═══════════════════════

async function hedefEkle() {
    const uni = document.getElementById('hedef-uni').value.trim();
    const bolum = document.getElementById('hedef-bolum').value.trim();
    if (!uni || !bolum) return toast('⚠️ Üniversite ve bölüm girin.');
    const foto = hedefFotoData || '';
    await fetch(`${API}/hedef`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({uni,bolum,puan:parseFloat(document.getElementById('hedef-puan').value)||0,siralama:parseInt(document.getElementById('hedef-siralama').value)||0,foto})});
    hedefFotoData=null;document.getElementById('hedef-foto-onizle').innerHTML='';
    ['hedef-uni','hedef-bolum','hedef-puan','hedef-siralama'].forEach(id=>document.getElementById(id).value='');
    fetchHedef(); toast('🎯 Hedef eklendi!');
}
// ═══ DASHBOARD BIG CARD UPDATER ════════════
setTimeout(async function dashBigCardsUpdate() {
    try {
    const xr = await fetch(`${API}/xp`); const x = await xr.json();
    document.getElementById('dash-xp').textContent = x.xp+'/'+(x.level*100)+' XP';
    const sr = await fetch(`${API}/streak`); const s = await sr.json();
    document.getElementById('dash-streak').textContent = '🔥 '+s.streak+' gün seri';
    // Pomodoro
    try { const pr = await fetch(`${API}/gunluk-kayit`); const pd = await pr.json();
        document.getElementById('dash-bar-pom').style.width=Math.min((pd.bugun?.pomodoro||0)/8*100,100)+'%';
        document.getElementById('dash-pom-text').textContent=(pd.bugun?.pomodoro||0)+'/8';
    } catch(e) {}
    // Son deneme
    try { const dr = await fetch(`${API}/denemeler`); const dl = await dr.json();
        if (dl.length) { document.getElementById('dash-son-puan').textContent=dl[0].puan; document.getElementById('dash-son-net').textContent=dl[0].toplam_net+' net'; }
    } catch(e) {}
    // Sıralama
    try { const lr = await fetch(`${API}/liderlik-siralama`); const ld = await lr.json();
        if (ld.siralama_hesaplama) { document.getElementById('dash-siralama').textContent=ld.siralama_hesaplama.siralama?.toLocaleString()||'--'; document.getElementById('dash-yuzdelik').textContent=ld.siralama_hesaplama.yuzdelik_dilim||'%0'; }
    } catch(e) {}
} catch(e) {}
}, 1500);

// ═══ FETCH HEDEF (geri eklendi) ═══════════
async function fetchHedef() {
    const r = await fetch(`${API}/hedef`); const d = await r.json();
    document.getElementById('hedef-son-puan').textContent = d.son_puan || '--';
    const liste = document.getElementById('hedef-listesi');
    if (!d.universiteler.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz hedef eklenmedi.</p>'; document.getElementById('hedef-fark').textContent='--'; return; }
    let enYakinFark = Infinity;
    liste.innerHTML = d.universiteler.map(h => {
        const fark = d.son_puan ? (d.son_puan - h.puan).toFixed(1) : null;
        if (fark !== null && Math.abs(fark) < Math.abs(enYakinFark)) enYakinFark = fark;
        const cls = fark===null?'':fark>=0?'iyi':'kotu';
        const sembol = fark===null?'?':fark>=0?'+':'';
        return `<div class="hedef-item"><div class="hedef-sol"><span class="hedef-uni">${esc(h.uni)}</span><span class="hedef-bolum">${esc(h.bolum)} · ${h.puan} puan</span></div><div style="display:flex;align-items:center;gap:12px;"><span class="hedef-fark ${cls}">${fark!==null?sembol+fark+' puan':'?'}</span><span class="hedef-puan">#${h.siralama.toLocaleString()}</span><button class="hedef-sil" onclick="hedefSil('${h.id}')">🗑</button></div></div>`;
    }).join('');
    document.getElementById('hedef-fark').textContent = enYakinFark!==Infinity?(enYakinFark>=0?'+':'')+enYakinFark.toFixed(1)+' puan':'--';
    document.getElementById('hedef-fark').parentElement.querySelector('.stat-desc').textContent = enYakinFark>=0?'✅ Hedefi geçtin!':enYakinFark!==Infinity?'📉 Eksik':'Henüz veri yok';
}
async function hedefSil(id) { await fetch(`${API}/hedef/${id}`,{method:'DELETE'}); fetchHedef(); toast('🗑 Silindi.'); }


// ═══ VERİ YEDEKLE ═══════════════════════════

async function veriDisariAktar() {
    const r = await fetch(`${API}/export`); const data = await r.json();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`yks-kocu-yedek-${new Date().toISOString().slice(0,10)}.json`; a.click();
    document.getElementById('yedek-durum').innerHTML='<span style="color:var(--success);">✅ Dışa aktarıldı!</span>';
}
async function veriIceriAktar(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
        const text = await file.text(); const data = JSON.parse(text);
        // Tüm verileri API'ye gönder
        for (const [key,val] of Object.entries(data)) {
            if (key.startsWith('export')||key==='ai_config') continue;
            const endpoint = {data:'/api/gunluk-guncelle',denemeler:'/api/denemeler',gunluk:'/api/gunluk-kayit',uyku:'/api/uyku',saglik:'/api/saglik',hedef:'/api/hedef'};
            // Basit import - sadece son kaydı ekle
        }
        document.getElementById('yedek-durum').innerHTML='<span style="color:var(--success);">✅ Yedek dosyası okundu! İçe aktarma için manuel giriş yap.</span>';
        toast('✅ Yedek okundu!');
    } catch(ex) {
        document.getElementById('yedek-durum').innerHTML='<span style="color:var(--danger);">❌ Geçersiz dosya!</span>';
    }
}


// ═══ NOT DEFTERİ ═══════════════════════════

async function notEkle() {
    const baslik = document.getElementById('not-baslik').value.trim();
    const icerik = document.getElementById('not-icerik').value.trim();
    if (!baslik && !icerik) return toast('⚠️ Başlık veya içerik girin.');
    const renkler = ['accent','primary','success'];
    await fetch(`${API}/notlar`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({baslik,icerik,renk:renkler[Math.floor(Math.random()*3)]})});
    document.getElementById('not-baslik').value=''; document.getElementById('not-icerik').value='';
    fetchNotlar(); toast('📓 Not eklendi!');
}
async function fetchNotlar() {
    const r = await fetch(`${API}/notlar`); const records = await r.json();
    const liste = document.getElementById('not-listesi');
    if (!records.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz not yok.</p>'; return; }
    liste.innerHTML = records.map(n => `<div class="not-kart ${n.renk||'accent'}">
        <button class="not-sil" onclick="notSil('${n.id}')">🗑</button>
        <div class="not-baslik">${esc(n.baslik)||'İsimsiz not'}</div>
        <div class="not-icerik">${esc(n.icerik)}</div>
        <div class="not-tarih">${n.tarih}</div>
    </div>`).join('');
}
async function notSil(id) { await fetch(`${API}/notlar/${id}`,{method:'DELETE'}); fetchNotlar(); toast('🗑 Silindi.'); }

// ═══ MOTİVASYON DUVARI ══════════════════════

async function motivasyonEkle() {
    const icerik = document.getElementById('motivasyon-icerik').value.trim();
    if (!icerik) return toast('⚠️ Bir şey yaz.');
    await fetch(`${API}/motivasyon`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({icerik,tip:'soz'})});
    document.getElementById('motivasyon-icerik').value='';
    fetchMotivasyon(); toast('🌟 Eklendi!');
}
async function fetchMotivasyon() {
    const r = await fetch(`${API}/motivasyon`); const records = await r.json();
    const liste = document.getElementById('motivasyon-listesi');
    if (!records.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz eklenmedi.</p>'; return; }
    liste.innerHTML = records.map(m => `<div class="motivasyon-kart soz">
        <span class="motivasyon-icerik">${esc(m.icerik)}</span>
        <button class="motivasyon-sil" onclick="motivasyonSil('${m.id}')">✕</button>
    </div>`).join('');
}
async function motivasyonSil(id) { await fetch(`${API}/motivasyon/${id}`,{method:'DELETE'}); fetchMotivasyon(); }

// ═══ SES & ROZET ═══════════════════════════

function beep(freq=800,dur=200,tip='sine') {
    try { const ctx=new(window.AudioContext||window.webkitAudioContext)();
        const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
        o.frequency.value=freq;o.type=tip;g.gain.value=0.08;o.start();setTimeout(()=>o.stop(),dur);
    } catch(e) {}
}
// Farklı sesler
function sesBasari() { beep(523,100);setTimeout(()=>beep(659,100),100);setTimeout(()=>beep(784,200),200); }
function sesHata() { beep(200,300,'square'); }
function sesBildirim() { beep(880,100);setTimeout(()=>beep(1100,150),120); }
function sesLevelUp() { beep(523,80);setTimeout(()=>beep(659,80),80);setTimeout(()=>beep(784,80),160);setTimeout(()=>beep(1047,200),240); }
function beep_old(freq=800,dur=200) {
    try { const ctx=new(window.AudioContext||window.webkitAudioContext)();
        const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
        o.frequency.value=freq;o.type='sine';g.gain.value=0.1;o.start();setTimeout(()=>o.stop(),dur);
    } catch(e) {}
}

// ═══ KONFETİ & BAŞARI ANİMASYONU ═══════════
function konfetiPatlat() {
    for (let i=0;i<50;i++) {
        const p = document.createElement('div');
        p.style.cssText = `position:fixed;top:-10px;left:${Math.random()*100}%;width:8px;height:${8+Math.random()*12}px;background:hsl(${Math.random()*360},80%,60%);border-radius:2px;z-index:999;animation:konfeti ${1+Math.random()*2}s ease forwards;animation-delay:${Math.random()*0.5}s;pointer-events:none;`;
        document.body.appendChild(p);
        setTimeout(()=>p.remove(),3000);
    }
}
function buyukRozet(emoji,text) {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);background:var(--card);border:2px solid var(--accent);border-radius:24px;padding:24px 40px;text-align:center;z-index:999;font-size:20px;font-weight:700;animation:rozetPopup .5s ease forwards;pointer-events:none;';
    r.innerHTML=`<div style="font-size:48px;margin-bottom:8px;">${emoji}</div>${text}`;
    document.body.appendChild(r);
    setTimeout(()=>r.remove(),3000);
    konfetiPatlat();
}

function rozetGoster(emoji, text) {
    let c = document.getElementById('rozet-container');
    if (!c) { c=document.createElement('div'); c.id='rozet-container'; c.className='rozet-container'; document.body.appendChild(c); }
    const r = document.createElement('div'); r.className='rozet'; r.innerHTML=`${emoji} ${text}`;
    c.appendChild(r); setTimeout(()=>r.remove(),3000);
}

// Sesleri pomodoro'ya bağla - notify fonksiyonuna ek
const origNotify = notify;
notify = function(title, body) { beep(title.includes('Tamam')?1000:600,300); origNotify(title, body); };

// İlk kez 5 pomodoro yapınca rozet
setInterval(() => { if (pomodoro.total === 5 && !localStorage.getItem('rozet-5')) { buyukRozet('🍅','5 Pomodoro!'); localStorage.setItem('rozet-5','1'); }
    if (pomodoro.total === 10 && !localStorage.getItem('rozet-10')) { buyukRozet('🔥','10 Pomodoro!'); localStorage.setItem('rozet-10','1'); }
    if (pomodoro.total === 25 && !localStorage.getItem('rozet-25')) { buyukRozet('🏆','25 Pomodoro!'); localStorage.setItem('rozet-25','1'); }
}, 5000);



// ═══ CHART.JS GRAFİKLER ═════════════════════


// ═══ CHART.JS GLOBAL CONFIG ═════════════════
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148,163,184,0.1)';
Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.animation.duration = 800;
Chart.defaults.animation.easing = 'easeOutQuart';

const chartColors = {purple:'#a78bfa',purpleBg:'rgba(124,58,237,0.15)',green:'#10b981',greenBg:'rgba(16,185,129,0.15)',amber:'#f59e0b',amberBg:'rgba(245,158,11,0.15)',red:'#ef4444',blue:'#818cf8'};
let chartInstances = {};
function destroyChart(id) { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } }

function renderPuanChart(data) {
    destroyChart('puan');
    const canvas = document.getElementById('chart-puan'); if (!canvas) return;
    document.getElementById('ist-puan-bos').style.display = data.length ? 'none' : '';
    if (!data.length) { canvas.style.display='none'; return; }
    canvas.style.display='';
    chartInstances.puan = new Chart(canvas, {type:'line',data:{labels:data.map(d=>d.tarih.slice(5)),datasets:[{label:'Puan',data:data.map(d=>d.puan),borderColor:chartColors.purple,backgroundColor:chartColors.purpleBg,tension:0.4,fill:true,pointRadius:5,pointBackgroundColor:chartColors.purple,pointBorderColor:'#fff',pointBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(148,163,184,0.1)'},ticks:{color:'#94a3b8'}},x:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});
}

function renderHaftalikChart(data) {
    destroyChart('haftalik');
    const canvas = document.getElementById('chart-haftalik'); if (!canvas) return;
    const entries = Object.entries(data);
    if (!entries.length) return;
    chartInstances.haftalik = new Chart(canvas, {type:'bar',data:{labels:entries.map(([t])=>t.slice(5)),datasets:[{label:'Çalışma (dk)',data:entries.map(([,v])=>v.calisma_dk),backgroundColor:entries.map(([,v])=>v.calisma_dk>0?chartColors.purple:'rgba(148,163,184,0.1)'),borderRadius:6,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(148,163,184,0.1)'},ticks:{color:'#94a3b8'}},x:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});
}

function renderKonuChart(data) {
    destroyChart('konu');
    const canvas = document.getElementById('chart-konu'); if (!canvas) return;
    if (!data.length) return;
    chartInstances.konu = new Chart(canvas, {type:'bar',data:{labels:data.map(d=>d.ad),datasets:[{label:'% Tamamlanan',data:data.map(d=>d.yuzde),backgroundColor:data.map((_,i)=>`hsla(${260+i*5},70%,60%,0.8)`),borderRadius:6,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{max:100,grid:{color:'rgba(148,163,184,0.1)'},ticks:{color:'#94a3b8',callback:v=>'%'+v}},y:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});
}

function renderUykuChart(data) {
    destroyChart('uyku');
    const canvas = document.getElementById('chart-uyku'); if (!canvas) return;
    if (!data.length) return;
    chartInstances.uyku = new Chart(canvas, {type:'bar',data:{labels:data.map(r=>r.tarih.slice(5)),datasets:[{label:'Uyku (saat)',data:data.map(r=>r.saat),backgroundColor:data.map(r=>r.saat>=7?chartColors.green:r.saat>=6?chartColors.amber:chartColors.red),borderRadius:8,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},annotation:!1},scales:{y:{min:0,max:Math.max(...data.map(r=>r.saat),8)+1,grid:{color:'rgba(148,163,184,0.1)'},ticks:{color:'#94a3b8'}},x:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});
}

function renderKiloChart(data) {
    destroyChart('kilo');
    const canvas = document.getElementById('chart-kilo'); if (!canvas) return;
    if (!data.length) return;
    const minK = Math.min(...data.map(k=>k.kilo))-1, maxK = Math.max(...data.map(k=>k.kilo))+1;
    chartInstances.kilo = new Chart(canvas, {type:'line',data:{labels:data.map(k=>k.tarih.slice(5)),datasets:[{label:'Kilo (kg)',data:data.map(k=>k.kilo),borderColor:chartColors.amber,backgroundColor:chartColors.amberBg,tension:0.4,fill:true,pointRadius:5,pointBackgroundColor:chartColors.amber,pointBorderColor:'#fff',pointBorderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:minK,max:maxK,grid:{color:'rgba(148,163,184,0.1)'},ticks:{color:'#94a3b8'}},x:{grid:{display:false},ticks:{color:'#94a3b8'}}}}});
}


// ═══ DERS PROGRAMI ═════════════════════════

function renderProgram() {
    const gunler = ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
    const grid = document.getElementById('program-grid');
    let html = '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;">';
    gunler.forEach((gun, gi) => {
        html += '<div class="prog-gun-kolon"><div class="prog-gun-baslik">'+gun+' <button onclick="progSatirEkle('+gi+')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;">+</button></div><div class="prog-satirlar" id="prog-gun-'+gi+'">';
        for (let s=0;s<8;s++) {
            html += '<div class="prog-satir"><input type="text" class="prog-time" data-gun="'+gi+'" data-slot="'+s+'" placeholder="09:00" onchange="programAutoSave()" maxlength="5" style="width:55px;"><input placeholder="Ders" data-gun="'+gi+'" data-slot="'+s+'" data-field="ders" ondblclick="this.style.textDecoration=this.style.textDecoration===\'line-through\'?\'\':\'line-through\'" onchange="programAutoSave()" class="prog-ders"></div>';
        }
        html += '</div></div>';
    });
    grid.innerHTML = html;
    fetch(`${API}/program`).then(r=>r.json()).then(data => {
        const allKeys = Object.keys(data);
        const maxSlots = {};
        allKeys.forEach(k => {
            const m = k.match(/^(\d+)-(\d+)$/);
            if (m) { const g=parseInt(m[1]),s=parseInt(m[2]); if(!maxSlots[g]||s>=maxSlots[g])maxSlots[g]=s; }
        });
        Object.entries(maxSlots).forEach(([g,s]) => { progSatirEkle(parseInt(g), Math.max(0, s+1-8), true); });
        Object.entries(data).forEach(([k,v]) => {
            const m = k.match(/^(\d+)-(\d+)$/);
            if (!m) return;
            const g=m[1], s=m[2];
            const timeInp = document.querySelector('input[data-gun="'+g+'"][data-slot="'+s+'"]:not([data-field])');
            const dersInp = document.querySelector('input[data-gun="'+g+'"][data-slot="'+s+'"][data-field="ders"]');
            if (typeof v === 'string') {
                if (v.includes(':')) { if (timeInp) timeInp.value = v; }
                else { if (dersInp) dersInp.value = v; }
            }
        });
    });
}
function programAutoSave() {
    const data = {};
    document.querySelectorAll('#program-grid input').forEach(inp => {
        const g = inp.dataset.gun, s = inp.dataset.slot;
        if (g===undefined||s===undefined) return;
        if (!inp.value.trim()) return;
        if (!data[g+'-'+s]) data[g+'-'+s] = {};
        if (inp.dataset.field === 'ders') data[g+'-'+s].ders = inp.value.trim();
        else data[g+'-'+s].saat = inp.value.trim();
    });
    Object.keys(data).forEach(k => { if (!data[k].saat&&!data[k].ders) delete data[k]; });
    if (Object.keys(data).length) fetch(`${API}/program`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}

function progSatirEkle(gun, count, silent) {
    count = count || 1;
    const container = document.getElementById('prog-gun-'+gun);
    if (!container) return;
    const existing = container.querySelectorAll('.prog-satir').length;
    for (let i=0;i<count;i++) {
        const s = existing + i;
        const div = document.createElement('div');
        div.className = 'prog-satir';
        div.innerHTML = '<input type="text" class="prog-time" data-gun="'+gun+'" data-slot="'+s+'" placeholder="09:00" onchange="programAutoSave()" maxlength="5" style="width:55px;"><input placeholder="Ders" data-gun="'+gun+'" data-slot="'+s+'" data-field="ders" ondblclick="this.style.textDecoration=this.style.textDecoration===\'line-through\'?\'\':\'line-through\'" onchange="programAutoSave()" class="prog-ders">';
        container.appendChild(div);
    }
    if (!silent) programAutoSave();
}
function programPDF() {
    fetch(`${API}/program`).then(r=>r.json()).then(data => {
        const ele = document.getElementById('program-print');
        if (!ele) return toast('PDF şablonu bulunamadı.');
        const tbody = ele.querySelector('#pp-body') || ele.querySelector('tbody');
        const tarihEl = ele.querySelector('#pp-tarih');
        if (tarihEl) {
            const today=new Date();const gun=today.getDay();const pazartesi=new Date(today);pazartesi.setDate(today.getDate()-(gun===0?6:gun-1));const pazar=new Date(pazartesi);pazar.setDate(pazartesi.getDate()+6);const fmt=d=>d.getDate()+' '+d.toLocaleDateString('tr-TR',{month:'long'});tarihEl.textContent=fmt(pazartesi)+' - '+fmt(pazar)+' '+pazar.getFullYear();
        }
        // Group by day
        const days = [[],[],[],[],[],[],[]];
        Object.entries(data).forEach(([k,v])=>{
            const m=k.match(/^(\d+)-(\d+)$/);if(!m)return;
            const g=parseInt(m[1]),saat=v.saat||(typeof v==='string'&&v.includes(':')?v:''),ders=v.ders||(typeof v==='string'&&!v.includes(':')?v:'');
            if(saat||ders)days[g].push({saat,ders});
        });
        // Sort each day by time
        days.forEach(d=>d.sort((a,b)=>(a.saat||'').localeCompare(b.saat||'')));
        // Find max rows
        const maxRows=Math.max(1,...days.map(d=>d.length));
        let rows='';
        for(let i=0;i<maxRows;i++){
            rows+='<tr style="min-height:32px;">';
            for(let g=0;g<7;g++){
                const slot=days[g][i];
                const bg=i%2?'background:#faf8ff;':'';
                rows+='<td style="padding:10px 8px;text-align:center;vertical-align:top;'+bg+'">';
                if(slot)rows+='<div style="font-size:10px;color:#7c3aed;font-weight:600;">'+ (slot.saat||'') +'</div><div style="font-size:13px;">'+ (slot.ders||'') +'</div>';
                else rows+='<div style="color:#ddd;">&nbsp;</div>';
                rows+='</td>';
            }
            rows+='</tr>';
        }
        tbody.innerHTML=rows;
        ele.style.display='block';
        setTimeout(()=>{window.print();ele.style.display='none';},400);
    });
}
async function programKaydet() { programAutoSave(); toast('✅ Program kaydedildi!'); }

// ═══ GÜNLÜK CHALLENGE ═════════════════════

async function fetchChallenge() {
    const r = await fetch(`${API}/challenge`); const d = await r.json();
    const tamam = d.tamamlanan.length;
    document.getElementById('challenge-progress').textContent = `✅ ${tamam}/3 görev tamamlandı`;
    document.getElementById('challenge-listesi').innerHTML = d.gorevler.map((g,i) => {
        const done = d.tamamlanan.includes(i);
        return `<div class="challenge-gorev${done?' tamamlandi':''}" onclick="challengeTamamla(${i})">
            <input type="checkbox" ${done?'checked':''}><span>${g}</span></div>`;
    }).join('');
    if (tamam === 3 && !d.tamamlanan.includes(-1)) {
        beep(1200,500); toast('🎉 Tüm görevler tamam! Harikasın!');
    }
}
async function challengeTamamla(idx) {
    await fetch(`${API}/challenge`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tamamla:true,idx})});
    fetchChallenge();
}

// ═══ FLASHCARDS ═══════════════════════════

let fcState = {kartlar:[], idx:0, cevrildi:false};

async function flashcardEkle() {
    const on = document.getElementById('fc-on').value.trim();
    const arka = document.getElementById('fc-arka').value.trim();
    if (!on || !arka) return toast('⚠️ Ön ve arka yüzü doldur.');
    const ders = document.getElementById('fc-ders').value;
    await fetch(`${API}/flashcards`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on,arka,ders})});
    document.getElementById('fc-on').value=''; document.getElementById('fc-arka').value='';
    fetchFlashcards(); toast('🃏 Kart eklendi!');
}
async function fetchFlashcards() {
    const r = await fetch(`${API}/flashcards`); fcState.kartlar = await r.json();
    fcState.idx = 0; fcState.cevrildi = false;
    // Liste
    const liste = document.getElementById('flashcard-listesi');
    if (!fcState.kartlar.length) { liste.innerHTML = '<p style="color:var(--text-muted);">Henüz kart yok.</p>'; }
    else liste.innerHTML = fcState.kartlar.map(k => 
        `<div class="fc-item"><span class="fc-item-ders">${esc(k.ders)}</span><span class="fc-item-on">${esc(k.on)}</span><span class="fc-item-seviye">${'⭐'.repeat(k.seviye||1)}</span><button class="fc-sil" onclick="flashcardSil('${k.id}')">🗑</button></div>`
    ).join('');
    flashcardGoster();
}
function flashcardGoster() {
    if (!fcState.kartlar.length) {
        document.getElementById('fc-on-text').textContent = 'Kart ekleyerek başla';
        document.getElementById('fc-arka-text').style.display='none';
        document.getElementById('fc-sayac').textContent = '0/0 kart';
        return;
    }
    const k = fcState.kartlar[fcState.idx % fcState.kartlar.length];
    document.getElementById('fc-on-text').textContent = k.on;
    document.getElementById('fc-arka-text').textContent = k.arka;
    document.getElementById('fc-arka-text').style.display = fcState.cevrildi ? '' : 'none';
    document.getElementById('fc-on-text').style.display = fcState.cevrildi ? 'none' : '';
    document.getElementById('fc-kart').classList.toggle('cevrildi', fcState.cevrildi);
    document.getElementById('fc-sayac').textContent = `${fcState.idx+1}/${fcState.kartlar.length} kart`;
}
function flashcardCevir() {
    if (!fcState.kartlar.length) return;
    fcState.cevrildi = !fcState.cevrildi;
    flashcardGoster();
}
async function flashcardZor() {
    if (!fcState.kartlar.length) return;
    const k = fcState.kartlar[fcState.idx % fcState.kartlar.length];
    await fetch(`${API}/flashcards/${k.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({seviye:Math.max(1,(k.seviye||1)-1)})});
    fcState.idx++; fcState.cevrildi=false; flashcardGoster(); fetchFlashcards();
}
async function flashcardOrta() {
    if (!fcState.kartlar.length) return;
    fcState.idx++; fcState.cevrildi=false; flashcardGoster();
}
async function flashcardKolay() {
    if (!fcState.kartlar.length) return;
    const k = fcState.kartlar[fcState.idx % fcState.kartlar.length];
    await fetch(`${API}/flashcards/${k.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({seviye:Math.min(5,(k.seviye||1)+1)})});
    fcState.idx++; fcState.cevrildi=false; flashcardGoster(); fetchFlashcards();
}
async function flashcardSil(id) { await fetch(`${API}/flashcards/${id}`,{method:'DELETE'}); fetchFlashcards(); toast('🗑 Silindi.'); }



// ═══ PARÇACIK ARKA PLAN ════════════════════
(function initParticles() {
    const canvas = document.getElementById('particles-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    for (let i=0;i<40;i++) particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:1+Math.random()*2,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5});
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach(p=>{
            p.x+=p.vx;p.y+=p.vy;
            if(p.x<0)p.x=canvas.width;if(p.x>canvas.width)p.x=0;
            if(p.y<0)p.y=canvas.height;if(p.y>canvas.height)p.y=0;
            ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle='rgba(124,58,237,'+(.3+Math.random()*.2)+')';ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
})();

// ═══ XP SİSTEMİ ═════════════════════════════
let xpData = {xp:0, level:1, toplam_xp:0, next_level:100};

async function fetchXP() {
    try {
        const r = await fetch(`${API}/xp`); xpData = await r.json();
        const nextLvl = (xpData.level) * 100;
        document.getElementById('xp-level').textContent = 'Lv'+xpData.level;
        const pct = Math.min(((xpData.xp)/(nextLvl))*100, 100);
        document.getElementById('xp-bar-fill').style.width = pct+'%';
        document.getElementById('xp-text').textContent = xpData.xp+'/'+nextLvl+' XP';
        document.getElementById('xp-bar-container').style.display = '';
    } catch(e) { document.getElementById('xp-bar-container').style.display = 'none'; }
}
async function xpEkle(action, miktar=1) {
    try {
        const r = await fetch(`${API}/xp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,miktar})});
        const d = await r.json();
        if (d.level_up) { buyukRozet('⬆️','Level '+d.level+'!'); sesLevelUp(); }
        fetchXP();
    } catch(e) {}
}

// ═══ XP TRIGGERS ═══
const origPomodoroBitti = pomodoroBaslat;
// XP'yi mevcut event'lere bağla
setInterval(() => {
    // Pomodoro tamamlanınca XP ver
    const origFetch = fetch;
    // XP kazancı için gunlukKaydet sonrası
}, 10000);

// ═══ QUICK NOTE ═══
function quickNoteToggle() {
    const panel = document.getElementById('quick-note-panel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
}
async function quickNoteSave() {
    const text = document.getElementById('quick-note-text').value.trim();
    if (!text) return;
    await fetch(`${API}/notlar`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baslik:'Hızlı Not',icerik:text,renk:'accent'})});
    document.getElementById('quick-note-text').value='';
    document.getElementById('quick-note-panel').style.display='none';
    toast('📝 Not kaydedildi!');
}

// ═══ COUNTDOWN OVERLAY ═══
document.getElementById('countdown-overlay').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
});

// Quick note'u göster
document.getElementById('quick-note').style.display = '';

// XP'yi yükle
fetchXP();

// ═══ DIYET ═══════════════════════════════
async function fetchDiyet() {
    try {
        const r = await fetch(`${API}/diyet`); const d = await r.json();
        const hedefEl = document.getElementById('diyet-hedef-kal');
        const bugunEl = document.getElementById('diyet-bugun-kal');
        if (hedefEl) hedefEl.textContent = d.gunluk_kalori||2000;
        if (bugunEl) bugunEl.textContent = d.bugun_kalori||0;
        const pct = d.gunluk_kalori ? Math.min((d.bugun_kalori||0)/d.gunluk_kalori*100,100) : 0;
        const circle = document.querySelector('.diyet-progress .fill');
        if (circle) circle.style.strokeDashoffset = 377 - (pct/100)*377;
    } catch(e) {}
}

// ═══ WEATHER ═══════════════════════════
const TURKIYE_ILLER = ['Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kırıkkale','Kırklareli','Kırşehir','Kilis','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'];
const ILCELER = {
    'İstanbul':['Adalar','Arnavutköy','Ataşehir','Avcılar','Bağcılar','Bahçelievler','Bakırköy','Başakşehir','Bayrampaşa','Beşiktaş','Beykoz','Beylikdüzü','Beyoğlu','Büyükçekmece','Çatalca','Çekmeköy','Esenler','Esenyurt','Eyüpsultan','Fatih','Gaziosmanpaşa','Güngören','Kadıköy','Kağıthane','Kartal','Küçükçekmece','Maltepe','Pendik','Sancaktepe','Sarıyer','Silivri','Sultanbeyli','Sultangazi','Şile','Şişli','Tuzla','Ümraniye','Üsküdar','Zeytinburnu'],
    'Ankara':['Altındağ','Çankaya','Etimesgut','Gölbaşı','Keçiören','Mamak','Polatlı','Pursaklar','Sincan','Yenimahalle'],
    'İzmir':['Balçova','Bayraklı','Bornova','Buca','Çiğli','Gaziemir','Güzelbahçe','Karabağlar','Karşıyaka','Konak','Narlıdere'],
    'Antalya':['Alanya','Aksu','Döşemealtı','Kepez','Konyaaltı','Manavgat','Muratpaşa'],
    'Bursa':['Gemlik','Gürsu','İnegöl','Mudanya','Nilüfer','Osmangazi','Yıldırım'],
};
let havaKonum = localStorage.getItem('hava-konum') || 'İstanbul';
let havaIlce = localStorage.getItem('hava-ilce') || '';

function havaSehirDoldur() {
    const sel = document.getElementById('hava-sehir');
    if (!sel) return;
    sel.innerHTML = TURKIYE_ILLER.map(i => `<option value="${i}" ${i===havaKonum?'selected':''}>${i}</option>`).join('');
    havaIlceGuncelle();
}

function havaIlceGuncelle() {
    const sehir = document.getElementById('hava-sehir')?.value || havaKonum;
    const sel = document.getElementById('hava-ilce');
    if (!sel) return;
    const ilceler = ILCELER[sehir] || [];
    sel.innerHTML = '<option value="">Tümü</option>' + ilceler.map(i => `<option value="${i}" ${i===havaIlce?'selected':''}>${i}</option>`).join('');
}

async function fetchWeather(location) {
    const loc = location || havaKonum + (havaIlce ? '+' + havaIlce : '');
    try {
        const r = await fetch(`https://wttr.in/${encodeURIComponent(loc)}?format=j1`);
        if (!r.ok) throw new Error('Bulunamadı');
        const d = await r.json();
        const c = d.current_condition[0];
        const temp = document.getElementById('weather-temp');
        const desc = document.getElementById('weather-desc');
        const icon = document.getElementById('weather-icon');
        const tip = document.getElementById('weather-tip');
        if (temp) temp.textContent = c.temp_C + '°C';
        if (desc) desc.textContent = c.weatherDesc[0].value;
        const code = c.weatherCode;
        const icons = {'113':'☀️','116':'⛅','119':'☁️','122':'☁️','176':'🌧️','200':'⛈️','227':'🌨️','230':'❄️','248':'🌫️','260':'🌫️'};
        if (icon) icon.textContent = icons[code]||'🌤️';
        if (tip) tip.textContent = code==113?'☀️ Dışarıda mola ver!':code<200?'📚 İçeride çalışma zamanı':'🏠 Evde kalıp çalış!';
        return d;
    } catch(e) {
        if (document.getElementById('weather-temp')) {
            document.getElementById('weather-temp').textContent = '--°C';
            document.getElementById('weather-desc').textContent = 'Bulunamadı';
        }
        return null;
    }
}
fetchWeather();
function havaKonumKaydet() {
    const sehir = document.getElementById('hava-sehir')?.value;
    const ilce = document.getElementById('hava-ilce')?.value || '';
    if (sehir) { havaKonum = sehir; localStorage.setItem('hava-konum', sehir); }
    havaIlce = ilce; localStorage.setItem('hava-ilce', ilce);
    fetchWeather();
    if (document.getElementById('hava-detay')) fetchHavaDetay();
    toast('✅ Konum kaydedildi: ' + sehir + (ilce?', '+ilce:''));
}

// ═══ FULLSCREEN FOCUS MODE ══════════════════
function focusModeAc() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    document.body.style.background = '#000';
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.topbar').style.display = 'none';
    document.querySelector('.main-content').style.marginLeft = '0';
    document.querySelector('.content-area').style.padding = '0';
    document.querySelectorAll('.tab-panel').forEach(p=>p.style.display='none');
    document.getElementById('tab-pomodoro').style.display='flex';
    document.getElementById('tab-pomodoro').style.justifyContent='center';
    document.getElementById('tab-pomodoro').style.alignItems='center';
    document.getElementById('tab-pomodoro').style.minHeight='100vh';
    document.querySelector('.pomodoro-timer').style.width='300px';
    document.querySelector('.pomodoro-timer').style.height='300px';
    document.querySelector('.timer-display').style.fontSize='72px';
    toast('🎯 Odak modu açık! ESC ile çık.');
}
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        location.reload();
    }
});

// Focus button add
document.addEventListener('DOMContentLoaded', () => {
    const timerControls = document.querySelector('.timer-controls');
    if (timerControls && !document.getElementById('focus-btn')) {
        const btn = document.createElement('button');
        btn.id='focus-btn'; btn.className='btn-outline'; btn.textContent='🎯 Odak'; btn.onclick=focusModeAc;
        timerControls.appendChild(btn);
    }
});

// ═══ LİDERLİK TABLOSU ══════════════════════
async function fetchLeaderboard() {
    try {
        const r = await fetch(`${API}/xp`); const xp = await r.json();
        // Basit lokal liderlik - sadece kendi verin
        const board = [{isim:'Sen',xp:xp.toplam_xp,level:xp.level,icon:'👑'}];
        // Motivasyonel sanal rakipler
        const sanal = [
            {isim:'YKS Canavarı',xp:2500,level:12,icon:'🦁'},
            {isim:'Net Kralı',xp:1800,level:9,icon:'👑'},
            {isim:'Süper Öğrenci',xp:950,level:5,icon:'⭐'},
            {isim:'Çalışkan Arı',xp:450,level:3,icon:'🐝'},
        ];
        board.push(...sanal);
        board.sort((a,b)=>b.xp-a.xp);
        return board;
    } catch(e) { return []; }
}

async function renderLeaderboard() {
    // Gerçek sıralama verisini çek
    try {
        const sr = await fetch(`${API}/liderlik-siralama`); const sd = await sr.json();
        if (sd.ok && sd.siralama_hesaplama) {
            document.getElementById('leaderboard-list').innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:48px;font-weight:900;background:linear-gradient(180deg,var(--text),var(--primary-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${sd.siralama_hesaplama.siralama?.toLocaleString()||'?'}</div>
                    <div style="font-size:14px;color:var(--text-muted);margin-bottom:4px;">Tahmini YKS Sıralaması</div>
                    <div style="font-size:24px;color:var(--primary-light);font-weight:700;">${sd.siralama_hesaplama.yuzdelik_dilim||'?'}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Yüzdelik Dilim</div>
                    ${sd.rozetler?.map(r=>`<span style="display:inline-block;margin:4px;padding:4px 12px;background:rgba(124,58,237,.1);border-radius:20px;font-size:12px;">${r.ad}</span>`).join('')||''}
                </div>`;
            return;
        }
    } catch(e) {}
    const board = await fetchLeaderboard();
    const el = document.getElementById('leaderboard-list');
    el.innerHTML = board.map((p,i) => {
        const sira = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
        const cls = p.isim==='Sen'?' sen':'';
        return `<div class="lb-item${cls}"><span class="lb-icon">${p.icon}</span><span class="lb-sira">${sira}</span><span class="lb-isim">${p.isim}</span><span class="lb-level">Lv${p.level}</span><span class="lb-xp">${p.xp} XP</span></div>`;
    }).join('');
}

// ═══ EKSİK FONKSİYONLAR ═════════════════════
function aiQuickToggle() {
    const panel = document.getElementById('ai-quick-panel');
    if (!panel) return;
    panel.style.display = panel.style.display==='none'?'':'none';
    if (panel.style.display!=='none') document.getElementById('ai-quick-input')?.focus();
}
async function aiQuickSor() {
    const text = document.getElementById('ai-quick-input')?.value?.trim();
    if (!text) return;
    const el = document.getElementById('ai-quick-cevap');
    if (!el) return;
    el.textContent = 'Düşünüyor...';
    try {
        const r = await fetch(`${API}/ai/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:text}]})});
        const d = await r.json();
        el.textContent = d.ok ? d.reply : (d.error||'Hata');
        document.getElementById('ai-quick-input').value='';
    } catch(e) { el.textContent = 'Bağlantı hatası'; }
}
function cmdAc() {
    document.getElementById('cmd-overlay').classList.add('active');
    document.getElementById('cmd-input').value='';
    document.getElementById('cmd-input').focus();
    cmdAra();
}
function cmdKapat() { document.getElementById('cmd-overlay').classList.remove('active'); }

function cmdAra() {
    const q = document.getElementById('cmd-input').value.toLowerCase();
    cmdResults = q ? cmdListesi.filter(c => c.ad.toLowerCase().includes(q)) : cmdListesi;
    cmdIndex = 0;
    document.getElementById('cmd-sonuclar').innerHTML = cmdResults.map((c,i) => 
        `<div class="cmd-sonuc${i===0?' active':''}" onclick="cmdSec(${i})">
            <span class="cmd-icon">${c.icon}</span><span class="cmd-title">${c.ad}</span><span class="cmd-kisayol">${c.action||'modül'}</span></div>`
    ).join('');
}
function cmdKey(e) {
    if (e.key === 'Escape') { cmdKapat(); return; }
    if (e.key === 'Enter') { if (cmdResults[cmdIndex]) cmdSec(cmdIndex); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdIndex = Math.min(cmdIndex+1, cmdResults.length-1); cmdGuncelle(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cmdIndex = Math.max(cmdIndex-1, 0); cmdGuncelle(); }
}
function cmdGuncelle() {
    document.querySelectorAll('.cmd-sonuc').forEach((el,i) => el.classList.toggle('active', i===cmdIndex));
    const active = document.querySelector('.cmd-sonuc.active');
    if (active) active.scrollIntoView({block:'nearest'});
}
function cmdSec(i) { const c = cmdResults[i]; cmdKapat();
    if (c.id) switchTab(c.id); else if (c.action==='ayarlar') ayarlarAc();
    else if (c.action==='theme') toggleTheme(); else if (c.action==='modul') modulYonetAc(); }
function toggleNotif() {
    const el = document.getElementById('notif-center');
    el.classList.toggle('active');
    if (el.classList.contains('active')) { document.getElementById('notif-bell').innerHTML = '🔔'; notifGuncelle(); }
}
function notifGuncelle() {
    const el = document.getElementById('notif-list');
    if (!bildirimler.length) { el.innerHTML='<p style="color:var(--text-muted);font-size:12px;padding:16px;">Henüz bildirim yok.</p>'; return; }
    el.innerHTML = bildirimler.map(b => `<div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;display:flex;gap:8px;"><span>${b.icon}</span><span>${b.mesaj}</span><span style="color:var(--text-muted);margin-left:auto;font-size:10px;">${b.zaman}</span></div>`).join('');
}
let bildirimler = [];

// ═══ GÖREV EKLE ═══════════════════════════
async function challengeOzelEkle() {
    const gorev = document.getElementById('challenge-ozel')?.value?.trim();
    if (!gorev) return toast('⚠️ Görev yaz.');
    await fetch(`${API}/challenge`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ozel:gorev})});
    document.getElementById('challenge-ozel').value='';
    fetchChallenge(); toast('✅ Görev eklendi!');
}

// ═══ POMODORO ÖZEL ════════════════════════
function pomodoroOzel() {
    const dk = parseInt(document.getElementById('pomodoro-ozel-dk')?.value)||25;
    pomodoro.modes.calisma = dk*60;
    pomodoro.mode = 'calisma';
    pomodoroSifirla();
    updateTimerDisplay(pomodoro.modes.calisma);
    document.querySelector('[data-mode="calisma"]').textContent = `📖 Çalışma (${dk}dk)`;
    toast(`✅ ${dk} dakikalık çalışma ayarlandı!`);
}
function saatGuncelle() {
    const el = document.getElementById('live-clock');
    if (el) { const n=new Date(); el.textContent=n.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}); }
}

// ═══ INIT + START ═══════════════════════════
init(); setInterval(fetchStatus, 60000); setInterval(saatGuncelle, 1000); saatGuncelle();
