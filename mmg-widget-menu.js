/* ==========================================================================
   mmgcreativity — Widget sağ-tık menüsü (ortak)
   Sayfada BOŞ bir alana sağ tıklayınca küçük bir menü açılır; menüden KUR ve
   Hesap Makinesi widget'ları gizlenip yeniden gösterilebilir (kullanıcı isteği:
   "isteyen bu kur ve hesap makinesi widget'larını kaldırabilsin").

   Tercih: localStorage['mmg_widgets_hidden'] = '1' (gizli) | '0'/yok (görünür)
   Widget dosyaları (mmg-doviz-widget.js, mmg-calc-widget.js) açılışta bu
   anahtara bakar; değişince sayfa yeniden yüklenerek uygulanır.

   Menü YALNIZCA boş alanda açılır: yazı seçiliyken, form alanlarında, bağlantı
   ve butonlarda tarayıcının kendi menüsü çıkar (kopyala/yapıştır kaybolmasın).
   ========================================================================== */
(function(){
  'use strict';
  var KEY = 'mmg_widgets_hidden';
  var menu = null;

  function hidden(){
    try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; }
  }
  function setHidden(v){
    try{ localStorage.setItem(KEY, v ? '1' : '0'); }catch(e){}
  }

  function closeMenu(){
    if(menu){ menu.remove(); menu = null; }
  }

  // Sağ tıklanan yer "boş alan" mı? Etkileşimli/metin öğelerinde tarayıcının
  // kendi menüsü kalsın — yoksa kopyala-yapıştır ve bağlantı menüsü kaybolur.
  function isEmptySpot(t){
    if(!t) return false;
    if(t.closest('input, textarea, select, button, a, [contenteditable="true"], table, .mmg-chat-panel, #mmgChatPanel')) return false;
    try{ if(String(window.getSelection())) return false; }catch(e){}
    return true;
  }

  function openMenu(x, y){
    closeMenu();
    var isHidden = hidden();
    menu = document.createElement('div');
    menu.id = 'mmgWidgetMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText =
      'position:fixed; z-index:2000; min-width:210px; padding:6px;' +
      'background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);' +
      'border-radius:10px; box-shadow:0 16px 40px rgba(0,0,0,0.5);' +
      'font-family:Inter,sans-serif; font-size:13px; color:var(--text,#EAEDF3);';
    menu.innerHTML =
      '<button type="button" data-act="toggle" style="display:flex; align-items:center; gap:9px; width:100%;' +
        'background:none; border:none; color:inherit; font:inherit; text-align:left; cursor:pointer;' +
        'padding:9px 10px; border-radius:7px;">' +
        '<span style="font-size:15px; line-height:1;">' + (isHidden ? '➕' : '🚫') + '</span>' +
        '<span>' + (isHidden ? 'Widget’ları göster (KUR + Hesap Makinesi)' : 'Widget’ları kaldır (KUR + Hesap Makinesi)') + '</span>' +
      '</button>';
    document.body.appendChild(menu);

    // Ekran dışına taşmasın.
    var r = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth  - r.width  - 6)) + 'px';
    menu.style.top  = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';

    var item = menu.querySelector('[data-act="toggle"]');
    item.addEventListener('mouseenter', function(){ item.style.background = 'var(--surface,#141C2B)'; });
    item.addEventListener('mouseleave', function(){ item.style.background = 'none'; });
    item.addEventListener('click', function(){
      setHidden(!isHidden);
      closeMenu();
      // Widget'lar açılışta enjekte edildiği için en temiz uygulama yeniden yükleme.
      // Masaüstü kabuğunda (iframe) tercih üst pencereye de yansısın.
      try{ if(window.top && window.top !== window) window.top.location.reload(); else location.reload(); }
      catch(e){ location.reload(); }
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
