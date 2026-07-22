/* ==========================================================================
   mmgcreativity — Beğen / Geri Bildirim Widget'ı (TÜM sayfalarda ortak)
   --------------------------------------------------------------------------
   Kullanım: Her sayfanın </body> etiketinden hemen önce şu satırı ekleyin:
     <script src="mmg-feedback-widget.js"></script>

   Notlar:
   - Bu script kendi HTML/CSS'ini otomatik olarak sayfaya enjekte eder,
     ayrıca bir şey eklemenize gerek yoktur.
   - Firestore'a yazabilmesi için sayfada daha önce window.mmgCloud
     (auth, db, doc, setDoc, currentUser) kurulmuş olması gerekir — bu obje
     zaten her araç sayfasındaki Firebase init bloğunda tanımlanıyor.
   - Geri bildirim sadece GİRİŞ YAPMIŞ kullanıcılar için Firestore'a
     kaydedilir (misafir kullanıcıların beğenisi kaydedilmez — bu bilinen
     bir sınırlamadır).
   - "page" alanı artık widget'ın çalıştığı GERÇEK sayfa adını yazar
     (location.pathname üzerinden), böylece Giderler.html, Gelirler.html
     gibi ayrı sayfalardan gelen geri bildirimler doğru etiketlenir.
   - userId alanı ayrıca kaydedilir, böylece istatistik panelinde
     "kim beğendi / yorum yaptı" bilgisi gösterilebilir.
========================================================================== */
(function(){
  if(window.__mmgFeedbackWidgetLoaded) return; // aynı sayfada iki kez yüklenmesin
  window.__mmgFeedbackWidgetLoaded = true;

  const CSS = `
  #mmgRateOverlay{
    position:fixed; inset:0; z-index:900; background:rgba(5,8,14,0.65);
    display:flex; align-items:center; justify-content:center; padding:20px;
  }
  #mmgRateOverlay[hidden]{ display:none; }
  #mmgRatePanel{
    position:relative; width:100%; max-width:360px; background:var(--surface,#141C2B);
    border:1px solid var(--hairline,#2A3448); border-radius:18px; padding:28px 24px;
    box-shadow:0 24px 60px rgba(0,0,0,0.5); font-family:'Inter',sans-serif;
  }
  #mmgRateCloseBtn{
    position:absolute; top:14px; right:14px; background:none; border:none;
    color:var(--muted,#8D96AC); cursor:pointer; font-size:14px; padding:4px;
  }
  #mmgRateCloseBtn:hover{ color:var(--text,#EAEDF3); }
  .mmg-rate-title{
    font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:18px; color:var(--text,#EAEDF3);
    margin-bottom:16px; text-align:center;
  }
  .mmg-rate-sub{
    font-size:13px; color:var(--muted,#8D96AC); text-align:center; margin-bottom:20px; line-height:1.5;
  }
  .mmg-rate-thumbs{ display:flex; gap:12px; margin-bottom:16px; }
  .mmg-rate-thumb{
    flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;
    background:var(--surface-2,#1B2536); border:1.5px solid var(--hairline,#2A3448); border-radius:12px;
    color:var(--muted,#8D96AC); padding:16px 0; cursor:pointer; transition:all .15s ease;
    font-family:'Inter',sans-serif; font-size:13px; font-weight:600;
  }
  .mmg-rate-thumb:hover{ border-color:var(--brass-dim,#8A7440); color:var(--text,#EAEDF3); }
  .mmg-rate-thumb.active#mmgThumbUp{ border-color:var(--teal,#3FB68A); color:var(--teal,#3FB68A); background:rgba(63,182,138,0.1); }
  .mmg-rate-thumb.active#mmgThumbDown{ border-color:var(--red,#E2544B); color:var(--red,#E2544B); background:rgba(226,84,75,0.1); }
  .mmg-rate-comment{
    width:100%; box-sizing:border-box; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);
    border-radius:8px; padding:10px 12px; color:var(--text,#EAEDF3); font-family:'Inter',sans-serif; font-size:13px;
    resize:vertical; outline:none; margin-bottom:14px;
  }
  .mmg-rate-comment:focus{ border-color:var(--brass-dim,#8A7440); }
  .mmg-rate-comment::placeholder{ color:var(--muted,#8D96AC); }
  .mmg-rate-actions{ display:flex; flex-direction:column; gap:10px; }
  .mmg-rate-btn-primary{
    display:block; width:100%; box-sizing:border-box; text-align:center; background:var(--brass,#C6A15B); color:#1a1a1a; border:none;
    border-radius:8px; padding:12px 0; font-family:'Inter',sans-serif; font-weight:700; font-size:14px;
    cursor:pointer; text-decoration:none; transition:opacity .15s ease;
  }
  .mmg-rate-btn-primary:hover{ opacity:0.9; }
  .mmg-rate-btn-secondary{
    background:none; border:none; color:var(--muted,#8D96AC); font-family:'Inter',sans-serif; font-size:12.5px;
    cursor:pointer; text-decoration:underline; padding:4px;
  }
  .mmg-rate-btn-secondary:hover{ color:var(--text,#EAEDF3); }
  @media print{ #mmgRateOverlay{ display:none !important; } }
  `;

  const HTML = `
  <div id="mmgRateOverlay" hidden>
    <div id="mmgRatePanel">
      <button type="button" id="mmgRateCloseBtn" aria-label="Kapat">✕</button>
      <div id="mmgRateStepScore">
        <div class="mmg-rate-title">Sitemizi beğendiniz mi?</div>
        <div class="mmg-rate-thumbs">
          <button type="button" class="mmg-rate-thumb" id="mmgThumbUp" data-liked="1">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.6a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18 10h-5.6l.9-4.4a1.7 1.7 0 0 0-3-1.4L7 11"/></svg>
            <span>Evet</span>
          </button>
          <button type="button" class="mmg-rate-thumb" id="mmgThumbDown" data-liked="0">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 2v11M22 11V4a2 2 0 0 0-2-2H7.4a2 2 0 0 0-2 1.7l-1.3 8A2 2 0 0 0 6 14h5.6l-.9 4.4a1.7 1.7 0 0 0 3 1.4L17 13"/></svg>
            <span>Hayır</span>
          </button>
        </div>
        <textarea id="mmgRateComment" class="mmg-rate-comment" placeholder="Yorumunuz (opsiyonel)" rows="3"></textarea>
        <button type="button" class="mmg-rate-btn-primary" id="mmgRateSubmitBtn">Gönder</button>
      </div>
      <div id="mmgRateStepStore" hidden>
        <div class="mmg-rate-title">Teşekkürler! 🎉</div>
        <div class="mmg-rate-sub">Bu memnuniyetinizi Play Store'da da bizimle paylaşır mısınız? Yorumunuz bizim için çok değerli.</div>
        <div class="mmg-rate-actions">
          <a href="https://play.google.com/store/apps/details?id=com.mmgcreativity.dijitalfinans" target="_blank" rel="noopener" class="mmg-rate-btn-primary" id="mmgRatePlayStoreBtn">Play Store'a Git</a>
          <button type="button" class="mmg-rate-btn-secondary" id="mmgRateSkipBtn">Belki Sonra</button>
        </div>
      </div>
      <div id="mmgRateStepThanks" hidden>
        <div class="mmg-rate-title">Teşekkürler!</div>
        <div class="mmg-rate-sub">Geri bildiriminiz bize ulaştı, uygulamayı geliştirmemize yardımcı oluyor.</div>
      </div>
    </div>
  </div>`;

  function inject(){
    const styleTag = document.createElement('style');
    styleTag.id = 'mmgRateStyle';
    styleTag.textContent = CSS;
    document.head.appendChild(styleTag);

    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap.firstElementChild);

    initWidget();
  }

  function initWidget(){
    const overlay = document.getElementById('mmgRateOverlay');
    const closeBtn = document.getElementById('mmgRateCloseBtn');
    const stepScore = document.getElementById('mmgRateStepScore');
    const stepStore = document.getElementById('mmgRateStepStore');
    const stepThanks = document.getElementById('mmgRateStepThanks');
    const skipBtn = document.getElementById('mmgRateSkipBtn');
    const thumbUp = document.getElementById('mmgThumbUp');
    const thumbDown = document.getElementById('mmgThumbDown');
    const commentBox = document.getElementById('mmgRateComment');
    const submitBtn = document.getElementById('mmgRateSubmitBtn');

    // Beğeni kutusu: ayın 1'inde bir kez otomatik gösterilir, o ay için tekrar gösterilmez.
    const MMG_RATE_THIS_MONTH = new Date().toISOString().slice(0,7);
    function markShownToday(){
      try{ localStorage.setItem('mmg_rate_btn_interacted_date', MMG_RATE_THIS_MONTH); }catch(e){}
    }

    let likedValue = null;

    function selectThumb(val){
      likedValue = val;
      thumbUp.classList.toggle('active', val === 1);
      thumbDown.classList.toggle('active', val === 0);
    }
    thumbUp.addEventListener('click', () => { selectThumb(1); submitFeedback(); });
    thumbDown.addEventListener('click', () => { selectThumb(0); submitFeedback(); });

    function openOverlay(){
      stepScore.hidden = false;
      stepStore.hidden = true;
      stepThanks.hidden = true;
      selectThumb(null);
      commentBox.value = '';
      overlay.hidden = false;
      markShownToday();
    }
    function closeOverlay(){ overlay.hidden = true; }

    async function submitFeedback(){
      if(likedValue === null){
        thumbUp.style.borderColor = 'var(--red,#E2544B)';
        thumbDown.style.borderColor = 'var(--red,#E2544B)';
        setTimeout(() => { thumbUp.style.borderColor=''; thumbDown.style.borderColor=''; }, 900);
        return;
      }
      const comment = commentBox.value.trim();
      try{ if(typeof gtag === 'function') gtag('event', 'feedback_given', { liked: !!likedValue, has_comment: !!comment }); }catch(gtagErr){}
      try{ localStorage.setItem('mmg_feedback_liked', String(likedValue)); }catch(e){}
      try{ localStorage.setItem('mmg_feedback_comment', comment); }catch(e){}
      try{ localStorage.setItem('mmg_feedback_date', new Date().toISOString()); }catch(e){}

      try{
        if(window.mmgCloud && window.mmgCloud.currentUser && window.mmgCloud.setDoc && window.mmgCloud.doc){
          const cloud = window.mmgCloud;
          const pageName = (location.pathname.split('/').pop() || 'index.html');
          await cloud.setDoc(cloud.doc(cloud.db, 'feedback', cloud.currentUser.uid + '_' + Date.now()), {
            userId: cloud.currentUser.uid,
            userEmail: cloud.currentUser.email || null,
            liked: !!likedValue,
            comment: comment || null,
            page: pageName,
            ratedAt: new Date().toISOString()
          }, { merge: true });
        }
      }catch(e){ /* sessizce geç */ }

      stepScore.hidden = true;
      if(likedValue === 1){
        stepStore.hidden = false;
      } else {
        stepThanks.hidden = false;
      }
    }

    submitBtn.addEventListener('click', submitFeedback);
    closeBtn.addEventListener('click', closeOverlay);
    skipBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeOverlay(); });

    // Sadece ayın 1'inde, o ay için henüz gösterilmediyse kutuyu otomatik aç.
    try{
      const isFirstOfMonth = new Date().getDate() === 1;
      if(isFirstOfMonth && localStorage.getItem('mmg_rate_btn_interacted_date') !== MMG_RATE_THIS_MONTH){
        setTimeout(openOverlay, 1500);
      }
    }catch(e){}

    // Dışarıdan manuel tetiklemek isterseniz (örn. bir "Geri bildirim ver" butonuna bağlamak için):
    window.mmgOpenFeedbackWidget = openOverlay;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
