/* ==========================================================================
   mmgcreativity — Sohbet Widget'ı (TÜM sayfalarda ortak, module script)
   --------------------------------------------------------------------------
   Kullanım: Her sayfanın </body> etiketinden hemen önce şu satırı ekleyin:
     <script type="module" src="mmg-chat-widget.js"></script>

   Özellikler:
   - Her kullanıcıya otomatik bir kısa "Sohbet Kodu" atanır (users/{uid}.chatCode).
   - Kullanıcılar admin'e (isAdmin=true olan hesaplara) onay gerekmeden yazabilir.
   - Kullanıcılar birbirine ancak KARŞI TARAF ONAYLADIKTAN SONRA yazabilir:
     biri diğerinin Sohbet Kodu'nu girer -> istek gider -> karşı taraf kabul
     ederse ortak bir sohbet açılır.
   - Bu dosya kendi Firebase modüllerini import eder ve sayfada zaten var olan
     Firebase App'i (initializeApp ile açılmış olan) yeniden kullanır; böylece
     aynı oturum/giriş durumu paylaşılır ve ayrı bir auth örneği oluşmaz.

   Firestore koleksiyonları:
     users/{uid}.chatCode                — kullanıcının sohbet kodu
     chatCodes/{code} -> {uid}           — kod -> kullanıcı eşlemesi (arama için)
     chatRequests/{fromUid_toUid}        — bekleyen/kabul/red istek kayıtları
     chats/{chatId}                      — sohbet meta verisi
     chats/{chatId}/messages/{msgId}     — mesajlar

   ÖNEMLİ: Bu özelliğin güvenli çalışması için Firestore güvenlik kurallarının
   ayrıca güncellenmesi gerekir (ayrı olarak paylaşıldı).
========================================================================== */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, arrayUnion,
  collection, query, where, orderBy, limit, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

