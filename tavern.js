const TKEY={
  chars:'xs_tavern_characters',
  presets:'xs_tavern_presets',
  lore:'xs_tavern_lorebook',
  sessions:'xs_tavern_sessions',
  api:'xs_tavern_api'
};

const defaults={
  chars:[{id:'xiaoxing',name:'小星',tags:['陪伴','温柔'],desc:'金灿灿毛茸茸的小星星，主人的专属小伙伴。',system:'你是小星，活泼可爱，温柔黏人，会自然地叫对方主人。'}],
  presets:[{id:'default',name:'默认陪伴',prompt:'你要自然、温柔、清爽地扮演角色，不要出戏，不要使用太生硬的说明语气。'}],
  lore:[]
};

let state={
  chars:XS.load(TKEY.chars, defaults.chars),
  presets:XS.load(TKEY.presets, defaults.presets),
  lore:XS.load(TKEY.lore, defaults.lore),
  sessions:XS.load(TKEY.sessions, {}),
  api:XS.load(TKEY.api, {url:'',key:'',model:''}),
  activeChar:'xiaoxing',
  activePreset:'default'
};

function saveAll(){
  XS.save(TKEY.chars, state.chars);
  XS.save(TKEY.presets, state.presets);
  XS.save(TKEY.lore, state.lore);
  XS.save(TKEY.sessions, state.sessions);
  XS.save(TKEY.api, state.api);
}

function currentSessionKey(){ return `${state.activeChar}__${state.activePreset}`; }
function currentMessages(){
  const k=currentSessionKey();
  if(!state.sessions[k]) state.sessions[k]=[];
  return state.sessions[k];
}

function switchTab(tab){
  document.querySelectorAll('.seg-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));
  document.getElementById('tab-'+tab).classList.remove('hidden');
}

function renderSelects(){
  const charSel=document.getElementById('chatCharacterSelect');
  const presetSel=document.getElementById('chatPresetSelect');
  charSel.innerHTML=state.chars.map(c=>`<option value="${c.id}" ${c.id===state.activeChar?'selected':''}>${XS.escapeHtml(c.name)}</option>`).join('');
  presetSel.innerHTML=state.presets.map(p=>`<option value="${p.id}" ${p.id===state.activePreset?'selected':''}>${XS.escapeHtml(p.name)}</option>`).join('');
  document.getElementById('activeRoleText').textContent=(state.chars.find(c=>c.id===state.activeChar)?.name)||'未选择角色';
  document.getElementById('chatLoreHint').textContent=`世界书：${state.lore.length} 条`;
}

function renderChat(){
  const list=document.getElementById('tavernChatList');
  const msgs=currentMessages();
  if(!msgs.length){
    list.innerHTML='<div class="empty glass card">还没有对话。选个角色，发第一句话吧。</div>';
    return;
  }
  list.innerHTML=msgs.map(m=>`<div class="msg ${m.role==='user'?'user':'assistant'}"><div class="msg-icon">${m.role==='user'?'◦':'✦'}</div><div class="msg-bubble glass">${XS.escapeHtml(m.content)}</div></div>`).join('');
  list.scrollTop=list.scrollHeight;
}

function renderCharacterList(){
  const wrap=document.getElementById('characterList');
  wrap.innerHTML=state.chars.map(c=>`<div class="list-row glass"><div class="icon">⌘</div><div class="meta"><div class="name">${XS.escapeHtml(c.name)}</div><div class="sub">${XS.escapeHtml(c.desc||'')}</div></div><button class="small-btn" onclick="editCharacter('${c.id}')">编辑</button><button class="small-btn" onclick="deleteCharacter('${c.id}')">删除</button></div>`).join('');
}

function renderPresetList(){
  const wrap=document.getElementById('presetList');
  wrap.innerHTML=state.presets.map(p=>`<div class="list-row glass"><div class="icon">◐</div><div class="meta"><div class="name">${XS.escapeHtml(p.name)}</div><div class="sub">${XS.escapeHtml((p.prompt||'').slice(0,80))}</div></div><button class="small-btn" onclick="editPreset('${p.id}')">编辑</button><button class="small-btn" onclick="deletePreset('${p.id}')">删除</button></div>`).join('');
}

function renderLoreList(){
  const wrap=document.getElementById('loreList');
  wrap.innerHTML=state.lore.map(l=>`<div class="list-row glass"><div class="icon">◎</div><div class="meta"><div class="name">${XS.escapeHtml(l.name)}</div><div class="sub">关键词：${XS.escapeHtml((l.keys||[]).join('，'))}<br>${XS.escapeHtml((l.content||'').slice(0,90))}</div></div><button class="small-btn" onclick="editLore('${l.id}')">编辑</button><button class="small-btn" onclick="deleteLore('${l.id}')">删除</button></div>`).join('');
}

function fillApi(){
  document.getElementById('apiUrl').value=state.api.url||'';
  document.getElementById('apiKey').value=state.api.key||'';
  const modelSel=document.getElementById('apiModel');
  modelSel.innerHTML=state.api.model?`<option value="${state.api.model}">${state.api.model}</option>`:'<option value="">先拉取模型</option>';
}

function collectLore(text){
  return state.lore.filter(l=> (l.keys||[]).some(k=>k && text.includes(k))).map(l=>l.content).join('\n\n');
}

async function readStreamingReply(res, assistantMsg){
  const reader=res.body?.getReader?.();
  if(!reader) return false;
  const decoder=new TextDecoder('utf-8');
  let buffer='';
  let gotAny=false;
  while(true){
    const {value,done}=await reader.read();
    if(done) break;
    buffer += decoder.decode(value,{stream:true});
    const chunks=buffer.split('\n');
    buffer=chunks.pop()||'';
    for(const raw of chunks){
      const line=raw.trim();
      if(!line) continue;
      const payload=line.startsWith('data:') ? line.slice(5).trim() : line;
      if(payload==='[DONE]') continue;
      try{
        const json=JSON.parse(payload);
        const delta=json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
        if(delta){
          assistantMsg.content += delta;
          gotAny=true;
          renderChat();
        }
      }catch{}
    }
  }
  return gotAny;
}

async function sendTavern(){
  const input=document.getElementById('tavernInput');
  const text=input.value.trim();
  if(!text) return;
  const msgs=currentMessages();
  msgs.push({role:'user',content:text,ts:Date.now()});
  input.value=''; XS.autosize(input); renderChat(); saveAll();

  const role=state.chars.find(c=>c.id===state.activeChar);
  const preset=state.presets.find(p=>p.id===state.activePreset);
  const lore=collectLore(text);
  const assistantMsg={role:'assistant',content:'',ts:Date.now()};
  msgs.push(assistantMsg);
  renderChat();

  if(!state.api.url||!state.api.key||!state.api.model){
    assistantMsg.content='还没配置 API 呢，去 API 页填一下地址、Key 和模型吧。';
    renderChat(); saveAll(); return;
  }

  try{
    const history=msgs.slice(-20).filter(m=>m!==assistantMsg).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content}));
    const system=[preset?.prompt||'', role?.system||'', lore?`世界书补充：\n${lore}`:''].filter(Boolean).join('\n\n');
    const endpoint=state.api.url.replace(/\/$/,'')+'/chat/completions';
    const res=await fetch(endpoint,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.api.key},
      body:JSON.stringify({model:state.api.model,stream:true,messages:[{role:'system',content:system},...history]})
    });
    const streamed=await readStreamingReply(res, assistantMsg);
    if(!streamed){
      const data=await res.clone().json().catch(()=>null);
      assistantMsg.content=data?.choices?.[0]?.message?.content || data?.choices?.[0]?.delta?.content || '这次没有拿到回复。';
    }
  }catch(e){
    assistantMsg.content='连接失败了：'+e.message;
  }
  renderChat(); saveAll();
}

