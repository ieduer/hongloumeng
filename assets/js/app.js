/* ==============================================================
   《紅樓夢》章節 + 海龜湯互動腳本 2025-06-13 修正版
   ============================================================== */

/* ---------- 全局狀態 ---------- */
let conversationHistory = [];
let currentChapterData  = null;
let initialContentInfo  = null;
let hongloumengData     = null;
let shiciData           = null;

let currentTurtleSoup = null;   // {question, answer}
let puzzleSolved      = false;

/* ---------- DOM ---------- */
const $msg   = document.getElementById('messages');
const $in    = document.getElementById('user-input');
const $send  = document.getElementById('chat-button');
const $menu  = document.getElementById('chapter-menu');
const $dark  = document.getElementById('toggle-dark-btn');
const emojis = ['😼','🐶','🦊','🐻','🐼','🐰','🐯','🦉','🍁','🏮'];

/* ---------- 初始化 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  Promise.all([
    fetch('data/hongloumeng.json').then(r=>r.ok?r.json():Promise.reject(r.status)),
    fetch('data/shici.json').then(r=>r.ok?r.json():Promise.reject(r.status))
  ])
  .then(([hlm, sc]) => { hongloumengData=hlm; shiciData=sc;
    loadInitialPoem(); loadChapterMenu(); })
  .catch(e => { console.error(e);
    append('ai',`<p style="color:red;">初始化錯誤：${e}</p>`); $send.disabled=true; });

  if(localStorage.getItem('theme')==='dark')
    document.body.classList.add('dark-mode');
});

/* ==============================================================
   章節目錄
   ============================================================== */
function loadChapterMenu(){
  if(!hongloumengData?.chapters){
    $menu.innerHTML='<p style="color:red;">目錄載入失敗</p>'; return; }
  $menu.innerHTML='';
  hongloumengData.chapters.forEach(ch=>{
    const b=document.createElement('button');
    b.textContent=`${ch.chapter}  ${ch.title}`;
    b.onclick=()=>loadChapter(ch);
    $menu.appendChild(b);
  });
}

/* ==============================================================
   首頁隨機詩詞
   ============================================================== */
function loadInitialPoem(){
  resetState();
  const list=shiciData;
  if(!list?.length){ append('ai','暫無詩詞'); return;}
  const e=list[Math.floor(Math.random()*list.length)];
  const {title,poem_text,explanation}=e.details;
  const html=`<h3>${title}</h3>
<div class="poem-like-block">${poem_text.join('<br>')}</div>`+
(explanation?`<strong>【註解】</strong>${formatDisplay(explanation,false)}`:'');
  append('ai',`偶隨書頁翻，拾得片語詩箋：\n\n${html}`,['initial-poem']);
  initialContentInfo={title};
}

/* ==============================================================
   顯示章節 ⇒ 產生海龜湯
   ============================================================== */
function loadChapter(ch){
  resetState(); currentChapterData=ch;
  append('ai',`<h3>${ch.chapter}  ${ch.title}</h3>\n${formatDisplay(ch.content,true)}`,['chapter-display']);
  conversationHistory.push({role:'ai',content:`(展示${ch.chapter}${ch.title}全文)`});
  genTurtleSoup(ch);
}
function genTurtleSoup(ch){
  loading('Gemini 正烹製海龜湯…');
  const prompt=`
你是曹雪芹。請依據《紅樓夢》${ch.chapter} ${ch.title} 的情節，設計一題海龜湯：
【謎面】模糊描述
【謎底】完整情節（僅供你判斷）

之後「客官」可提出 *能以「是／否／無關」回答* 的問題，
你只能回答「是」「否」「無關」。
當對方猜中謎底，回覆「恭喜你解開謎題！」並簡短解釋。`;
  askLLM(prompt,false,res=>{
    loading(false);
    currentTurtleSoup=parsePuzzle(res);
    if(!currentTurtleSoup){ append('ai','謎題生成失敗'); return;}
    append('ai',`<strong>🌊 海龜湯謎題：</strong><br>${currentTurtleSoup.question}<br><small style="color:#888;">（請提出能以「是／否／無關」回答的問題）</small>`);
    conversationHistory.push({role:'ai',content:`(謎面:${currentTurtleSoup.question};謎底:${currentTurtleSoup.answer})`});
  });
}
function parsePuzzle(t){
  const m=t.match(/【謎面】\s*([\s\S]*?)\s*【謎底】\s*([\s\S]*)/);
  return m?{question:m[1].trim(),answer:m[2].trim()}:null;
}

/* ==============================================================
   用戶訊息
   ============================================================== */
$send.addEventListener('click',sendMsg);
$in.addEventListener('keypress',e=>{
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(); }});

