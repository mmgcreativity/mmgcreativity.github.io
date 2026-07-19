/*
  mmgcreativity — Ödemeler <-> Nakit Akış Tablosu paylaşımlı senkronizasyon mantığı.
  Bu dosya hem Odemeler.html hem de Nakit_Akis_Tablosu.html tarafından <script src="mmg-odemeler-sync.js">
  ile yüklenir. Amaç: vadesi gelen ödeme kalemlerini otomatik olarak Nakit Akış Tablosu'nun
  localStorage veri yapısına ("mmg_nat_YYYY-MM") gider kalemi olarak işlemek.
*/
(function(){
  function pad2(n){ return n < 10 ? '0'+n : ''+n; }
  function toKey(y,m,d){ return y + '-' + pad2(m+1) + '-' + pad2(d); }
  function monthKeyOf(y,m){ return y + '-' + pad2(m+1); }

  const PAYMENTS_KEY = 'mmg_odemeler';
  const CASHFLOW_PREFIX = 'mmg_nat_';

  window.MMG_PAYMENT_CATEGORIES = [
    { id:'fatura',           label:'Faturalar',        icon:'🧾', cashflowCat:'Fatura' },
    { id:'kredi_karti',      label:'Kredi Kartları',   icon:'💳', cashflowCat:'Kredi Kartı' },
    { id:'teminat_mektubu',  label:'Teminat Mektubu',  icon:'📜', cashflowCat:'Teminat Mektubu' },
    { id:'komisyon',         label:'Komisyonlar',      icon:'📊', cashflowCat:'Komisyon' },
    { id:'kira',             label:'Kiralar',          icon:'🏠', cashflowCat:'Kira' },
    { id:'diger',            label:'Diğer',            icon:'📦', cashflowCat:'Diğer Gider' }
  ];

  function loadPaymentsLocal(){
    try{ const raw = localStorage.getItem(PAYMENTS_KEY); return raw ? JSON.parse(raw) : []; }
    catch(e){ return []; }
  }
  function savePaymentsLocal(list){
    try{ localStorage.setItem(PAYMENTS_KEY, JSON.stringify(list)); }catch(e){}
  }
  function loadCashflowMonthLocal(mk){
    try{ const raw = localStorage.getItem(CASHFLOW_PREFIX+mk); return raw ? JSON.parse(raw) : {}; }
    catch(e){ return {}; }
  }
  function saveCashflowMonthLocal(mk, data){
    try{ localStorage.setItem(CASHFLOW_PREFIX+mk, JSON.stringify(data)); }catch(e){}
  }

  function advanceDate(dateStr, recurrence){
    const p = dateStr.split('-').map(Number);
    const dt = new Date(p[0], p[1]-1, p[2]);
    if(recurrence === 'haftalik') dt.setDate(dt.getDate()+7);
    else if(recurrence === 'aylik') dt.setMonth(dt.getMonth()+1);
    else if(recurrence === 'yillik') dt.setFullYear(dt.getFullYear()+1);
    return dt.getFullYear() + '-' + pad2(dt.getMonth()+1) + '-' + pad2(dt.getDate());
  }

  function catLabel(item){
    if(item && item.subCategory && String(item.subCategory).trim()){
      return String(item.subCategory).trim();
    }
    const catId = item && item.category;
    const found = window.MMG_PAYMENT_CATEGORIES.find(c => c.id === catId);
    return found ? found.cashflowCat : 'Diğer Gider';
  }

  // Yerelde bekleyen ödemeleri kontrol eder, vadesi gelmiş (bugün veya öncesi) ve henüz
  // aktarılmamış olanları Nakit Akış Tablosu'nun ilgili gününe gider kalemi olarak işler.
  // Tekrarlı ödemelerde bir sonraki vadeyi otomatik hesaplar. Dönüş: { count, months }
  window.mmgRunPaymentSync = function(){
    const t = new Date();
    const todayStr = toKey(t.getFullYear(), t.getMonth(), t.getDate());

    const payments = loadPaymentsLocal();
    if(!payments.length) return { count:0, months:[] };

    let transferredCount = 0;
    const touchedMonths = {};

    payments.forEach(item => {
      if(!item.dueDate || item.paused) return;
      let guard = 0;
      while(item.dueDate <= todayStr && item.lastTransferredDate !== item.dueDate && guard < 36){
        guard++;
        const p = item.dueDate.split('-').map(Number);
        const mk = monthKeyOf(p[0], p[1]-1);
        if(!touchedMonths[mk]) touchedMonths[mk] = loadCashflowMonthLocal(mk);
        const monthData = touchedMonths[mk];
        if(!monthData[item.dueDate]) monthData[item.dueDate] = { gider:[], gelir:[], expanded:{gider:false, gelir:false} };
        monthData[item.dueDate].gider.push({
          id: 'pay_' + item.id + '_' + item.dueDate,
          desc: item.desc,
          category: catLabel(item),
          amount: item.amount,
          sourceId: item.id
        });
        transferredCount++;
        item.lastTransferredDate = item.dueDate;

        if(item.recurrence && item.recurrence !== 'yok'){
          item.dueDate = advanceDate(item.dueDate, item.recurrence);
        } else {
          break; // tek seferlik ödeme, döngüden çık
        }
      }
    });

    const months = Object.keys(touchedMonths);
    if(transferredCount > 0){
      months.forEach(mk => saveCashflowMonthLocal(mk, touchedMonths[mk]));
      savePaymentsLocal(payments);
    }
    return { count: transferredCount, months: months };
  };

  // ---- Bulut yardımcıları (üye girişi yapılmışsa, en iyi çaba prensibiyle) ----
  window.mmgSyncPaymentsToCloud = async function(){
    if(!(window.mmgCloud && window.mmgCloud.currentUser)) return;
    try{
      const cloud = window.mmgCloud;
      const payments = loadPaymentsLocal();
      for(const item of payments){
        await cloud.setDoc(cloud.doc(cloud.db, 'users', cloud.currentUser.uid, 'odemeler', item.id), item);
      }
    }catch(e){ /* sessizce geç */ }
  };

  window.mmgLoadPaymentsFromCloud = async function(){
    if(!(window.mmgCloud && window.mmgCloud.currentUser)) return null;
    try{
      const cloud = window.mmgCloud;
      const snaps = await cloud.getDocs(cloud.collection(cloud.db, 'users', cloud.currentUser.uid, 'odemeler'));
      const list = [];
      snaps.forEach(d => list.push(d.data()));
      return list;
    }catch(e){ return null; }
  };

  window.mmgDeletePaymentCloud = async function(id){
    if(!(window.mmgCloud && window.mmgCloud.currentUser)) return;
    try{
      const cloud = window.mmgCloud;
      await cloud.deleteDoc(cloud.doc(cloud.db, 'users', cloud.currentUser.uid, 'odemeler', id));
    }catch(e){ /* sessizce geç */ }
  };

  window.mmgSaveCashflowMonthCloud = async function(mk, data){
    if(!(window.mmgCloud && window.mmgCloud.currentUser)) return;
    try{
      const cloud = window.mmgCloud;
      await cloud.setDoc(cloud.doc(cloud.db, 'users', cloud.currentUser.uid, 'cashflow', mk), { data, updatedAt: new Date().toISOString() });
    }catch(e){ /* sessizce geç */ }
  };

  // Üye girişliyse: buluttaki ödeme listesini yerelle birleştirir (bulut güncel kabul edilir),
  // ardından senkronizasyonu tekrar çalıştırır ve sonucu buluta yazar.
  window.mmgMergeCloudPaymentsAndSync = async function(){
    if(!(window.mmgCloud && window.mmgCloud.currentUser)) return window.mmgRunPaymentSync();
    const cloudList = await window.mmgLoadPaymentsFromCloud();
    if(cloudList){
      const local = loadPaymentsLocal();
      const map = {};
      local.forEach(p => { map[p.id] = p; });
      cloudList.forEach(p => { map[p.id] = p; });
      savePaymentsLocal(Object.values(map));
    }
    const result = window.mmgRunPaymentSync();
    await window.mmgSyncPaymentsToCloud();
    for(const mk of result.months){
      await window.mmgSaveCashflowMonthCloud(mk, loadCashflowMonthLocal(mk));
    }
    return result;
  };

  window.mmgLocalPaymentsAPI = {
    load: loadPaymentsLocal,
    save: savePaymentsLocal,
    loadMonth: loadCashflowMonthLocal,
    saveMonth: saveCashflowMonthLocal,
    advanceDate: advanceDate,
    catLabel: catLabel,
    todayKey: function(){ const t=new Date(); return toKey(t.getFullYear(), t.getMonth(), t.getDate()); }
  };
})();
