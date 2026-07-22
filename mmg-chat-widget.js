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
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

(function(){
  if(window.__mmgChatWidgetLoaded) return;
  window.__mmgChatWidgetLoaded = true;

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
  let unsubChats = null, unsubRequests = null, unsubMessages = null;
  let openChatId = null, openChatInfo = null;
  let chatsMap = {};     // chatId -> chat data
  let requestsMap = {};  // reqId -> request data
  let activeTab = 'admin'; // admin | friends | add | requests

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
    width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
    background:linear-gradient(135deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 85%);
    color:#fff; display:flex; align-items:center; justify-content:center;
    box-shadow:0 10px 26px rgba(0,0,0,0.4); transition:transform .15s ease;
  }
  #mmgChatBubble:hover{ transform:scale(1.06); }
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
  .mmg-chat-bubble{
    max-width:78%; padding:9px 12px; border-radius:14px; font-size:13px; line-height:1.45; word-wrap:break-word;
    background:var(--surface-2,#1B2536); color:var(--text,#EAEDF3); border:1px solid var(--hairline,#2A3448);
  }
  .mmg-chat-msg.me .mmg-chat-bubble{
    background:linear-gradient(120deg, var(--coral,#FF6B4A), var(--brass,#C6A15B) 85%); color:#fff; border:none;
  }
  .mmg-chat-msg-time{ font-size:9.5px; color:var(--muted,#8D96AC); margin-top:3px; text-align:right; }
  .mmg-chat-msg.me .mmg-chat-msg-time{ color:rgba(255,255,255,0.75); }
  .mmg-chat-footer{ flex:0 0 auto; display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--hairline,#2A3448); }
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
      <button type="button" class="mmg-chat-iconbtn" id="mmgChatCloseBtn" aria-label="Kapat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div id="mmgChatCodeBox" class="mmg-chat-code-box"></div>
    <div class="mmg-chat-tabs" id="mmgChatTabs">
      <div class="mmg-chat-tab active" data-tab="admin">Admin</div>
      <div class="mmg-chat-tab" data-tab="friends">Sohbetler</div>
      <div class="mmg-chat-tab" data-tab="requests">İstekler<span class="mmg-chat-dot" id="mmgChatReqDot" hidden></span></div>
      <div class="mmg-chat-tab" data-tab="add">Kod ile Ekle</div>
    </div>
    <div class="mmg-chat-body" id="mmgChatBody"></div>
    <div class="mmg-chat-footer" id="mmgChatFooter" hidden>
      <textarea id="mmgChatInput" placeholder="Mesaj yazın…" rows="1"></textarea>
      <button type="button" class="mmg-chat-send-btn" id="mmgChatSendBtn" aria-label="Gönder">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
  </div>`;

  function inject(){
    const styleTag = document.createElement('style');
    styleTag.id = 'mmgChatStyle';
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    while(wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
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
    els.closeBtn = document.getElementById('mmgChatCloseBtn');
    els.codeBox = document.getElementById('mmgChatCodeBox');
    els.tabs = document.getElementById('mmgChatTabs');
    els.reqDot = document.getElementById('mmgChatReqDot');
    els.body = document.getElementById('mmgChatBody');
    els.footer = document.getElementById('mmgChatFooter');
    els.input = document.getElementById('mmgChatInput');
    els.sendBtn = document.getElementById('mmgChatSendBtn');

    els.bubble.addEventListener('click', () => { els.panel.hidden = !els.panel.hidden; if(!els.panel.hidden) renderTab(); });
    els.closeBtn.addEventListener('click', () => { els.panel.hidden = true; });
    els.backBtn.addEventListener('click', closeOpenChat);
    els.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.mmg-chat-tab');
      if(!tab) return;
      activeTab = tab.dataset.tab;
      [...els.tabs.children].forEach(c => c.classList.toggle('active', c === tab));
      closeOpenChat(false);
      renderTab();
    });
    els.sendBtn.addEventListener('click', sendCurrentMessage);
    els.input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendCurrentMessage(); }
    });
  }

  function setBadge(n){
    if(n > 0){ els.badge.hidden = false; els.badge.textContent = n > 9 ? '9+' : String(n); }
    else { els.badge.hidden = true; }
  }

  function closeOpenChat(rerender){
    if(unsubMessages){ unsubMessages(); unsubMessages = null; }
    openChatId = null; openChatInfo = null;
    els.backBtn.hidden = true;
    els.footer.hidden = true;
    if(rerender !== false) renderTab();
  }

  // ---- Sohbet kodu üretimi ----
  async function ensureChatCode(uid){
    const uref = doc(db, 'users', uid);
    const usnap = await getDoc(uref);
    const udata = usnap.exists() ? usnap.data() : {};
    if(udata.chatCode) return udata.chatCode;
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
  function startListeners(uid){
    unsubChats = onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', uid)), (snap) => {
      chatsMap = {};
      snap.forEach(d => { chatsMap[d.id] = d.data(); });
      if(activeTab === 'friends') renderTab();
      if(openChatId && chatsMap[openChatId]) updateOpenChatHeaderIfNeeded();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget chats onSnapshot:', err));

    unsubRequests = onSnapshot(query(collection(db, 'chatRequests'), where('toUid', '==', uid), where('status', '==', 'pending')), (snap) => {
      requestsMap = {};
      snap.forEach(d => { requestsMap[d.id] = d.data(); });
      if(activeTab === 'requests') renderTab();
      updateBadge();
    }, (err) => console.error('mmg-chat-widget requests onSnapshot:', err));
  }

  function updateBadge(){
    const reqCount = Object.keys(requestsMap).length;
    els.reqDot.hidden = reqCount === 0;
    let unread = 0;
    Object.keys(chatsMap).forEach(id => {
      const c = chatsMap[id];
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
          <div class="mmg-chat-list-name">Yönetici ile Sohbet</div>
          <div class="mmg-chat-list-sub">Destek / geri bildirim</div>
        </div>
      </div>`;
    document.getElementById('mmgOpenAdminChatBtn').addEventListener('click', () => openAdminChat());
  }

  async function openAdminChat(){
    const uid = currentUser.uid;
    const chatId = adminChatId(uid);
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
    openChat(chatId, { title: 'Yönetici ile Sohbet', isAdminChat: true });
  }

  function renderFriendsTab(){
    els.title.textContent = 'Sohbet';
    const ids = Object.keys(chatsMap).filter(id => !chatsMap[id].isAdminChat);
    if(!ids.length){
      els.body.innerHTML = `<div class="mmg-chat-empty">Henüz bir sohbetiniz yok.<br>"Kod ile Ekle" sekmesinden bir arkadaşınızın sohbet kodunu girerek istek gönderebilirsiniz.</div>`;
      return;
    }
    ids.sort((a,b) => {
      const ta = chatsMap[a].lastMessageAt && chatsMap[a].lastMessageAt.toMillis ? chatsMap[a].lastMessageAt.toMillis() : 0;
      const tb = chatsMap[b].lastMessageAt && chatsMap[b].lastMessageAt.toMillis ? chatsMap[b].lastMessageAt.toMillis() : 0;
      return tb - ta;
    });
    els.body.innerHTML = ids.map(id => {
      const c = chatsMap[id];
      const otherUid = (c.participants || []).find(u => u !== currentUser.uid);
      const info = (c.participantInfo && c.participantInfo[otherUid]) || {};
      const label = info.code ? ('Kod: ' + info.code) : 'Kullanıcı';
      const lastAt = c.lastMessageAt && c.lastMessageAt.toMillis ? c.lastMessageAt.toMillis() : 0;
      const readAt = c['lastRead_' + currentUser.uid] && c['lastRead_' + currentUser.uid].toMillis ? c['lastRead_' + currentUser.uid].toMillis() : 0;
      const isUnread = lastAt > readAt && c.lastSenderUid !== currentUser.uid;
      return `<div class="mmg-chat-list-item" data-chat-id="${esc(id)}" data-label="${esc(label)}">
        <div class="mmg-chat-avatar">${esc((info.code||'?').slice(0,1))}</div>
        <div class="mmg-chat-list-main">
          <div class="mmg-chat-list-name">${esc(label)}${isUnread ? ' •' : ''}</div>
          <div class="mmg-chat-list-sub">${esc(c.lastMessage || 'Henüz mesaj yok')}</div>
        </div>
        <div class="mmg-chat-list-time">${fmtTime(c.lastMessageAt)}</div>
      </div>`;
    }).join('');
    els.body.querySelectorAll('.mmg-chat-list-item').forEach(row => {
      row.addEventListener('click', () => openChat(row.dataset.chatId, { title: row.dataset.label, isAdminChat: false }));
    });
  }

  function renderRequestsTab(){
    els.title.textContent = 'Sohbet İstekleri';
    const ids = Object.keys(requestsMap);
    if(!ids.length){
      els.body.innerHTML = `<div class="mmg-chat-empty">Bekleyen bir sohbet isteğiniz yok.</div>`;
      return;
    }
    els.body.innerHTML = ids.map(id => {
      const r = requestsMap[id];
      return `<div class="mmg-chat-req-row" data-req-id="${esc(id)}" data-from-uid="${esc(r.fromUid)}" data-from-code="${esc(r.fromCode||'')}">
        <div class="who"><b>${esc(r.fromCode || '???')}</b> kodlu kullanıcı sizinle sohbet etmek istiyor.</div>
        <div class="mmg-chat-req-actions">
          <button type="button" class="mmg-chat-btn accept">Kabul Et</button>
          <button type="button" class="mmg-chat-btn decline">Reddet</button>
        </div>
      </div>`;
    }).join('');
    els.body.querySelectorAll('.mmg-chat-req-row').forEach(row => {
      const reqId = row.dataset.reqId, fromUid = row.dataset.fromUid, fromCode = row.dataset.fromCode;
      row.querySelector('.accept').addEventListener('click', () => acceptRequest(reqId, fromUid, fromCode));
      row.querySelector('.decline').addEventListener('click', () => declineRequest(reqId));
    });
  }

  function renderAddTab(){
    els.title.textContent = 'Kod ile Sohbet Ekle';
    els.body.innerHTML = `
      <div class="mmg-chat-add-form">
        <p style="font-size:12px; color:var(--muted,#8D96AC); margin-bottom:10px; line-height:1.5;">
          Arkadaşınızın Sohbet Kodu'nu girin. İsteğiniz, karşı taraf kabul ettiğinde bir sohbete dönüşür.
        </p>
        <input type="text" id="mmgChatAddInput" placeholder="ör. AB12CD" maxlength="8">
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
      msgEl.textContent = 'Bir hata oluştu, tekrar deneyin.';
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

  // ---- Açık sohbet ----
  function openChat(chatId, info){
    openChatId = chatId;
    openChatInfo = info || {};
    els.backBtn.hidden = false;
    els.footer.hidden = false;
    els.title.textContent = info && info.title ? info.title : 'Sohbet';
    els.body.innerHTML = `<div class="mmg-chat-empty">Yükleniyor…</div>`;

    // okundu bilgisini güncelle
    setDoc(doc(db, 'chats', chatId), { ['lastRead_' + currentUser.uid]: serverTimestamp() }, { merge: true }).catch(()=>{});

    if(unsubMessages) unsubMessages();
    const msgsQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    unsubMessages = onSnapshot(msgsQuery, (snap) => {
      const msgs = [];
      snap.forEach(d => msgs.push(d.data()));
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
    els.body.innerHTML = msgs.map(m => {
      const mine = m.senderUid === currentUser.uid;
      return `<div class="mmg-chat-msg ${mine ? 'me' : ''}">
        <div>
          <div class="mmg-chat-bubble">${esc(m.text)}</div>
          <div class="mmg-chat-msg-time">${fmtTime(m.createdAt)}</div>
        </div>
      </div>`;
    }).join('');
    els.body.scrollTop = els.body.scrollHeight;
  }

  async function sendCurrentMessage(){
    const text = (els.input.value || '').trim();
    if(!text || !openChatId) return;
    els.input.value = '';
    const uid = currentUser.uid;
    try{
      await addDoc(collection(db, 'chats', openChatId, 'messages'), {
        senderUid: uid,
        senderIsAdmin: !!myIsAdmin,
        text: text.slice(0, 2000),
        createdAt: serverTimestamp()
      });
      await setDoc(doc(db, 'chats', openChatId), {
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
    chatsMap = {}; requestsMap = {}; openChatId = null;
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
    try{
      const uref = doc(db, 'users', user.uid);
      const usnap = await getDoc(uref);
      myIsAdmin = usnap.exists() && usnap.data().isAdmin === true;
      myChatCode = await ensureChatCode(user.uid);
      els.codeBox.innerHTML = myChatCode ? `Sizin Sohbet Kodunuz: <b>${esc(myChatCode)}</b>` : '';
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
