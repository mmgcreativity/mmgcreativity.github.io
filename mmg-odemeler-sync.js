/*
 * MMG Creativity — Ödeme (Gider) → Nakit Akış Senkron Motoru
 * ----------------------------------------------------------
 * Bu dosya EKSİKTİ: Giderler.html ve Nakit_Akis_Tablosu.html şu fonksiyonları çağırıyordu
 * ama hiçbir yerde tanımlı değildi; bu yüzden girilen giderler Nakit Akış'a HİÇ aktarılmıyordu
 * ("Aktarılıyor…" durumunda takılı kalıyordu). Bu motor eksikliği giderir.
 *
 * Sağladığı global'ler:
 *   window.mmgLocalPaymentsAPI            — { load(), save(list) }  (localStorage: mmg_odemeler_list)
 *   window.mmgRunPaymentSync()            — MİSAFİR/yerel: vadesi gelen (ve tekrarlı) giderleri
 *                                           yerel Nakit Akış önbelleğine işler.
 *   window.mmgMergeCloudPaymentsAndSync() — ÜYE/bulut: {scope}/odemeler kayıtlarını okuyup vadesi
 *                                           gelenleri {scope}/cashflow/{ay} dokümanına işler.
 *   window.mmgLatestDueOccurrence(item)   — bir kaydın bugüne kadarki en son vadesi gelen tarihi
 *                                           (durum rozeti "Aktarıldı" mı hesaplamak için).
 *
 * Not: Nakit Akış verisi { 'YYYY-MM-DD': { gider:[{id,desc,category,amount}], gelir:[...],
 * expanded:{gider,gelir} } } yapısındadır ve bulutta {scope}/cashflow/{YYYY-MM} = { data: ... }
 * olarak, yerelde 'mmg_nat_scope_<koleksiyon>:<id>_<YYYY-MM>' anahtarında JSON olarak tutulur.
 */
