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
    { code: 'EUR', label: 'EUR', flag: '🇪🇺' }
  ];
  // Gram Altın ayrı kaynaktan çekilir (döviz API'sinde altın yok). Birincil kaynak
  // CORS'ta takılırsa yedek kaynağa düşülür (kullanıcı: "Gram Altın gelmiyor").
  const GOLD_URLS = [
    'https://finans.truncgil.com/v4/today.json',
    'https://api.genelpara.com/embed/altin.json'
  ];
  // "+Parite" listesinde gösterilecek yaygın kodlar (kullanıcı isteği: kör prompt yerine
  // tıklanabilir liste). Zaten eklenmiş/temel (USD,EUR) olanlar listede işaretli/pasif görünür.
  // gold:true olanlar döviz API'sinde YOKTUR — altın kaynağından (GOLD_URLS) çekilir.
  const COMMON_EXTRA = [
    { code:'ONS', label:'Ons Altın',       flag:'🥇', gold:true },
    { code:'GBP', label:'İngiliz Sterlini', flag:'🇬🇧' },
    { code:'CHF', label:'İsviçre Frangı',  flag:'🇨🇭' },
    { code:'JPY', label:'Japon Yeni',      flag:'🇯🇵' },
    { code:'SAR', label:'Suudi Riyali',    flag:'🇸🇦' },
    { code:'AED', label:'BAE Dirhemi',     flag:'🇦🇪' },
    { code:'CNY', label:'Çin Yuanı',       flag:'🇨🇳' },
    { code:'RUB', label:'Rus Rublesi',     flag:'🇷🇺' },
    { code:'CAD', label:'Kanada Doları',   flag:'🇨🇦' },
    { code:'KWD', label:'Kuveyt Dinarı',   flag:'🇰🇼' }
  ];
  const GOLD_CODES = COMMON_EXTRA.filter(c => c.gold).map(c => c.code);
  // Kullanıcının kendi eklediği pariteler (örn. GBP, CHF, SAR) — kalıcı.
  const EXTRA_KEY = 'mmg_doviz_extra_pairs';
  function getExtraPairs(){
    try{ const a = JSON.parse(localStorage.getItem(EXTRA_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch(e){ return []; }
  }
  function setExtraPairs(a){ try{ localStorage.setItem(EXTRA_KEY, JSON.stringify(a)); }catch(e){} }

  function inject(){
    if(document.getElementById('mmgDovizBtn')) return; // tek örnek
    // NOT: Gizleme burada DEĞİL, mmg-widget-menu.js içinde CSS ile yapılır. Widget her
    // zaman oluşturulur; böylece sağ tık menüsünden açılıp kapanması ANINDA olur
    // (kullanıcı: "tıklayınca çok geç yüklüyor" — eskiden yeniden yükleme gerekiyordu).

    // --- Buton (Hesap Makinesi butonunun hemen soluna) ---
    const btn = document.createElement('button');
    btn.id = 'mmgDovizBtn';
    btn.type = 'button';
    btn.title = 'Döviz Kurları';
    btn.setAttribute('aria-label', 'Döviz Kurları');
    btn.innerHTML = '<span class="mmg-doviz-btn-ico">₺</span><span class="mmg-doviz-btn-lbl">KUR</span>';

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
      '<div class="mmg-doviz-foot" style="justify-content:space-between;gap:8px;">' +
        '<span id="mmgDovizUpdated"></span>' +
        '<button type="button" id="mmgDovizAddBtn" title="Parite ekle" style="background:none;border:1px solid var(--hairline,#2A3448);border-radius:6px;color:var(--brass,#C6A15B);cursor:pointer;font-size:10.5px;font-weight:700;padding:3px 8px;">+ EKLE</button>' +
      '</div>' +
      // Liste PANELİN İÇİNDE, başlık ile alt çubuk arasına oturur (kullanıcı: "kesik geliyor").
      // Yukarı doğru açılan mutlak konumlu eski liste panel/ekran dışına taşıp kırpılıyordu.
      '<div id="mmgDovizAddList" class="mmg-doviz-add-list" hidden></div>';

    // --- Stil ---
    const style = document.createElement('style');
    style.textContent =
      '#mmgDovizBtn{position:fixed;top:16px;right:66px;z-index:800;width:42px;height:42px;border-radius:11px;' +
        'border:1px solid var(--hairline,#2A3448);background:var(--surface-2,#1B2536);color:var(--brass,#C6A15B);' +
        'cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,0.35);display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:1px;transition:border-color .15s ease, transform .15s ease;}' +
      '#mmgDovizBtn .mmg-doviz-btn-ico{font-size:17px;line-height:1;font-weight:700;}' +
      '#mmgDovizBtn .mmg-doviz-btn-lbl{font-size:7.5px;line-height:1;letter-spacing:.08em;font-weight:700;color:var(--muted,#8D96AC);}' +
      '#mmgDovizBtn:hover{border-color:var(--brass-dim,#8A7440);transform:translateY(-1px);}' +
      // Panel genişliği 230px→280px (kullanıcı: "çakışma oluyor" — dar panelde uzun kur
      // değerleri/etiketler kenara sıkışıp arkadaki sayfa içeriğiyle çakışıyordu).
      '#mmgDovizPanel{position:fixed;top:64px;right:66px;z-index:801;width:280px;min-height:230px;background:var(--surface,#141C2B);' +
        'border:1px solid var(--hairline,#2A3448);border-radius:14px;padding:14px;box-shadow:0 24px 60px rgba(0,0,0,0.5);' +
        'font-family:\'IBM Plex Mono\',monospace;}' +
      '#mmgDovizPanel[hidden]{display:none;}' +
      '.mmg-doviz-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-size:11.5px;' +
        'color:var(--muted,#8D96AC);text-transform:uppercase;letter-spacing:.06em;}' +
      '#mmgDovizCloseBtn{background:none;border:none;color:var(--muted,#8D96AC);cursor:pointer;font-size:13px;padding:2px 4px;}' +
      '#mmgDovizCloseBtn:hover{color:var(--text,#EAEDF3);}' +
      '.mmg-doviz-rows{display:flex;flex-direction:column;gap:5px;}' +
      // Kutu yüksekliği azaltıldı (kullanıcı isteği): padding 9px/11px → 6px/10px.
      '.mmg-doviz-row{display:flex;align-items:center;justify-content:space-between;background:var(--surface-2,#1B2536);' +
        'border:1px solid var(--hairline,#2A3448);border-radius:8px;padding:6px 10px;}' +
      // "Gram Altın" iki satıra kırılınca /TRY ikinci satırın yanında kalıp arada büyük boşluk
      // oluşuyordu (kullanıcı 2026-07-31). nowrap ile etiket tek satırda tutuluyor; ayrıca
      // flex gap'i (7px) negatif margin ile ~3px'e indirilip /TRY etikete yaklaştırıldı.
      '.mmg-doviz-pair{display:flex;align-items:center;gap:7px;color:var(--text,#EAEDF3);font-size:13px;font-weight:600;white-space:nowrap;}' +
      '.mmg-doviz-pair small{color:var(--muted,#8D96AC);font-weight:500;margin-left:-4px;}' +
      '.mmg-doviz-val{color:var(--brass,#C6A15B);font-size:15px;font-weight:700;}' +
      '.mmg-doviz-loading,.mmg-doviz-err{color:var(--muted,#8D96AC);font-size:12px;text-align:center;padding:14px 4px;}' +
      '.mmg-doviz-err{color:var(--red,#E2544B);}' +
      '.mmg-doviz-foot{display:flex;align-items:center;justify-content:center;margin-top:11px;padding-top:9px;' +
        'border-top:1px solid var(--hairline,#2A3448);font-size:10px;color:var(--muted,#8D96AC);}' +
      '.mmg-doviz-foot #mmgDovizUpdated{white-space:nowrap;}' +
      // "+ Parite" tıklanınca açılan liste: kör prompt yerine tıklanabilir seçenekler.
      // Panelin İÇİNE, başlığın altı ile alt çubuğun üstü arasına yerleşir; taşan kısım
      // kendi içinde kaydırılır. Böylece ekran/panel dışına taşıp kırpılması imkânsız.
      '.mmg-doviz-add-list{position:absolute;left:12px;right:12px;top:40px;bottom:44px;overflow-y:auto;' +
        'background:var(--surface-2,#1B2536);border:1px solid var(--hairline,#2A3448);border-radius:10px;' +
        'box-shadow:0 14px 34px rgba(0,0,0,0.45);padding:6px;z-index:802;}' +
      '.mmg-doviz-add-list[hidden]{display:none;}' +
      '.mmg-doviz-add-item{display:flex;align-items:center;gap:7px;width:100%;background:none;border:none;' +
        'color:var(--text,#EAEDF3);font-size:12.5px;font-weight:600;text-align:left;padding:7px 8px;border-radius:7px;' +
        'cursor:pointer;font-family:inherit;}' +
      '.mmg-doviz-add-item:hover{background:var(--surface,#141C2B);}' +
      '.mmg-doviz-add-item[disabled]{opacity:0.4;cursor:default;}' +
      '.mmg-doviz-add-item[disabled]:hover{background:none;}' +
      '.mmg-doviz-add-item small{color:var(--muted,#8D96AC);font-weight:500;margin-left:auto;}' +
      '.mmg-doviz-add-custom{display:flex;gap:6px;margin-top:4px;padding-top:6px;border-top:1px solid var(--hairline,#2A3448);}' +
      '.mmg-doviz-add-custom input{flex:1;min-width:0;background:var(--surface,#141C2B);border:1px solid var(--hairline,#2A3448);' +
        'border-radius:6px;color:var(--text,#EAEDF3);font-size:12px;padding:5px 7px;font-family:inherit;text-transform:uppercase;}' +
      '.mmg-doviz-add-custom button{flex:0 0 auto;background:var(--brass,#C6A15B);border:none;border-radius:6px;color:#0D1420;' +
        'font-size:11.5px;font-weight:700;padding:5px 9px;cursor:pointer;}' +
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

    let lastRates = null; // parite eklerken kod doğrulamak için son kur seti
    function renderRates(data){
      const r = data.rates || {};
      lastRates = r;
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
      // Kullanıcının eklediği pariteler (✕ ile kaldırılabilir).
      getExtraPairs().forEach(code => {
        if(GOLD_CODES.indexOf(code) !== -1) return; // altın satırları renderGold içinde çizilir
        const perUsd = code === 'USD' ? 1 : r[code];
        if(!perUsd) return;
        const val = tryUsd / perUsd;
        html += '<div class="mmg-doviz-row" data-extra="' + code + '">' +
                  '<span class="mmg-doviz-pair">💱 ' + code + '<small>/TRY</small></span>' +
                  '<span style="display:flex;align-items:center;gap:8px;">' +
                    '<span class="mmg-doviz-val">' + fmt(val) + '</span>' +
                    '<button type="button" class="mmg-doviz-del" data-del="' + code + '" title="Kaldır" style="background:none;border:none;color:var(--muted,#8D96AC);cursor:pointer;font-size:12px;padding:0 2px;">✕</button>' +
                  '</span>' +
                '</div>';
      });
      rowsEl.innerHTML = html || '<div class="mmg-doviz-err">Kur bulunamadı</div>';
      renderGold(); // Gram Altın satırını (varsa) ekle
      // Güncelleme zamanı
      let stamp = '';
      try{
        const d = data.time_last_update_utc ? new Date(data.time_last_update_utc) : new Date();
        stamp = d.toLocaleDateString('tr-TR', { day:'2-digit', month:'2-digit' }) + ' ' +
                d.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
      }catch(e){}
      updatedEl.textContent = stamp ? ('Güncel: ' + stamp) : '';
    }

    function parseTRNum(s){ if(typeof s==='number') return s; return parseFloat(String(s==null?'':s).replace(/[^0-9.,]/g,'').replace(/\./g,'').replace(',','.')); }
    // Altın kaynağından tek bir kalemi çıkarır. Kaynaklar farklı anahtar/biçim kullanıyor:
    // truncgil v4: { "GRA": {"Selling":..} } / { "gram-altin": {"Satış":"..."} } / { "ONS": {...} }
    // genelpara:   { "GA": {"satis":"..."} } / { "ONS": {"satis":"..."} }
    function pickNum(g){
      if(!g) return null;
      const raw = (g.Selling != null ? g.Selling : (g['Satış'] != null ? g['Satış'] : (g.satis != null ? g.satis : g.selling)));
      const v = parseTRNum(raw);
      return (v && isFinite(v)) ? v : null;
    }
    function extractGold(d){
      if(!d) return null;
      return pickNum(d.GRA || d['gram-altin'] || d.GA || d.gram || d.gramaltin);
    }
    function extractOns(d){
      if(!d) return null;
      return pickNum(d.ONS || d['ons-altin'] || d.ons || d.ONSALTIN || d.onsaltin);
    }
    // Gram Altın her zaman gösterilir; Ons Altın yalnızca kullanıcı "+ Parite"den eklediyse.
    function renderGold(idx){
      idx = idx || 0;
      if(idx >= GOLD_URLS.length) return;
      const wantOns = getExtraPairs().indexOf('ONS') !== -1;
      fetch(GOLD_URLS[idx]).then(r=>r.json()).then(d=>{
        const v = extractGold(d);
        if(!v){ renderGold(idx + 1); return; }
        if(!rowsEl.querySelector('.mmg-doviz-gold')){
          rowsEl.insertAdjacentHTML('beforeend',
            '<div class="mmg-doviz-row mmg-doviz-gold"><span class="mmg-doviz-pair">🥇 Gram Altın<small>/TRY</small></span><span class="mmg-doviz-val">' + fmt(v) + '</span></div>');
        }
        if(wantOns && !rowsEl.querySelector('.mmg-doviz-ons')){
          const o = extractOns(d);
          if(o){
            rowsEl.insertAdjacentHTML('beforeend',
              '<div class="mmg-doviz-row mmg-doviz-ons" data-extra="ONS">' +
                '<span class="mmg-doviz-pair">🥇 Ons Altın<small>/USD</small></span>' +
                '<span style="display:flex;align-items:center;gap:8px;">' +
                  '<span class="mmg-doviz-val">' + fmt(o) + '</span>' +
                  '<button type="button" class="mmg-doviz-del" data-del="ONS" title="Kaldır" style="background:none;border:none;color:var(--muted,#8D96AC);cursor:pointer;font-size:12px;padding:0 2px;">✕</button>' +
                '</span>' +
              '</div>');
          }
        }
      }).catch(()=>{ renderGold(idx + 1); });
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
    function closePanel(){ panel.hidden = true; const al = panel.querySelector('#mmgDovizAddList'); if(al) al.hidden = true; }

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

    // ---- Kullanıcı-eklemeli pariteler ----
    // "+ Parite": artık kör prompt yerine tıklanabilir bir liste açılır (kullanıcı isteği:
    // "ne ekleyebileceğine dair bir liste çıkmalı"). Yaygın kodlar tek tıkla eklenir; listede
    // olmayan özel bir kod için altta küçük bir metin kutusu var.
    const addBtn  = panel.querySelector('#mmgDovizAddBtn');
    const addList = panel.querySelector('#mmgDovizAddList');

    function addExtraCode(code){
      code = (code || '').trim().toUpperCase();
      if(!code) return;
      if(!/^[A-Z]{3}$/.test(code)){ window.alert('Geçersiz kod. 3 harfli döviz kodu girin (örn. GBP).'); return; }
      if(lastRates && !lastRates[code]){ window.alert('"' + code + '" kuru kaynakta bulunamadı.'); return; }
      const extras = getExtraPairs();
      if(extras.indexOf(code) === -1 && !PAIRS.some(p => p.code === code)){
        extras.push(code); setExtraPairs(extras);
      }
      addList.hidden = true;
      loadRates(false);
    }

    function renderAddList(){
      const extras = getExtraPairs();
      const added = (code) => extras.indexOf(code) !== -1 || PAIRS.some(p => p.code === code);
      let html = COMMON_EXTRA.map(c => {
        const isAdded = added(c.code);
        return '<button type="button" class="mmg-doviz-add-item" data-add="' + c.code + '"' +
               (isAdded ? ' disabled' : '') + '>' + c.flag + ' ' + c.code +
               '<small>' + (isAdded ? 'eklendi' : c.label) + '</small></button>';
      }).join('');
      html += '<div class="mmg-doviz-add-custom">' +
                '<input type="text" id="mmgDovizCustomCode" maxlength="3" placeholder="Özel kod (SAR)">' +
                '<button type="button" id="mmgDovizCustomAdd">Ekle</button>' +
              '</div>';
      addList.innerHTML = html;
    }

    if(addBtn && addList){
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if(!addList.hidden){ addList.hidden = true; return; }
        renderAddList();
        addList.hidden = false;
      });
      addList.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('[data-add]');
        if(item && !item.disabled){ addExtraCode(item.dataset.add); return; }
        if(e.target.id === 'mmgDovizCustomAdd'){
          const input = addList.querySelector('#mmgDovizCustomCode');
          addExtraCode(input ? input.value : '');
        }
      });
    }
    rowsEl.addEventListener('click', (e) => {
      const del = e.target.closest('.mmg-doviz-del');
      if(!del) return;
      e.stopPropagation();
      setExtraPairs(getExtraPairs().filter(c => c !== del.dataset.del));
      loadRates(false);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
