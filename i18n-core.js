/*
 * MMG i18n Core
 * -------------
 * Tüm sayfalarda ortak kullanılan basit çeviri altyapısı.
 * - Her sayfa kendi TR/EN sözlüğünü tanımlar ve registerDict() ile bildirir.
 * - [data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria]
 *   öznitelikleriyle işaretlenmiş elemanlar otomatik güncellenir.
 * - İlk ziyarette (daha önce dil seçilmemişse) ziyaretçinin ülkesine bakılarak
 *   Türkiye dışından gelenler için otomatik İngilizce açılır.
 * - Ana kabuk (index.html) içindeki iframe'e ve iframe içindeki sayfalardan
 *   üst pencereye postMessage ile dil senkronize edilir.
 */
(function () {
  var STORAGE_KEY = 'mmg_lang';
  var currentDict = { tr: {}, en: {} };
  var currentLang = 'tr';
  var listeners = [];

  function getSavedLang() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* yoksay */ }
  }

  function t(key) {
    var dict = currentDict[currentLang] || currentDict.tr || {};
    if (dict[key] !== undefined) return dict[key];
    var fallback = currentDict.tr || {};
    return fallback[key] !== undefined ? fallback[key] : key;
  }

  function apply(lang) {
    if (!lang) lang = 'tr';
    currentLang = lang;
    var dict = currentDict[lang] || currentDict.tr || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] !== undefined) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (dict[key] !== undefined) el.setAttribute('placeholder', dict[key]);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (dict[key] !== undefined) el.setAttribute('title', dict[key]);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (dict[key] !== undefined) el.setAttribute('aria-label', dict[key]);
    });
    document.querySelectorAll('.mmg-lang-btn[data-lang]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.documentElement.setAttribute('lang', lang);

    try {
      var frameEl = document.getElementById('app-frame');
      if (frameEl && frameEl.contentWindow) {
        frameEl.contentWindow.postMessage({ mmgLang: lang }, '*');
      }
    } catch (e) { /* yoksay */ }

    listeners.forEach(function (fn) {
      try { fn(lang); } catch (e) { /* yoksay */ }
    });
  }

  function setLang(lang) {
    saveLang(lang);
    apply(lang);
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function registerDict(dict) {
    currentDict = dict || { tr: {}, en: {} };
  }

  // ---- Coğrafi konuma göre varsayılan dil ----
  // Yalnızca bu tarayıcıda hiç dil seçimi kaydedilmemişse (ilk ziyaret) çalışır.
  // Türkiye'den gelenler Türkçe, diğer tüm ülkeler İngilizce ile karşılanır.
  // Sonuç bulunur bulunmaz normal bir kullanıcı seçimiymiş gibi kaydedilir;
  // böylece aynı ziyaretçi sitedeki diğer sayfalara geçtiğinde tekrar tekrar
  // konum sorgusu yapılmaz ve kullanıcı istediği zaman elle değiştirebilir.
  function detectAndApplyDefaultLang() {
    var saved = getSavedLang();
    if (saved) {
      apply(saved);
      return;
    }

    // Sonuç gelene kadar tarayıcı diline göre geçici bir tahmin göster.
    var browserLang = (navigator.language || 'tr').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en';
    apply(browserLang);

    fetch('https://ipapi.co/json/', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || getSavedLang()) return; // bu sırada kullanıcı elle seçim yaptıysa dokunma
        var country = (data.country_code || data.country || '').toUpperCase();
        var lang = country === 'TR' ? 'tr' : 'en';
        setLang(lang);
      })
      .catch(function () { /* konum tespit edilemezse tarayıcı dili tahmini geçerli kalır */ });
  }

  window.MMGI18N = {
    t: t,
    apply: apply,
    setLang: setLang,
    getSavedLang: getSavedLang,
    onChange: onChange,
    registerDict: registerDict,
    detectAndApplyDefaultLang: detectAndApplyDefaultLang,
    get lang() { return currentLang; }
  };

  // iframe içindeki sayfalar, üst kabuktan gelen dil değişikliği mesajını dinler.
  window.addEventListener('message', function (e) {
    if (e && e.data && e.data.mmgLang) {
      apply(e.data.mmgLang);
    }
  });

  // Aynı tarayıcıda başka bir sekmede dil değiştirilirse bu sekme de senkron olsun.
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      apply(e.newValue);
    }
  });
})();
