/* ==========================================================================
   mmgcreativity — Widget sağ-tık menüsü (ortak)
   Sayfada BOŞ bir alana sağ tıklayınca "Widget'lar" başlıklı küçük bir menü açılır.
   Menüden üç widget AYRI AYRI açılıp kapatılabilir (kullanıcı isteği):
     • Kurlar          → #mmgDovizBtn  (mmg-doviz-widget.js)
     • Hesap Makinesi  → #mmgCalcBtn   (mmg-calc-widget.js)
     • Chat            → #mmgChatBubble(mmg-chat-widget.js)

   Tercihler (localStorage, '1' = gizli):
     mmg_widget_kur_hidden · mmg_widget_calc_hidden · mmg_widget_chat_hidden
   Widget dosyaları açılışta kendi anahtarına bakar; değişiklik sayfa yeniden
   yüklenerek uygulanır.

   Menü YALNIZCA boş alanda açılır: yazı seçiliyken, form alanlarında, bağlantı
   ve butonlarda tarayıcının kendi menüsü çıkar (kopyala/yapıştır kaybolmasın).
   ========================================================================== */
(function(){
  'use strict';

  var WIDGETS = [
    { key:'mmg_widget_kur_hidden',  label:'Kurlar',          icon:'₺'  },
    { key:'mmg_widget_calc_hidden', label:'Hesap Makinesi',  icon:'🧮' },
    { key:'mmg_widget_chat_hidden', label:'Chat',            icon:'💬' }
  ];
  var menu = null;

  function isHidden(k){ try{ return localStorage.getItem(k) === '1'; }catch(e){ return false; } }
  function setHidden(k, v){ try{ localStorage.setItem(k, v ? '1' : '0'); }catch(e){} }
  function closeMenu(){ if(menu){ menu.remove(); menu = null; } }

  // ---- Widget konumu: EKRANA değil SAYFAYA sabit ----
  // Kullanıcı isteği: "ekranın sağ üstünde değil SAYFANIN sağ üstünde dursun,
  // kaydırınca gitsin". Widget'lar position:fixed idi → ekrana çakılı kalıp
  // içeriğin üstüne biniyorlardı. absolute'a çevrilince sayfa kaydırıldıkça
  // yukarı kayıp giderler. (Chat balonu hariç — o her zaman erişilebilir kalmalı.)
  try{
    var pos = document.createElement('style');
    pos.textContent =
      '#mmgDovizBtn, #mmgCalcBtn{ position:absolute !important; }' +
      '#mmgDovizPanel, #mmgCalcPanel{ position:absolute !important; }';
    (document.head || document.documentElement).appendChild(pos);
  }catch(e){}

  // Chat widget'ı kendi dosyasında gizlilik kontrolü yapmıyor olabilir; tercih
  // gizliyse burada CSS ile kapatıyoruz (balon + panel + bildirim balonu).
  try{
    if(isHidden('mmg_widget_chat_hidden')){
      var ch = document.createElement('style');
      ch.textContent = '#mmgChatBubble, #mmgChatPanel, #mmgChatToastContainer{ display:none !important; }';
      (document.head || document.documentElement).appendChild(ch);
    }
  }catch(e){}

  // Sağ tıklanan yer "boş alan" mı? Etkileşimli/metin öğelerinde tarayıcının
  // kendi menüsü kalsın — yoksa kopyala-yapıştır ve bağlantı menüsü kaybolur.
  function isEmptySpot(t){
    if(!t) return false;
    if(t.closest('input, textarea, select, button, a, [contenteditable="true"], table, #mmgChatPanel')) return false;
    try{ if(String(window.getSelection())) return false; }catch(e){}
    return true;
  }

  function rowHtml(w){
    var off = isHidden(w.key);
    return '<button type="button" data-key="' + w.key + '" style="display:flex; align-items:center; gap:10px; width:100%;' +
      'background:none; border:none; color:inherit; font:inherit; text-align:left; cursor:pointer;' +
      'padding:8px 10px; border-radius:7px;">' +
      '<span style="flex:0 0 16px; font-size:13px; line-height:1; color:' + (off ? 'var(--muted,#8D96AC)' : 'var(--brass,#C6A15B)') + ';">' +
        (off ? '☐' : '☑') + '</span>' +
      '<span style="flex:0 0 18px; font-size:14px; line-height:1;">' + w.icon + '</span>' +
      '<span style="' + (off ? 'color:var(--muted,#8D96AC);' : '') + '">' + w.label + '</span>' +
    '</button>';
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
    menu.innerHTML =
      '<div style="font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;' +
        'color:var(--muted,#8D96AC); padding:6px 10px 6px;">Widget’lar</div>' +
      WIDGETS.map(rowHtml).join('');
    document.body.appendChild(menu);

    // Ekran dışına taşmasın.
    var r = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth  - r.width  - 6)) + 'px';
    menu.style.top  = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';

    menu.querySelectorAll('[data-key]').forEach(function(btn){
      btn.addEventListener('mouseenter', function(){ btn.style.background = 'var(--surface,#141C2B)'; });
      btn.addEventListener('mouseleave', function(){ btn.style.background = 'none'; });
      btn.addEventListener('click', function(){
        var k = btn.dataset.key;
        setHidden(k, !isHidden(k));
        closeMenu();
        // Widget'lar açılışta enjekte edildiği için en temiz uygulama yeniden yükleme.
        // Masaüstü kabuğunda (iframe) tercih üst pencereye de yansısın.
        try{ if(window.top && window.top !== window) window.top.location.reload(); else location.reload(); }
        catch(e){ location.reload(); }
      });
    });
  }

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