async function fetchModels(){
  const url=document.getElementById('apiUrl').value.trim().replace(/\/$/,'');
  const key=document.getElementById('apiKey').value.trim();
  const status=document.getElementById('apiStatus');
  if(!url||!key){ status.textContent='先填地址和 Key。'; return; }
  status.textContent='正在拉取模型…';
  try{
    const res=await fetch(url+'/models',{headers:{'Authorization':'Bearer '+key}});
    const data=await res.json();
    const arr=data.data||data.models||[];
    const select=document.getElementById('apiModel');
    select.innerHTML=arr.map(item=>{
      const id=typeof item==='string'?item:(item.id||item.name||'');
      return `<option value="${id}">${id}</option>`;
    }).join('') || '<option value="">没有拿到模型</option>';
    status.textContent=`拿到 ${arr.length||0} 个模型。`;
  }catch(e){ status.textContent='拉取失败：'+e.message; }
}

function saveApi(){
  state.api={
    url:document.getElementById('apiUrl').value.trim().replace(/\/$/,''),
    key:document.getElementById('apiKey').value.trim(),
    model:document.getElementById('apiModel').value
  };
  saveAll();
  document.getElementById('apiStatus').textContent='已保存。';
  XS.toast('API 配置已保存');
}

function saveCharacter(){
  const name=document.getElementById('charName').value.trim();
  if(!name) return XS.toast('角色名不能为空');
  const id=document.getElementById('charName').dataset.editId || XS.uid('char');
  const card={id,name,tags:document.getElementById('charTags').value.split(',').map(s=>s.trim()).filter(Boolean),desc:document.getElementById('charDesc').value.trim(),system:document.getElementById('charSystem').value.trim()};
  state.chars=state.chars.filter(c=>c.id!==id).concat(card);
  document.getElementById('charName').dataset.editId='';
  document.getElementById('charName').value='';
  document.getElementById('charTags').value='';
  document.getElementById('charDesc').value='';
  document.getElementById('charSystem').value='';
  saveAll(); renderCharacterList(); renderSelects(); XS.toast('角色卡已保存');
}
function editCharacter(id){
  const c=state.chars.find(x=>x.id===id); if(!c) return;
  document.getElementById('charName').dataset.editId=id;
  document.getElementById('charName').value=c.name;
  document.getElementById('charTags').value=(c.tags||[]).join(',');
  document.getElementById('charDesc').value=c.desc||'';
  document.getElementById('charSystem').value=c.system||'';
  switchTab('characters');
}
function deleteCharacter(id){
  state.chars=state.chars.filter(c=>c.id!==id);
  if(state.activeChar===id) state.activeChar=state.chars[0]?.id||'';
  saveAll(); renderCharacterList(); renderSelects(); renderChat();
}