(function(){
  if(window.__mmgChatWidgetLoaded) return;
  window.__mmgChatWidgetLoaded = true;

  // Bu sayfa mmgcreativity uygulama kabuğunun (index.html) içine iframe olarak
  // açılmışsa (Hesaplama Araçları, Hesabım, vb. sayfalar app-frame içinde açılır),
  // üst pencerede zaten bir widget çalışıyor demektir. Aynı widget'ın hem üst
  // pencerede hem iframe içinde ayrı ayrı enjekte edilip üst üste binmesini
  // (iki baloncuk/panel görünmesini) önlemek için iframe içindeyken enjekte etmiyoruz.
  // Not: Mobilde dar ekranlarda iframe yerine tam sayfa geçişi yapıldığından (index.html
  // içinde belirtildiği gibi) o durumda sayfa zaten en üst pencere olur ve widget normal
  // şekilde çalışmaya devam eder.
  try{
    if(window.self !== window.top) return;
  }catch(e){ /* farklı origin ihtimaline karşı sessizce devam et (yine de enjekte et) */ }

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
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }catch(e){ console.error('mmg-chat-widget: firebase init hatası', e); return; }

  // ---- Durum ----
  let currentUser = null;
  let myChatCode = null;
  let myName = null;   // kullanıcının adı (bildirimlerde koddan sonra göstermek için)
  let myIsAdmin = false;
  let myBlockedUids = [];
  let unsubChats = null, unsubRequests = null, unsubMessages = null;
  let openChatId = null, openChatInfo = null, openChatOtherUid = null, openChatCollection = 'chats', openChatCode = null;
  let groupsMap = {};        // groupId -> group data
  let groupInvitesMap = {};  // inviteId -> invite data
  let unsubGroups = null, unsubGroupInvites = null;
  let sentGroupInvitesMap = {};  // gönderdiğim bekleyen grup davetleri (geri çekmek için)
  let sentRequestsMap = {};      // gönderdiğim bekleyen sohbet istekleri (geri çekmek için)
  let unsubSentRequests = null;
  let requestsSubView = 'incoming'; // incoming | sent
  let unsubSentGroupInvites = null;
  let unsubFirmaMemberInvite = null, unsubFirmaAdminInvite = null;
  let firmaMemberInvites = []; // [{id, firmaId, kind, data}] — bir kod birden fazla firmaya davet edilebilir
  let firmaAdminInvite = null; // {id, kind, data} | null
  let friendsSubView = 'list'; // 'list' | 'add'  (Kod ile kişi ekleme, Sohbetler sekmesi içinde)
  let groupsSubView = 'list';  // 'list' | 'newGroup'  (grup oluşturma, Gruplar sekmesi içinde)
  let pendingGroupMembers = []; // [{uid, code}] grup oluşturma formunda eklenen kişiler
  let chatsMap = {};     // chatId -> chat data
  let requestsMap = {};  // reqId -> request data
  let notificationsMap = {};  // notifId -> genel bildirim (davet/referans/hatırlatma) verisi
  let unsubNotifications = null;
  let notificationsFirstSnapshot = true;
  let activeTab = 'friends'; // friends | requests | groups | admin | notifications
  let mainView = 'sohbet';   // sohbet | bildirim  (üstteki iki ana başlık)

  // ---- Kullanıcı Kodu -> görünen ad önbelleği ----
  // userDirectory/{kod} = {uid, username} herkese açık okunur; sohbet başlığında/listesinde/
  // bildiriminde "Kod: 1002" yerine kullanıcının adını göstermek için. Ad bulunana kadar koda düşülür.
  let nameByCode = {};
  let pendingNameFetches = {};
  let openMsgsById = {};   // açık sohbetteki mesajlar: id -> {id, text, mine, senderLabel}
  let replyingTo = null;   // cevaplanan mesaj: {text, senderLabel} | null

  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function genCode(){
    let s = '';
    for(let i=0;i<6;i++) s += CODE_ALPHABET[Math.floor(Math.random()*CODE_ALPHABET.length)];
    return s;
  }
  function pairChatId(a,b){ return [a,b].sort().join('_'); }
  function adminChatId(uid){ return 'admin_' + uid; }
  function esc(str){
    return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtTime(ts){
    try{
      const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : (ts ? new Date(ts) : null);
      if(!d) return '';
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if(sameDay) return d.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
      return d.toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'}) + ' ' + d.toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
    }catch(e){ return ''; }
  }

  // ---- Kod -> ad çözümü (userDirectory herkese açık okunur) ----
  // Ad bulunana kadar "Kod: X" gösterilir; ad gelince ilgili görünüm/başlık tazelenir.
  function labelForCode(code){
    if(!code) return 'Kullanıcı';
    const cached = nameByCode[code];
    if(cached) return '#' + code + ' ' + cached;  // kod + ad (ör. "#1002 tuba güler")
    if(cached === undefined) prefetchName(code);  // henüz çözülmedi -> arka planda çöz
    return '#' + code;                            // ad gelene kadar sadece kod
  }
  // Etiketten (kod + ad) baş harfi/avatar harfini güvenle çıkar (kod önekini at).
  function avatarLetterFromLabel(label){
    const s = String(label || '').replace(/^#\d+\s*/, '').replace(/^Kod:\s*/, '').trim();
    return (s.slice(0, 1) || '#').toUpperCase();
  }
  async function prefetchName(code){
    if(!code || nameByCode[code] !== undefined || pendingNameFetches[code]) return;
    pendingNameFetches[code] = true;
    try{
      const snap = await getDoc(doc(db, 'userDirectory', String(code)));
      nameByCode[code] = snap.exists() ? String(snap.data().username || '').trim() : '';
    }catch(e){ nameByCode[code] = ''; }
    delete pendingNameFetches[code];
    try{
      if(openChatId) refreshOpenChatTitle();
      else if(activeTab === 'friends') renderTab();
    }catch(e){}
  }
  function refreshOpenChatTitle(){
    if(!openChatId || openChatCollection !== 'chats' || !openChatCode) return;
    const nm = nameByCode[openChatCode];
    if(nm) els.title.textContent = nm;
  }

  const CSS = `
  #mmgChatBubble{
    position:fixed; right:20px; bottom:20px; z-index:850;
    width:56px; height:56px; border-radius:50%; border:none; cursor:grab;
    background:linear-gradient(135deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 85%);
    color:#fff; display:flex; align-items:center; justify-content:center;
    box-shadow:0 10px 26px rgba(0,0,0,0.4); transition:transform .15s ease;
    touch-action:none; user-select:none; -webkit-user-select:none;
    transform:scale(0.7); transform-origin:bottom right;
  }
  #mmgChatBubble.dragging{ cursor:grabbing; transition:none; box-shadow:0 14px 34px rgba(0,0,0,0.55); }
  #mmgChatBubble:hover{ transform:scale(0.742); }
  #mmgChatBubble[hidden]{ display:none; }
  @keyframes mmgChatPulseRing{
    0%{ box-shadow:0 0 0 0 rgba(63,182,138,0.55); }
    70%{ box-shadow:0 0 0 12px rgba(63,182,138,0); }
    100%{ box-shadow:0 0 0 0 rgba(63,182,138,0); }
  }
  @keyframes mmgChatBlinkDot{
    0%, 100%{ opacity:1; transform:scale(1); }
    50%{ opacity:0.35; transform:scale(0.82); }
  }
  @keyframes mmgChatFlashBubble{
    0%, 100%{ transform:scale(0.7); }
    25%{ transform:scale(0.82); }
    50%{ transform:scale(0.7); }
    75%{ transform:scale(0.8); }
  }
  #mmgChatBubble.mmg-chat-has-unread{ animation:mmgChatPulseRing 1.6s ease-out infinite; }
  #mmgChatBubble.mmg-chat-flash{ animation:mmgChatFlashBubble .5s ease-in-out 2; }
  #mmgChatOnlineDot{
    position:absolute; bottom:2px; right:2px; width:13px; height:13px; border-radius:50%;
    background:var(--teal,#3FB68A); border:2px solid var(--bg,#0D1420); pointer-events:none;
    display:none;
  }
  #mmgChatOnlineDot.show{ display:block; animation:mmgChatBlinkDot 1s ease-in-out infinite; }
  #mmgChatBadge{
    position:absolute; top:-4px; right:-4px; background:var(--red,#E2544B); color:#fff;
    font-family:'Inter',sans-serif; font-size:11px; font-weight:700; min-width:18px; height:18px;
    border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 4px;
    border:2px solid var(--bg,#0D1420);
  }
  #mmgChatBadge[hidden]{ display:none; }
  #mmgChatPanel{
    position:fixed; right:20px; bottom:88px; z-index:851; width:350px; max-width:calc(100vw - 24px);
    height:520px; max-height:calc(100vh - 120px); background:var(--surface,#141C2B);
    border:1px solid var(--hairline,#2A3448); border-radius:16px; box-shadow:0 24px 60px rgba(0,0,0,0.5);
    display:flex; flex-direction:column; overflow:hidden; font-family:'Inter',sans-serif;
  }
  #mmgChatPanel[hidden]{ display:none; }
  .mmg-chat-fab{
    position:absolute; right:16px; bottom:18px; width:46px; height:46px; border-radius:50%;
    background:var(--grad,linear-gradient(120deg,#FF6B4A,#7C4DD9)); color:#fff; border:none;
    font-size:28px; line-height:1; cursor:pointer; z-index:6;
    box-shadow:0 8px 22px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;
    transition:transform .15s ease, box-shadow .15s ease;
  }
  .mmg-chat-fab:hover{ transform:scale(1.08); box-shadow:0 10px 26px rgba(214,64,122,0.45); }
  .mmg-chat-fab[hidden]{ display:none; }
  .mmg-chat-head{
    display:flex; align-items:center; gap:8px; padding:14px 14px 10px; border-bottom:1px solid var(--hairline,#2A3448);
    flex:0 0 auto;
  }
  .mmg-chat-head .mmg-chat-title{ font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px; color:var(--text,#EAEDF3); flex:1; }
  .mmg-chat-iconbtn{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; padding:4px; border-radius:6px;
    display:flex; align-items:center; justify-content:center;
  }
  .mmg-chat-iconbtn:hover{ color:var(--text,#EAEDF3); background:var(--surface-2,#1B2536); }
  /* Bu buton .mmg-chat-iconbtn'da display:flex olduğu için hidden özniteliği kendiliğinden
     gizlemiyordu; açıkça gizliyoruz (1:1 sohbette 'gruptan ayrıl' butonu görünme hatası). */
  .mmg-chat-iconbtn[hidden]{ display:none !important; }
  .mmg-chat-tabs{ display:flex; gap:4px; padding:0 10px 10px; flex:0 0 auto; }
  .mmg-chat-tab{
    flex:1; text-align:center; font-size:11.5px; font-weight:600; padding:7px 4px; border-radius:8px;
    background:var(--surface-2,#1B2536); color:var(--muted,#8D96AC); cursor:pointer; border:1px solid transparent;
    position:relative; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .mmg-chat-tab.active{ color:var(--text,#EAEDF3); border-color:var(--brass-dim,#8A7440); background:rgba(198,161,91,0.12); }
  .mmg-chat-tab .mmg-chat-dot{
    position:absolute; top:3px; right:6px; width:7px; height:7px; border-radius:50%; background:var(--red,#E2544B);
  }
  /* Bildirim zili (sağ üstte): bekleyen bildirim varken kırmızı nokta + titreme (shake) */
  .mmg-chat-bell.active{ color:var(--brass,#C6A15B); }
  .mmg-chat-bell-dot{
    position:absolute; top:3px; right:3px; width:8px; height:8px; border-radius:50%;
    background:var(--red,#E2544B); box-shadow:0 0 0 2px var(--surface,#141C2B);
  }
  .mmg-chat-bell-dot[hidden]{ display:none; }
  .mmg-chat-bell.mmg-chat-bell-shake{ animation:mmgBellShake 1.1s ease-in-out infinite; transform-origin:top center; }
  @keyframes mmgBellShake{
    0%,60%,100%{ transform:rotate(0); }
    5%{ transform:rotate(14deg); } 10%{ transform:rotate(-12deg); } 15%{ transform:rotate(10deg); }
    20%{ transform:rotate(-8deg); } 25%{ transform:rotate(6deg); } 30%{ transform:rotate(-3deg); } 35%{ transform:rotate(0); }
  }
  @keyframes mmgNotifBlink{
    0%,100%{ opacity:1; box-shadow:0 0 0 0 rgba(226,84,75,0.75); }
    50%{ opacity:0.3; box-shadow:0 0 0 5px rgba(226,84,75,0); }
  }
  .mmg-chat-body{ flex:1 1 auto; overflow-y:auto; padding:10px 12px; }
  .mmg-chat-body::-webkit-scrollbar{ width:6px; }
  .mmg-chat-empty{ color:var(--muted,#8D96AC); font-size:12.5px; text-align:center; padding:30px 10px; line-height:1.6; }
  .mmg-chat-code-box{
    text-align:center; font-size:12px; color:var(--muted,#8D96AC); padding:8px 12px 0;
  }
  .mmg-chat-code-box b{ color:var(--brass,#C6A15B); font-family:'IBM Plex Mono',monospace; letter-spacing:.05em; }
  .mmg-chat-list-item{
    display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; cursor:pointer;
    background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); margin-bottom:8px;
  }
  .mmg-chat-list-item:hover{ border-color:var(--brass-dim,#8A7440); }
  .mmg-chat-avatar{
    width:36px; height:36px; border-radius:50%; background:var(--brass-dim,#8A7440); color:#fff;
    display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex:0 0 auto;
  }
  .mmg-chat-list-main{ flex:1; min-width:0; }
  .mmg-chat-list-name{ font-size:13px; font-weight:600; color:var(--text,#EAEDF3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mmg-chat-list-sub{ font-size:11.5px; color:var(--muted,#8D96AC); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mmg-chat-list-time{ font-size:10.5px; color:var(--muted,#8D96AC); flex:0 0 auto; }
  .mmg-chat-list-delete{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:13px; padding:6px;
    flex:0 0 auto; opacity:0.5; border-radius:6px; transition:opacity .12s ease, background .12s ease;
  }
  .mmg-chat-list-delete:hover{ opacity:1; color:var(--red,#E2544B); background:rgba(226,84,75,0.1); }
  .mmg-notif-card{
    background:var(--surface-2,#1B2536); border:1px solid var(--brass-dim,#8A7440); border-radius:10px;
    padding:12px 13px; margin-bottom:10px;
  }
  .mmg-notif-title{ font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13px; color:var(--text,#EAEDF3); margin-bottom:5px; }
  .mmg-notif-sub{ font-size:11.5px; color:var(--muted,#8D96AC); line-height:1.5; margin-bottom:8px; }
  .mmg-notif-perms{ font-size:11px; color:var(--text,#EAEDF3); background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448); border-radius:8px; padding:7px 9px; margin-bottom:10px; line-height:1.5; }
  .mmg-notif-perms ul{ margin:3px 0 0 15px; padding:0; }
  .mmg-notif-actions{ display:flex; gap:8px; }
  .mmg-notif-accept, .mmg-notif-reject{
    flex:1; padding:7px 0; border-radius:7px; border:none; cursor:pointer; font-family:'Inter',sans-serif;
    font-size:12px; font-weight:700;
  }
  .mmg-notif-accept{ background:linear-gradient(120deg, var(--teal,#3FB68A), #2E8C6A); color:#fff; }
  .mmg-notif-reject{ background:var(--surface,#141C2B); color:var(--muted,#8D96AC); border:1px solid var(--hairline,#2A3448); }
  .mmg-notif-accept:disabled, .mmg-notif-reject:disabled{ opacity:0.5; cursor:default; }
  .mmg-notif-msg{ font-size:11px; margin-top:7px; min-height:13px; }
  .mmg-chat-req-row{
    background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); border-radius:10px; padding:10px; margin-bottom:8px;
  }
  .mmg-chat-req-row .who{ font-size:12.5px; color:var(--text,#EAEDF3); margin-bottom:8px; }
  .mmg-chat-req-row .who b{ color:var(--brass,#C6A15B); font-family:'IBM Plex Mono',monospace; }
  .mmg-chat-req-actions{ display:flex; gap:8px; }
  .mmg-chat-btn{
    flex:1; text-align:center; padding:7px 0; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer; border:none;
  }
  .mmg-chat-btn.accept{ background:var(--teal,#3FB68A); color:#06231a; }
  .mmg-chat-btn.decline{ background:var(--surface,#141C2B); color:var(--red,#E2544B); border:1px solid var(--red,#E2544B); }
  .mmg-chat-btn.block{ background:var(--surface,#141C2B); color:var(--muted,#8D96AC); border:1px solid var(--hairline,#2A3448); }
  .mmg-chat-req-actions .mmg-chat-btn{ font-size:11px; padding:7px 2px; }
  .mmg-chat-add-form{ padding:6px 2px; }
  .mmg-chat-add-form input{
    width:100%; box-sizing:border-box; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);
    border-radius:8px; padding:11px 12px; color:var(--text,#EAEDF3); font-family:'IBM Plex Mono',monospace; font-size:14px;
    text-transform:uppercase; letter-spacing:.08em; outline:none; margin-bottom:10px;
  }
  .mmg-chat-add-form input:focus{ border-color:var(--brass-dim,#8A7440); }
  .mmg-chat-primary-btn{
    width:100%; padding:11px 0; border-radius:8px; border:none; cursor:pointer;
    background:linear-gradient(120deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 75%); color:#fff;
    font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13.5px;
  }
  .mmg-chat-msg{ margin-bottom:10px; display:flex; }
  .mmg-chat-msg.me{ justify-content:flex-end; }
  .mmg-chat-msg > div{ max-width:78%; min-width:0; }
  .mmg-chat-bubble{
    width:fit-content; max-width:100%; padding:9px 12px; border-radius:14px; font-size:13px; line-height:1.45; word-wrap:break-word; overflow-wrap:break-word;
    background:var(--surface-2,#1B2536); color:var(--text,#EAEDF3); border:1px solid var(--hairline,#2A3448);
  }
  .mmg-chat-msg.me .mmg-chat-bubble{
    background:linear-gradient(120deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 85%); color:#fff; border:none;
  }
  .mmg-chat-msg-time{ font-size:9.5px; color:var(--muted,#8D96AC); margin-top:3px; text-align:right; }
  .mmg-chat-msg.me .mmg-chat-msg-time{ color:rgba(255,255,255,0.75); }
  .mmg-chat-footer{ flex:0 0 auto; display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--hairline,#2A3448); align-items:flex-end; }
  .mmg-chat-footer[hidden]{ display:none !important; }
  .mmg-chat-emoji-btn{
    width:38px; height:38px; border-radius:8px; border:1px solid var(--hairline,#2A3448); cursor:pointer; flex:0 0 auto;
    background:var(--surface-2,#1B2536); font-size:17px; display:flex; align-items:center; justify-content:center;
  }
  .mmg-chat-emoji-btn:hover{ border-color:var(--brass-dim,#8A7440); }
  .mmg-chat-emoji-picker{
    position:absolute; bottom:46px; left:0; z-index:5; width:220px; max-height:180px; overflow-y:auto;
    background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448); border-radius:10px; padding:8px;
    display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; box-shadow:0 12px 30px rgba(0,0,0,0.4);
  }
  .mmg-chat-emoji-picker[hidden]{ display:none; }
  .mmg-chat-emoji-picker span{
    cursor:pointer; text-align:center; font-size:18px; padding:4px 0; border-radius:6px; line-height:1;
  }
  .mmg-chat-emoji-picker span:hover{ background:var(--surface-2,#1B2536); }
  .mmg-chat-msg-delete{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:11px; padding:2px 4px;
    opacity:0.45; transition:opacity .12s ease; flex:0 0 auto; align-self:flex-start;
  }
  .mmg-chat-msg-delete:hover{ opacity:1; color:var(--red,#E2544B); }
  .mmg-chat-react-btn{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:13px; padding:2px 4px;
    opacity:0.45; transition:opacity .12s ease; flex:0 0 auto; align-self:flex-start;
  }
  .mmg-chat-react-btn:hover{ opacity:1; color:var(--brass,#C6A15B); }
  .mmg-chat-react-picker{
    position:fixed; z-index:920; background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448);
    border-radius:999px; padding:5px 7px; display:flex; gap:3px; box-shadow:0 12px 30px rgba(0,0,0,0.45);
  }
  .mmg-chat-react-picker[hidden]{ display:none; }
  .mmg-chat-react-picker span{ cursor:pointer; font-size:18px; padding:3px; border-radius:50%; line-height:1; transition:transform .1s ease; }
  .mmg-chat-react-picker span:hover{ transform:scale(1.25); background:var(--surface-2,#1B2536); }
  .mmg-chat-reactions{ display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
  .mmg-chat-msg.me .mmg-chat-reactions{ justify-content:flex-end; }
  .mmg-chat-reaction-pill{
    display:inline-flex; align-items:center; gap:3px; font-size:11px; padding:2px 7px; border-radius:999px;
    background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); color:var(--text,#EAEDF3);
    cursor:pointer; line-height:1.4;
  }
  .mmg-chat-reaction-pill.mine{ border-color:var(--brass,#C6A15B); background:rgba(198,161,91,0.14); }
  .mmg-chat-reaction-pill:hover{ border-color:var(--brass-dim,#8A7440); }
  .mmg-chat-bubble{ cursor:pointer; }
  .mmg-chat-msg-actions{
    position:fixed; z-index:930; background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448);
    border-radius:12px; padding:5px; box-shadow:0 14px 34px rgba(0,0,0,0.5); min-width:156px;
  }
  .mmg-chat-msg-actions[hidden]{ display:none; }
  .mmg-chat-msg-actions button{
    display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; color:var(--text,#EAEDF3);
    cursor:pointer; font-family:'Inter',sans-serif; font-size:13px; padding:9px 11px; border-radius:8px; text-align:left;
  }
  .mmg-chat-msg-actions button:hover{ background:var(--surface-2,#1B2536); }
  .mmg-chat-msg-actions button.danger{ color:var(--red,#E2544B); }
  .mmg-chat-quote{
    border-left:3px solid var(--brass,#C6A15B); background:rgba(198,161,91,0.10); border-radius:6px;
    padding:4px 8px; margin-bottom:5px; font-size:11.5px; max-width:100%; overflow:hidden;
  }
  .mmg-chat-msg.me .mmg-chat-quote{ background:rgba(255,255,255,0.14); border-left-color:rgba(255,255,255,0.7); }
  .mmg-chat-quote .qn{ color:var(--brass,#C6A15B); font-weight:600; display:block; font-size:10.5px; }
  .mmg-chat-msg.me .mmg-chat-quote .qn{ color:rgba(255,255,255,0.9); }
  .mmg-chat-quote .qt{ display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0.85; }
  .mmg-chat-reply-bar{
    flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:7px 12px; border-top:1px solid var(--hairline,#2A3448);
    background:var(--surface-2,#1B2536);
  }
  .mmg-chat-reply-bar[hidden]{ display:none; }
  .mmg-chat-reply-bar .rb-main{ flex:1; min-width:0; border-left:3px solid var(--brass,#C6A15B); padding-left:8px; }
  .mmg-chat-reply-bar .rb-name{ color:var(--brass,#C6A15B); font-weight:600; font-size:11px; }
  .mmg-chat-reply-bar .rb-text{ font-size:12px; color:var(--muted,#8D96AC); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mmg-chat-reply-bar button{ background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:15px; padding:2px 4px; flex:0 0 auto; }
  .mmg-chat-reply-bar button:hover{ color:var(--text,#EAEDF3); }
  .mmg-chat-fwd-sheet{
    position:fixed; z-index:940; background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448);
    border-radius:14px; box-shadow:0 20px 50px rgba(0,0,0,0.55); width:260px; max-width:calc(100vw - 24px);
    max-height:min(340px, calc(100vh - 40px)); overflow-y:auto; padding:8px;
  }
  .mmg-chat-fwd-sheet[hidden]{ display:none; }
  .mmg-chat-fwd-sheet .fwd-title{ font-size:12.5px; font-weight:700; color:var(--text,#EAEDF3); padding:6px 8px 8px; }
  .mmg-chat-fwd-item{
    display:flex; align-items:center; gap:9px; padding:8px 9px; border-radius:8px; cursor:pointer; font-size:13px; color:var(--text,#EAEDF3);
  }
  .mmg-chat-fwd-item:hover{ background:var(--surface-2,#1B2536); }
  .mmg-chat-msg-row{ display:flex; align-items:flex-start; gap:4px; min-width:0; }
  .mmg-chat-msg.me .mmg-chat-msg-row{ flex-direction:row-reverse; }
  .mmg-chat-footer textarea{
    flex:1; resize:none; height:38px; max-height:80px; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);
    border-radius:8px; padding:9px 11px; color:var(--text,#EAEDF3); font-family:'Inter',sans-serif; font-size:13px; outline:none;
  }
  .mmg-chat-footer textarea:focus{ border-color:var(--brass-dim,#8A7440); }
  .mmg-chat-send-btn{
    width:38px; height:38px; border-radius:8px; border:none; cursor:pointer; flex:0 0 auto;
    background:linear-gradient(120deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 85%); color:#fff;
    display:flex; align-items:center; justify-content:center;
  }
  .mmg-chat-msg-error{ font-size:11.5px; color:var(--red,#E2544B); margin-top:6px; min-height:14px; }
  .mmg-chat-msg-ok{ font-size:11.5px; color:var(--teal,#3FB68A); margin-top:6px; min-height:14px; }
  @media print{ #mmgChatBubble, #mmgChatPanel{ display:none !important; } }
  @media (max-width:480px){
    #mmgChatPanel{ right:10px; bottom:78px; width:calc(100vw - 20px); height:min(560px, calc(100vh - 110px)); }
    #mmgChatBubble{ right:14px; bottom:14px; }
  }

  #mmgChatToastContainer{
    position:fixed; right:20px; bottom:88px; z-index:900;
    display:flex; flex-direction:column-reverse; gap:10px;
    width:320px; max-width:calc(100vw - 24px); pointer-events:none;
  }
  @media (max-width:480px){ #mmgChatToastContainer{ right:10px; bottom:14px; width:calc(100vw - 20px); } }
  .mmg-chat-toast{
    pointer-events:auto; cursor:pointer; display:flex; align-items:flex-start; gap:10px;
    background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448); border-radius:12px;
    padding:12px; box-shadow:0 16px 40px rgba(0,0,0,0.45); font-family:'Inter',sans-serif;
    opacity:0; transform:translateY(12px) scale(0.98); transition:opacity .18s ease, transform .18s ease;
  }
  .mmg-chat-toast.mmg-chat-toast-in{ opacity:1; transform:translateY(0) scale(1); }
  .mmg-chat-toast.mmg-chat-toast-out{ opacity:0; transform:translateY(6px) scale(0.98); }
  .mmg-chat-toast-avatar{
    width:34px; height:34px; border-radius:50%; background:var(--brass-dim,#8A7440); color:#fff;
    display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex:0 0 auto;
  }
  .mmg-chat-toast-main{ flex:1; min-width:0; }
  .mmg-chat-toast-title{ font-size:12.5px; font-weight:700; color:var(--text,#EAEDF3); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mmg-chat-toast-msg{ font-size:12px; color:var(--muted,#8D96AC); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .mmg-chat-toast-close{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; padding:2px; flex:0 0 auto; font-size:12px; line-height:1;
  }
  .mmg-chat-toast-close:hover{ color:var(--text,#EAEDF3); }
  `;

  const HTML = `
  <button type="button" id="mmgChatBubble" aria-label="Sohbet" hidden>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    <span id="mmgChatBadge" hidden>0</span>
    <span id="mmgChatOnlineDot"></span>
  </button>
  <div id="mmgChatPanel" hidden>
    <div class="mmg-chat-head">
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatBackBtn" hidden aria-label="Geri">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="mmg-chat-title" id="mmgChatTitle">Sohbet</div>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatDeleteBtn" hidden aria-label="Sohbeti sil" title="Sohbeti sil">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatBlockBtn" hidden aria-label="Engelle" title="Bu kullanıcıyı engelle">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>
      </button>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatNudgeBtn" hidden aria-label="Dürt" title="Dürt — karşı tarafa bildirim gönder" style="font-size:16px;">👉</button>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatLeaveGroupBtn" hidden aria-label="Gruptan ayrıl" title="Gruptan ayrıl">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
      </button>
      <button type="button" class="mmg-chat-iconbtn mmg-chat-bell" id="mmgChatBellBtn" aria-label="Bildirimler" title="Bildirimler" style="position:relative;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span class="mmg-chat-bell-dot" id="mmgChatNotifDot" hidden></span>
      </button>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatCloseBtn" aria-label="Kapat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="mmgChatCodeBox" class="mmg-chat-code-box"></div>
    <div class="mmg-chat-tabs" id="mmgChatTabs">
      <div class="mmg-chat-tab active" data-tab="friends">Kişilerim</div>
      <div class="mmg-chat-tab" data-tab="groups">Grup</div>
      <div class="mmg-chat-tab" data-tab="requests">İstek<span class="mmg-chat-dot" id="mmgChatReqDot" hidden></span></div>
    </div>
    <div class="mmg-chat-body" id="mmgChatBody"></div>
    <button type="button" id="mmgChatNewBtn" class="mmg-chat-fab" aria-label="Yeni sohbet" title="Yeni sohbet başlat" hidden>+</button>
    <div class="mmg-chat-reply-bar" id="mmgChatReplyBar" hidden></div>
    <div class="mmg-chat-footer" id="mmgChatFooter" hidden>
      <div style="position:relative;">
        <button type="button" class="mmg-chat-emoji-btn" id="mmgChatEmojiBtn" aria-label="Emoji ekle">🙂</button>
        <div class="mmg-chat-emoji-picker" id="mmgChatEmojiPicker" hidden></div>
      </div>
      <textarea id="mmgChatInput" placeholder="Mesaj yazın…" rows="1"></textarea>
      <button type="button" class="mmg-chat-send-btn" id="mmgChatSendBtn" aria-label="Gönder">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
  </div>`;

  const TOAST_HTML = `<div id="mmgChatToastContainer" aria-live="polite"></div>`;
  const REACT_PICKER_HTML = `<div class="mmg-chat-react-picker" id="mmgChatReactPicker" hidden></div>`;
  const MSG_ACTIONS_HTML = `<div class="mmg-chat-msg-actions" id="mmgChatMsgActions" hidden></div>`;
  const FWD_SHEET_HTML = `<div class="mmg-chat-fwd-sheet" id="mmgChatFwdSheet" hidden></div>`;

  function inject(){
    const styleTag = document.createElement('style');
    styleTag.id = 'mmgChatStyle';
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while(wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
    const toastWrap = document.createElement('div');
    toastWrap.innerHTML = TOAST_HTML;
    document.body.appendChild(toastWrap.firstElementChild);
    const reactWrap = document.createElement('div');
    reactWrap.innerHTML = REACT_PICKER_HTML;
    document.body.appendChild(reactWrap.firstElementChild);
    const actionsWrap = document.createElement('div');
    actionsWrap.innerHTML = MSG_ACTIONS_HTML;
    document.body.appendChild(actionsWrap.firstElementChild);
    const fwdWrap = document.createElement('div');
    fwdWrap.innerHTML = FWD_SHEET_HTML;
    document.body.appendChild(fwdWrap.firstElementChild);
    wireUp();
  }

  // ---- DOM referansları (inject sonrası doldurulur) ----
  let els = {};

  function wireUp(){
    els.bubble = document.getElementById('mmgChatBubble');
    els.badge = document.getElementById('mmgChatBadge');
    els.onlineDot = document.getElementById('mmgChatOnlineDot');
    els.panel = document.getElementById('mmgChatPanel');
    els.title = document.getElementById('mmgChatTitle');
    els.backBtn = document.getElementById('mmgChatBackBtn');
    els.blockBtn = document.getElementById('mmgChatBlockBtn');
    els.deleteBtn = document.getElementById('mmgChatDeleteBtn');
    els.leaveGroupBtn = document.getElementById('mmgChatLeaveGroupBtn');
    els.nudgeBtn = document.getElementById('mmgChatNudgeBtn');
    els.closeBtn = document.getElementById('mmgChatCloseBtn');
    els.codeBox = document.getElementById('mmgChatCodeBox');
    els.tabs = document.getElementById('mmgChatTabs');
    els.bellBtn = document.getElementById('mmgChatBellBtn');
    els.reqDot = document.getElementById('mmgChatReqDot');
    els.notifDot = document.getElementById('mmgChatNotifDot');
    els.body = document.getElementById('mmgChatBody');
    els.newBtn = document.getElementById('mmgChatNewBtn');
    if(els.newBtn){
      els.newBtn.addEventListener('click', () => {
        if(!currentUser) return;
        activeTab = 'friends'; friendsSubView = 'add';
        renderTab();
      });
    }
    els.footer = document.getElementById('mmgChatFooter');
    els.input = document.getElementById('mmgChatInput');
    els.sendBtn = document.getElementById('mmgChatSendBtn');
    els.toastContainer = document.getElementById('mmgChatToastContainer');
    els.emojiBtn = document.getElementById('mmgChatEmojiBtn');
    els.emojiPicker = document.getElementById('mmgChatEmojiPicker');
    els.reactPicker = document.getElementById('mmgChatReactPicker');
    els.msgActions = document.getElementById('mmgChatMsgActions');
    els.fwdSheet = document.getElementById('mmgChatFwdSheet');
    els.replyBar = document.getElementById('mmgChatReplyBar');

    els.bubble.addEventListener('pointerdown', onBubblePointerDown);
    els.closeBtn.addEventListener('click', () => { els.panel.hidden = true; });
    window.addEventListener('resize', () => { applyBubblePos(); if(!els.panel.hidden) positionPanelNearBubble(); });
    els.backBtn.addEventListener('click', closeOpenChat);
    els.blockBtn.addEventListener('click', () => {
      if(!openChatOtherUid) return;
      const label = (openChatInfo && openChatInfo.title) || 'Bu kullanıcı';
      if(confirm(label + ' engellensin mi? Bu kişi size bir daha mesaj gönderemez.')){
        blockUser(openChatOtherUid);
      }
    });
    els.deleteBtn.addEventListener('click', () => {
      if(!openChatId || openChatCollection !== 'chats') return;
      const label = (openChatInfo && openChatInfo.title) || 'Bu sohbet';
      if(confirm(label + ' sohbeti tamamen silinsin mi? Bu işlem geri alınamaz ve tüm mesaj geçmişi kaybolur.')){
        deleteChat(openChatId);
      }
    });
    els.leaveGroupBtn.addEventListener('click', () => {
      if(!openChatId || openChatCollection !== 'chatGroups') return;
      const label = (openChatInfo && openChatInfo.title) || 'Bu grup';
      if(confirm(label + ' grubundan ayrılmak istediğinize emin misiniz?')){
        leaveGroup(openChatId);
      }
    });
    els.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.mmg-chat-tab');
      if(!tab) return;
      const t = tab.dataset.tab;
      if(t === 'add'){
        // "Ekle" alt sekmesi: Sohbetler'in kod-ile-ekle görünümünü aç
        activeTab = 'friends'; friendsSubView = 'add';
      } else {
        activeTab = t; friendsSubView = 'list';
      }
      if(activeTab !== 'groups') groupsSubView = 'list';
      closeOpenChat(false);
      renderTab();
    });
    // Sağ üstteki BİLDİRİM ZİLİ: tıklayınca bildirimler görünümüne geç / geri dön (ana başlık barı kaldırıldı).
    if(els.bellBtn){
      els.bellBtn.addEventListener('click', () => {
        closeOpenChat(false);
        if(activeTab === 'notifications'){
          activeTab = 'friends'; friendsSubView = 'list';
        } else {
          activeTab = 'notifications';
        }
        renderTab();
      });
    }
    // Dürt: karşı tarafa "dürtme" bildirimi gönder (uygulama-içi; kapalı-uygulama push'u Blaze ister)
    if(els.nudgeBtn){
      els.nudgeBtn.addEventListener('click', async () => {
        if(!openChatOtherUid) return;
        const who = (myChatCode ? ('#' + myChatCode) : 'Bir kullanıcı') + (myName ? ' - ' + myName : '');
        try{ await window.mmgNotify(openChatOtherUid, { type:'nudge', title:'👉 Dürtüldünüz', body: who + ' sizi dürttü' }); }catch(e){}
        els.nudgeBtn.textContent = '✅';
        setTimeout(() => { els.nudgeBtn.textContent = '👉'; }, 1200);
      });
    }
    els.sendBtn.addEventListener('click', sendCurrentMessage);
    els.input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendCurrentMessage(); }
    });

    // ---- Emoji seçici ----
    const EMOJI_LIST = ['😀','😁','😂','🤣','😊','😍','😘','😉','😎','🤔','😅','😢','😭','😡','😱','👍','👎','🙏','👏','💪','❤️','🔥','🎉','✅','❌','⏰','💰','📈','📉','💳','🏦','😴','🤝','😇','🙌','🥳'];
    els.emojiPicker.innerHTML = EMOJI_LIST.map(e => `<span>${e}</span>`).join('');
    els.emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      els.emojiPicker.hidden = !els.emojiPicker.hidden;
    });
    els.emojiPicker.addEventListener('click', (e) => {
      const span = e.target.closest('span');
      if(!span) return;
      const emoji = span.textContent;
      const start = els.input.selectionStart ?? els.input.value.length;
      const end = els.input.selectionEnd ?? els.input.value.length;
      els.input.value = els.input.value.slice(0, start) + emoji + els.input.value.slice(end);
      const newPos = start + emoji.length;
      els.input.focus();
      els.input.setSelectionRange(newPos, newPos);
    });
    document.addEventListener('click', (e) => {
      if(els.emojiPicker.hidden) return;
      if(els.emojiPicker.contains(e.target) || els.emojiBtn.contains(e.target)) return;
      els.emojiPicker.hidden = true;
    });

    // Panel açıkken, panelin ve baloncuğun DIŞINDA bir yere tıklanırsa paneli kapat.
    // Baloncuğa tıklamak zaten kendi aç/kapat mantığını yürütüyor (onBubblePointerUp),
    // bu yüzden baloncuk tıklamaları burada hariç tutuluyor.
    document.addEventListener('pointerdown', (e) => {
      if(els.panel.hidden) return;
      if(els.panel.contains(e.target) || els.bubble.contains(e.target)) return;
      // Panel dışında konumlanan kendi açılır menülerimiz (mesaj aksiyonları, emoji/tepki seçici,
      // ilet sayfası, toast) "dış tık" sayılmamalı — yoksa menüye basınca panel de kapanır.
      if((els.msgActions && !els.msgActions.hidden && els.msgActions.contains(e.target)) ||
         (els.reactPicker && !els.reactPicker.hidden && els.reactPicker.contains(e.target)) ||
         (els.fwdSheet && !els.fwdSheet.hidden && els.fwdSheet.contains(e.target)) ||
         (els.toastContainer && els.toastContainer.contains(e.target))) return;
      els.panel.hidden = true;
    }, true);

    // Sayfa içeriği çoğunlukla bir <iframe> (araç sayfası) olduğundan, iframe'e tıklandığında
    // yukarıdaki 'pointerdown' dış-tık dinleyicisi TETİKLENMEZ — olaylar iframe sınırını geçmez.
    // Böyle durumlarda pencere odağı iframe'e geçer ve 'blur' olur; paneli o zaman da kapatıyoruz.
    // (Kullanıcı defalarca "dışarı tıklayınca kapanmıyor" dedi — kök neden buydu.)
    window.addEventListener('blur', () => {
      if(!els.panel || els.panel.hidden) return;
      // Baloncuk/panel içi bir etkileşimden dolayı blur olduysa kapatma.
      const ae = document.activeElement;
      if(ae && els.panel.contains(ae)) return;
      els.panel.hidden = true;
    });
  }

  function setBadge(n){
    if(n > 0){
      els.badge.hidden = false; els.badge.textContent = n > 9 ? '9+' : String(n);
      els.bubble.classList.add('mmg-chat-has-unread');
      if(els.onlineDot) els.onlineDot.classList.add('show');
    } else {
      els.badge.hidden = true;
      els.bubble.classList.remove('mmg-chat-has-unread');
      if(els.onlineDot) els.onlineDot.classList.remove('show');
    }
  }

  // ---- Ses + tarayıcı bildirimi + baloncuk "flash" efekti ----
  let audioCtx = null;
  function playPingSound(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if(audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
      const t0 = audioCtx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.16, t0 + i * 0.09 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + i * 0.09);
        osc.stop(t0 + i * 0.09 + 0.24);
      });
    }catch(e){ /* ses çalınamazsa sessizce geç */ }
  }
  function requestNotifyPermission(){
    try{
      if(window.Notification && Notification.permission === 'default'){
        Notification.requestPermission().catch(()=>{});
      }
    }catch(e){ /* sessizce geç */ }
  }
  function flashBubble(){
    if(!els.bubble) return;
    els.bubble.classList.remove('mmg-chat-flash');
    void els.bubble.offsetWidth; // reflow: animasyonu baştan tetikler
    els.bubble.classList.add('mmg-chat-flash');
  }
  function notifyNewMessage(title, message){
    flashBubble();
    playPingSound();
    try{
      if(window.Notification && Notification.permission === 'granted' && document.hidden){
        const n = new Notification(title || 'Yeni mesaj', {
          body: message || '', icon: 'icon-192.png', tag: 'mmg-chat', silent: true
        });
        n.onclick = () => { try{ window.focus(); }catch(e){} n.close(); };
      }
    }catch(e){ /* bildirim gösterilemezse sessizce geç */ }
  }

  // ---- Sağ altta beliren bildirim baloncuğu (toast) ----
  function showChatToast(opts){
    if(!els.toastContainer) return;
    const toastEl = document.createElement('div');
    toastEl.className = 'mmg-chat-toast';
    toastEl.innerHTML = `
      <div class="mmg-chat-toast-avatar">${esc(opts.avatarLetter || '💬')}</div>
      <div class="mmg-chat-toast-main">
        <div class="mmg-chat-toast-title">${esc(opts.title || 'Yeni mesaj')}</div>
        <div class="mmg-chat-toast-msg">${esc(opts.message || '')}</div>
      </div>
      <button type="button" class="mmg-chat-toast-close" aria-label="Kapat">✕</button>
    `;
    let removed = false;
    function removeToast(){
      if(removed) return;
      removed = true;
      toastEl.classList.remove('mmg-chat-toast-in');
      toastEl.classList.add('mmg-chat-toast-out');
      setTimeout(() => toastEl.remove(), 200);
    }
    toastEl.addEventListener('click', (e) => {
      if(e.target.closest('.mmg-chat-toast-close')){ e.stopPropagation(); removeToast(); return; }
      removeToast();
      if(typeof opts.onClick === 'function') opts.onClick();
    });
    // Aynı anda en fazla 3 toast göster; fazlası birikince en eskiyi kaldır (yığılma/kötü görüntü önlenir).
    try{
      const MAX_TOASTS = 3;
      while(els.toastContainer.children.length >= MAX_TOASTS){
        els.toastContainer.firstElementChild.remove();
      }
    }catch(e){}
    els.toastContainer.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('mmg-chat-toast-in'));
    setTimeout(removeToast, 6000);
  }

  // ---- Taşınabilir baloncuk (sürükle-bırak) ----
  const BUBBLE_POS_KEY = 'mmg_chat_bubble_pos';
  let dragState = null;

  function loadBubblePos(){
    try{
      const raw = localStorage.getItem(BUBBLE_POS_KEY);
      if(!raw) return null;
      const p = JSON.parse(raw);
      if(typeof p.xr === 'number' && typeof p.yr === 'number') return p;
    }catch(e){}
    return null;
  }
  function saveBubblePos(xr, yr){
    try{ localStorage.setItem(BUBBLE_POS_KEY, JSON.stringify({ xr, yr })); }catch(e){}
  }
  function applyBubblePos(){
    const pos = loadBubblePos();
    if(!pos) return; // kaydedilmiş konum yoksa CSS'teki varsayılan (sağ-alt) köşede kalsın
    const size = els.bubble.offsetWidth || 56;
    const maxX = window.innerWidth - size - 8;
    const maxY = window.innerHeight - size - 8;
    const x = Math.min(Math.max(pos.xr * window.innerWidth, 8), Math.max(8, maxX));
    const y = Math.min(Math.max(pos.yr * window.innerHeight, 8), Math.max(8, maxY));
    els.bubble.style.left = x + 'px';
    els.bubble.style.top = y + 'px';
    els.bubble.style.right = 'auto';
    els.bubble.style.bottom = 'auto';
  }

  function onBubblePointerDown(e){
    const rect = els.bubble.getBoundingClientRect();
    dragState = {
      startX: e.clientX, startY: e.clientY,
      origLeft: rect.left, origTop: rect.top,
      moved: false, pointerId: e.pointerId
    };
    try{ els.bubble.setPointerCapture(e.pointerId); }catch(err){}
    els.bubble.addEventListener('pointermove', onBubblePointerMove);
    els.bubble.addEventListener('pointerup', onBubblePointerUp);
    els.bubble.addEventListener('pointercancel', onBubblePointerUp);
  }
  function onBubblePointerMove(e){
    if(!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if(!dragState.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)){
      dragState.moved = true;
      els.bubble.classList.add('dragging');
    }
    if(dragState.moved){
      const size = els.bubble.offsetWidth || 56;
      let newLeft = dragState.origLeft + dx;
      let newTop = dragState.origTop + dy;
      newLeft = Math.min(Math.max(newLeft, 8), window.innerWidth - size - 8);
      newTop = Math.min(Math.max(newTop, 8), window.innerHeight - size - 8);
      els.bubble.style.left = newLeft + 'px';
      els.bubble.style.top = newTop + 'px';
      els.bubble.style.right = 'auto';
      els.bubble.style.bottom = 'auto';
      if(!els.panel.hidden) positionPanelNearBubble();
    }
  }
  function onBubblePointerUp(e){
    if(!dragState) return;
    els.bubble.classList.remove('dragging');
    els.bubble.removeEventListener('pointermove', onBubblePointerMove);
    els.bubble.removeEventListener('pointerup', onBubblePointerUp);
    els.bubble.removeEventListener('pointercancel', onBubblePointerUp);
    try{ els.bubble.releasePointerCapture(dragState.pointerId); }catch(err){}
    if(dragState.moved){
      const rect = els.bubble.getBoundingClientRect();
      saveBubblePos(rect.left / window.innerWidth, rect.top / window.innerHeight);
    } else {
      // Sürükleme olmadıysa normal bir tıklama/dokunuş: paneli aç/kapat
      requestNotifyPermission();
      els.panel.hidden = !els.panel.hidden;
      if(!els.panel.hidden){ positionPanelNearBubble(); renderTab(); }
    }
    dragState = null;
  }
  function positionPanelNearBubble(){
    const rect = els.bubble.getBoundingClientRect();
    const panelRect = els.panel.getBoundingClientRect();
    const panelW = panelRect.width || 350;
    const panelH = panelRect.height || 520;
    let top = rect.top - panelH - 12;
    if(top < 8) top = Math.min(rect.bottom + 12, window.innerHeight - panelH - 8);
    top = Math.max(8, top);
    let right = window.innerWidth - rect.right;
    if(right < 8) right = 8;
    if(right + panelW > window.innerWidth - 8) right = Math.max(8, window.innerWidth - panelW - 8);
    els.panel.style.top = top + 'px';
    els.panel.style.bottom = 'auto';
    els.panel.style.right = right + 'px';
    els.panel.style.left = 'auto';
  }

  function closeOpenChat(rerender){
    if(unsubMessages){ unsubMessages(); unsubMessages = null; }
    openChatId = null; openChatInfo = null; openChatOtherUid = null; openChatCollection = 'chats'; openChatCode = null;
    openMsgsById = {};
    try{ cancelReply(); closeMsgActionMenu(); closeForwardSheet(); closeReactPicker(); }catch(e){}
    els.backBtn.hidden = true;
    els.footer.hidden = true;
    if(els.leaveGroupBtn) els.leaveGroupBtn.hidden = true;
    if(els.blockBtn) els.blockBtn.hidden = true;
    if(els.deleteBtn) els.deleteBtn.hidden = true;
    if(els.nudgeBtn) els.nudgeBtn.hidden = true;
    // Kod kutusunu kendi kullanıcı koduna geri döndür (sohbet açıkken karşı tarafın kodunu gösteriyordu).
    if(els.codeBox) els.codeBox.innerHTML = myChatCode ? ('Sizin Kullanıcı Kodunuz: <b>' + esc(myChatCode) + '</b>') : '';
    if(rerender !== false) renderTab();
  }

  // ---- Sohbet kodu üretimi ----
  async function ensureChatCode(uid){
    const uref = doc(db, 'users', uid);
    const usnap = await getDoc(uref);
    const udata = usnap.exists() ? usnap.data() : {};

    // Öncelik: sitede zaten kullanılan Müşteri No'yu (#1016 gibi) kullanıcı kodu olarak kullan.
    // Daha önce rastgele bir kod atanmış olsa bile, Müşteri No varsa ona geçiş yapılır.
    if(udata.customerNumber != null){
      const code = String(udata.customerNumber);
      if(udata.chatCode === code) return code;
      const cref = doc(db, 'chatCodes', code);
      try{
        const csnap = await getDoc(cref);
        if(!csnap.exists()){
          await setDoc(cref, { uid, createdAt: serverTimestamp() });
          await setDoc(uref, { chatCode: code }, { merge: true });
          return code;
        } else if(csnap.data().uid === uid){
          await setDoc(uref, { chatCode: code }, { merge: true });
          return code;
        }
      }catch(e){ console.error('mmg-chat-widget: müşteri no kodu ayarlanamadı', e); }
    }

    if(udata.chatCode) return udata.chatCode;

    // Yedek: Müşteri No yoksa/çakışıyorsa rastgele bir kod üret
    for(let i=0;i<6;i++){
      const code = genCode();
      const cref = doc(db, 'chatCodes', code);
      const csnap = await getDoc(cref);
      if(!csnap.exists()){
        try{
          await setDoc(cref, { uid, createdAt: serverTimestamp() });
          await setDoc(uref, { chatCode: code }, { merge: true });
          return code;
        }catch(e){ /* çakışma olduysa yeniden dene */ }
      }
    }
    return null;
  }

  // ---- Dinleyiciler ----
  let chatsFirstSnapshot = true, groupsFirstSnapshot = true;
  let firmaMemberInvitesFirstSnapshot = true, firmaAdminInviteFirstSnapshot = true;

  function detectNewMessagesAndToast(newMap, oldMap, kind){
    Object.keys(newMap).forEach(id => {
      const c = newMap[id];
      const prev = oldMap[id];
      const newAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const prevAt = prev && prev.lastMessageAt && prev.lastMessageAt.toMillis ? prev.lastMessageAt.toMillis() : 0;
      if(!newAt || newAt <= prevAt) return;
      if(!c.lastSenderUid || c.lastSenderUid === currentUser.uid) return;
      if(openChatId === id) return; // zaten bu sohbet açıkken popup gösterilmesin
      if(kind === 'chats' && !c.isAdminChat){
        const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
        if(myBlockedUids.includes(otherUid)) return;
      }
      showToastForChat(id, c, kind);
    });
  }

  function showToastForChat(id, c, kind){
    if(kind === 'chats' && c.isAdminChat){
      notifyNewMessage('Sistem Yöneticiniz', c.lastMessage || 'Yeni mesaj');
      showChatToast({
        title: 'Sistem Yöneticiniz',
        message: c.lastMessage || 'Yeni mesaj',
        avatarLetter: 'A',
        onClick: () => {
          els.panel.hidden = false;
          positionPanelNearBubble();
          activeTab = 'admin';
          [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'admin'));
          openChat(id, { title: 'Sistem Yöneticiniz ile Görüşün', isAdminChat: true });
        }
      });
      return;
    }
    if(kind === 'groups'){
      const title = (c.name || 'Grup') + ' (Grup)';
      notifyNewMessage(title, c.lastMessage || 'Yeni mesaj');
      showChatToast({
        title, message: c.lastMessage || 'Yeni mesaj', avatarLetter: '👥',
        onClick: () => {
          els.panel.hidden = false;
          positionPanelNearBubble();
          activeTab = 'groups';
          [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'groups'));
          openChat(id, { title: (c.name || 'Grup'), isAdminChat: false, collection: 'chatGroups' });
        }
      });
      return;
    }
    // kind === 'chats', normal 1:1
    const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
    const info = (c.participantInfo && c.participantInfo[otherUid]) || {};
    const label = labelForCode(info.code);
    notifyNewMessage(label, c.lastMessage || 'Yeni mesaj');
    showChatToast({
      title: label, message: c.lastMessage || 'Yeni mesaj', avatarLetter: avatarLetterFromLabel(label),
      onClick: () => {
        els.panel.hidden = false;
        positionPanelNearBubble();
        activeTab = 'friends';
        [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'friends'));
        openChat(id, { title: label, isAdminChat: false, otherUid, collection: 'chats' });
      }
    });
  }

  function showToastForFirmaInvite(inv){
    const firmaName = (inv.data && inv.data.firmaName) || 'bir firma';
    const title = '🏢 ' + firmaName;
    const message = inv.kind === 'admin'
      ? 'Yönetici olarak davet edildiniz. Görmek için tıklayın.'
      : 'Kullanıcı olarak davet edildiniz. Görmek için tıklayın.';
    notifyNewMessage(title, message);
    showChatToast({
      title, message, avatarLetter: '🏢',
      onClick: () => {
        els.panel.hidden = false;
        positionPanelNearBubble();
        activeTab = 'notifications';
        [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'notifications'));
        renderTab();
      }
    });
  }

  function startListeners(uid){
    unsubChats = onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', uid)), (snap) => {
      const newChatsMap = {};
      snap.forEach(d => { newChatsMap[d.id] = d.data(); });
      if(!chatsFirstSnapshot) detectNewMessagesAndToast(newChatsMap, chatsMap, 'chats');
      chatsMap = newChatsMap;
      chatsFirstSnapshot = false;
      if(activeTab === 'friends' && friendsSubView === 'list') renderTab();
      if(openChatId && chatsMap[openChatId]) updateOpenChatHeaderIfNeeded();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget chats onSnapshot:', err));

    unsubRequests = onSnapshot(query(collection(db, 'chatRequests'), where('toUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      requestsMap = {};
      snap.forEach(d => { requestsMap[d.id] = d.data(); });
      if(activeTab === 'requests') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget requests onSnapshot:', err));

    // GÖNDERDİĞİM bekleyen sohbet istekleri (geri çekebilmek + durum görebilmek için) — kullanıcı isteği.
    unsubSentRequests = onSnapshot(query(collection(db, 'chatRequests'), where('fromUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      sentRequestsMap = {};
      snap.forEach(d => { sentRequestsMap[d.id] = Object.assign({ _id: d.id }, d.data()); });
      if(activeTab === 'requests') renderTab();
    }, (err) => console.error('mmg-chat-widget sentRequests onSnapshot:', err));

    unsubGroups = onSnapshot(query(collection(db, 'chatGroups'), where('members', 'array-contains', uid)), (snap) => {
      const newGroupsMap = {};
      snap.forEach(d => { newGroupsMap[d.id] = d.data(); });
      if(!groupsFirstSnapshot) detectNewMessagesAndToast(newGroupsMap, groupsMap, 'groups');
      groupsMap = newGroupsMap;
      groupsFirstSnapshot = false;
      if(activeTab === 'groups' && groupsSubView === 'list') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget groups onSnapshot:', err));

    unsubGroupInvites = onSnapshot(query(collection(db, 'chatGroupInvites'), where('toUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      groupInvitesMap = {};
      snap.forEach(d => { groupInvitesMap[d.id] = d.data(); });
      if(activeTab === 'requests') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget groupInvites onSnapshot:', err));

    // GÖNDERDİĞİM bekleyen grup davetleri (geri çekebilmek için) — kullanıcı isteği.
    unsubSentGroupInvites = onSnapshot(query(collection(db, 'chatGroupInvites'), where('fromUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      sentGroupInvitesMap = {};
      snap.forEach(d => { sentGroupInvitesMap[d.id] = Object.assign({ _id: d.id }, d.data()); });
      if(activeTab === 'groups') renderTab();
    }, (err) => console.error('mmg-chat-widget sentGroupInvites onSnapshot:', err));

    // ---- Genel bildirimler (çan/badge): davet gönderildi, referans kullanıldı, hatırlatma ----
    unsubNotifications = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid)), (snap) => {
      const prev = notificationsMap;
      notificationsMap = {};
      snap.forEach(d => { notificationsMap[d.id] = d.data(); });
      if(!notificationsFirstSnapshot){
        Object.keys(notificationsMap).forEach(id => {
          const n = notificationsMap[id];
          if(!prev[id] && !n.read){
            try{
              notifyNewMessage(n.title || 'Yeni bildirim', n.body || '');
              showChatToast({
                title: n.title || 'Yeni bildirim',
                message: n.body || '',
                avatarLetter: '🔔',
                onClick: () => {
                  els.panel.hidden = false;
                  positionPanelNearBubble();
                  activeTab = 'notifications';
                  [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'notifications'));
                  renderTab();
                }
              });
            }catch(e){}
          }
        });
      }
      notificationsFirstSnapshot = false;
      if(activeTab === 'notifications') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget notifications onSnapshot:', err));

    // ---- Firma Hesabı davetleri (YENİ): eskiden ayrı bir açılır bildirim kutusundaydı,
    // şimdi bu sohbet panelinin "Bildirimler" sekmesinde gösteriliyor ----
    // "Yönetici" daveti kullanıcının kendi kodu (myChatCode / Kullanıcı Kodu) ile eşleşen tek bir
    // kayıt; "kullanıcı" daveti ise aynı kod birden fazla firmaya davet edilebildiğinden
    // firmaInvites/{kod}/firmas altındaki tüm kayıtlardan oluşan bir liste.
    if(myChatCode){
      unsubFirmaMemberInvite = onSnapshot(collection(db, 'firmaInvites', myChatCode, 'firmas'), (snap) => {
        const prevFirmaIds = new Set(firmaMemberInvites.map(inv => inv.firmaId));
        firmaMemberInvites = [];
        snap.forEach(d => firmaMemberInvites.push({ id: myChatCode, firmaId: d.id, kind: 'member', data: d.data() || {} }));
        if(!firmaMemberInvitesFirstSnapshot){
          firmaMemberInvites.forEach(inv => { if(!prevFirmaIds.has(inv.firmaId)) showToastForFirmaInvite(inv); });
        }
        firmaMemberInvitesFirstSnapshot = false;
        if(activeTab === 'notifications') renderTab();
        updateBadge();
      }, (err) => console.error('mmg-chat-widget firmaInvites onSnapshot:', err));
      unsubFirmaAdminInvite = onSnapshot(doc(db, 'firmaAdminInvites', myChatCode), (snap) => {
        const hadBefore = !!firmaAdminInvite;
        firmaAdminInvite = snap.exists() ? { id: myChatCode, kind: 'admin', data: snap.data() || {} } : null;
        if(!firmaAdminInviteFirstSnapshot && firmaAdminInvite && !hadBefore) showToastForFirmaInvite(firmaAdminInvite);
        firmaAdminInviteFirstSnapshot = false;
        if(activeTab === 'notifications') renderTab();
        updateBadge();
      }, (err) => console.error('mmg-chat-widget firmaAdminInvites onSnapshot:', err));
    }
  }

  function updateBadge(){
    const reqCount = Object.keys(requestsMap).length + Object.keys(groupInvitesMap).length;
    els.reqDot.hidden = reqCount === 0;
    const firmaInviteCount = firmaMemberInvites.length + (firmaAdminInvite ? 1 : 0);
    const notifUnread = Object.keys(notificationsMap).filter(id => !notificationsMap[id].read).length;
    const bellPending = firmaInviteCount + notifUnread;
    if(els.notifDot) els.notifDot.hidden = bellPending === 0;
    // Bildirim zili: bekleyen varken titresin (shake), yoksa dursun.
    if(els.bellBtn) els.bellBtn.classList.toggle('mmg-chat-bell-shake', bellPending > 0);
    let unread = 0;
    Object.keys(chatsMap).forEach(id => {
      const c = chatsMap[id];
      const lastAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const readAt = c['lastRead_' + currentUser.uid] && c['lastRead_' + currentUser.uid].toMillis ? c['lastRead_' + currentUser.uid].toMillis() : 0;
      if(lastAt > readAt && c.lastSenderUid !== currentUser.uid) unread++;
    });
    Object.keys(groupsMap).forEach(id => {
      const c = groupsMap[id];
      const lastAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const readAt = c['lastRead_' + currentUser.uid] && c['lastRead_' + currentUser.uid].toMillis ? c['lastRead_' + currentUser.uid].toMillis() : 0;
      if(lastAt > readAt && c.lastSenderUid !== currentUser.uid) unread++;
    });
    setBadge(unread + reqCount + firmaInviteCount + notifUnread);
  }

  function updateOpenChatHeaderIfNeeded(){ /* şu an ekstra bir şey gerekmiyor */ }

  // ---- Sekme render ----
  // Ana başlık barı kaldırıldı. Bildirimler artık sağ üstteki zil ile açılıyor. Bu fonksiyon,
  // bildirimler görünümündeyken alt sekme çubuğunu gizler; diğer her durumda gösterir + aktif
  // sekmeyi vurgular. Ayrıca zil, bildirimler görünümündeyken vurgulanır.
  function syncMainView(){
    const isNotif = (activeTab === 'notifications');
    if(els.bellBtn) els.bellBtn.classList.toggle('active', isNotif);
    if(els.tabs){
      els.tabs.hidden = isNotif;   // bildirimler görünümünde alt sekmeler gizli
      if(!isNotif){
        const activeSub = (activeTab === 'friends' && friendsSubView === 'add') ? 'add' : activeTab;
        [...els.tabs.children].forEach(c => c.classList.toggle('active', c.dataset.tab === activeSub));
      }
    }
  }

  function renderTab(){
    if(openChatId) return; // bir sohbet açıkken sekme gövdesi değişmesin
    syncMainView();
    // "+" yeni sohbet butonu yalnızca Kişilerim listesinde görünsün.
    if(els.newBtn) els.newBtn.hidden = !(currentUser && activeTab === 'friends' && friendsSubView === 'list' && mainView !== 'bildirim');
    if(activeTab === 'admin') return renderAdminTab();
    if(activeTab === 'friends') return renderFriendsTab();
    if(activeTab === 'groups') return renderGroupsTab();
    if(activeTab === 'requests') return renderRequestsTab();
    if(activeTab === 'notifications') return renderNotificationsTab();
  }

  // Bu modüller KullaniciYonetimi.html'deki PERMISSION_MODULES ile birebir eşleşir;
  // bir kullanıcı davetinde hangi yetkilerin verildiğini bildirimde açıkça göstermek için kullanılır.
  const NOTIF_PERM_MODULES = [
    { key:'gelirler', label:'Gelirler' }, { key:'giderler', label:'Giderler' },
    { key:'nakitakis', label:'Nakit Akış Tablosu' }, { key:'talimat', label:'Talimat Hazırlama' },
    { key:'hesaplama', label:'Hesaplama Araçları' }
  ];

  // Bildirime tıklayınca ilgili 1:1 sohbeti aç (dürtme / yeni mesaj bildirimleri).
  function openChatFromNotif(n){
    if(!n || !n.fromUid || !currentUser) return;
    mainView = 'sohbet'; activeTab = 'friends';
    const chatId = pairChatId(currentUser.uid, n.fromUid);
    const title = (n.fromCode ? ('#' + n.fromCode) : 'Sohbet') + (n.fromName ? ' - ' + n.fromName : '');
    openChat(chatId, { title: title, isAdminChat: false, otherUid: n.fromUid, collection: 'chats' });
  }

  function renderNotificationsTab(){
    els.footer.hidden = true;
    const notifList = Object.keys(notificationsMap).map(id => Object.assign({ _id: id }, notificationsMap[id]))
      .sort((a, b) => {
        const am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return bm - am;
      });
    if(!firmaMemberInvites.length && !firmaAdminInvite && !notifList.length){
      els.body.innerHTML = '<div class="mmg-chat-empty">Bekleyen bir bildiriminiz yok.</div>';
      return;
    }
    // Kullanıcı ("üye") davetlerinin hepsi TEK bir kartta, tek "Kabul Et" ile onaylanır —
    // birden fazla firmaya aynı anda davet edilse bile tek tek sorulmasın diye.
    let html = '';
    if(firmaMemberInvites.length) html += renderGroupedMemberInviteCard(firmaMemberInvites);
    if(firmaAdminInvite) html += renderInviteCard(firmaAdminInvite, 'admin');
    if(notifList.length){
      html += '<div style="display:flex; justify-content:flex-end; margin-bottom:8px;"><button type="button" id="mmgNotifClearAll" style="background:transparent; border:1px solid rgba(226,84,75,0.5); color:#E2544B; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:600; cursor:pointer;">🗑 Tümünü Sil</button></div>';
    }
    html += notifList.map(renderNotifItem).join('');
    els.body.innerHTML = html;

    const clearAllBtn = document.getElementById('mmgNotifClearAll');
    if(clearAllBtn) clearAllBtn.addEventListener('click', async () => {
      if(!confirm('Tüm bildirimler silinsin mi?')) return;
      clearAllBtn.disabled = true;
      for(const n of notifList){ await deleteNotification(n._id); }
    });

    notifList.forEach(n => {
      const delBtn = document.getElementById('mmgNotifDel_' + n._id);
      if(delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteNotification(n._id); });
      if(n.fromUid && (n.type === 'nudge' || n.type === 'chat')){
        const card = els.body.querySelector('[data-notif-open="' + n._id + '"]');
        if(card) card.addEventListener('click', (e) => { if(e.target.closest('button')) return; openChatFromNotif(n); });
      }
    });
    const unreadIds = notifList.filter(n => !n.read).map(n => n._id);
    if(unreadIds.length) markNotificationsRead(unreadIds);

    if(firmaMemberInvites.length){
      const acceptBtn = document.getElementById('mmgNotifGroupAccept');
      const rejectBtn = document.getElementById('mmgNotifGroupReject');
      if(acceptBtn) acceptBtn.addEventListener('click', () => acceptGroupedMemberInvites(firmaMemberInvites));
      if(rejectBtn) rejectBtn.addEventListener('click', () => rejectGroupedMemberInvites(firmaMemberInvites));
    }
    if(firmaAdminInvite){
      const acceptBtn = document.getElementById('mmgNotifAccept_admin');
      const rejectBtn = document.getElementById('mmgNotifReject_admin');
      if(acceptBtn) acceptBtn.addEventListener('click', () => acceptFirmaInvite(firmaAdminInvite, 'admin'));
      if(rejectBtn) rejectBtn.addEventListener('click', () => rejectFirmaInvite(firmaAdminInvite, 'admin'));
    }
  }

  function mmgNotifEsc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtNotifTime(ts){
    try{
      if(!ts || !ts.toMillis) return '';
      const d = new Date(ts.toMillis());
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
    }catch(e){ return ''; }
  }
  function renderNotifItem(n){
    const icon = n.type === 'invite' ? '🏢' : (n.type === 'referral' ? '🎁' : (n.type === 'reminder' ? '⏰' : (n.type === 'nudge' ? '👉' : (n.type === 'chat' ? '💬' : '🔔'))));
    const when = fmtNotifTime(n.createdAt);
    const openable = !!(n.fromUid && (n.type === 'nudge' || n.type === 'chat'));
    return '<div data-notif-open="' + mmgNotifEsc(n._id) + '" style="display:flex; gap:10px; align-items:flex-start; padding:12px; border:1px solid #2A3448; border-radius:12px; margin-bottom:8px; ' + (openable ? 'cursor:pointer; ' : '') + 'background:' + (n.read ? 'transparent' : 'rgba(198,161,91,0.08)') + ';">' +
        '<div style="font-size:18px; line-height:1;">' + icon + '</div>' +
        '<div style="flex:1; min-width:0;">' +
          '<div style="font-weight:600; font-size:13.5px;">' + mmgNotifEsc(n.title || 'Bildirim') + '</div>' +
          (n.body ? '<div style="font-size:12.5px; opacity:0.75; margin-top:2px;">' + mmgNotifEsc(n.body) + '</div>' : '') +
          (when ? '<div style="font-size:11px; opacity:0.6; margin-top:4px;">' + mmgNotifEsc(when) + '</div>' : '') +
        '</div>' +
        '<button type="button" id="mmgNotifDel_' + mmgNotifEsc(n._id) + '" title="Sil" style="background:none; border:none; color:#8D96AC; cursor:pointer; font-size:15px; line-height:1;">✕</button>' +
      '</div>';
  }
  async function markNotificationsRead(ids){
    for(const id of ids){ try{ await updateDoc(doc(db, 'notifications', id), { read: true }); }catch(e){} }
  }
  async function deleteNotification(id){
    try{ await deleteDoc(doc(db, 'notifications', id)); }catch(e){}
  }
  // Global yardımcı: başka sayfalar (KullaniciYonetimi, kayıt akışı) buradan bildirim yazabilir.
  window.mmgNotify = async function(toUid, data){
    try{
      if(!toUid || !currentUser) return false;
      await addDoc(collection(db, 'notifications'), {
        toUid: toUid,
        fromUid: currentUser.uid,
        fromCode: (typeof myChatCode !== 'undefined' && myChatCode) ? myChatCode : null,
        fromName: (typeof myName !== 'undefined' && myName) ? myName : null,
        type: (data && data.type) || 'info',
        title: (data && data.title) || 'Bildirim',
        body: (data && data.body) || '',
        link: (data && data.link) || null,
        read: false,
        createdAt: serverTimestamp()
      });
      return true;
    }catch(e){ console.error('mmgNotify:', e); return false; }
  };

  function renderGroupedMemberInviteCard(invites){
    const firmasHtml = invites.map(inv => {
      const firmaName = (inv.data && inv.data.firmaName) || 'bir firma';
      const perms = (inv.data && inv.data.permissions) || {};
      const allowed = NOTIF_PERM_MODULES.filter(m => perms[m.key] !== false).map(m => m.label);
      return '<div style="padding:6px 0; border-bottom:1px solid var(--mmg-hairline, rgba(255,255,255,0.08));">' +
        '<b>🏢 ' + esc(firmaName) + '</b>' +
        '<div style="font-size:11.5px; opacity:0.75; margin-top:2px;">' +
        (allowed.length ? esc(allowed.join(', ')) : 'Hiçbiri (yalnızca görüntüleme)') +
        '</div></div>';
    }).join('');
    const title = invites.length > 1 ? ('👥 ' + invites.length + ' firmaya kullanıcı olarak davet edildiniz') : ('🏢 ' + ((invites[0].data && invites[0].data.firmaName) || 'bir firma'));
    return '<div class="mmg-notif-card">' +
      '<div class="mmg-notif-title">' + esc(title) + '</div>' +
      '<div class="mmg-notif-sub">Kabul ederseniz, aşağıdaki firma(lar)ın belirtilen modüllerindeki veri girişleriniz size özel kalmak yerine o firmanın ortak veri havuzuna dahil olur.</div>' +
      '<div class="mmg-notif-perms">' + firmasHtml + '</div>' +
      '<div class="mmg-notif-actions">' +
        '<button type="button" class="mmg-notif-accept" id="mmgNotifGroupAccept">✓ Tümünü Kabul Et</button>' +
        '<button type="button" class="mmg-notif-reject" id="mmgNotifGroupReject">✕ Tümünü Reddet</button>' +
      '</div>' +
      '<div class="mmg-notif-msg" id="mmgNotifGroupMsg"></div>' +
    '</div>';
  }

  async function acceptGroupedMemberInvites(invites){
    const msgEl = document.getElementById('mmgNotifGroupMsg');
    const acceptBtn = document.getElementById('mmgNotifGroupAccept');
    const rejectBtn = document.getElementById('mmgNotifGroupReject');
    if(acceptBtn) acceptBtn.disabled = true;
    if(rejectBtn) rejectBtn.disabled = true;
    try{
      for(const invite of invites){
        await setDoc(doc(db, 'firmaAccounts', invite.data.firmaId, 'members', currentUser.uid), {
          email: currentUser.email || '', permissions: invite.data.permissions || {}, addedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', currentUser.uid), { firmaIds: arrayUnion(invite.data.firmaId) }, { merge: true });
        await deleteDoc(doc(db, 'firmaInvites', invite.id, 'firmas', invite.firmaId));
      }
      if(msgEl){ msgEl.style.color = 'var(--teal,#3FB68A)'; msgEl.textContent = 'Kabul edildi ✓'; }
      try{ window.location.reload(); }catch(e){}
    }catch(e){
      if(msgEl){ msgEl.style.color = 'var(--red,#E2544B)'; msgEl.textContent = 'Bir şeyler ters gitti, lütfen tekrar deneyin.'; }
      if(acceptBtn) acceptBtn.disabled = false;
      if(rejectBtn) rejectBtn.disabled = false;
    }
  }

  async function rejectGroupedMemberInvites(invites){
    const acceptBtn = document.getElementById('mmgNotifGroupAccept');
    const rejectBtn = document.getElementById('mmgNotifGroupReject');
    if(acceptBtn) acceptBtn.disabled = true;
    if(rejectBtn) rejectBtn.disabled = true;
    try{
      for(const invite of invites){
        await deleteDoc(doc(db, 'firmaInvites', invite.id, 'firmas', invite.firmaId));
      }
    }catch(e){
      if(acceptBtn) acceptBtn.disabled = false;
      if(rejectBtn) rejectBtn.disabled = false;
    }
  }

  function renderInviteCard(inv, idx){
    const firmaName = (inv.data && inv.data.firmaName) || 'bir firma';
    const isAdmin = inv.kind === 'admin';
    const title = '🏢 ' + firmaName;
    const sub = isAdmin
      ? ('"' + firmaName + '" firmasına yönetici olarak davet edildiniz. Yönetici olarak bu firmaya kullanıcı ekleyip çıkarabilir, yetkilerini düzenleyebilirsiniz — bu rolde kendi mali verilerinizi girmezsiniz. Kabul ediyor musunuz?')
      : ('"' + firmaName + '" firmasına kullanıcı olarak davet edildiniz. Kabul ederseniz, aşağıdaki modüllerdeki veri girişleriniz size özel kalmak yerine bu firmanın ortak veri havuzuna dahil olur. Kabul ediyor musunuz?');
    let permsHtml = '';
    if(!isAdmin){
      const perms = (inv.data && inv.data.permissions) || {};
      const allowed = NOTIF_PERM_MODULES.filter(m => perms[m.key] !== false).map(m => m.label);
      permsHtml = '<div class="mmg-notif-perms"><b>Erişim kazanacağınız bölümler:</b><ul>' +
        (allowed.length ? allowed.map(l => '<li>' + esc(l) + '</li>').join('') : '<li>Hiçbiri (yalnızca görüntüleme)</li>') + '</ul></div>';
    }
    return '<div class="mmg-notif-card">' +
      '<div class="mmg-notif-title">' + esc(title) + '</div>' +
      '<div class="mmg-notif-sub">' + esc(sub) + '</div>' +
      permsHtml +
      '<div class="mmg-notif-actions">' +
        '<button type="button" class="mmg-notif-accept" id="mmgNotifAccept_' + idx + '">✓ Kabul Et</button>' +
        '<button type="button" class="mmg-notif-reject" id="mmgNotifReject_' + idx + '">✕ Reddet</button>' +
      '</div>' +
      '<div class="mmg-notif-msg" id="mmgNotifMsg_' + idx + '"></div>' +
    '</div>';
  }

  async function acceptFirmaInvite(invite, idx){
    const msgEl = document.getElementById('mmgNotifMsg_' + idx);
    const acceptBtn = document.getElementById('mmgNotifAccept_' + idx);
    const rejectBtn = document.getElementById('mmgNotifReject_' + idx);
    if(acceptBtn) acceptBtn.disabled = true;
    if(rejectBtn) rejectBtn.disabled = true;
    try{
      if(invite.kind === 'admin'){
        await setDoc(doc(db, 'firmaAccounts', invite.data.firmaId, 'admins', currentUser.uid), {
          email: currentUser.email || '', addedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', currentUser.uid), { adminFirmaIds: arrayUnion(invite.data.firmaId) }, { merge: true });
      } else {
        await setDoc(doc(db, 'firmaAccounts', invite.data.firmaId, 'members', currentUser.uid), {
          email: currentUser.email || '', permissions: invite.data.permissions || {}, addedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', currentUser.uid), { firmaIds: arrayUnion(invite.data.firmaId) }, { merge: true });
      }
      await deleteDoc(invite.kind === 'admin' ? doc(db, 'firmaAdminInvites', invite.id) : doc(db, 'firmaInvites', invite.id, 'firmas', invite.firmaId));
      if(msgEl){ msgEl.style.color = 'var(--teal,#3FB68A)'; msgEl.textContent = 'Kabul edildi ✓'; }
      // Yeni bağlantı sayfada (ana kabuk) hemen yansısın diye bir yenileme sinyali gönder.
      try{ window.location.reload(); }catch(e){}
    }catch(e){
      if(msgEl){ msgEl.style.color = 'var(--red,#E2544B)'; msgEl.textContent = 'Bir şeyler ters gitti, lütfen tekrar deneyin.'; }
      if(acceptBtn) acceptBtn.disabled = false;
      if(rejectBtn) rejectBtn.disabled = false;
    }
  }

  async function rejectFirmaInvite(invite, idx){
    const acceptBtn = document.getElementById('mmgNotifAccept_' + idx);
    const rejectBtn = document.getElementById('mmgNotifReject_' + idx);
    if(acceptBtn) acceptBtn.disabled = true;
    if(rejectBtn) rejectBtn.disabled = true;
    try{
      await deleteDoc(invite.kind === 'admin' ? doc(db, 'firmaAdminInvites', invite.id) : doc(db, 'firmaInvites', invite.id, 'firmas', invite.firmaId));
    }catch(e){
      if(acceptBtn) acceptBtn.disabled = false;
      if(rejectBtn) rejectBtn.disabled = false;
    }
  }

  function renderAdminTab(){
    els.title.textContent = 'Sohbet';
    els.body.innerHTML = `
      <div class="mmg-chat-empty">Sorularınızı veya geri bildiriminizi doğrudan bize yazabilirsiniz.</div>
      <div class="mmg-chat-list-item" id="mmgOpenAdminChatBtn">
        <div class="mmg-chat-avatar">A</div>
        <div class="mmg-chat-list-main">
          <div class="mmg-chat-list-name">Sistem Yöneticiniz ile Görüşün</div>
          <div class="mmg-chat-list-sub">Destek / geri bildirim</div>
        </div>
      </div>`;
    document.getElementById('mmgOpenAdminChatBtn').addEventListener('click', () => openAdminChat());
  }

  async function openAdminChat(){
    const uid = currentUser.uid;
    const chatId = adminChatId(uid);
    try{
      const cref = doc(db, 'chats', chatId);
      const csnap = await getDoc(cref);
      if(!csnap.exists()){
        await setDoc(cref, {
          participants: [uid],
          isAdminChat: true,
          userUid: uid,
          userEmail: currentUser.email || null,
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastMessageAt: null,
          lastSenderUid: null
        });
      }
      openChat(chatId, { title: 'Sistem Yöneticiniz ile Görüşün', isAdminChat: true });
    }catch(e){
      console.error('mmg-chat-widget: yönetici sohbeti açılamadı', e);
      const hint = (e && e.code === 'permission-denied')
        ? 'İzin hatası: Firestore güvenlik kuralları henüz eklenmemiş/güncellenmemiş olabilir.'
        : 'Sohbet açılamadı, lütfen tekrar deneyin.';
      els.body.innerHTML = `<div class="mmg-chat-empty" style="color:var(--red,#E2544B);">${esc(hint)}</div>`;
    }
  }

  function renderFriendsTab(){
    els.title.textContent = 'Sohbetler';
    if(friendsSubView === 'add') return renderAddTab();

    const chatIds = Object.keys(chatsMap).filter(id => {
      const c = chatsMap[id];
      if(c.isAdminChat) return false;
      const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
      return !myBlockedUids.includes(otherUid);
    });

    const rows = [];
    chatIds.forEach(id => {
      const c = chatsMap[id];
      const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
      const info = (c.participantInfo && c.participantInfo[otherUid]) || {};
      const label = labelForCode(info.code);
      const lastAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const readAt = c['lastRead_' + currentUser.uid] && c['lastRead_' + currentUser.uid].toMillis ? c['lastRead_' + currentUser.uid].toMillis() : 0;
      rows.push({
        id, label, sub: c.lastMessage || 'Henüz mesaj yok', lastAt,
        unread: lastAt > readAt && c.lastSenderUid !== currentUser.uid,
        avatarLetter: avatarLetterFromLabel(label), otherUid
      });
    });
    rows.sort((a, b) => b.lastAt - a.lastAt);

    const listHtml = rows.length ? rows.map(r => `
      <div class="mmg-chat-list-item" data-chat-id="${esc(r.id)}" data-label="${esc(r.label)}" data-other-uid="${esc(r.otherUid || '')}">
        <div class="mmg-chat-avatar">${esc(r.avatarLetter)}</div>
        <div class="mmg-chat-list-main">
          <div class="mmg-chat-list-name">${esc(r.label)}${r.unread ? ' •' : ''}</div>
          <div class="mmg-chat-list-sub">${esc(r.sub)}</div>
        </div>
        <button type="button" class="mmg-chat-list-delete" data-delete-chat-id="${esc(r.id)}" data-delete-label="${esc(r.label)}" title="Kişiyi sil" aria-label="Kişiyi sil">🗑</button>
      </div>`).join('')
      : `<div class="mmg-chat-empty">Henüz bir sohbetiniz yok.<br><b>İstek → Gönderilen</b> sekmesindeki "+ Kişi Ekle" ile kullanıcı kodu girerek istek gönderebilirsiniz.</div>`;

    // Kullanıcı isteği: "+ Kişi Ekle" Kişilerim'den KALDIRILDI; artık İstek > Gönderilen altında.
    els.body.innerHTML = listHtml;

    els.body.querySelectorAll('.mmg-chat-list-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const label = btn.dataset.deleteLabel || 'Bu kişi';
        if(confirm(label + ' silinsin mi? Bu kişiyle olan tüm sohbet geçmişi kaybolacak.')){
          deleteChat(btn.dataset.deleteChatId);
        }
      });
    });
    els.body.querySelectorAll('.mmg-chat-list-item[data-chat-id]').forEach(row => {
      row.addEventListener('click', () => {
        openChat(row.dataset.chatId, { title: row.dataset.label, isAdminChat: false, otherUid: row.dataset.otherUid, collection: 'chats' });
      });
    });
  }

  function renderGroupsTab(){
    els.title.textContent = 'Gruplar';
    if(groupsSubView === 'newGroup') return renderNewGroupForm();

    const rows = Object.keys(groupsMap).map(id => {
      const g = groupsMap[id];
      const lastAt = g.lastMessageAt && g.lastMessageAt.toMillis ? g.lastMessageAt.toMillis() : 0;
      const readAt = g['lastRead_' + currentUser.uid] && g['lastRead_' + currentUser.uid].toMillis ? g['lastRead_' + currentUser.uid].toMillis() : 0;
      return {
        id, label: (g.name || 'Grup'), sub: g.lastMessage || 'Henüz mesaj yok', lastAt,
        unread: lastAt > readAt && g.lastSenderUid !== currentUser.uid
      };
    });
    rows.sort((a, b) => b.lastAt - a.lastAt);

    const listHtml = rows.length ? rows.map(r => `
      <div class="mmg-chat-list-item" data-group-id="${esc(r.id)}">
        <div class="mmg-chat-avatar">👥</div>
        <div class="mmg-chat-list-main">
          <div class="mmg-chat-list-name">${esc(r.label)}${r.unread ? ' •' : ''}</div>
          <div class="mmg-chat-list-sub">${esc(r.sub)}</div>
        </div>
      </div>`).join('')
      : `<div class="mmg-chat-empty">Henüz bir grubunuz yok.<br>"+ Grup Oluştur" ile yeni bir grup kurabilirsiniz.</div>`;

    // Gönderdiğim bekleyen grup davetleri (geri çekilebilir) — kullanıcı isteği.
    const sentInv = Object.keys(sentGroupInvitesMap).map(id => sentGroupInvitesMap[id]);
    let sentHtml = '';
    if(sentInv.length){
      sentHtml = '<div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--hairline,#2A3448);">' +
        '<div style="font-size:11.5px; color:var(--muted,#8D96AC); font-weight:600; margin:0 2px 8px;">Gönderdiğim bekleyen davetler</div>' +
        sentInv.map(inv =>
          '<div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--hairline,#2A3448); border-radius:10px; margin-bottom:6px;">' +
            '<div style="flex:1; min-width:0; font-size:12.5px;">' +
              '<b>' + esc(inv.groupName || 'Grup') + '</b> → <b>' + esc(inv.toCode || inv.toUid || '?') + '</b> koduna davet' +
            '</div>' +
            '<button type="button" class="mmg-chat-btn decline" data-cancel-invite="' + esc(inv._id) + '" style="flex:0 0 auto; background:transparent; border:1px solid rgba(226,84,75,0.55); color:#E2544B; font-weight:600;">Geri Çek</button>' +
          '</div>'
        ).join('') + '</div>';
    }

    els.body.innerHTML = `
      <div class="mmg-chat-list-item" id="mmgNewGroupBtn" style="justify-content:center; font-weight:700; color:var(--brass,#C6A15B);">
        + Grup Oluştur
      </div>
      ${listHtml}
      ${sentHtml}`;

    document.getElementById('mmgNewGroupBtn').addEventListener('click', () => {
      groupsSubView = 'newGroup';
      pendingGroupMembers = [];
      renderTab();
    });
    els.body.querySelectorAll('.mmg-chat-list-item[data-group-id]').forEach(row => {
      row.addEventListener('click', () => {
        const g = groupsMap[row.dataset.groupId] || {};
        openChat(row.dataset.groupId, { title: (g.name || 'Grup'), isAdminChat: false, collection: 'chatGroups' });
      });
    });
    els.body.querySelectorAll('[data-cancel-invite]').forEach(btn => {
      btn.addEventListener('click', () => cancelSentGroupInvite(btn.dataset.cancelInvite));
    });
  }

  // Gönderdiğim bir grup davetini geri çek (sil).
  async function cancelSentGroupInvite(inviteId){
    try{ await deleteDoc(doc(db, 'chatGroupInvites', inviteId)); }
    catch(e){ console.error('cancelSentGroupInvite:', e); }
  }

  function renderNewGroupForm(){
    els.title.textContent = 'Grup Oluştur';
    els.body.innerHTML = `
      <div class="mmg-chat-add-form">
        <button type="button" class="mmg-chat-iconbtn" id="mmgGroupBackBtn" style="margin-bottom:8px;">← Gruplar'a dön</button>
        <input type="text" id="mmgGroupNameInput" placeholder="Grup adı" style="text-transform:none; letter-spacing:normal; font-family:'Inter',sans-serif;" maxlength="60">
        <input type="text" id="mmgGroupMemberInput" placeholder="Üye kullanıcı kodu (ör. 1016)" maxlength="12">
        <button type="button" class="mmg-chat-primary-btn" id="mmgGroupAddMemberBtn" style="margin-bottom:10px;">Üye Ekle</button>
        <div id="mmgGroupMemberChips" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;"></div>
        <button type="button" class="mmg-chat-primary-btn" id="mmgGroupCreateBtn">Grubu Oluştur</button>
        <div id="mmgGroupMsg" class="mmg-chat-msg-error"></div>
      </div>`;

    document.getElementById('mmgGroupBackBtn').addEventListener('click', () => {
      groupsSubView = 'list'; renderTab();
    });
    document.getElementById('mmgGroupAddMemberBtn').addEventListener('click', addPendingGroupMember);
    document.getElementById('mmgGroupMemberInput').addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); addPendingGroupMember(); } });
    document.getElementById('mmgGroupCreateBtn').addEventListener('click', createGroup);
    renderGroupMemberChips();
  }

  function renderGroupMemberChips(){
    const wrap = document.getElementById('mmgGroupMemberChips');
    if(!wrap) return;
    if(!pendingGroupMembers.length){
      wrap.innerHTML = `<span style="font-size:11.5px; color:var(--muted,#8D96AC);">Henüz üye eklenmedi.</span>`;
      return;
    }
    wrap.innerHTML = pendingGroupMembers.map((m, idx) => `
      <span style="display:inline-flex; align-items:center; gap:6px; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); border-radius:999px; padding:5px 10px; font-size:11.5px; color:var(--text,#EAEDF3); font-family:'IBM Plex Mono',monospace;">
        ${esc(m.code)}
        <button type="button" data-idx="${idx}" style="background:none; border:none; color:var(--red,#E2544B); cursor:pointer; font-size:12px; padding:0; line-height:1;">✕</button>
      </span>`).join('');
    wrap.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingGroupMembers.splice(Number(btn.dataset.idx), 1);
        renderGroupMemberChips();
      });
    });
  }

  async function addPendingGroupMember(){
    const inputEl = document.getElementById('mmgGroupMemberInput');
    const msgEl = document.getElementById('mmgGroupMsg');
    const code = (inputEl.value || '').trim().toUpperCase();
    msgEl.textContent = '';
    if(!code) return;
    if(code === myChatCode){ msgEl.textContent = 'Kendi kodunuzu ekleyemezsiniz.'; return; }
    if(pendingGroupMembers.some(m => m.code === code)){ msgEl.textContent = 'Bu kullanıcı zaten eklendi.'; return; }
    try{
      const codeSnap = await getDoc(doc(db, 'chatCodes', code));
      if(!codeSnap.exists()){ msgEl.textContent = 'Bu koda sahip bir kullanıcı bulunamadı.'; return; }
      const targetUid = codeSnap.data().uid;
      if(myBlockedUids.includes(targetUid)){ msgEl.textContent = 'Engellediğiniz bir kullanıcıyı ekleyemezsiniz.'; return; }
      pendingGroupMembers.push({ uid: targetUid, code });
      inputEl.value = '';
      renderGroupMemberChips();
    }catch(e){
      console.error(e);
      msgEl.textContent = (e && e.code === 'permission-denied') ? 'İzin hatası: Firestore güvenlik kuralları eksik olabilir.' : 'Bir hata oluştu, tekrar deneyin.';
    }
  }

  async function createGroup(){
    const nameInput = document.getElementById('mmgGroupNameInput');
    const msgEl = document.getElementById('mmgGroupMsg');
    const name = (nameInput.value || '').trim();
    if(!name){ msgEl.textContent = 'Lütfen bir grup adı girin.'; return; }
    if(!pendingGroupMembers.length){ msgEl.textContent = 'En az bir üye eklemelisiniz.'; return; }
    try{
      const uid = currentUser.uid;
      const groupRef = doc(collection(db, 'chatGroups'));
      const memberInfo = {}; memberInfo[uid] = { code: myChatCode || null };
      await setDoc(groupRef, {
        name,
        ownerUid: uid,
        members: [uid],
        memberInfo,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
        lastSenderUid: null
      });
      for(const m of pendingGroupMembers){
        await setDoc(doc(db, 'chatGroupInvites', groupRef.id + '_' + m.uid), {
          groupId: groupRef.id,
          groupName: name,
          fromUid: uid,
          fromCode: myChatCode,
          toUid: m.uid,
          toCode: m.code,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }
      groupsSubView = 'list';
      pendingGroupMembers = [];
      renderTab();
    }catch(e){
      console.error(e);
      msgEl.textContent = (e && e.code === 'permission-denied') ? 'İzin hatası: Firestore güvenlik kuralları eksik olabilir.' : 'Grup oluşturulamadı, tekrar deneyin.';
    }
  }

  async function leaveGroup(groupId){
    try{
      closeOpenChat(false);
      const g = groupsMap[groupId];
      const remaining = (g && g.members || []).filter(u => u !== currentUser.uid);
      await updateDoc(doc(db, 'chatGroups', groupId), { members: remaining });
      renderTab();
    }catch(e){ console.error(e); }
  }

  function renderRequestsTab(){
    els.title.textContent = 'Sohbet İstekleri';
    const reqIds = Object.keys(requestsMap).filter(id => !myBlockedUids.includes(requestsMap[id].fromUid));
    const invIds = Object.keys(groupInvitesMap).filter(id => !myBlockedUids.includes(groupInvitesMap[id].fromUid));
    const sentIds = Object.keys(sentRequestsMap);
    const incomingCount = reqIds.length + invIds.length;

    // İki alt başlık: Gelen İstekler / Gönderilen İstekler — kullanıcı isteği.
    const subBar = `<div class="mmg-chat-subtabs" style="display:flex; gap:6px; margin:0 0 12px;">
        <button type="button" class="mmg-chat-subtab${requestsSubView==='incoming'?' active':''}" data-rsub="incoming"
          style="flex:1; padding:8px 6px; border-radius:9px; border:1px solid var(--line,#232B3E); cursor:pointer; font-size:12.5px; font-weight:600;
          background:${requestsSubView==='incoming'?'var(--accent,#3B82F6)':'transparent'}; color:${requestsSubView==='incoming'?'#fff':'var(--muted,#8D96AC)'};">
          Gelen${incomingCount?` (${incomingCount})`:''}</button>
        <button type="button" class="mmg-chat-subtab${requestsSubView==='sent'?' active':''}" data-rsub="sent"
          style="flex:1; padding:8px 6px; border-radius:9px; border:1px solid var(--line,#232B3E); cursor:pointer; font-size:12.5px; font-weight:600;
          background:${requestsSubView==='sent'?'var(--accent,#3B82F6)':'transparent'}; color:${requestsSubView==='sent'?'#fff':'var(--muted,#8D96AC)'};">
          Gönderilen${sentIds.length?` (${sentIds.length})`:''}</button>
      </div>`;

    function wireSubBar(){
      els.body.querySelectorAll('.mmg-chat-subtab').forEach(b => {
        b.addEventListener('click', () => { requestsSubView = b.dataset.rsub; renderTab(); });
      });
    }

    // ---- GÖNDERİLEN görünümü ----
    if(requestsSubView === 'sent'){
      // "+ Kişi Ekle" artık burada (kullanıcı isteği: Ekle'yi İstek > Gönderilen'e taşı).
      const addBtnHtml = `<div class="mmg-chat-list-item" id="mmgAddPersonBtn" style="justify-content:center; font-weight:700; color:var(--brass,#C6A15B); margin-bottom:10px;">+ Kişi Ekle</div>`;
      function wireAddBtn(){
        const b = document.getElementById('mmgAddPersonBtn');
        if(b) b.addEventListener('click', () => { activeTab = 'friends'; friendsSubView = 'add'; renderTab(); });
      }
      if(!sentIds.length){
        els.body.innerHTML = subBar + addBtnHtml + `<div class="mmg-chat-empty">Gönderdiğiniz bekleyen istek yok.</div>`;
        wireSubBar(); wireAddBtn();
        return;
      }
      const sentHtml = sentIds.map(id => {
        const s = sentRequestsMap[id];
        return `<div data-sent-id="${esc(id)}" data-to-uid="${esc(s.toUid || '')}" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--hairline,#2A3448); border-radius:10px; margin-bottom:6px;">
          <div style="flex:1; min-width:0; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><b>${esc(s.toCode || s.toUid || '???')}</b> koduna istek</div>
          <button type="button" class="mmg-chat-btn nudge-sent" title="Dürt — karşı tarafa bildirim gönder" style="flex:0 0 auto; background:transparent; border:1px solid rgba(198,161,91,0.55); color:var(--brass,#C6A15B); font-weight:600;">👉 Dürt</button>
          <button type="button" class="mmg-chat-btn decline cancel-sent" style="flex:0 0 auto; background:transparent; border:1px solid rgba(226,84,75,0.55); color:#E2544B; font-weight:600;">Geri Çek</button>
        </div>`;
      }).join('');
      els.body.innerHTML = subBar + addBtnHtml + sentHtml;
      wireSubBar(); wireAddBtn();
      els.body.querySelectorAll('[data-sent-id]').forEach(row => {
        row.querySelector('.cancel-sent').addEventListener('click', () => cancelSentRequest(row.dataset.sentId));
        const nudgeBtn = row.querySelector('.nudge-sent');
        if(nudgeBtn){
          const uid = row.dataset.toUid;
          const nkey = 'mmg_last_nudge_' + uid;
          // Cooldown içindeyse ✅ + pasif göster; kalan süre bitince eski haline dön (kullanıcı isteği:
          // tik işareti 1 dk dolana kadar kalsın).
          function applyCooldown(){
            const rem = 60000 - (Date.now() - (+(localStorage.getItem(nkey) || 0)));
            if(rem > 0){
              nudgeBtn.disabled = true;
              nudgeBtn.textContent = '✅';
              nudgeBtn.title = 'Dürtüldü — 1 dk sonra tekrar dürtebilirsiniz';
              setTimeout(() => { nudgeBtn.disabled = false; nudgeBtn.textContent = '👉 Dürt'; nudgeBtn.title = 'Dürt — karşı tarafa bildirim gönder'; }, rem);
              return true;
            }
            return false;
          }
          applyCooldown();
          nudgeBtn.addEventListener('click', async () => {
            if(!uid || !window.mmgNotify){ nudgeBtn.textContent = '—'; setTimeout(()=>{ nudgeBtn.textContent = '👉 Dürt'; }, 1200); return; }
            if(applyCooldown()) return;
            nudgeBtn.disabled = true;
            try{
              await window.mmgNotify(uid, { type:'nudge', title:'👉 Dürtüldünüz', body:'Bir kullanıcı sizi dürttü — bekleyen sohbet isteğini yanıtlayın.' });
              try{ localStorage.setItem(nkey, String(Date.now())); }catch(e){}
              applyCooldown();
            }
            catch(e){ nudgeBtn.textContent = '—'; setTimeout(()=>{ nudgeBtn.disabled = false; nudgeBtn.textContent = '👉 Dürt'; }, 1400); }
          });
        }
      });
      return;
    }

    // ---- GELEN görünümü ----
    if(!reqIds.length && !invIds.length){
      els.body.innerHTML = subBar + `<div class="mmg-chat-empty">Bekleyen bir isteğiniz yok.</div>`;
      wireSubBar();
      return;
    }
    const reqHtml = reqIds.map(id => {
      const r = requestsMap[id];
      return `<div class="mmg-chat-req-row" data-kind="chat" data-req-id="${esc(id)}" data-from-uid="${esc(r.fromUid)}" data-from-code="${esc(r.fromCode||'')}">
        <div class="who"><b>${esc(r.fromCode || '???')}</b> kodlu kullanıcı sizinle sohbet etmek istiyor.</div>
        <div class="mmg-chat-req-actions">
          <button type="button" class="mmg-chat-btn accept">Kabul Et</button>
          <button type="button" class="mmg-chat-btn decline">Reddet</button>
          <button type="button" class="mmg-chat-btn block">Engelle</button>
        </div>
      </div>`;
    }).join('');
    const invHtml = invIds.map(id => {
      const inv = groupInvitesMap[id];
      return `<div class="mmg-chat-req-row" data-kind="group" data-req-id="${esc(id)}" data-from-uid="${esc(inv.fromUid)}" data-from-code="${esc(inv.fromCode||'')}" data-group-id="${esc(inv.groupId)}">
        <div class="who"><b>${esc(inv.fromCode || '???')}</b> kodlu kullanıcı sizi <b>${esc(inv.groupName || 'bir gruba')}</b> davet etti.</div>
        <div class="mmg-chat-req-actions">
          <button type="button" class="mmg-chat-btn accept">Kabul Et</button>
          <button type="button" class="mmg-chat-btn decline">Reddet</button>
          <button type="button" class="mmg-chat-btn block">Engelle</button>
        </div>
      </div>`;
    }).join('');
    els.body.innerHTML = subBar + reqHtml + invHtml;
    wireSubBar();

    els.body.querySelectorAll('.mmg-chat-req-row[data-kind="chat"]').forEach(row => {
      const reqId = row.dataset.reqId, fromUid = row.dataset.fromUid, fromCode = row.dataset.fromCode;
      row.querySelector('.accept').addEventListener('click', () => acceptRequest(reqId, fromUid, fromCode));
      row.querySelector('.decline').addEventListener('click', () => declineRequest(reqId));
      row.querySelector('.block').addEventListener('click', () => {
        if(confirm(fromCode + ' kodlu kullanıcıyı engellemek istediğinize emin misiniz? Bu kullanıcı size bir daha istek gönderemez.')){
          declineRequest(reqId);
          blockUser(fromUid);
        }
      });
    });
    els.body.querySelectorAll('.mmg-chat-req-row[data-kind="group"]').forEach(row => {
      const reqId = row.dataset.reqId, fromUid = row.dataset.fromUid, fromCode = row.dataset.fromCode, groupId = row.dataset.groupId;
      row.querySelector('.accept').addEventListener('click', () => acceptGroupInvite(reqId, groupId));
      row.querySelector('.decline').addEventListener('click', () => declineGroupInvite(reqId));
      row.querySelector('.block').addEventListener('click', () => {
        if(confirm(fromCode + ' kodlu kullanıcıyı engellemek istediğinize emin misiniz?')){
          declineGroupInvite(reqId);
          blockUser(fromUid);
        }
      });
    });
  }

  // Gönderdiğim bekleyen sohbet isteğini geri çek (sil) — kullanıcı isteği.
  async function cancelSentRequest(reqId){
    try{
      await deleteDoc(doc(db, 'chatRequests', reqId));
      delete sentRequestsMap[reqId];
      if(activeTab === 'requests') renderTab();
    }catch(e){ console.error('cancelSentRequest:', e); alert('İstek geri çekilemedi. Lütfen tekrar deneyin.'); }
  }

  async function acceptGroupInvite(inviteId, groupId){
    try{
      const uid = currentUser.uid;
      await updateDoc(doc(db, 'chatGroupInvites', inviteId), { status: 'accepted' });
      await updateDoc(doc(db, 'chatGroups', groupId), {
        members: arrayUnion(uid),
        ['memberInfo.' + uid]: { code: myChatCode || null }
      });
    }catch(e){ console.error(e); }
  }

  async function declineGroupInvite(inviteId){
    try{ await updateDoc(doc(db, 'chatGroupInvites', inviteId), { status: 'declined' }); }
    catch(e){ console.error(e); }
  }


  function renderAddTab(){
    els.title.textContent = 'Kişi Ekle';
    els.body.innerHTML = `
      <div class="mmg-chat-add-form">
        <button type="button" class="mmg-chat-iconbtn" id="mmgAddBackBtn" style="margin-bottom:8px;">← Sohbetler'e dön</button>
        <p style="font-size:12px; color:var(--muted,#8D96AC); margin-bottom:10px; line-height:1.5;">
          Arkadaşınızın Kullanıcı Kodunu (Müşteri No) girin. İsteğiniz, karşı taraf kabul ettiğinde bir sohbete dönüşür.
        </p>
        <input type="text" id="mmgChatAddInput" placeholder="ör. 1016" maxlength="12">
        <button type="button" class="mmg-chat-primary-btn" id="mmgChatAddBtn">İstek Gönder</button>
        <div id="mmgChatAddMsg" class="mmg-chat-msg-error"></div>
      </div>`;
    document.getElementById('mmgAddBackBtn').addEventListener('click', () => { friendsSubView = 'list'; renderTab(); });
    document.getElementById('mmgChatAddBtn').addEventListener('click', sendChatRequest);
    document.getElementById('mmgChatAddInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChatRequest(); });
  }

  async function sendChatRequest(){
    const inputEl = document.getElementById('mmgChatAddInput');
    const msgEl = document.getElementById('mmgChatAddMsg');
    const code = (inputEl.value || '').trim().toUpperCase();
    msgEl.className = 'mmg-chat-msg-error'; msgEl.textContent = '';
    if(!code){ msgEl.textContent = 'Lütfen bir kod girin.'; return; }
    if(code === myChatCode){ msgEl.textContent = 'Kendi kodunuzu giremezsiniz.'; return; }
    try{
      const codeSnap = await getDoc(doc(db, 'chatCodes', code));
      if(!codeSnap.exists()){ msgEl.textContent = 'Bu koda sahip bir kullanıcı bulunamadı.'; return; }
      const targetUid = codeSnap.data().uid;
      const uid = currentUser.uid;
      if(myBlockedUids.includes(targetUid)){
        msgEl.textContent = 'Bu kullanıcıyı engellediniz, istek gönderemezsiniz.';
        return;
      }

      const existingChatId = pairChatId(uid, targetUid);
      const existingChatSnap = await getDoc(doc(db, 'chats', existingChatId));
      if(existingChatSnap.exists()){
        msgEl.className = 'mmg-chat-msg-ok'; msgEl.textContent = 'Zaten bu kullanıcıyla bir sohbetiniz var. "Sohbetler" sekmesinden açabilirsiniz.';
        return;
      }

      // Karşı taraf zaten bize istek göndermiş mi? Öyleyse doğrudan kabul edelim.
      const incomingReqId = targetUid + '_' + uid;
      const incomingSnap = await getDoc(doc(db, 'chatRequests', incomingReqId));
      if(incomingSnap.exists() && incomingSnap.data().status === 'pending'){
        await acceptRequest(incomingReqId, targetUid, incomingSnap.data().fromCode, msgEl);
        inputEl.value = '';
        return;
      }

      const outgoingReqId = uid + '_' + targetUid;
      const outgoingSnap = await getDoc(doc(db, 'chatRequests', outgoingReqId));
      if(outgoingSnap.exists() && outgoingSnap.data().status === 'pending'){
        msgEl.className = 'mmg-chat-msg-ok'; msgEl.textContent = 'Bu kullanıcıya zaten bir isteğiniz var, onayını bekliyorsunuz.';
        return;
      }

      await setDoc(doc(db, 'chatRequests', outgoingReqId), {
        fromUid: uid,
        fromCode: myChatCode,
        fromEmail: currentUser.email || null,
        toUid: targetUid,
        toCode: code,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      // Karşı tarafa bildirim düş (çan/badge) — kullanıcı isteği: "isteklere bildirim gitmiyor".
      try{ await window.mmgNotify(targetUid, {
        type: 'chatRequest',
        title: 'Yeni sohbet isteği',
        body: (myChatCode ? (myChatCode + ' kodlu kullanıcı') : 'Bir kullanıcı') + ' sizinle sohbet etmek istiyor.',
        link: null
      }); }catch(_e){}
      msgEl.className = 'mmg-chat-msg-ok';
      msgEl.textContent = 'İsteğiniz gönderildi. Karşı taraf onayladığında sohbet açılacak.';
      inputEl.value = '';
    }catch(e){
      console.error(e);
      if(e && e.code === 'permission-denied'){
        msgEl.textContent = 'İzin hatası: Firestore güvenlik kuralları henüz eklenmemiş olabilir.';
      } else {
        msgEl.textContent = 'Bir hata oluştu, tekrar deneyin.';
      }
    }
  }

  async function acceptRequest(reqId, fromUid, fromCode, msgEl){
    try{
      const uid = currentUser.uid;
      await updateDoc(doc(db, 'chatRequests', reqId), { status: 'accepted' });
      const chatId = pairChatId(uid, fromUid);
      const participantInfo = {};
      participantInfo[fromUid] = { code: fromCode || null };
      participantInfo[uid] = { code: myChatCode || null };
      await setDoc(doc(db, 'chats', chatId), {
        participants: [uid, fromUid],
        type: 'user',
        isAdminChat: false,
        participantInfo,
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageAt: null,
        lastSenderUid: null
      }, { merge: true });
      // İsteği gönderene "kabul edildi" bildirimi düş.
      try{ await window.mmgNotify(fromUid, {
        type: 'chatAccepted',
        title: 'Sohbet isteğiniz kabul edildi',
        body: (myChatCode ? (myChatCode + ' kodlu kullanıcı') : 'Kullanıcı') + ' isteğinizi kabul etti, artık sohbet edebilirsiniz.',
        link: null
      }); }catch(_e){}
      if(msgEl){ msgEl.className = 'mmg-chat-msg-ok'; msgEl.textContent = 'İstek kabul edildi, sohbet açıldı.'; }
    }catch(e){ console.error(e); }
  }

  async function declineRequest(reqId){
    try{ await updateDoc(doc(db, 'chatRequests', reqId), { status: 'declined' }); }
    catch(e){ console.error(e); }
  }

  async function blockUser(targetUid){
    if(!targetUid || !currentUser) return;
    try{
      await updateDoc(doc(db, 'users', currentUser.uid), { blockedUids: arrayUnion(targetUid) });
      if(!myBlockedUids.includes(targetUid)) myBlockedUids.push(targetUid);
      if(openChatOtherUid === targetUid) closeOpenChat(false);
      renderTab();
    }catch(e){ console.error(e); }
  }

  // ---- Sohbeti (kişiyi) tamamen sil ----
  async function deleteChat(chatId){
    if(!chatId) return;
    try{
      const msgsSnap = await getDocs(collection(db, 'chats', chatId, 'messages'));
      await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref).catch(() => {})));
      await deleteDoc(doc(db, 'chats', chatId));
      delete chatsMap[chatId];
      if(openChatId === chatId) closeOpenChat(false);
      renderTab();
    }catch(e){
      console.error('mmg-chat-widget: sohbet silinemedi', e);
      alert('Sohbet silinemedi, lütfen tekrar deneyin.');
    }
  }

  // ---- Açık sohbet ----
  function openChat(chatId, info){
    openChatId = chatId;
    openChatInfo = info || {};
    if(els.newBtn) els.newBtn.hidden = true;
    openChatOtherUid = (info && info.otherUid) || null;
    openChatCollection = (info && info.collection) || 'chats';
    els.backBtn.hidden = false;
    els.footer.hidden = false;
    els.blockBtn.hidden = !openChatOtherUid; // gruplarda gösterilmez, sadece 1:1 sohbette
    if(els.nudgeBtn) els.nudgeBtn.hidden = !openChatOtherUid; // dürtme yalnızca 1:1'de
    els.leaveGroupBtn.hidden = openChatCollection !== 'chatGroups';
    els.deleteBtn.hidden = openChatCollection !== 'chats'; // gruplarda "gruptan ayrıl" kullanılır
    els.title.textContent = info && info.title ? info.title : 'Sohbet';
    // 1:1 sohbette başlığı koda değil kullanıcının adına çöz (ad gelene kadar koda düşer).
    openChatCode = null;
    if(openChatCollection === 'chats' && openChatOtherUid){
      const c0 = chatsMap[chatId] || {};
      const pinfo = (c0.participantInfo && c0.participantInfo[openChatOtherUid]) || {};
      if(pinfo.code){ openChatCode = pinfo.code; els.title.textContent = labelForCode(pinfo.code); }
    }
    // Açık 1:1 sohbette üstteki kod kutusunda KARŞI TARAFIN kodunu göster (listeye dönünce kendi kodu geri gelir).
    if(els.codeBox){
      els.codeBox.innerHTML = openChatCode
        ? ('Karşı taraf kodu: <b>' + esc(openChatCode) + '</b>')
        : (myChatCode ? ('Sizin Kullanıcı Kodunuz: <b>' + esc(myChatCode) + '</b>') : '');
    }
    els.body.innerHTML = `<div class="mmg-chat-empty">Yükleniyor…</div>`;

    // okundu bilgisini güncelle
    setDoc(doc(db, openChatCollection, chatId), { ['lastRead_' + currentUser.uid]: serverTimestamp() }, { merge: true }).catch(()=>{});

    if(unsubMessages) unsubMessages();
    const msgsQuery = query(collection(db, openChatCollection, chatId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    unsubMessages = onSnapshot(msgsQuery, (snap) => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      renderMessages(msgs);
    }, (err) => {
      console.error('mmg-chat-widget messages onSnapshot:', err);
      els.body.innerHTML = `<div class="mmg-chat-empty">Mesajlar yüklenemedi.</div>`;
    });
  }

  const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];

  function renderMessages(msgs){
    if(!msgs.length){
      els.body.innerHTML = `<div class="mmg-chat-empty">Henüz mesaj yok. İlk mesajı siz gönderin!</div>`;
      return;
    }
    const isGroup = openChatCollection === 'chatGroups';
    const groupInfo = isGroup ? (groupsMap[openChatId] || {}) : null;
    openMsgsById = {};
    els.body.innerHTML = msgs.map(m => {
      const mine = m.senderUid === currentUser.uid;
      let senderLabelText = mine ? 'Siz' : (isGroup ? 'Üye' : (els.title.textContent || 'Kullanıcı'));
      let senderLabel = '';
      if(isGroup && !mine){
        const info = (groupInfo.memberInfo && groupInfo.memberInfo[m.senderUid]) || {};
        if(info.code && nameByCode[info.code] === undefined) prefetchName(info.code);
        const memLabel = info.code ? (nameByCode[info.code] || info.code) : 'Üye';
        senderLabelText = memLabel;
        senderLabel = `<div style="font-size:10.5px; color:var(--brass,#C6A15B); margin-bottom:2px; font-family:'IBM Plex Mono',monospace;">${esc(memLabel)}</div>`;
      }
      openMsgsById[m.id] = { id: m.id, text: m.text, mine, senderLabel: senderLabelText };
      const reactions = m.reactions || {};
      const counts = {};
      Object.keys(reactions).forEach(uid => {
        const emo = reactions[uid];
        if(!emo) return;
        counts[emo] = (counts[emo] || 0) + 1;
      });
      const reactionsHtml = Object.keys(counts).length
        ? `<div class="mmg-chat-reactions">${Object.keys(counts).map(emo =>
            `<span class="mmg-chat-reaction-pill${reactions[currentUser.uid] === emo ? ' mine' : ''}" data-msg-id="${esc(m.id)}" data-emoji="${esc(emo)}">${emo} ${counts[emo]}</span>`
          ).join('')}</div>`
        : '';
      const quoteHtml = m.replyTo
        ? `<div class="mmg-chat-quote"><span class="qn">${esc(m.replyTo.senderLabel || '')}</span><span class="qt">${esc(m.replyTo.text || '')}</span></div>`
        : '';
      const fwdHtml = m.forwarded
        ? `<div style="font-size:10px; opacity:0.6; margin-bottom:2px; font-style:italic;">↪ İletildi</div>`
        : '';
      return `<div class="mmg-chat-msg ${mine ? 'me' : ''}">
        <div>
          ${senderLabel}
          <div class="mmg-chat-msg-row">
            <div class="mmg-chat-bubble" data-msg-id="${esc(m.id)}" title="Seçenekler için tıklayın">${quoteHtml}${fwdHtml}${esc(m.text)}</div>
          </div>
          ${reactionsHtml}
          <div class="mmg-chat-msg-time">${fmtTime(m.createdAt)}</div>
        </div>
      </div>`;
    }).join('');
    els.body.querySelectorAll('.mmg-chat-bubble[data-msg-id]').forEach(bub => {
      bub.addEventListener('click', (e) => {
        e.stopPropagation();
        const msg = openMsgsById[bub.dataset.msgId];
        if(msg) openMsgActionMenu(bub, msg);
      });
    });
    els.body.querySelectorAll('.mmg-chat-reaction-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        reactToMessage(pill.dataset.msgId, pill.dataset.emoji);
      });
    });
    els.body.scrollTop = els.body.scrollHeight;
  }

  // ---- Mesaja emoji ile tepki ver ----
  let reactPickerMsgId = null;
  function openReactPicker(anchorBtn, msgId){
    if(!els.reactPicker) return;
    if(reactPickerMsgId === msgId && !els.reactPicker.hidden){ closeReactPicker(); return; }
    reactPickerMsgId = msgId;
    els.reactPicker.innerHTML = REACTION_EMOJIS.map(e => `<span data-emoji="${e}">${e}</span>`).join('');
    els.reactPicker.hidden = false;
    const rect = anchorBtn.getBoundingClientRect();
    const pickerW = 210;
    let left = rect.left - pickerW / 2 + rect.width / 2;
    left = Math.min(Math.max(8, left), window.innerWidth - pickerW - 8);
    let top = rect.top - 44;
    if(top < 8) top = rect.bottom + 6;
    els.reactPicker.style.left = left + 'px';
    els.reactPicker.style.top = top + 'px';
    els.reactPicker.querySelectorAll('span').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        reactToMessage(msgId, span.dataset.emoji);
        closeReactPicker();
      });
    });
  }
  function closeReactPicker(){
    if(!els.reactPicker) return;
    els.reactPicker.hidden = true;
    reactPickerMsgId = null;
  }
  document.addEventListener('click', (e) => {
    if(els.reactPicker && !els.reactPicker.hidden && !els.reactPicker.contains(e.target)) closeReactPicker();
  });

  // ---- Mesaj aksiyon menüsü: Cevapla / İlet / Emoji / Sil ----
  function openMsgActionMenu(anchor, msg){
    if(!els.msgActions) return;
    closeReactPicker();
    els.msgActions.innerHTML =
      `<button type="button" data-act="reply">↩️ Cevapla</button>` +
      `<button type="button" data-act="forward">➡️ İlet</button>` +
      `<button type="button" data-act="react">🙂 Emoji ile tepki</button>` +
      (msg.mine ? `<button type="button" data-act="delete" class="danger">🗑 Sil</button>` : '');
    els.msgActions.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const menuW = 160, menuH = els.msgActions.offsetHeight || 190;
    let left = msg.mine ? (rect.right - menuW) : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - menuW - 8);
    let top = rect.bottom + 4;
    if(top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 4);
    els.msgActions.style.left = left + 'px';
    els.msgActions.style.top = top + 'px';
    els.msgActions.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        closeMsgActionMenu();
        if(act === 'reply') startReply(msg);
        else if(act === 'forward') openForwardSheet(msg);
        else if(act === 'react') openReactPicker(anchor, msg.id);
        else if(act === 'delete'){ if(confirm('Bu mesajı silmek istediğinize emin misiniz?')) deleteMessage(msg.id); }
      });
    });
  }
  function closeMsgActionMenu(){ if(els.msgActions) els.msgActions.hidden = true; }
  document.addEventListener('click', (e) => {
    if(els.msgActions && !els.msgActions.hidden && !els.msgActions.contains(e.target)) closeMsgActionMenu();
  });

  // ---- Cevapla ----
  function startReply(msg){
    replyingTo = { text: msg.text || '', senderLabel: msg.senderLabel || '' };
    if(!els.replyBar) return;
    els.replyBar.innerHTML =
      `<div class="rb-main"><div class="rb-name">${esc(msg.senderLabel || '')} kişisine cevap</div>` +
      `<div class="rb-text">${esc(msg.text || '')}</div></div>` +
      `<button type="button" id="mmgChatReplyCancel" aria-label="Cevabı iptal et">✕</button>`;
    els.replyBar.hidden = false;
    const cancel = document.getElementById('mmgChatReplyCancel');
    if(cancel) cancel.addEventListener('click', cancelReply);
    if(els.input) els.input.focus();
  }
  function cancelReply(){
    replyingTo = null;
    if(els.replyBar){ els.replyBar.hidden = true; els.replyBar.innerHTML = ''; }
  }

  // ---- İlet (forward) ----
  function openForwardSheet(msg){
    if(!els.fwdSheet) return;
    const items = [];
    Object.keys(chatsMap).forEach(id => {
      const c = chatsMap[id];
      if(c.isAdminChat) return;
      const other = (c.participants || []).find(u => u !== currentUser.uid);
      if(myBlockedUids.includes(other)) return;
      const info = (c.participantInfo && c.participantInfo[other]) || {};
      const label = labelForCode(info.code);
      items.push({ id, coll: 'chats', label, av: avatarLetterFromLabel(label) });
    });
    Object.keys(groupsMap).forEach(id => {
      const g = groupsMap[id];
      items.push({ id, coll: 'chatGroups', label: (g.name || 'Grup'), av: '👥' });
    });
    els.fwdSheet.innerHTML = `<div class="fwd-title">İletilecek sohbeti seçin</div>` +
      (items.length ? items.map(it =>
        `<div class="mmg-chat-fwd-item" data-id="${esc(it.id)}" data-coll="${it.coll}">` +
          `<div class="mmg-chat-toast-avatar" style="width:28px; height:28px; font-size:12px;">${esc(it.av)}</div>` +
          `<div style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(it.label)}</div>` +
        `</div>`).join('')
        : `<div style="padding:10px; color:var(--muted,#8D96AC); font-size:12px;">İletilecek başka sohbet yok.</div>`);
    els.fwdSheet.hidden = false;
    els.fwdSheet.style.left = Math.max(8, (window.innerWidth - 260) / 2) + 'px';
    els.fwdSheet.style.top = Math.max(8, (window.innerHeight - 320) / 2) + 'px';
    els.fwdSheet.querySelectorAll('.mmg-chat-fwd-item').forEach(it => {
      it.addEventListener('click', (e) => {
        e.stopPropagation();
        forwardMessageTo(it.dataset.coll, it.dataset.id, msg.text);
        closeForwardSheet();
      });
    });
  }
  function closeForwardSheet(){ if(els.fwdSheet) els.fwdSheet.hidden = true; }
  document.addEventListener('click', (e) => {
    if(els.fwdSheet && !els.fwdSheet.hidden && !els.fwdSheet.contains(e.target)) closeForwardSheet();
  });
  async function forwardMessageTo(coll, chatId, text){
    if(!text || !chatId || !currentUser) return;
    const uid = currentUser.uid;
    try{
      await addDoc(collection(db, coll, chatId, 'messages'), {
        senderUid: uid, senderIsAdmin: !!myIsAdmin, text: String(text).slice(0, 2000),
        forwarded: true, createdAt: serverTimestamp()
      });
      await setDoc(doc(db, coll, chatId), {
        lastMessage: String(text).slice(0, 140), lastMessageAt: serverTimestamp(),
        lastSenderUid: uid, ['lastRead_' + uid]: serverTimestamp()
      }, { merge: true });
    }catch(e){ console.error('mmg-chat-widget: mesaj iletilemedi', e); }
  }

  async function reactToMessage(msgId, emoji){
    if(!msgId || !openChatId || !currentUser) return;
    try{
      const msgRef = doc(db, openChatCollection, openChatId, 'messages', msgId);
      const snap = await getDoc(msgRef);
      const current = snap.exists() ? (snap.data().reactions || {}) : {};
      const already = current[currentUser.uid] === emoji;
      const updated = Object.assign({}, current);
      if(already){ delete updated[currentUser.uid]; }
      else { updated[currentUser.uid] = emoji; }
      await setDoc(msgRef, { reactions: updated }, { merge: true });
    }catch(e){ console.error('mmg-chat-widget: tepki eklenemedi', e); }
  }

  async function deleteMessage(msgId){
    if(!msgId || !openChatId) return;
    try{
      await deleteDoc(doc(db, openChatCollection, openChatId, 'messages', msgId));
    }catch(e){
      console.error('mmg-chat-widget: mesaj silinemedi', e);
    }
  }

  async function sendCurrentMessage(){
    const text = (els.input.value || '').trim();
    if(!text || !openChatId) return;
    els.input.value = '';
    const uid = currentUser.uid;
    const msgData = {
      senderUid: uid,
      senderIsAdmin: !!myIsAdmin,
      text: text.slice(0, 2000),
      createdAt: serverTimestamp()
    };
    if(replyingTo){
      msgData.replyTo = {
        text: String(replyingTo.text || '').slice(0, 140),
        senderLabel: String(replyingTo.senderLabel || '').slice(0, 40)
      };
      cancelReply();
    }
    try{
      await addDoc(collection(db, openChatCollection, openChatId, 'messages'), msgData);
      await setDoc(doc(db, openChatCollection, openChatId), {
        lastMessage: text.slice(0, 140),
        lastMessageAt: serverTimestamp(),
        lastSenderUid: uid,
        ['lastRead_' + uid]: serverTimestamp()
      }, { merge: true });
      // Karşı tarafa bildirim düşür (uygulama-içi çan/badge; kapalı-uygulama push'u Blaze+functions ister).
      try{
        const preview = text.slice(0, 80);
        const who = (myChatCode ? ('#' + myChatCode) : 'Bir kullanıcı') + (myName ? ' - ' + myName : '');
        if(openChatCollection === 'chats' && openChatOtherUid){
          window.mmgNotify(openChatOtherUid, { type:'chat', title:'💬 Yeni mesaj', body: who + ': ' + preview });
        } else if(openChatCollection === 'chatGroups'){
          const g = groupsMap[openChatId] || {};
          (g.members || []).forEach(m => { if(m && m !== uid) window.mmgNotify(m, { type:'chat', title:'💬 Yeni grup mesajı', body: who + ': ' + preview }); });
        }
      }catch(e){}
    }catch(e){ console.error(e); }
  }


  // ---- Başlangıç ----
  function stopAll(){
    if(unsubChats){ unsubChats(); unsubChats = null; }
    if(unsubRequests){ unsubRequests(); unsubRequests = null; }
    if(unsubSentRequests){ unsubSentRequests(); unsubSentRequests = null; }
    if(unsubMessages){ unsubMessages(); unsubMessages = null; }
    if(unsubGroups){ unsubGroups(); unsubGroups = null; }
    if(unsubGroupInvites){ unsubGroupInvites(); unsubGroupInvites = null; }
    if(unsubSentGroupInvites){ unsubSentGroupInvites(); unsubSentGroupInvites = null; }
    if(unsubFirmaMemberInvite){ unsubFirmaMemberInvite(); unsubFirmaMemberInvite = null; }
    if(unsubFirmaAdminInvite){ unsubFirmaAdminInvite(); unsubFirmaAdminInvite = null; }
    if(unsubNotifications){ unsubNotifications(); unsubNotifications = null; }
    chatsMap = {}; requestsMap = {}; groupsMap = {}; groupInvitesMap = {}; openChatId = null;
    notificationsMap = {}; notificationsFirstSnapshot = true;
    chatsFirstSnapshot = true; groupsFirstSnapshot = true;
    firmaMemberInvitesFirstSnapshot = true; firmaAdminInviteFirstSnapshot = true;
    firmaMemberInvites = []; firmaAdminInvite = null;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    stopAll();
    if(!user){
      els.bubble.hidden = true;
      els.panel.hidden = true;
      return;
    }
    els.bubble.hidden = false;
    applyBubblePos();
    try{
      const uref = doc(db, 'users', user.uid);
      const usnap = await getDoc(uref);
      const udata = usnap.exists() ? usnap.data() : {};
      myIsAdmin = udata.isAdmin === true;
      myBlockedUids = Array.isArray(udata.blockedUids) ? udata.blockedUids : [];
      myName = udata.displayName || udata.adSoyad || udata.isim || udata.name || udata.fullName || udata.firmaAdi || (user.displayName || null);
      myChatCode = await ensureChatCode(user.uid);
      els.codeBox.innerHTML = myChatCode ? `Sizin Kullanıcı Kodunuz: <b>${esc(myChatCode)}</b>` : '';
    }catch(e){ console.error('mmg-chat-widget kullanıcı bilgisi alınamadı:', e); }
    startListeners(user.uid);
    renderTab();
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