function sendMsg(){
  const txt=$in.value.trim(); if(!txt) return;
  append('user',txt); $in.value='';
  conversationHistory.push({role:'user',content:txt}); trimHist(20);

  /* —— 海龜湯互動 —— */
  if(currentTurtleSoup&&!puzzleSolved){
    loading('思索中…');
    const puzzlePrompt=`【謎面】${currentTurtleSoup.question}
【謎底】${currentTurtleSoup.answer}
客官問題：「${txt}」
僅回答「是」「否」「無關」。若對方已猜中則祝賀並解釋。`;
    askLLM(puzzlePrompt,true,res=>{
      loading(false);
      const ok=/^(是|否|無關)/.test(res.trim())||res.includes('恭喜你解開謎題');
      append('ai',res + (ok?'':`<br><small style="color:#888;">（請僅回答「是／否／無關」）</small>`));
      conversationHistory.push({role:'model',content:res});
      if(res.includes('恭喜你解開謎題')) puzzleSolved=true;
    });
    return;
  }

  /* —— 普通對話 —— */
  loading('Gemini 回覆中…');
  askLLM(buildPrompt(txt),false,res=>{
    loading(false); append('ai',res);
    conversationHistory.push({role:'model',content:res}); trimHist(20);
  });
}

/* ==============================================================
   格式化
   ============================================================== */
function formatDisplay(text,isChapter){
  if(!text) return '';
  let t=text.replace(/\r\n?/g,'\n').trim();

  // Markdown
  t=t.replace(/^### (.*)$/gim,'<h3>$1</h3>')
     .replace(/^## (.*)$/gim,'<h2>$1</h2>')
     .replace(/^# (.*)$/gim ,'<h1>$1</h1>')
     .replace(/\*\*\*(.*?)\*\*\*/g,'<strong><em>$1</em></strong>')
     .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
     .replace(/\*(.*?)\*/g,'<em>$1</em>');

  // list
  t=t.replace(/^(?:[\*\-]\s+.*(?:\n|$))+/gm,m=>`<ul>${m.trim().split('\n').map(l=>`<li>${l.replace(/^[\*\-]\s+/,'')}</li>`).join('')}</ul>`);
  t=t.replace(/^(?:\d+\.\s+.*(?:\n|$))+/gm,m=>`<ol>${m.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\.\s+/,'')}</li>`).join('')}</ol>`);

  const blocks=t.split(/\n\s*\n+/).map(b=>b.trim()).filter(Boolean);
  const html=blocks.map(b=>{
    if(/^<(h[1-6]|ul|ol|blockquote|pre)/i.test(b)) return b;
    if(isChapter){
      const p=b.replace(/([。？！])/g,'$1<br>').replace(/<br>$/,'');
      return `<p style="text-indent:2em;">${p}</p>`;
    }
    return `<p>${b.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  return html.replace(/<p>\s*<\/p>/g,'');
}

/* ==============================================================
   UI 輔助
   ============================================================== */
function append(role,html,cls=[]){
  const d=document.createElement('div');
  d.classList.add('message-bubble',role==='user'?'user-message':'ai-message',...cls);
  d.innerHTML=html.includes('<')?html:`<p>${html.replace(/</g,'<').replace(/>/g,'>').replace(/\n/g,'<br>')}</p>`;
  $msg.appendChild(d); $msg.scrollTop=$msg.scrollHeight;
}
function loading(txt){ txt?show(txt):hide(); }
function show(txt){
  hide(); const s=document.createElement('div');
  s.id='load'; s.className='loading-indicator';
  s.innerHTML=`<strong>${txt}</strong><span>${emojis[Math.floor(Math.random()*emojis.length)]}</span>`;
  $msg.appendChild(s); $msg.scrollTop=$msg.scrollHeight;
}
function hide(){ document.getElementById('load')?.remove(); }

function buildPrompt(newMsg){
  let p='你是曹雪芹，古雅口吻應答。\n\n';
  if(currentChapterData) p+=`【章節】${currentChapterData.chapter} ${currentChapterData.title}\n\n`;
  const hist=conversationHistory.filter(x=>x.role!=='ai').slice(-8);
  if(hist.length) p+='【對話】\n'+hist.map(h=>`${h.role==='user'?'客官':'老夫'}: ${h.content.replace(/<[^>]*>/g,' ').slice(0,120)}\n`).join('')+'\n';
  return p+`客官: ${newMsg}\n\n曹雪芹:`;
}
function trimHist(n){ if(conversationHistory.length>n) conversationHistory.splice(0,conversationHistory.length-n);}
function resetState(){
  $msg.innerHTML='';
  conversationHistory=[]; currentChapterData=null;
  currentTurtleSoup=null; puzzleSolved=false; initialContentInfo=null;
}

/* ==============================================================
   Gemini API — expectYN=true 代表海龜湯回答
   ============================================================== */
function askLLM(prompt, expectYN, cb){
  fetch('https://ai.bdfz.net/',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({prompt})
  })
  .then(r=>r.ok?r.json():r.text().then(t=>{throw new Error(t||r.status);}))

  .then(j=>{
    let ans=j.answer?.trim()||'';
    if(expectYN && !ans) ans='無關';          // 被過濾 ⇒ 自動『無關』
    cb(ans||'…老夫一時語塞。');
  })
  .catch(e=>{
    console.error(e);
    cb(expectYN ? '無關' : `<span style="color:red;">後端錯誤：${e.message}</span>`);
  });
}

/* ==============================================================
   黑暗模式
   ============================================================== */
$dark.addEventListener('click',()=>{
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme',
    document.body.classList.contains('dark-mode')?'dark':'light');
});