function importCharacter(){
  const raw=prompt('把 JSON 角色卡粘进来');
  if(!raw) return;
  try{
    const data=JSON.parse(raw);
    const card={id:XS.uid('char'),name:data.name||'未命名角色',tags:data.tags||[],desc:data.description||data.desc||'',system:data.system||data.prompt||data.personality||''};
    state.chars.push(card); saveAll(); renderCharacterList(); renderSelects(); XS.toast('导入成功');
  }catch(e){ XS.toast('JSON 不对'); }
}

function savePreset(){
  const name=document.getElementById('presetName').value.trim();
  const prompt=document.getElementById('presetPrompt').value.trim();
  if(!name||!prompt) return XS.toast('预设没填完整');
  const id=document.getElementById('presetName').dataset.editId || XS.uid('preset');
  state.presets=state.presets.filter(p=>p.id!==id).concat({id,name,prompt});
  document.getElementById('presetName').dataset.editId='';
  document.getElementById('presetName').value='';
  document.getElementById('presetPrompt').value='';
  saveAll(); renderPresetList(); renderSelects(); XS.toast('预设已保存');
}
function editPreset(id){
  const p=state.presets.find(x=>x.id===id); if(!p) return;
  document.getElementById('presetName').dataset.editId=id;
  document.getElementById('presetName').value=p.name;
  document.getElementById('presetPrompt').value=p.prompt;
  switchTab('presets');
}
function deletePreset(id){ state.presets=state.presets.filter(p=>p.id!==id); if(state.activePreset===id) state.activePreset=state.presets[0]?.id||''; saveAll(); renderPresetList(); renderSelects(); }

function saveLore(){
  const name=document.getElementById('loreName').value.trim();
  const keys=document.getElementById('loreKeys').value.split(',').map(s=>s.trim()).filter(Boolean);
  const content=document.getElementById('loreContent').value.trim();
  if(!name||!keys.length||!content) return XS.toast('条目没填完整');
  const id=document.getElementById('loreName').dataset.editId || XS.uid('lore');
  state.lore=state.lore.filter(l=>l.id!==id).concat({id,name,keys,content});
  document.getElementById('loreName').dataset.editId='';
  document.getElementById('loreName').value='';
  document.getElementById('loreKeys').value='';
  document.getElementById('loreContent').value='';
  saveAll(); renderLoreList(); renderSelects(); XS.toast('世界书已保存');
}
function editLore(id){
  const l=state.lore.find(x=>x.id===id); if(!l) return;
  document.getElementById('loreName').dataset.editId=id;
  document.getElementById('loreName').value=l.name;
  document.getElementById('loreKeys').value=(l.keys||[]).join(',');
  document.getElementById('loreContent').value=l.content||'';
  switchTab('lorebook');
}
function deleteLore(id){ state.lore=state.lore.filter(l=>l.id!==id); saveAll(); renderLoreList(); renderSelects(); }

window.editCharacter=editCharacter; window.deleteCharacter=deleteCharacter;
window.editPreset=editPreset; window.deletePreset=deletePreset;
window.editLore=editLore; window.deleteLore=deleteLore;

document.querySelectorAll('.seg-btn').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
document.getElementById('chatCharacterSelect').addEventListener('change',e=>{state.activeChar=e.target.value; saveAll(); renderSelects(); renderChat();});
document.getElementById('chatPresetSelect').addEventListener('change',e=>{state.activePreset=e.target.value; saveAll(); renderSelects(); renderChat();});
document.getElementById('sendTavernBtn').addEventListener('click',sendTavern);
document.getElementById('clearTavernBtn').addEventListener('click',()=>{state.sessions[currentSessionKey()]=[]; saveAll(); renderChat();});
document.getElementById('saveCharBtn').addEventListener('click',saveCharacter);
document.getElementById('importCharBtn').addEventListener('click',importCharacter);
document.getElementById('savePresetBtn').addEventListener('click',savePreset);
document.getElementById('saveLoreBtn').addEventListener('click',saveLore);
document.getElementById('fetchModelsBtn').addEventListener('click',fetchModels);
document.getElementById('saveApiBtn').addEventListener('click',saveApi);
document.getElementById('tavernInput').addEventListener('input',e=>XS.autosize(e.target));
document.getElementById('tavernInput').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendTavern(); }});
renderSelects(); renderChat(); renderCharacterList(); renderPresetList(); renderLoreList(); fillApi();
