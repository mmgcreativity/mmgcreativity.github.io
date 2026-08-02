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

  /* ==========================================================================
     CARİ (müşteri / tedarikçi) LİSTESİ — TEK KAYNAK: Veri Giriş Paneli
     Kullanıcı isteği (2026-08-02): "müşteriler zaten veri girişinden yapılıyor…
     işletme yönetiminde sadece listeleri gelebilir."
     Yani yeni modüller KENDİ müşteri kartını TUTMAZ; hepsi buradan okur.
     Yol: {users|firmaAccounts|companies}/{scopeId}/customers  (ve /suppliers)
     Müşteri dokümanı: { name, ibans[], riskLimit, vadeGun, vergiNo, telefon, not }
     ========================================================================== */
  var cariCache = { customers:null, suppliers:null };

  MMGStore.cariler = async function(kind){
    kind = kind || 'customers';
    if(cariCache[kind]) return cariCache[kind].slice();
    var C = window.mmgCloud;
    if(!C || !C.currentUser || !C.scopeId) return [];
    try{
      var snap = await C.getDocs(C.collection(C.db, C.scopeCollection, C.scopeId, kind));
      var list = [];
      snap.forEach(function(d){
        var x = d.data() || {};
        list.push({
          id: d.id, ad: x.name || '', ibans: x.ibans || [],
          limit: Number(x.riskLimit) || 0, vadeGun: Number(x.vadeGun) || 0,
          vergi: x.vergiNo || '', tel: x.telefon || '', not: x.not || ''
        });
      });
      list.sort(function(a,b){ return a.ad.localeCompare(b.ad, 'tr'); });
      cariCache[kind] = list;
      return list.slice();
    }catch(e){ return []; }
  };
  MMGStore.cariTazele = function(){ cariCache = { customers:null, suppliers:null }; };

  /* Cari seçici <select>'i doldurur. Kapsam hazır olmadan çağrılırsa
     'mmg-scope-ready' olayını bekler; böylece sayfa açılışında boş kalmaz. */
  MMGStore.cariDoldur = function(sel, kind, onHazir){
    if(!sel) return;
    var doldur = async function(){
      var list = await MMGStore.cariler(kind);
      var onceki = sel.value;
      sel.innerHTML = list.length
        ? '<option value="">— seçin —</option>' + list.map(function(c){
            return '<option value="' + c.id + '">' +
              String(c.ad).replace(/[&<>"]/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]; }) +
            '</option>';
          }).join('')
        : '<option value="">— Veri Girişi\'nden müşteri ekleyin —</option>';
      if(onceki) sel.value = onceki;
      if(onHazir) onHazir(list);
    };
    if(window.mmgCloud && window.mmgCloud.ready) doldur();
    else document.addEventListener('mmg-scope-ready', doldur);
  };

  /* ==========================================================================
     FİRMALARIM — kullanıcının KENDİ şirketleri (YAŞAR CİHAN, ADERANS, CİHANTAŞ…)
     Banka limitleri, teminat mektupları ve bakiyeler firma bazında ayrıldığı için
     bu liste de TEK KAYNAK olmalı. Banka Yönetimi ekranındaki "Firmalarım"
     sekmesinden yönetilir, diğer modüller buradan okur.
     ⚠️ Bu, Firestore'daki `firmaAccounts` (ekip/hesap paylaşımı) ile AYNI ŞEY DEĞİL;
     o erişim yönetimi, bu ise muhasebe/raporlama kırılımı.
     ========================================================================== */
  var firmaStore = null;
  MMGStore.firmaStore = function(){
    if(!firmaStore){ firmaStore = MMGStore('firmalar').load(); }
    return firmaStore;
  };
  MMGStore.firmalar = function(){ return MMGStore.firmaStore().get(); };
  MMGStore.firmaDoldur = function(sel, hepsiEtiketi){
    if(!sel) return;
    var list = MMGStore.firmalar().slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); });
    var onceki = sel.value;
    sel.innerHTML = (hepsiEtiketi ? '<option value="">' + hepsiEtiketi + '</option>' : '<option value="">— seçin —</option>') +
      list.map(function(f){
        return '<option value="' + f.id + '">' +
          String(f.ad).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }) +
        '</option>';
      }).join('');
    sel.value = onceki;
  };

  window.MMGStore = MMGStore;
})();
