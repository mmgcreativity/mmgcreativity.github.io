/* ==========================================================================
   mmgcreativity — Hesap Makinesi Widget'i (tum sayfalarda ortak)
   Eskiden her arac sayfasinin ICINDE ayri ayri tanimliydi; masaustunde araclar
   iframe icinde acildigi icin buton IFRAME'in sag ustune sabitleniyor ve sayfa
   icerigiyle CAKISIYORDU (kullanici: "kur ve hesap makinesi widget lari asagi
   geldi kaydirinca"). Artik ortak dosya: dis kabuk (index.html) yukleyince
   pencerenin gercek sag ustunde durur.
   Gizleme tercihi: localStorage['mmg_widgets_hidden'] === '1' ise hic basilmaz
   (sayfada bos alana sag tiklayinca cikan menuden acilip kapatilir).
   ========================================================================== */
(function(){
  'use strict';
  if(document.getElementById('mmgCalcBtn')) return;                 // tek ornek
  // NOT: Gizleme mmg-widget-menu.js içinde CSS ile yapılır (anında etki için).

  var style = document.createElement('style');
  style.textContent = `  #mmgCalcBtn{
    position:fixed; top:16px; right:16px; z-index:800;
    width:42px; height:42px; border-radius:11px; border:1px solid var(--hairline,#2A3448);
    background:var(--surface-2,#1B2536); color:var(--brass,#C6A15B); font-size:19px;
    cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.35);
    display:flex; align-items:center; justify-content:center; transition:border-color .15s ease, transform .15s ease;
  }
  #mmgCalcBtn:hover{ border-color:var(--brass-dim,#8A7440); transform:translateY(-1px); }
  #mmgCalcPanel{
    position:fixed; top:64px; right:16px; z-index:801; width:236px;
    background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448); border-radius:14px;
    padding:14px; box-shadow:0 24px 60px rgba(0,0,0,0.5); font-family:'IBM Plex Mono',monospace;
  }
  #mmgCalcPanel[hidden]{ display:none; }
  .mmg-calc-head{
    display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;
    font-size:11.5px; color:var(--muted,#8D96AC); text-transform:uppercase; letter-spacing:.06em;
  }
  #mmgCalcCloseBtn{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:13px; padding:2px 4px;
  }
  #mmgCalcCloseBtn:hover{ color:var(--text,#EAEDF3); }
  #mmgCalcDisplay{
    width:100%; box-sizing:border-box; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);
    border-radius:8px; padding:12px 10px; color:var(--text,#EAEDF3); font-size:22px; text-align:right;
    margin-bottom:10px; font-family:'IBM Plex Mono',monospace;
  }
  .mmg-calc-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
  .mmg-calc-btn{
    background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); border-radius:8px;
    color:var(--text,#EAEDF3); font-family:'IBM Plex Mono',monospace; font-size:15px; font-weight:600;
    padding:10px 0; cursor:pointer; transition:border-color .15s ease, background .15s ease;
  }
  .mmg-calc-btn:hover{ border-color:var(--brass-dim,#8A7440); background:var(--surface,#141C2B); }
  .mmg-calc-op{ color:var(--brass,#C6A15B); }
  .mmg-calc-eq{ background:var(--brass,#C6A15B); border-color:var(--brass,#C6A15B); color:#1a1a1a; }
  .mmg-calc-eq:hover{ opacity:0.9; }
    #mmgCalcPanel{ right:8px; left:8px; width:auto; }
    #mmgCalcBtn{ right:8px; }
@media (max-width:480px){
    #mmgCalcPanel{ right:8px; left:8px; width:auto; }
    #mmgCalcBtn{ right:8px; }
  }
`;
  document.head.appendChild(style);

  var host = document.createElement('div');
  host.innerHTML = `<button id="mmgCalcBtn" title="Hesap Makinesi" aria-label="Hesap Makinesi">🧮</button>
<div id="mmgCalcPanel" hidden>
  <div class="mmg-calc-head">
    <span>Hesap Makinesi</span>
    <button type="button" id="mmgCalcCloseBtn" aria-label="Kapat">✕</button>
  </div>
  <input id="mmgCalcDisplay" readonly value="0">
  <div class="mmg-calc-grid">
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-act="clear">C</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-act="back">⌫</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-act="percent">%</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-op="/">÷</button>

    <button type="button" class="mmg-calc-btn" data-num="7">7</button>
    <button type="button" class="mmg-calc-btn" data-num="8">8</button>
    <button type="button" class="mmg-calc-btn" data-num="9">9</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-op="*">×</button>

    <button type="button" class="mmg-calc-btn" data-num="4">4</button>
    <button type="button" class="mmg-calc-btn" data-num="5">5</button>
    <button type="button" class="mmg-calc-btn" data-num="6">6</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-op="-">−</button>

    <button type="button" class="mmg-calc-btn" data-num="1">1</button>
    <button type="button" class="mmg-calc-btn" data-num="2">2</button>
    <button type="button" class="mmg-calc-btn" data-num="3">3</button>
    <button type="button" class="mmg-calc-btn mmg-calc-op" data-op="+">+</button>

    <button type="button" class="mmg-calc-btn" data-num="0" style="grid-column:span 2;">0</button>
    <button type="button" class="mmg-calc-btn" data-act="dot">,</button>
    <button type="button" class="mmg-calc-btn mmg-calc-eq" data-act="equals">=</button>
  </div>
</div>
<style>
  #mmgCalcBtn{
    position:fixed; top:16px; right:16px; z-index:800;
    width:42px; height:42px; border-radius:11px; border:1px solid var(--hairline,#2A3448);
    background:var(--surface-2,#1B2536); color:var(--brass,#C6A15B); font-size:19px;
    cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.35);
    display:flex; align-items:center; justify-content:center; transition:border-color .15s ease, transform .15s ease;
  }
  #mmgCalcBtn:hover{ border-color:var(--brass-dim,#8A7440); transform:translateY(-1px); }
  #mmgCalcPanel{
    position:fixed; top:64px; right:16px; z-index:801; width:236px;
    background:var(--surface,#141C2B); border:1px solid var(--hairline,#2A3448); border-radius:14px;
    padding:14px; box-shadow:0 24px 60px rgba(0,0,0,0.5); font-family:'IBM Plex Mono',monospace;
  }
  #mmgCalcPanel[hidden]{ display:none; }
  .mmg-calc-head{
    display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;
    font-size:11.5px; color:var(--muted,#8D96AC); text-transform:uppercase; letter-spacing:.06em;
  }
  #mmgCalcCloseBtn{
    background:none; border:none; color:var(--muted,#8D96AC); cursor:pointer; font-size:13px; padding:2px 4px;
  }
  #mmgCalcCloseBtn:hover{ color:var(--text,#EAEDF3); }
  #mmgCalcDisplay{
    width:100%; box-sizing:border-box; background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448);
    border-radius:8px; padding:12px 10px; color:var(--text,#EAEDF3); font-size:22px; text-align:right;
    margin-bottom:10px; font-family:'IBM Plex Mono',monospace;
  }
  .mmg-calc-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:7px; }
  .mmg-calc-btn{
    background:var(--surface-2,#1B2536); border:1px solid var(--hairline,#2A3448); border-radius:8px;
    color:var(--text,#EAEDF3); font-family:'IBM Plex Mono',monospace; font-size:15px; font-weight:600;
    padding:10px 0; cursor:pointer; transition:border-color .15s ease, background .15s ease;
  }
  .mmg-calc-btn:hover{ border-color:var(--brass-dim,#8A7440); background:var(--surface,#141C2B); }
  .mmg-calc-op{ color:var(--brass,#C6A15B); }
  .mmg-calc-eq{ background:var(--brass,#C6A15B); border-color:var(--brass,#C6A15B); color:#1a1a1a; }
  .mmg-calc-eq:hover{ opacity:0.9; }
  @media (max-width:480px){
    #mmgCalcPanel{ right:8px; left:8px; width:auto; }
    #mmgCalcBtn{ right:8px; }
  }
</style>
`;
  while(host.firstChild) document.body.appendChild(host.firstChild);

  
  const btn = document.getElementById('mmgCalcBtn');
  const panel = document.getElementById('mmgCalcPanel');
  const closeBtn = document.getElementById('mmgCalcCloseBtn');
  const display = document.getElementById('mmgCalcDisplay');

  let current = '0';
  let previous = null;
  let operator = null;
  let justEvaluated = false;

  function render(){
    display.value = current.replace('.', ',');
  }

  function inputNum(n){
    if(justEvaluated){ current = '0'; justEvaluated = false; }
    if(current === '0' && n !== ','){ current = String(n); }
    else { current += String(n); }
    render();
  }

  function inputDot(){
    if(justEvaluated){ current = '0'; justEvaluated = false; }
    if(!current.includes('.')) current += '.';
    render();
  }

  function clearAll(){
    current = '0'; previous = null; operator = null; justEvaluated = false;
    render();
  }

  function backspace(){
    if(justEvaluated){ clearAll(); return; }
    current = current.length > 1 ? current.slice(0, -1) : '0';
    render();
  }

  function percent(){
    current = String(parseFloat(current) / 100);
    render();
  }

  function chooseOperator(op){
    if(operator !== null && !justEvaluated) compute();
    previous = current;
    operator = op;
    justEvaluated = false;
    current = '0';
  }

  function compute(){
    if(operator === null || previous === null) return;
    const a = parseFloat(previous), b = parseFloat(current);
    let result = 0;
    switch(operator){
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/': result = b !== 0 ? a / b : 0; break;
    }
    current = String(Math.round(result * 1e10) / 1e10);
    operator = null;
    previous = null;
    justEvaluated = true;
    render();
  }

  document.querySelectorAll('.mmg-calc-btn').forEach(b => {
    b.addEventListener('click', () => {
      const num = b.dataset.num;
      const op = b.dataset.op;
      const act = b.dataset.act;
      if(num !== undefined) inputNum(num);
      else if(op !== undefined) chooseOperator(op);
      else if(act === 'clear') clearAll();
      else if(act === 'back') backspace();
      else if(act === 'percent') percent();
      else if(act === 'dot') inputDot();
      else if(act === 'equals') compute();
    });
  });

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });
  closeBtn.addEventListener('click', () => { panel.hidden = true; });
  document.addEventListener('click', (e) => {
    if(!panel.hidden && !panel.contains(e.target) && e.target !== btn){
      panel.hidden = true;
    }
  });

})();
