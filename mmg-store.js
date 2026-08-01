/* ==========================================================================
   mmg-store.js — Modüller için ORTAK veri deposu (yerel + bulut)

   Kullanım:
     const store = MMGStore('stok');            // koleksiyon/doküman adı
     store.onChange(list => render(list));      // her değişimde çağrılır
     store.load();                              // yerelden anında, buluttan tazeler
     store.set(list);                           // kaydet (yerel + bulut)

   Tasarım kararı — "önce yerel, sonra bulut":
     Kullanıcı en çok "açılış yavaş" ve "verim gitti" şikâyeti yaşadı. Bu yüzden
     okuma DAİMA localStorage'tan anında yapılır; bulut arka planda gelir ve
     yalnızca DAHA YENİ ise (updatedAt) yereli ezer. Böylece çevrimdışıyken ve
     giriş yapılmamışken de modüller tam çalışır.

   Bulut yolu: {users|firmaAccounts}/{scopeId}/mmgModules/{ad}
     Tek doküman içinde { items:[...], updatedAt: <ms> }. Firestore doküman
     sınırı 1MB — binlerce satırda bile yeterli. Sınıra yaklaşınca uyarı verir.
   ========================================================================== */
(function(){
  'use strict';

  function MMGStore(name){
    var LS_KEY = 'mmg_mod_' + name;
    var LS_TS  = 'mmg_mod_' + name + '_ts';
    var items = [];
    var listeners = [];
    var cloudTried = false;

    function readLocal(){
      try{
        var raw = localStorage.getItem(LS_KEY);
        return raw ? (JSON.parse(raw) || []) : [];
      }catch(e){ return []; }
    }
    function localTs(){
      try{ return parseInt(localStorage.getItem(LS_TS) || '0', 10) || 0; }catch(e){ return 0; }
    }
    function writeLocal(list, ts){
      try{
        localStorage.setItem(LS_KEY, JSON.stringify(list));
        localStorage.setItem(LS_TS, String(ts));
      }catch(e){
        // Kota dolduysa sessizce geç; kullanıcı verisi bulutta duruyorsa kaybolmaz.
        console.warn('[mmg-store] yerel kayıt başarısız:', e && e.message);
      }
    }
    function emit(){ listeners.forEach(function(fn){ try{ fn(items.slice()); }catch(e){} }); }

    function cloudRef(){
      var C = window.mmgCloud;
      if(!C || !C.canWrite || !C.canWrite()) return null;
      return C.doc(C.db, C.scopeCollection, C.scopeId, 'mmgModules', name);
    }

    async function pullCloud(){
      var ref = cloudRef();
      if(!ref) return;
      try{
        var snap = await window.mmgCloud.getDoc(ref);
        if(!snap.exists()) { pushCloud(); return; }   // ilk kez: yereli yukarı taşı
        var d = snap.data() || {};
        var remoteTs = d.updatedAt || 0;
        if(remoteTs > localTs()){
          items = Array.isArray(d.items) ? d.items : [];
          writeLocal(items, remoteTs);
          emit();
        } else if(localTs() > remoteTs){
          pushCloud();
        }
      }catch(e){ /* çevrimdışı / izin yok — yerel devam */ }
    }

    async function pushCloud(){
      var ref = cloudRef();
      if(!ref) return;
      try{
        await window.mmgCloud.setDoc(ref, { items: items, updatedAt: localTs() });
      }catch(e){ /* sessizce geç */ }
    }

    return {
      name: name,
      get(){ return items.slice(); },
      onChange(fn){ listeners.push(fn); return this; },
      load(){
        items = readLocal();
        emit();
        if(window.mmgCloud && window.mmgCloud.ready){ pullCloud(); }
        else if(!cloudTried){
          cloudTried = true;
          document.addEventListener('mmg-scope-ready', function(){ pullCloud(); });
        }
        return this;
      },
      set(list){
        items = Array.isArray(list) ? list : [];
        writeLocal(items, Date.now());
        emit();
        pushCloud();
        return this;
      },
      add(row){ var l = items.slice(); l.push(row); this.set(l); return this; },
      update(id, patch){
        this.set(items.map(function(r){ return r.id === id ? Object.assign({}, r, patch) : r; }));
        return this;
      },
      remove(id){ this.set(items.filter(function(r){ return r.id !== id; })); return this; },
      clear(){ this.set([]); return this; }
    };
  }

  /* Ortak yardımcılar — tüm modüller aynı biçimlendirmeyi kullansın diye. */
  MMGStore.uid = function(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };
  MMGStore.fmt = function(n, d){
    d = (d === undefined) ? 2 : d;
    var v = Number(n);
    if(!isFinite(v)) v = 0;
    return v.toLocaleString('tr-TR', { minimumFractionDigits:d, maximumFractionDigits:d });
  };
  /* "1.234,56" / "1234.56" / "1234,56" → 1234.56 */
  MMGStore.parse = function(s){
    if(typeof s === 'number') return s;
    if(!s) return 0;
    var t = String(s).trim().replace(/\s/g, '');
    if(t.indexOf(',') > -1 && t.indexOf('.') > -1){
      t = (t.lastIndexOf(',') > t.lastIndexOf('.')) ? t.replace(/\./g,'').replace(',','.')
                                                    : t.replace(/,/g,'');
    } else if(t.indexOf(',') > -1){ t = t.replace(/\./g,'').replace(',','.'); }
    var v = parseFloat(t);
    return isFinite(v) ? v : 0;
  };
  MMGStore.today = function(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };
  MMGStore.trDate = function(iso){
    if(!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? (p[2] + '.' + p[1] + '.' + p[0]) : iso;
  };

  window.MMGStore = MMGStore;
})();
