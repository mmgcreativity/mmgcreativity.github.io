/*!
 * mmg-undo.js — Basit, cerceve-bagimsiz "Geri Al" (undo) ozelligi
 * Veri giris alanlarindaki (input / textarea / select) degisiklikleri bir yigin
 * (stack) olarak takip eder. Ctrl+Z (veya Cmd+Z) ile son degisiklik geri alinir.
 *
 * Ozellikler:
 *  - document seviyesinde delegasyon (focusin / change) -> dinamik alanlar da calisir
 *  - undo sirasinda tetiklenen event'ler isaretlenip atlanir -> sonsuz dongu yok
 *  - geri alinca ilgili alanda 'input' ve 'change' event'i tetiklenir ->
 *    sayfanin kendi hesaplama / otomatik-kaydetme mantigi guncellenir
 *  - [data-mmg-undo] attribute'lu butonlara otomatik baglanir
 *  - kucuk, bagimsiz, global stil eklemez (yalnizca kendi olusturdugu opsiyonel
 *    yuzen butona inline stil verir)
 *
 * Global API: window.MMGUndo = { push, undo, clear, size }
 */
(function (window, document) {
  'use strict';

  if (window.MMGUndo) { return; } // birden fazla kez yuklenirse tekrar kurma

  var MAX_STACK = 300;      // yigin ust siniri
  var stack = [];           // { el, oldValue, kind } kayitlari
  var isUndoing = false;    // undo sirasindaki event'leri atlamak icin bayrak
  var prevValues = new WeakMap(); // her alan icin odak anindaki "onceki deger"

  // --- Yardimcilar --------------------------------------------------------

  function isTrackable(el) {
    if (!el || el.nodeType !== 1) { return false; }
    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') { return true; }
    if (tag === 'INPUT') {
      var t = (el.type || 'text').toLowerCase();
      // dugme/dosya benzeri tipleri takip etme
      if (t === 'button' || t === 'submit' || t === 'reset' ||
          t === 'file' || t === 'image' || t === 'hidden') {
        return false;
      }
      return true;
    }
    return false;
  }

  function kindOf(el) {
    if (el.tagName === 'INPUT') {
      var t = (el.type || 'text').toLowerCase();
      if (t === 'checkbox' || t === 'radio') { return 'checked'; }
    }
    return 'value';
  }

  function readState(el) {
    return kindOf(el) === 'checked' ? el.checked : el.value;
  }

  function writeState(el, kind, val) {
    if (kind === 'checked') { el.checked = val; }
    else { el.value = val; }
  }

  function dispatch(el, type) {
    var ev;
    try {
      ev = new Event(type, { bubbles: true, cancelable: false });
    } catch (e) {
      ev = document.createEvent('Event');
      ev.initEvent(type, true, false);
    }
    el.dispatchEvent(ev);
  }

  // --- Cekirdek: push / undo / clear -------------------------------------

  function push(el, oldValue, kind) {
    if (!el) { return; }
    kind = kind || kindOf(el);
    stack.push({ el: el, oldValue: oldValue, kind: kind });
    if (stack.length > MAX_STACK) { stack.shift(); }
    updateButtons();
  }

  function undo() {
    var entry = stack.pop();
    if (!entry) { updateButtons(); return false; }
    var el = entry.el;
    // Alan DOM'dan kaldirilmissa atla (mumkunse bir sonrakine gec)
    if (!el || !document.contains(el)) { return undo(); }

    isUndoing = true;
    try {
      writeState(el, entry.kind, entry.oldValue);
      // Bu alanin bir sonraki blur/change'inde tekrar iticiligi onlemek icin
      // "onceki deger"i geri yuklenen degere esitle.
      prevValues.set(el, readState(el));
      try { el.focus({ preventScroll: false }); } catch (e) {}
      // Sayfalarin hesaplama mantigi farkli olaylara bagli olabilir:
      //   - bazilari 'input'ta hesaplar
      //   - COGU 'blur' (veya 'change') aninda recalc() cagirir
      // Eskiden yalnizca input+change gonderiliyordu; blur'da hesaplayan sayfalarda
      // kutunun degeri geri geliyor ama TOPLAM/SONUC guncellenmiyordu -> kullaniciya
      // "geri al calismiyor" gibi gorunuyordu. Artik blur da gonderiliyor.
      // (isUndoing bayragi acik oldugu icin bu olaylar yigina tekrar itilmez.)
      dispatch(el, 'input');
      dispatch(el, 'change');
      dispatch(el, 'blur');
    } finally {
      isUndoing = false;
    }
    updateButtons();
    return true;
  }

  function clear() {
    stack.length = 0;
    updateButtons();
  }

  function size() { return stack.length; }

  // --- Olay delegasyonu ---------------------------------------------------

  document.addEventListener('focusin', function (e) {
    if (isUndoing) { return; }
    var el = e.target;
    if (isTrackable(el)) {
      prevValues.set(el, readState(el));
    }
  }, true);

  function commit(el) {
    if (isUndoing || !isTrackable(el)) { return; }
    var kind = kindOf(el);
    var cur = readState(el);
    var prev = prevValues.has(el) ? prevValues.get(el) : cur;
    if (cur !== prev) {
      push(el, prev, kind);
      prevValues.set(el, cur);
    }
  }

  // 'change' -> metin alanlarinda blur'da, select/checkbox'ta aninda tetiklenir
  document.addEventListener('change', function (e) {
    commit(e.target);
  }, true);

  // Guvenlik agi: blur (focusout) aninda da net degisikligi yakala
  document.addEventListener('focusout', function (e) {
    commit(e.target);
  }, true);

  // --- Klavye kisayolu: Ctrl+Z / Cmd+Z -----------------------------------

  document.addEventListener('keydown', function (e) {
    var z = (e.key === 'z' || e.key === 'Z' || e.keyCode === 90);
    if (!z) { return; }
    if (!(e.ctrlKey || e.metaKey)) { return; }
    if (e.shiftKey || e.altKey) { return; } // Ctrl+Shift+Z (redo) vb. dokunma

    // Yigindan geri alacak bir sey yoksa tarayicinin native metin-undo'suna
    // karismayalim; kendi yigimiz varsa devral.
    if (stack.length === 0) { return; }

    e.preventDefault();
    undo();
  }, false);

  // --- Opsiyonel "Geri Al" butonlari -------------------------------------

  var autoBtn = null;

  function bindDeclaredButtons() {
    var nodes = document.querySelectorAll('[data-mmg-undo]');
    for (var i = 0; i < nodes.length; i++) {
      var b = nodes[i];
      if (b.__mmgBound) { continue; }
      b.__mmgBound = true;
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        undo();
      });
    }
    return nodes.length;
  }

  function createFloatingButton() {
    if (autoBtn) { return; }
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-mmg-undo', 'auto');
    b.setAttribute('aria-label', 'Geri Al (Ctrl+Z)');
    b.title = 'Son degisikligi geri al (Ctrl+Z)';
    b.textContent = '↶ Geri Al';
    // Yalnizca bu elemana inline stil (global stil eklenmez)
    b.style.cssText = [
      'position:fixed',
      'left:16px',
      'bottom:16px',
      'z-index:2147483000',
      'display:none',
      'align-items:center',
      'gap:6px',
      'padding:8px 12px',
      'font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'color:#fff',
      'background:#334155',
      'border:0',
      'border-radius:9999px',
      'box-shadow:0 4px 14px rgba(0,0,0,.22)',
      'cursor:pointer',
      'opacity:.92'
    ].join(';');
    b.addEventListener('mouseenter', function () { b.style.opacity = '1'; });
    b.addEventListener('mouseleave', function () { b.style.opacity = '.92'; });
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      undo();
    });
    b.__mmgBound = true;
    (document.body || document.documentElement).appendChild(b);
    autoBtn = b;
  }

  function updateButtons() {
    if (autoBtn) {
      autoBtn.style.display = stack.length > 0 ? 'inline-flex' : 'none';
    }
  }

  function init() {
    var declared = bindDeclaredButtons();
    // Sayfada elle tanimlanmis [data-mmg-undo] buton yoksa yuzen buton olustur
    if (declared === 0) { createFloatingButton(); }
    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // --- Disa acilan minimal API -------------------------------------------

  window.MMGUndo = {
    push: function (el, oldValue, kind) { push(el, oldValue, kind); },
    undo: undo,
    clear: clear,
    size: size
  };

})(window, document);