(function () {
  "use strict";

  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }
  // Ay uzunluğuna göre günü kırparak 'YYYY-MM-DD' üretir (ör. 31 → Şubat'ta 28/29).
  function ymd(y, m, d) {
    var dim = new Date(y, m, 0).getDate(); // m: 1-12 → new Date(y, m, 0) = o ayın son günü
    var dd = Math.min(d, dim);
    return y + "-" + pad2(m) + "-" + pad2(dd);
  }

  // dueDate'ten bugüne kadar, tekrar kuralına göre vadesi gelmiş TÜM tarihleri döndürür.
  // Gelecek tarihli tek seferlikler boş döner. Tekrarlılar her periyot için bir tarih üretir.
  function occurrencesUpTo(dueDate, recurrence, today) {
    var out = [];
    if (!dueDate) return out;
    if (dueDate > today) return out; // henüz vadesi gelmemiş (ilk tarih gelecekte)
    var parts = dueDate.split("-");
    var y = +parts[0], m = +parts[1], d = +parts[2];
    var guard = 0;
    while (guard++ < 800) {
      var occ = ymd(y, m, d);
      if (occ > today) break;
      out.push(occ);
      if (recurrence === "aylik") { m++; if (m > 12) { m = 1; y++; } }
      else if (recurrence === "haftalik") {
        var dt = new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate()));
        dt.setDate(dt.getDate() + 7);
        y = dt.getFullYear(); m = dt.getMonth() + 1; d = dt.getDate();
      }
      else if (recurrence === "yillik") { y++; }
      else break; // 'yok' → tek sefer
    }
    return out;
  }

  window.mmgLatestDueOccurrence = function (item) {
    if (!item || !item.dueDate) return null;
    var occ = occurrencesUpTo(item.dueDate, item.recurrence, todayKey());
    return occ.length ? occ[occ.length - 1] : null;
  };

  /* ---- Yerel ödeme listesi API'si — KAPSAM BAZLI (2026-08-02) ----
     HATA: Liste tek bir global anahtarda ("mmg_odemeler_list") tutuluyordu. Nakit akış
     önbelleği kapsam bazlıydı ama LİSTENİN KENDİSİ değildi; bu yüzden A firmasında
     girilen bir gider, B firmasına geçildiğinde de ekranda görünüyordu
     (kullanıcı: "grup seçmediğim halde Yaşar Cihan'da Aderans'ın ödemesi geliyor").
     ÇÖZÜM: anahtar artık aktif kapsamı içerir → mmg_odemeler_list__firmaAccounts:<id>
     Eski global anahtar, yalnızca misafir/kişisel kapsama BİR KEZ taşınır; üye
     kapsamlarında doğru kaynak zaten buluttur ({scope}/odemeler). */
  function scopeKeyPart() {
    var c = window.mmgCloud || {};
    return (c.scopeCollection || "guest") + ":" + (c.scopeId || "guest");
  }
  function scopedListKey(base) { return base + "__" + scopeKeyPart(); }
  function makeScopedListAPI(base) {
    return {
      key: function () { return scopedListKey(base); },
      load: function () {
        var k = scopedListKey(base);
        try {
          var raw = localStorage.getItem(k);
          if (raw === null) {
            // Tek seferlik devir: sürüm öncesi global liste, kişisel/misafir kapsama taşınır.
            var c = window.mmgCloud || {};
            var kisisel = !c.scopeCollection || c.scopeCollection === "users";
            var eskiRaw = localStorage.getItem(base);
            if (kisisel && eskiRaw) { localStorage.setItem(k, eskiRaw); raw = eskiRaw; }
          }
          return raw ? (JSON.parse(raw) || []) : [];
        } catch (e) { return []; }
      },
      save: function (list) {
        try { localStorage.setItem(scopedListKey(base), JSON.stringify(list || [])); } catch (e) {}
      }
    };
  }
  window.mmgScopedListAPI = makeScopedListAPI;
  window.mmgLocalPaymentsAPI = makeScopedListAPI("mmg_odemeler_list");
  window.mmgLocalIncomeAPI = window.mmgLocalIncomeAPI || makeScopedListAPI("mmg_gelirler_list");

  /* Buluttaki {scope}/<col> kayıtlarını yerel kapsam listesine indirir.
     Ekranda gösterilen liste böylece HER ZAMAN aktif firmaya ait olur. */
  window.mmgPullScopeList = async function (colName, api) {
    var cloud = window.mmgCloud;
    if (!cloud || !cloud.currentUser || !cloud.scopeId || !cloud.db) return null;
    try {
      var snap = await cloud.getDocs(cloud.collection(cloud.db, cloud.scopeCollection, cloud.scopeId, colName));
      var items = [];
      snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
      api.save(items);
      return items;
    } catch (e) { return null; }
  };

  /* Grup görünümü: kullanıcının üye olduğu TÜM firmaların kayıtlarını,
     her kayda _firmaAd etiketi ekleyerek birleştirir (salt okunur). */
  window.mmgPullGroupList = async function (colName) {
    var cloud = window.mmgCloud;
    if (!cloud || !cloud.currentUser || !cloud.db) return [];
    var firmalar = [];
    try { firmalar = JSON.parse(localStorage.getItem("mmg_firma_uyelikler") || "[]") || []; } catch (e) {}
    if (!firmalar.length) return [];
    var hepsi = [];
    for (var i = 0; i < firmalar.length; i++) {
      try {
        var snap = await cloud.getDocs(cloud.collection(cloud.db, "firmaAccounts", firmalar[i].id, colName));
        snap.forEach(function (d) {
          hepsi.push(Object.assign({ id: d.id, _firmaAd: firmalar[i].name, _firmaId: firmalar[i].id }, d.data()));
        });
      } catch (e) { /* okunamayan firmayı atla */ }
    }
    return hepsi;
  };

  // Bir gider kaydını, verilen ay-veri nesnesine (monthData) belirtilen günde ekler.
  // Aynı kayıt+tarih için sabit bir id kullanır; böylece tekrar tekrar çağrılsa da MÜKERRER olmaz.
  function applyItemToMonthData(monthData, occ, item, kind, prefix) {
    kind = kind || "gider"; prefix = prefix || "sync_";
    if (!monthData[occ]) monthData[occ] = { gider: [], gelir: [], expanded: { gider: false, gelir: false } };
    if (!Array.isArray(monthData[occ][kind])) monthData[occ][kind] = [];
    var entryId = prefix + item.id + "_" + occ;
    for (var i = 0; i < monthData[occ][kind].length; i++) {
      if (monthData[occ][kind][i].id === entryId) return false; // zaten var
    }
    monthData[occ][kind].push({
      id: entryId,
      desc: item.desc || "",
      category: item.category || "",
      amount: item.amount,
      fromPayment: item.id
    });
    return true;
  }

  // Ortak bulut senkron çekirdeği: {scope}/<colName> kayıtlarını okuyup vadesi gelenleri
  // {scope}/cashflow/{ay} dokümanına (kind: 'gider'|'gelir') işler. Gider ve Gelir ikisi de kullanır.
  async function mergeCloudGeneric(colName, kind, prefix) {
    var cloud = window.mmgCloud;
    if (!cloud || !cloud.currentUser || !cloud.scopeId || !cloud.db) return { count: 0 };
    var db = cloud.db, doc = cloud.doc, getDoc = cloud.getDoc, setDoc = cloud.setDoc,
        collection = cloud.collection, getDocs = cloud.getDocs,
        col = cloud.scopeCollection, sid = cloud.scopeId;
    var today = todayKey();
    var count = 0, items = [];
    try {
      var snap = await getDocs(collection(db, col, sid, colName));
      snap.forEach(function (d) { items.push(Object.assign({ id: d.id }, d.data())); });
    } catch (e) { return { count: 0 }; }

    var monthCache = {}, itemUpdates = [];
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      if (!item || item.paused || !item.dueDate || !item.amount) continue;
      var occ = occurrencesUpTo(item.dueDate, item.recurrence, today);
      var latest = item.lastTransferredDate || null;
      for (var j = 0; j < occ.length; j++) {
        var o = occ[j], mk = o.slice(0, 7);
        if (!monthCache[mk]) {
          try {
            var cs = await getDoc(doc(db, col, sid, "cashflow", mk));
            monthCache[mk] = { data: (cs.exists() && cs.data().data) ? cs.data().data : {}, dirty: false };
          } catch (e2) { monthCache[mk] = { data: {}, dirty: false }; }
        }
        if (applyItemToMonthData(monthCache[mk].data, o, item, kind, prefix)) { monthCache[mk].dirty = true; count++; }
        if (!latest || o > latest) latest = o;
      }
      if (latest && latest !== item.lastTransferredDate) itemUpdates.push({ id: item.id, d: latest });
    }
    var mks = Object.keys(monthCache);
    for (var a = 0; a < mks.length; a++) {
      if (monthCache[mks[a]].dirty) {
        try { await setDoc(doc(db, col, sid, "cashflow", mks[a]), { data: monthCache[mks[a]].data, updatedAt: new Date().toISOString() }, { merge: true }); } catch (e3) {}
      }
    }
    for (var b = 0; b < itemUpdates.length; b++) {
      try { await setDoc(doc(db, col, sid, colName, itemUpdates[b].id), { lastTransferredDate: itemUpdates[b].d }, { merge: true }); } catch (e4) {}
    }
    return { count: count };
  }

  // ---- MİSAFİR / yerel senkron ----
  function localCashflowKey(mk) { return "mmg_nat_scope_" + scopeKeyPart() + "_" + mk; }

  window.mmgRunPaymentSync = function () {
    var today = todayKey();
    var list = window.mmgLocalPaymentsAPI.load();
    var monthCache = {}; // mk -> monthData
    var changedMonths = {};
    var count = 0, listDirty = false;

    list.forEach(function (item) {
      if (!item || item.paused || !item.dueDate || !item.amount) return;
      var occ = occurrencesUpTo(item.dueDate, item.recurrence, today);
      var latest = item.lastTransferredDate || null;
      occ.forEach(function (o) {
        var mk = o.slice(0, 7);
        if (!monthCache[mk]) {
          try { monthCache[mk] = JSON.parse(localStorage.getItem(localCashflowKey(mk)) || "{}") || {}; }
          catch (e) { monthCache[mk] = {}; }
        }
        if (applyItemToMonthData(monthCache[mk], o, item)) { changedMonths[mk] = true; count++; }
        if (!latest || o > latest) latest = o;
      });
      if (latest && latest !== item.lastTransferredDate) { item.lastTransferredDate = latest; listDirty = true; }
    });

    Object.keys(changedMonths).forEach(function (mk) {
      try { localStorage.setItem(localCashflowKey(mk), JSON.stringify(monthCache[mk])); } catch (e) {}
    });
    if (listDirty) window.mmgLocalPaymentsAPI.save(list);
    return { count: count, months: Object.keys(changedMonths) };
  };

  // ---- ÜYE / bulut senkron ----
  // Gider: {scope}/odemeler → cashflow.gider   |   Gelir: {scope}/gelirler → cashflow.gelir
  window.mmgMergeCloudPaymentsAndSync = function () { return mergeCloudGeneric("odemeler", "gider", "sync_"); };
  window.mmgMergeCloudGelirAndSync = function () { return mergeCloudGeneric("gelirler", "gelir", "glsync_"); };
})();
