/* ==========================================================================
   mmg-cloud-init.js — ORTAK Firebase/Firestore başlatıcı  (type="module")

   Neden ortak dosya?  Gelirler/Giderler/VeriGirisPaneli gibi sayfaların her
   birinde ~90 satırlık AYNI Firebase blok kopyalanmıştı. Yeni modüllerde
   (Stok, Risk, Portföy, Tahsilat Makbuzu) bu tekrarı yapmamak için tek yerden
   yönetiyoruz. Değişiklik gerekince tek dosya güncellenir.

   Sağladıkları:
     window.mmgCloud = { auth, db, doc, getDoc, setDoc, deleteDoc, collection,
                         getDocs, currentUser, currentUserName,
                         scopeCollection, scopeId, ready }
     Olaylar:  'mmg-auth-ready'  → kimlik belli oldu (user null olabilir)
               'mmg-scope-ready' → veri kapsamı (kişisel / firma) belli oldu

   Kapsam (scope) mantığı — index.html'deki sol-alt "Veri Kaynağı" rozetiyle
   birebir aynı:
     mmg_active_data_scope = 'personal'  → users/{uid}
     mmg_active_data_scope = <firmaId>   → firmaAccounts/{firmaId}
     hiç seçim yoksa ve users/{uid}.companyId varsa → companies/{companyId}
       ℹ️ ESKİ (companies) sistem — hâlâ canlı, çünkü index.html "Firma Oluştur"
       akışı users/{uid}.companyId yazmaya devam ediyor. 2026-08-02'de
       firestore.rules'a companies/{id}/{col}/** için üye-bazlı okuma/yazma
       kuralı eklendi; artık bu kapsamda da buluta yazılabiliyor.
       ⚠️ Kural CANLIYA ANCAK `firebase deploy --only firestore:rules`
       çalıştırıldıktan sonra geçer.

   iframe notu: masaüstü kabuğunda araçlar iframe'de açılır. Üst pencerede
   (index.html) zaten bir Auth örneği vardır; ikinci bir örnek açmak IndexedDB
   yarış durumuna yol açıyordu. Varsa üsttekini paylaşıyoruz.
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs }
  from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWzcRqmwhIBqjnYqyMoIrO8zj2p8oj5kU",
  authDomain: "mmgcreativity-31263.firebaseapp.com",
  projectId: "mmgcreativity-31263",
  storageBucket: "mmgcreativity-31263.firebasestorage.app",
  messagingSenderId: "243143536600",
  appId: "1:243143536600:web:daa53a2614b42a2ccb8cad",
  measurementId: "G-X8HEZRNWWS"
};

let auth, db;
try{
  if(window.parent && window.parent !== window && window.parent.mmgAuth && window.parent.mmgDb){
    auth = window.parent.mmgAuth;
    db   = window.parent.mmgDb;
  }
}catch(e){ /* farklı origin ihtimali — sessizce geç */ }
if(!auth || !db){
  const fbApp = initializeApp(firebaseConfig);
  auth = getAuth(fbApp);
  db   = getFirestore(fbApp);
}

window.mmgCloud = {
  auth, db, doc, getDoc, setDoc, deleteDoc, collection, getDocs,
  currentUser: null, currentUserName: null,
  scopeCollection: 'users', scopeId: null,
  ready: false,
  /* Yazma güvenli mi? Üç kapsam da (users / firmaAccounts / companies) rules tarafından
     destekleniyor; tek şart giriş yapılmış ve kapsam belli olması. Giriş yoksa modüller
     yalnızca yerelde (localStorage) çalışır — veri kaybolmaz, sadece eşitlenmez. */
  canWrite(){ return !!(this.currentUser && this.scopeId); }
};

onAuthStateChanged(auth, async (user) => {
  const C = window.mmgCloud;
  C.currentUser = user;
  C.scopeId = user ? user.uid : null;
  C.scopeCollection = 'users';
  document.dispatchEvent(new CustomEvent('mmg-auth-ready', { detail:{ user } }));

  if(user){
    try{
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      C.currentUserName = data.username || data.email || user.email || null;

      let activeScope = null;
      try{ activeScope = localStorage.getItem('mmg_active_data_scope'); }catch(e){}

      if(activeScope && activeScope !== 'personal'){
        C.scopeCollection = 'firmaAccounts';
        C.scopeId = activeScope;
      } else if(activeScope === 'personal'){
        /* kullanıcı bilinçli olarak kişisel veriyi seçti — users/{uid} kalsın */
      } else if(data.companyId){
        C.scopeCollection = 'companies';
        let active = null;
        try{ active = localStorage.getItem('mmg_active_company_id'); }catch(e){}
        C.scopeId = active || data.companyId;
      }

      if(data.isPremium){
        document.querySelectorAll('script[src*="adsbygoogle"]').forEach(s => s.remove());
        window.adsbygoogle = { push: function(){} };
      }
    }catch(e){ /* sessizce geç — yerel mod devam eder */ }
  }

  C.ready = true;
  document.dispatchEvent(new CustomEvent('mmg-scope-ready', {
    detail:{ scopeId: C.scopeId, scopeCollection: C.scopeCollection }
  }));
});
