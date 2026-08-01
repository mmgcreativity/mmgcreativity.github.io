/* ==========================================================================
   mmgcreativity — Widget sağ-tık menüsü (ortak)
   Sayfada BOŞ bir alana sağ tıklayınca "Widget'lar" başlıklı menü açılır:
     • Hepsi           → üçünü birden aç/kapat
     • Kurlar          → #mmgDovizBtn   (mmg-doviz-widget.js)
     • Hesap Makinesi  → #mmgCalcBtn    (mmg-calc-widget.js)
     • Chat            → #mmgChatBubble (mmg-chat-widget.js)

   Tercihler (localStorage, '1' = gizli):
     mmg_widget_kur_hidden · mmg_widget_calc_hidden · mmg_widget_chat_hidden

   ⚡ ANINDA uygulanır — sayfa YENİDEN YÜKLENMEZ (kullanıcı: "tıklayınca çok geç
   yüklüyor, neredeyse 3 sn"). Gizleme tek bir <style> etiketiyle yapıldığı için
   tıklama anında etki eder; menü açık kalır, arka arkaya seçim yapılabilir.
   Gizleme CSS ile olduğundan widget'ın ortak dosyadan mı yoksa sayfanın kendi
   HTML'inden mi geldiği fark etmez.

   Masaüstü kabuğunda araçlar iframe'de açılır; tercih değişince 'storage' olayı
   diğer belgeleri (üst pencere / diğer iframe'ler) tetikler ve onlar da anında
   uygular — yine yeniden yükleme yok.

   Menü YALNIZCA boş alanda açılır: yazı seçiliyken, form alanlarında, bağlantı
   ve butonlarda tarayıcının kendi menüsü çıkar (kopyala/yapıştır kaybolmasın).
   ========================================================================== */
