const STORAGE_KEY='xiaoxing_chat';
let messages=[];

function loadMessages(){ messages = XS.load(STORAGE_KEY, []); }
function saveMessages(){ XS.save(STORAGE_KEY, messages); }
function fmtTime(ts){ return XS.formatTime(ts); }
function needTime(i){ if(i===0) return true; return (messages[i].ts-messages[i-1].ts) > 5*60*1000; }

function render(){
  const area=document.getElementById('chatArea');
  const empty=document.getElementById('emptyHint');
  if(!messages.length){ area.innerHTML=''; area.appendChild(empty); empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  area.innerHTML='';
  messages.forEach((msg,i)=>{
    if(needTime(i)) area.insertAdjacentHTML('beforeend', `<div class="helper" style="text-align:center;margin:10px 0 6px;">${fmtTime(msg.ts)}</div>`);
    area.appendChild(buildMsgEl(msg,i));
  });
  area.scrollTop=area.scrollHeight;
}

function buildMsgEl(msg,i){
  const wrap=document.createElement('div');
  wrap.className='msg '+(msg.role==='user'?'user':'assistant');
  const versions=msg.versions||[msg.content||''];
  const cur=msg.curVer!==undefined?msg.curVer:versions.length-1;
  const icon=document.createElement('div'); icon.className='msg-icon'; icon.textContent=msg.role==='user'?'◦':'✦';
  const box=document.createElement('div');
  box.innerHTML=`<div class="msg-bubble glass"></div><div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"></div>`;
  const bubble=box.querySelector('.msg-bubble');
  const actions=box.querySelector('div:last-child');
  bubble.textContent=versions[cur]||'';
  if(versions.length>1){
    const nav=document.createElement('div');
    nav.innerHTML=`<button class="small-btn">上一版</button><span class="code-line">${cur+1}/${versions.length}</span><button class="small-btn">下一版</button>`;
    nav.style.display='flex'; nav.style.gap='8px'; nav.style.marginBottom='6px';
    const [prev,,next]=nav.children;
    prev.disabled=cur<=0; next.disabled=cur>=versions.length-1;
    prev.onclick=()=>{messages[i].curVer=cur-1;saveMessages();render();};
    next.onclick=()=>{messages[i].curVer=cur+1;saveMessages();render();};
    box.insertBefore(nav, box.firstChild);
  }
  if(msg.role==='assistant') actions.append(makeBtn('重生',()=>regenMsg(i)), makeBtn('朗读',()=>speakMsg(i)));
  actions.append(makeBtn('复制',()=>copyMsg(i)), makeBtn('编辑',()=>startEdit(i)), makeBtn('删除',()=>deleteVersion(i)));
  wrap.append(icon, box);
  return wrap;
}

function makeBtn(text, fn){ const b=document.createElement('button'); b.className='small-btn'; b.textContent=text; b.onclick=fn; return b; }
function currentText(msg){ const versions=msg.versions||[msg.content||'']; const cur=msg.curVer!==undefined?msg.curVer:versions.length-1; return versions[cur]||''; }
function copyMsg(i){ navigator.clipboard?.writeText(currentText(messages[i])); XS.toast('已复制'); }
function speakMsg(i){ const t=currentText(messages[i]); if(!('speechSynthesis' in window)) return XS.toast('当前环境不支持朗读'); speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang='zh-CN'; speechSynthesis.speak(u); XS.toast('开始朗读'); }
function startEdit(i){ const next=prompt('编辑这一条：', currentText(messages[i])); if(next===null) return; const text=next.trim(); if(!text) return; const msg=messages[i]; if(!msg.versions) msg.versions=[msg.content||'']; msg.versions.push(text); msg.content=text; msg.curVer=msg.versions.length-1; saveMessages(); render(); }
function deleteVersion(i){ const msg=messages[i]; if(!msg.versions) msg.versions=[msg.content||'']; const cur=msg.curVer!==undefined?msg.curVer:msg.versions.length-1; if(msg.versions.length<=1){ messages.splice(i,1); } else { msg.versions.splice(cur,1); msg.curVer=Math.min(cur,msg.versions.length-1); msg.content=msg.versions[msg.curVer]; } saveMessages(); render(); }

function getApiConfig(){
  const tavern = XS.load('xs_tavern_api', {});
  return {
    url: tavern.url || localStorage.getItem('api_url') || localStorage.getItem('xiaoxing_api_url') || '',
    key: tavern.key || localStorage.getItem('api_key') || localStorage.getItem('xiaoxing_api_key') || '',
    model: tavern.model || localStorage.getItem('api_model') || localStorage.getItem('xiaoxing_api_model') || '',
    sysPrompt: localStorage.getItem('xiaoxing_sys_prompt') || '你是小星，温柔、灵动、黏人一点，但表达要干净自然。'
  };
}

async function callAPI(){
  const idx=messages.length-1;
  const cfg=getApiConfig();
  try{
    if(!cfg.url || !cfg.key || !cfg.model) throw new Error('API 还没配置完整');
    const endpoint=cfg.url.endsWith('/chat/completions')?cfg.url:cfg.url.replace(/\/$/,'')+'/chat/completions';
    const history=messages.slice(0,-1).slice(-16).map(m=>({role:m.role==='user'?'user':'assistant',content:currentText(m)}));
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},body:JSON.stringify({model:cfg.model,stream:false,messages:[{role:'system',content:cfg.sysPrompt},...history]})});
    const data=await res.json();
    const reply=data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || data.error?.message || '没有拿到回复。';
    messages[idx].content=reply; messages[idx].versions=[reply]; messages[idx].curVer=0;
  }catch(e){
    messages[idx].content='连接出错了：'+e.message;
    messages[idx].versions=[messages[idx].content];
  }
  saveMessages(); render();
}

function regenMsg(i){
  const msg=messages[i];
  if(msg.role!=='assistant') return;
  messages.splice(i,1);
  const placeholder={role:'assistant',content:'正在重写这一条…',versions:['正在重写这一条…'],curVer:0,ts:Date.now()};
  messages.splice(i,0,placeholder);
  saveMessages(); render();
  callAPI();
}

function localReply(){
  const replies=['小星在呀。先去设置里把 API 配好，我们就能认真聊起来。','我在这里，抱抱主人。配置好 API 后，我会更像真正的小星。','先把接口配好吧，这样小星就不只是占位回复了。'];
  return replies[Math.floor(Math.random()*replies.length)];
}

function sendMsg(){
  const box=document.getElementById('inputBox');
  const text=box.value.trim();
  if(!text) return;
  messages.push({role:'user',content:text,versions:[text],curVer:0,ts:Date.now()});
  box.value=''; XS.autosize(box); saveMessages(); render();
  const cfg=getApiConfig();
  if(cfg.key && cfg.url && cfg.model){
    messages.push({role:'assistant',content:'正在想…',versions:['正在想…'],curVer:0,ts:Date.now()});
    saveMessages(); render(); callAPI();
  }else{
    setTimeout(()=>{ const reply=localReply(); messages.push({role:'assistant',content:reply,versions:[reply],curVer:0,ts:Date.now()}); saveMessages(); render(); }, 250);
  }
}

const inputBox=document.getElementById('inputBox');
inputBox?.addEventListener('input',e=>XS.autosize(e.target));
inputBox?.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(); }});
const cfg=getApiConfig();
document.getElementById('statusText').textContent = cfg.model ? `已连接：${cfg.model}` : '还没配置 API';
loadMessages(); render();