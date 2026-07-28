/* ==========================================================================
   mmgcreativity — Döviz Kurları Widget'ı (tüm sayfalarda ortak)
   Hesap Makinesi'nin (#mmgCalcBtn / #mmgCalcPanel) hemen SOLUNA yerleşir.
   VERİ KAYNAĞI: exchangerate-api.com açık uç noktası — https://open.er-api.com/v6/latest/USD
     - Ücretsiz, API anahtarı GEREKTİRMEZ, CORS açık, günlük güncellenir.
     - Base USD döner; X/TRY = rates.TRY / rates.X ile hesaplanır.
   Kur değerleri localStorage'da 30 dk önbelleklenir; süresi geçince yeniden çekilir.
   ========================================================================== */
(function(){
  'use strict';
  const API_URL   = 'https://open.er-api.com/v6/latest/USD';
  const CACHE_KEY = 'mmg_doviz_cache_v1';
  const MAX_AGE_MS = 30 * 60 * 1000; // 30 dakika
  // Gösterilecek pariteler (kod: etiket). Hepsi X/TRY olarak hesaplanır.
  const PAIRS = [
    { code: 'USD', label: 'USD', flag: '🇺🇸' },
    { code: 'EUR', label: 'EUR', flag: '🇪🇺' },
    { code: 'GBP', label: 'GBP', flag: '🇬🇧' },
    { code: 'CHF', label: 'CHF', flag: '🇨🇭' }
  ];

  function inject(){
    if(document.getElementById('mmgDovizBtn')) return; // tek örnek

    // --- Buton (Hesap Makinesi butonunun hemen soluna) ---
    const btn = document.createElement('button');
    btn.id = 'mmgDovizBtn';
    btn.type = 'button';
    btn.title = 'Döviz Kurları';
    btn.setAttribute('aria-label', 'Döviz Kurları');
    btn.textContent = '💱';

    // --- Panel ---
    const panel = document.createElement('div');
    panel.id = 'mmgDovizPanel';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="mmg-doviz-head">' +
        '<span>DÖVİZ KURLARI</span>' +
        '<button type="button" id="mmgDovizCloseBtn" aria-label="Kapat">✕</button>' +
      '</div>' +
      '<div id="mmgDovizRows" class="mmg-doviz-rows">' +
        '<div class="mmg-doviz-loading">Yükleniyor…</div>' +
      '</div>' +
      '<div class="mmg-doviz-foot">' +
        '<span id="mmgDovizUpdated"></span>' +
        '<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">exchangerate-api.com</a>' +
      '</div>';

    // --- Stil ---
    const style = document.createElement('style');
    style.textContent =
      '#mmgDovizBtn{position:fixed;top:16px;right:66px;z-index:800;width:42px;height:42px;border-radius:11px;' +
        'border:1px solid var(--hairline,#2A3448);background:var(--surface-2,#1B2536);color:var(--brass,#C6A15B);' +
        'font-size:18px;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,0.35);display:flex;align-items:center;' +
        'justify-content:center;transition:border-color .15s ease, transform .15s ease;}' +
      '#mmgDovizBtn:hover{border-color:var(--brass-dim,#8A7440);transform:translateY(-1px);}' +
      '#mmgDovizPanel{position:fixed;top:64px;right:264px;z-index:801;width:230px;background:var(--surface,#141C2B);' +
        'border:1px solid var(--hairline,#2A3448);border-radius:14px;padding:14px;box-shadow:0 24px 60px rgba(0,0,0,0.5);' +
        'font-family:\'IBM Plex Mono\',monospace;}' +
      '#mmgDovizPanel[hidden]{display:none;}' +
      '.mmg-doviz-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:11.5px;' +
        'color:var(--muted,#8D96AC);text-transform:uppercase;letter-spacing:.06em;}' +
      '#mmgDovizCloseBtn{background:none;border:none;color:var(--muted,#8D96AC);cursor:pointer;font-size:13px;padding:2px 4px;}' +
      '#mmgDovizCloseBtn:hover{color:var(--text,#EAEDF3);}' +
      '.mmg-doviz-rows{display:flex;flex-direction:column;gap:7px;}' +
      '.mmg-doviz-row{display:flex;align-items:center;justify-content:space-between;background:var(--surface-2,#1B2536);' +
        'border:1px solid var(--hairline,#2A3448);border-radius:8px;padding:9px 11px;}' +
      '.mmg-doviz-pair{display:flex;align-items:center;gap:7px;color:var(--text,#EAEDF3);font-size:13px;font-weight:600;}' +
      '.mmg-doviz-pair small{color:var(--muted,#8D96AC);font-weight:500;}' +
      '.mmg-doviz-val{color:var(--brass,#C6A15B);font-size:15px;font-weight:700;}' +
      '.mmg-doviz-loading,.mmg-doviz-err{color:var(--muted,#8D96AC);font-size:12px;text-align:center;padding:14px 4px;}' +
      '.mmg-doviz-err{color:var(--red,#E2544B);}' +
      '.mmg-doviz-foot{display:flex;align-items:center;justify-content:space-between;margin-top:11px;padding-top:9px;' +
        'border-top:1px solid var(--hairline,#2A3448);font-size:10px;color:var(--muted,#8D96AC);}' +
      '.mmg-doviz-foot a{color:var(--brass-dim,#8A7440);text-decoration:none;}' +
      '.mmg-doviz-foot a:hover{text-decoration:underline;}' +
      '@media (max-width:820px){#mmgDovizPanel{right:8px;left:8px;width:auto;}#mmgDovizBtn{right:58px;}}';

    document.body.appendChild(style);
    document.body.appendChild(btn);
    document.body.appendChild(panel);

    const rowsEl    = panel.querySelector('#mmgDovizRows');
    const updatedEl = panel.querySelector('#mmgDovizUpdated');
    const closeBtn  = panel.querySelector('#mmgDovizCloseBtn');

    function fmt(n){
      return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }

    function renderRates(data){
      const r = data.rates || {};
      const tryUsd = r.TRY; // 1 USD kaç TRY
      if(!tryUsd){ renderError(); return; }
      let html = '';
      PAIRS.forEach(p => {
        // X/TRY = (1 USD -> TRY) / (1 USD -> X)
        const perUsd = p.code === 'USD' ? 1 : r[p.code];
        if(!perUsd) return;
        const val = tryUsd / perUsd;
        html += '<div class="mmg-doviz-row">' +
                  '<span class="mmg-doviz-pair">' + p.flag + ' ' + p.label + '<small>/TRY</small></span>' +
                  '<span class="mmg-doviz-val">' + fmt(val) + '</span>' +
                '</div>';
      });
      rowsEl.innerHTML = html || '<div class="mmg-doviz-err">Kur bulunamadı</div>';
      // Güncelleme zamanı
      let stamp = '';
      try{
        const d = data.time_last_update_utc ? new Date(data.time_last_update_utc) : new Date();
        stamp = d.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit' }) + ' ' +
                d.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
      }catch(e){}
      updatedEl.textContent = stamp ? ('Güncel: ' + stamp) : '';
    }

    function renderError(){
      rowsEl.innerHTML = '<div class="mmg-doviz-err">Kurlar alınamadı.<br>Bağlantını kontrol et.</div>';
      updatedEl.textContent = '';
    }

    function loadRates(force){
      // Önbellek
      if(!force){
        try{
          const raw = localStorage.getItem(CACHE_KEY);
          if(raw){
            const cached = JSON.parse(raw);
            if(cached && cached.savedAt && (Date.now() - cached.savedAt) < MAX_AGE_MS && cached.data){
              renderRates(cached.data);
              return;
            }
          }
        }catch(e){}
      }
      rowsEl.innerHTML = '<div class="mmg-doviz-loading">Yükleniyor…</div>';
      fetch(API_URL)
        .then(res => res.ok ? res.json() : Promise.reject(new Error('http ' + res.status)))
        .then(data => {
          if(!data || data.result !== 'success') throw new Error('bad payload');
          renderRates(data);
          try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: data })); }catch(e){}
        })
        .catch(() => {
          // Ağ hatasında son önbelleğe düş
          try{
            const raw = localStorage.getItem(CACHE_KEY);
            if(raw){ const c = JSON.parse(raw); if(c && c.data){ renderRates(c.data); return; } }
          }catch(e){}
          renderError();
        });
    }

    function openPanel(){ panel.hidden = false; loadRates(false); }
    function closePanel(){ panel.hidden = true; }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(panel.hidden) openPanel(); else closePanel();
      // Hesap makinesi açıksa çakışmasın diye kapat
      const calc = document.getElementById('mmgCalcPanel');
      if(calc && !panel.hidden) calc.hidden = true;
    });
    closeBtn.addEventListener('click', closePanel);
    document.addEventListener('click', (e) => {
      if(!panel.hidden && !panel.contains(e.target) && e.target !== btn){ closePanel(); }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