(function(){
  'use strict';

  var WIDGETS = [
    { key:'mmg_widget_kur_hidden',  label:'Kurlar',         icon:'₺',  sel:'#mmgDovizBtn, #mmgDovizPanel' },
    { key:'mmg_widget_calc_hidden', label:'Hesap Makinesi', icon:'🧮', sel:'#mmgCalcBtn, #mmgCalcPanel' },
    { key:'mmg_widget_chat_hidden', label:'Chat',           icon:'💬', sel:'#mmgChatBubble, #mmgChatPanel, #mmgChatToastContainer' }
  ];
  var menu = null;

  function isHidden(k){ try{ return localStorage.getItem(k) === '1'; }catch(e){ return false; } }
  function setHidden(k, v){ try{ localStorage.setItem(k, v ? '1' : '0'); }catch(e){} }
  function allHidden(){ return WIDGETS.every(function(w){ return isHidden(w.key); }); }

  // ---- Tek <style> ile gizleme (anında etki) ----
  var hideStyle = null;
  function applyHiding(){
    if(!hideStyle){
      hideStyle = document.createElement('style');
      hideStyle.id = 'mmgWidgetHideStyle';
      (document.head || document.documentElement).appendChild(hideStyle);
    }
    var sels = WIDGETS.filter(function(w){ return isHidden(w.key); }).map(function(w){ return w.sel; });
    hideStyle.textContent = sels.length ? (sels.join(', ') + '{ display:none !important; }') : '';
  }

  // ---- Widget konumu: EKRANA değil SAYFAYA sabit ----
  // Kullanıcı isteği: "ekranın sağ üstünde değil SAYFANIN sağ üstünde dursun,
  // kaydırınca gitsin". position:fixed iken ekrana çakılı kalıp içeriğin üstüne
  // biniyorlardı; absolute ile sayfa kaydırıldıkça yukarı kayıp giderler.
  try{
    var pos = document.createElement('style');
    // ⚠️ YALNIZCA BUTONLAR. Paneller (#mmgDovizPanel / #mmgCalcPanel) kendi CSS'lerinde
    // fixed'e göre konumlandırılmış; absolute'a zorlanınca hesap makinesi paneli sayfanın
    // sol üstüne kaçıyordu (kullanıcı bildirdi). Paneller fixed kalır — zaten geçici
    // açılır kutular, sayfayla birlikte kaymalarına gerek yok.
    pos.textContent = '#mmgDovizBtn, #mmgCalcBtn{ position:absolute !important; }';
    (document.head || document.documentElement).appendChild(pos);
  }catch(e){}

  applyHiding();
  // Başka bir belgede (üst pencere / diğer iframe) tercih değişirse burada da uygula.
  window.addEventListener('storage', function(e){
    if(e && e.key && e.key.indexOf('mmg_widget_') === 0){ applyHiding(); }
  });

  function isEmptySpot(t){
    if(!t) return false;
    if(t.closest('input, textarea, select, button, a, [contenteditable="true"], table, #mmgChatPanel')) return false;
    try{ if(String(window.getSelection())) return false; }catch(e){}
    return true;
  }

  function box(on){
    return '<span style="flex:0 0 16px; font-size:13px; line-height:1; color:' +
      (on ? 'var(--brass,#C6A15B)' : 'var(--muted,#8D96AC)') + ';">' + (on ? '☑' : '☐') + '</span>';
  }
  function rowBtn(dataAttr, on, icon, label, bold){
    return '<button type="button" ' + dataAttr + ' style="display:flex; align-items:center; gap:10px; width:100%;' +
      'background:none; border:none; color:inherit; font:inherit; text-align:left; cursor:pointer;' +
      'padding:8px 10px; border-radius:7px;' + (bold ? 'font-weight:700;' : '') + '">' +
      box(on) +
      '<span style="flex:0 0 18px; font-size:14px; line-height:1;">' + icon + '</span>' +
      '<span style="' + (on ? '' : 'color:var(--muted,#8D96AC);') + '">' + label + '</span>' +
    '</button>';
  }

  function menuHtml(){
    var allOn = !allHidden();
    return '<div style="font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;' +
        'color:var(--muted,#8D96AC); padding:6px 10px 6px;">Widget’lar</div>' +
      rowBtn('data-all="1"', allOn, '✦', 'Hepsi', true) +
      '<div style="height:1px; background:var(--hairline,#2A3448); margin:4px 8px;"></div>' +
      WIDGETS.map(function(w){ return rowBtn('data-key="' + w.key + '"', !isHidden(w.key), w.icon, w.label, false); }).join('');
  }

  function wireRows(){
    menu.querySelectorAll('button').forEach(function(btn){
      btn.addEventListener('mouseenter', function(){ btn.style.background = 'var(--surface,#141C2B)'; });
      btn.addEventListener('mouseleave', function(){ btn.style.background = 'none'; });
      btn.addEventListener('click', function(ev){
        ev.stopPropagation();                       // menü açık kalsın, arka arkaya seçilebilsin
        if(btn.dataset.all){
          var turnOff = !allHidden();               // hepsi açıksa hepsini kapat, değilse hepsini aç
          WIDGETS.forEach(function(w){ setHidden(w.key, turnOff); });
        } else {
          var k = btn.dataset.key;
          setHidden(k, !isHidden(k));
        }
        applyHiding();                              // ⚡ anında, yeniden yükleme YOK
        menu.innerHTML = menuHtml();                // kutucukları tazele
        wireRows();
      });
    });
  }

  function openMenu(x, y){
    closeMenu();
    menu = document.createElement('div');
    menu.id = 'mmgWidgetMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText =
      'position:fixed; z-index:2000; min-width:206px; padding:6px;' +
      'background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);' +
      'border-radius:10px; box-shadow:0 16px 40px rgba(0,0,0,0.5);' +
      'font-family:Inter,sans-serif; font-size:13px; color:var(--text,#EAEDF3);';
    menu.innerHTML = menuHtml();
    document.body.appendChild(menu);

    var r = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth  - r.width  - 6)) + 'px';
    menu.style.top  = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    wireRows();
  }
  function closeMenu(){ if(menu){ menu.remove(); menu = null; } }

  document.addEventListener('contextmenu', function(e){
    if(!isEmptySpot(e.target)) return;   // etkileşimli öğe → tarayıcı menüsü
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  });
  document.addEventListener('click', closeMenu);
  document.addEventListener('scroll', closeMenu, true);
  window.addEventListener('blur', closeMenu);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeMenu(); });
})();
