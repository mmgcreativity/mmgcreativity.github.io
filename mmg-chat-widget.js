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
  let myIsAdmin = false;
  let myBlockedUids = [];
  let unsubChats = null, unsubRequests = null, unsubMessages = null;
  let openChatId = null, openChatInfo = null, openChatOtherUid = null, openChatCollection = 'chats';
  let groupsMap = {};        // groupId -> group data
  let groupInvitesMap = {};  // inviteId -> invite data
  let unsubGroups = null, unsubGroupInvites = null;
  let friendsSubView = 'list'; // 'list' | 'newGroup'
  let pendingGroupMembers = []; // [{uid, code}] grup oluşturma formunda eklenen kişiler
  let chatsMap = {};     // chatId -> chat data
  let requestsMap = {};  // reqId -> request data
  let activeTab = 'friends'; // friends | requests | add | admin

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
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatLeaveGroupBtn" hidden aria-label="Gruptan ayrıl" title="Gruptan ayrıl">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
      </button>
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatCloseBtn" aria-label="Kapat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="mmgChatCodeBox" class="mmg-chat-code-box"></div>
    <div class="mmg-chat-tabs" id="mmgChatTabs">
      <div class="mmg-chat-tab active" data-tab="friends">Sohbetler</div>
      <div class="mmg-chat-tab" data-tab="requests">İstekler<span class="mmg-chat-dot" id="mmgChatReqDot" hidden></span></div>
      <div class="mmg-chat-tab" data-tab="add">Kod ile Ekle</div>
      <div class="mmg-chat-tab" data-tab="admin">Yöneticiniz</div>
    </div>
    <div class="mmg-chat-body" id="mmgChatBody"></div>
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
    wireUp();
  }

  // ---- DOM referansları (inject sonrası doldurulur) ----
  let els = {};

  function wireUp(){
    els.bubble = document.getElementById('mmgChatBubble');
    els.badge = document.getElementById('mmgChatBadge');
    els.panel = document.getElementById('mmgChatPanel');
    els.title = document.getElementById('mmgChatTitle');
    els.backBtn = document.getElementById('mmgChatBackBtn');
    els.blockBtn = document.getElementById('mmgChatBlockBtn');
    els.deleteBtn = document.getElementById('mmgChatDeleteBtn');
    els.leaveGroupBtn = document.getElementById('mmgChatLeaveGroupBtn');
    els.closeBtn = document.getElementById('mmgChatCloseBtn');
    els.codeBox = document.getElementById('mmgChatCodeBox');
    els.tabs = document.getElementById('mmgChatTabs');
    els.reqDot = document.getElementById('mmgChatReqDot');
    els.body = document.getElementById('mmgChatBody');
    els.footer = document.getElementById('mmgChatFooter');
    els.input = document.getElementById('mmgChatInput');
    els.sendBtn = document.getElementById('mmgChatSendBtn');
    els.toastContainer = document.getElementById('mmgChatToastContainer');
    els.emojiBtn = document.getElementById('mmgChatEmojiBtn');
    els.emojiPicker = document.getElementById('mmgChatEmojiPicker');

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
      activeTab = tab.dataset.tab;
      if(activeTab !== 'friends') friendsSubView = 'list';
      [...els.tabs.children].forEach(c => c.classList.toggle('active', c === tab));
      closeOpenChat(false);
      renderTab();
    });
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
      els.panel.hidden = true;
    }, true);
  }

  function setBadge(n){
    if(n > 0){ els.badge.hidden = false; els.badge.textContent = n > 9 ? '9+' : String(n); }
    else { els.badge.hidden = true; }
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
    openChatId = null; openChatInfo = null; openChatOtherUid = null; openChatCollection = 'chats';
    els.backBtn.hidden = true;
    els.footer.hidden = true;
    if(els.leaveGroupBtn) els.leaveGroupBtn.hidden = true;
    if(els.blockBtn) els.blockBtn.hidden = true;
    if(els.deleteBtn) els.deleteBtn.hidden = true;
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
      showChatToast({
        title, message: c.lastMessage || 'Yeni mesaj', avatarLetter: '👥',
        onClick: () => {
          els.panel.hidden = false;
          positionPanelNearBubble();
          activeTab = 'friends';
          [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'friends'));
          openChat(id, { title: (c.name || 'Grup'), isAdminChat: false, collection: 'chatGroups' });
        }
      });
      return;
    }
    // kind === 'chats', normal 1:1
    const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
    const info = (c.participantInfo && c.participantInfo[otherUid]) || {};
    const label = info.code ? ('Kod: ' + info.code) : 'Kullanıcı';
    showChatToast({
      title: label, message: c.lastMessage || 'Yeni mesaj', avatarLetter: (info.code || '?').slice(0, 1),
      onClick: () => {
        els.panel.hidden = false;
        positionPanelNearBubble();
        activeTab = 'friends';
        [...els.tabs.children].forEach(t => t.classList.toggle('active', t.dataset.tab === 'friends'));
        openChat(id, { title: label, isAdminChat: false, otherUid, collection: 'chats' });
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

    unsubGroups = onSnapshot(query(collection(db, 'chatGroups'), where('members', 'array-contains', uid)), (snap) => {
      const newGroupsMap = {};
      snap.forEach(d => { newGroupsMap[d.id] = d.data(); });
      if(!groupsFirstSnapshot) detectNewMessagesAndToast(newGroupsMap, groupsMap, 'groups');
      groupsMap = newGroupsMap;
      groupsFirstSnapshot = false;
      if(activeTab === 'friends' && friendsSubView === 'list') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget groups onSnapshot:', err));

    unsubGroupInvites = onSnapshot(query(collection(db, 'chatGroupInvites'), where('toUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      groupInvitesMap = {};
      snap.forEach(d => { groupInvitesMap[d.id] = d.data(); });
      if(activeTab === 'requests') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget groupInvites onSnapshot:', err));
  }

  function updateBadge(){
    const reqCount = Object.keys(requestsMap).length + Object.keys(groupInvitesMap).length;
    els.reqDot.hidden = reqCount === 0;
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
    setBadge(unread + reqCount);
  }

  function updateOpenChatHeaderIfNeeded(){ /* şu an ekstra bir şey gerekmiyor */ }

  // ---- Sekme render ----
  function renderTab(){
    if(openChatId) return; // bir sohbet açıkken sekme gövdesi değişmesin
    if(activeTab === 'admin') return renderAdminTab();
    if(activeTab === 'friends') return renderFriendsTab();
    if(activeTab === 'requests') return renderRequestsTab();
    if(activeTab === 'add') return renderAddTab();
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
    els.title.textContent = 'Sohbet';
    if(friendsSubView === 'newGroup') return renderNewGroupForm();

    const chatIds = Object.keys(chatsMap).filter(id => {
      const c = chatsMap[id];
      if(c.isAdminChat) return false;
      const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
      return !myBlockedUids.includes(otherUid);
    });
    const groupIds = Object.keys(groupsMap);

    const rows = [];
    chatIds.forEach(id => {
      const c = chatsMap[id];
      const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
      const info = (c.participantInfo && c.participantInfo[otherUid]) || {};
      const label = info.code ? ('Kod: ' + info.code) : 'Kullanıcı';
      const lastAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const readAt = c['lastRead_' + currentUser.uid] && c['lastRead_' + currentUser.uid].toMillis ? c['lastRead_' + currentUser.uid].toMillis() : 0;
      rows.push({
        id, kind: 'chat', label, sub: c.lastMessage || 'Henüz mesaj yok', lastAt,
        unread: lastAt > readAt && c.lastSenderUid !== currentUser.uid,
        avatarLetter: (info.code || '?').slice(0, 1), otherUid
      });
    });
    groupIds.forEach(id => {
      const g = groupsMap[id];
      const lastAt = g.lastMessageAt && g.lastMessageAt.toMillis ? g.lastMessageAt.toMillis() : 0;
      const readAt = g['lastRead_' + currentUser.uid] && g['lastRead_' + currentUser.uid].toMillis ? g['lastRead_' + currentUser.uid].toMillis() : 0;
      rows.push({
        id, kind: 'group', label: (g.name || 'Grup') + ' (Grup)', sub: g.lastMessage || 'Henüz mesaj yok', lastAt,
        unread: lastAt > readAt && g.lastSenderUid !== currentUser.uid,
        avatarLetter: '👥'
      });
    });
    rows.sort((a, b) => b.lastAt - a.lastAt);

    const listHtml = rows.length ? rows.map(r => `
      <div class="mmg-chat-list-item" data-kind="${r.kind}" data-chat-id="${esc(r.id)}" data-label="${esc(r.label)}" data-other-uid="${esc(r.otherUid || '')}">
        <div class="mmg-chat-avatar">${esc(r.avatarLetter)}</div>
        <div class="mmg-chat-list-main">
          <div class="mmg-chat-list-name">${esc(r.label)}${r.unread ? ' •' : ''}</div>
          <div class="mmg-chat-list-sub">${esc(r.sub)}</div>
        </div>
        ${r.kind === 'chat' ? `<button type="button" class="mmg-chat-list-delete" data-delete-chat-id="${esc(r.id)}" data-delete-label="${esc(r.label)}" title="Kişiyi sil" aria-label="Kişiyi sil">🗑</button>` : ''}
      </div>`).join('')
      : `<div class="mmg-chat-empty">Henüz bir sohbetiniz yok.<br>"Kod ile Ekle" sekmesinden bir kullanıcı kodu girerek istek gönderebilir ya da bir grup oluşturabilirsiniz.</div>`;

    els.body.innerHTML = `
      <div class="mmg-chat-list-item" id="mmgNewGroupBtn" style="justify-content:center; font-weight:700; color:var(--brass,#C6A15B);">
        + Grup Oluştur
      </div>
      ${listHtml}`;

    document.getElementById('mmgNewGroupBtn').addEventListener('click', () => {
      friendsSubView = 'newGroup';
      pendingGroupMembers = [];
      renderTab();
    });
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
        if(row.dataset.kind === 'group'){
          const g = groupsMap[row.dataset.chatId] || {};
          openChat(row.dataset.chatId, { title: (g.name || 'Grup'), isAdminChat: false, collection: 'chatGroups' });
        } else {
          openChat(row.dataset.chatId, { title: row.dataset.label, isAdminChat: false, otherUid: row.dataset.otherUid, collection: 'chats' });
        }
      });
    });
  }

  function renderNewGroupForm(){
    els.title.textContent = 'Grup Oluştur';
    els.body.innerHTML = `
      <div class="mmg-chat-add-form">
        <button type="button" class="mmg-chat-iconbtn" id="mmgGroupBackBtn" style="margin-bottom:8px;">← Sohbetler'e dön</button>
        <input type="text" id="mmgGroupNameInput" placeholder="Grup adı" style="text-transform:none; letter-spacing:normal; font-family:'Inter',sans-serif;" maxlength="60">
        <input type="text" id="mmgGroupMemberInput" placeholder="Üye kullanıcı kodu (ör. 1016)" maxlength="12">
        <button type="button" class="mmg-chat-primary-btn" id="mmgGroupAddMemberBtn" style="margin-bottom:10px;">Üye Ekle</button>
        <div id="mmgGroupMemberChips" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;"></div>
        <button type="button" class="mmg-chat-primary-btn" id="mmgGroupCreateBtn">Grubu Oluştur</button>
        <div id="mmgGroupMsg" class="mmg-chat-msg-error"></div>
      </div>`;

    document.getElementById('mmgGroupBackBtn').addEventListener('click', () => {
      friendsSubView = 'list'; renderTab();
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
      friendsSubView = 'list';
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
    if(!reqIds.length && !invIds.length){
      els.body.innerHTML = `<div class="mmg-chat-empty">Bekleyen bir isteğiniz yok.</div>`;
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
    els.body.innerHTML = reqHtml + invHtml;

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
    els.title.textContent = 'Kod ile Sohbet Ekle';
    els.body.innerHTML = `
      <div class="mmg-chat-add-form">
        <p style="font-size:12px; color:var(--muted,#8D96AC); margin-bottom:10px; line-height:1.5;">
          Arkadaşınızın Kullanıcı Kodunu (Müşteri No) girin. İsteğiniz, karşı taraf kabul ettiğinde bir sohbete dönüşür.
        </p>
        <input type="text" id="mmgChatAddInput" placeholder="ör. 1016" maxlength="12">
        <button type="button" class="mmg-chat-primary-btn" id="mmgChatAddBtn">İstek Gönder</button>
        <div id="mmgChatAddMsg" class="mmg-chat-msg-error"></div>
      </div>`;
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
    openChatOtherUid = (info && info.otherUid) || null;
    openChatCollection = (info && info.collection) || 'chats';
    els.backBtn.hidden = false;
    els.footer.hidden = false;
    els.blockBtn.hidden = !openChatOtherUid; // gruplarda gösterilmez, sadece 1:1 sohbette
    els.leaveGroupBtn.hidden = openChatCollection !== 'chatGroups';
    els.deleteBtn.hidden = openChatCollection !== 'chats'; // gruplarda "gruptan ayrıl" kullanılır
    els.title.textContent = info && info.title ? info.title : 'Sohbet';
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

  function renderMessages(msgs){
    if(!msgs.length){
      els.body.innerHTML = `<div class="mmg-chat-empty">Henüz mesaj yok. İlk mesajı siz gönderin!</div>`;
      return;
    }
    const isGroup = openChatCollection === 'chatGroups';
    const groupInfo = isGroup ? (groupsMap[openChatId] || {}) : null;
    els.body.innerHTML = msgs.map(m => {
      const mine = m.senderUid === currentUser.uid;
      let senderLabel = '';
      if(isGroup && !mine){
        const info = (groupInfo.memberInfo && groupInfo.memberInfo[m.senderUid]) || {};
        senderLabel = `<div style="font-size:10.5px; color:var(--brass,#C6A15B); margin-bottom:2px; font-family:'IBM Plex Mono',monospace;">${esc(info.code || 'Üye')}</div>`;
      }
      return `<div class="mmg-chat-msg ${mine ? 'me' : ''}">
        <div>
          ${senderLabel}
          <div class="mmg-chat-msg-row">
            <div class="mmg-chat-bubble">${esc(m.text)}</div>
            ${mine ? `<button type="button" class="mmg-chat-msg-delete" data-msg-id="${esc(m.id)}" title="Mesajı sil">🗑</button>` : ''}
          </div>
          <div class="mmg-chat-msg-time">${fmtTime(m.createdAt)}</div>
        </div>
      </div>`;
    }).join('');
    els.body.querySelectorAll('.mmg-chat-msg-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.dataset.msgId;
        if(confirm('Bu mesajı silmek istediğinize emin misiniz?')) deleteMessage(msgId);
      });
    });
    els.body.scrollTop = els.body.scrollHeight;
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
    try{
      await addDoc(collection(db, openChatCollection, openChatId, 'messages'), {
        senderUid: uid,
        senderIsAdmin: !!myIsAdmin,
        text: text.slice(0, 2000),
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, openChatCollection, openChatId), {
        lastMessage: text.slice(0, 140),
        lastMessageAt: serverTimestamp(),
        lastSenderUid: uid,
        ['lastRead_' + uid]: serverTimestamp()
      }, { merge: true });
    }catch(e){ console.error(e); }
  }


  // ---- Başlangıç ----
  function stopAll(){
    if(unsubChats){ unsubChats(); unsubChats = null; }
    if(unsubRequests){ unsubRequests(); unsubRequests = null; }
    if(unsubMessages){ unsubMessages(); unsubMessages = null; }
    if(unsubGroups){ unsubGroups(); unsubGroups = null; }
    if(unsubGroupInvites){ unsubGroupInvites(); unsubGroupInvites = null; }
    chatsMap = {}; requestsMap = {}; groupsMap = {}; groupInvitesMap = {}; openChatId = null;
    chatsFirstSnapshot = true; groupsFirstSnapshot = true;
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
