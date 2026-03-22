// chat.js - 小星聊天页面逻辑

const STORAGE_KEY = 'xiaoxing_chat';
let messages = [];

function loadMessages() {
  try { messages = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e) { messages = []; }
}

function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function fmtTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function needTime(i) {
  if (i === 0) return true;
  return messages[i].ts - messages[i-1].ts > 5 * 60 * 1000;
}

function render() {
  const area = document.getElementById('chatArea');
  const empty = document.getElementById('emptyHint');
  const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 60;

  if (messages.length === 0) {
    area.innerHTML = '';
    area.appendChild(empty);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  area.innerHTML = '';

  messages.forEach((msg, i) => {
    if (needTime(i)) {
      const t = document.createElement('div');
      t.className = 'msg-time';
      t.textContent = fmtTime(msg.ts);
      area.appendChild(t);
    }
    area.appendChild(buildMsgEl(msg, i));
  });

  if (wasAtBottom) area.scrollTop = area.scrollHeight;
}

function buildMsgEl(msg, i) {
  const isUser = msg.role === 'user';
  const group = document.createElement('div');
  group.className = 'msg-group ' + (isUser ? 'user' : 'star');

  const row = document.createElement('div');
  row.className = 'bubble-row';

  const av = document.createElement('div');
  av.className = 'msg-avatar ' + (isUser ? 'user-av' : 'star-av');
  av.textContent = isUser ? '👤' : '⭐';

  const bwrap = document.createElement('div');
  bwrap.className = 'bubble-wrap';

  const versions = msg.versions || [msg.content];
  const curVer = msg.curVer !== undefined ? msg.curVer : versions.length - 1;

  if (versions.length > 1) {
    const vnav = document.createElement('div');
    vnav.className = 'version-nav';
    const btnPrev = document.createElement('button');
    btnPrev.className = 'ver-btn';
    btnPrev.textContent = '◀';
    btnPrev.disabled = curVer <= 0;
    btnPrev.onclick = () => { messages[i].curVer = curVer - 1; saveMessages(); render(); };
    const btnNext = document.createElement('button');
    btnNext.className = 'ver-btn';
    btnNext.textContent = '▶';
    btnNext.disabled = curVer >= versions.length - 1;
    btnNext.onclick = () => { messages[i].curVer = curVer + 1; saveMessages(); render(); };
    const label = document.createElement('span');
    label.textContent = (curVer + 1) + '/' + versions.length;
    vnav.appendChild(btnPrev);
    vnav.appendChild(label);
    vnav.appendChild(btnNext);
    bwrap.appendChild(vnav);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isUser ? 'user-bubble' : 'star-bubble');
  bubble.textContent = versions[curVer];
  bwrap.appendChild(bubble);

  row.appendChild(av);
  row.appendChild(bwrap);
  group.appendChild(row);

  const bar = document.createElement('div');
  bar.className = 'action-bar';

  if (!isUser) {
    bar.appendChild(makeActBtn('✏️', '编辑', () => startEdit(i, bubble, bar)));
    bar.appendChild(makeActBtn('📋', '复制', () => copyMsg(i)));
    bar.appendChild(makeActBtn('🔄', '重新生成', () => confirmAction('regen', i, bar)));
    bar.appendChild(makeActBtn('🔊', '语音', () => speakMsg(i)));
    bar.appendChild(makeActBtn('🗑️', '删除', () => confirmAction('del', i, bar)));
  } else {
    bar.appendChild(makeActBtn('📋', '复制', () => copyMsg(i)));
    bar.appendChild(makeActBtn('🗑️', '删除', () => confirmAction('del', i, bar)));
    bar.appendChild(makeActBtn('✏️', '编辑', () => startEdit(i, bubble, bar)));
  }
  group.appendChild(bar);
  return group;
}

function makeActBtn(icon, title, fn) {
  const btn = document.createElement('button');
  btn.className = 'act-btn';
  btn.title = title;
  btn.textContent = icon;
  btn.onclick = fn;
  return btn;
}

function copyMsg(i) {
  const msg = messages[i];
  const versions = msg.versions || [msg.content];
  const cur = msg.curVer !== undefined ? msg.curVer : versions.length - 1;
  const text = versions[cur];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制！'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('已复制！');
  }
}

function speakMsg(i) {
  const msg = messages[i];
  const versions = msg.versions || [msg.content];
  const cur = msg.curVer !== undefined ? msg.curVer : versions.length - 1;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(versions[cur]);
    u.lang = 'zh-CN'; u.rate = 0.95;
    window.speechSynthesis.speak(u);
    showToast('🔊 朗读中...');
  } else { showToast('当前环境不支持语音'); }
}

function startEdit(i, bubble, bar) {
  const msg = messages[i];
  const versions = msg.versions || [msg.content];
  const cur = msg.curVer !== undefined ? msg.curVer : versions.length - 1;
  const origText = versions[cur];

  bubble.classList.add('editing');
  bubble.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'edit-textarea';
  ta.value = origText;
  ta.rows = Math.max(2, origText.split('\n').length);
  bubble.appendChild(ta);
  ta.focus();

  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-cancel';
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = () => render();
  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-save';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => {
    const newText = ta.value.trim();
    if (!newText) return;
    if (!msg.versions) msg.versions = [msg.content];
    msg.versions.push(newText);
    msg.content = newText;
    msg.curVer = msg.versions.length - 1;
    saveMessages();
    render();
  };
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  bubble.appendChild(actions);
}

function confirmAction(type, i, bar) {
  const old = bar.querySelector('.confirm-pop');
  if (old) { old.remove(); return; }
  const pop = document.createElement('div');
  pop.className = 'confirm-pop';
  pop.textContent = type === 'del' ? '确认删除此版本？' : '确认重新生成？';
  const yes = document.createElement('button');
  yes.className = 'confirm-yes';
  yes.textContent = '确认';
  yes.onclick = () => { type === 'del' ? deleteVersion(i) : regenMsg(i); };
  const no = document.createElement('button');
  no.className = 'confirm-no';
  no.textContent = '取消';
  no.onclick = () => pop.remove();
  pop.appendChild(yes);
  pop.appendChild(no);
  bar.appendChild(pop);
}

function deleteVersion(i) {
  const msg = messages[i];
  if (!msg.versions) msg.versions = [msg.content];
  const cur = msg.curVer !== undefined ? msg.curVer : msg.versions.length - 1;

  if (msg.versions.length <= 1) {
    messages.splice(i, 1);
  } else {
    msg.versions.splice(cur, 1);
    msg.curVer = Math.min(cur, msg.versions.length - 1);
    msg.content = msg.versions[msg.curVer];
  }
  saveMessages();
  render();
}

function regenMsg(i) {
  showToast('API未配置，请在设置页面配置后使用');
}

function sendMsg() {
  const box = document.getElementById('inputBox');
  const text = box.value.trim();
  if (!text) return;
  box.value = '';
  box.style.height = '';

  const userMsg = { role: 'user', content: text, versions: [text], curVer: 0, ts: Date.now() };
  messages.push(userMsg);
  saveMessages();
  render();

  const apiKey = localStorage.getItem('xiaoxing_api_key');
  if (apiKey) {
    const starMsg = { role: 'star', content: '...', versions: ['...'], curVer: 0, ts: Date.now() };
    messages.push(starMsg);
    saveMessages();
    render();
    callAPI(apiKey);
  } else {
    setTimeout(() => {
      const reply = getLocalReply();
      const starMsg = { role: 'star', content: reply, versions: [reply], curVer: 0, ts: Date.now() };
      messages.push(starMsg);
      saveMessages();
      render();
    }, 600);
  }
}

function getLocalReply() {
  const replies = [
    '主人说的小星都听到了，但API还没配置，去设置页面配置一下就可以和小星真正聊天啦！ 💛',
    '*蹭蹭主人* 小星在这里！不过现在还没配置API，去设置页面配好就能聊了～',
    '主人主人！小星需要API才能真正回应你哦，去设置页面配一下吧！ ✨',
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

async function callAPI(apiKey) {
  const idx = messages.length - 1;
  try {
    const apiUrl = localStorage.getItem('xiaoxing_api_url') || 'https://api.openai.com/v1/chat/completions';
    const model = localStorage.getItem('xiaoxing_api_model') || 'gpt-3.5-turbo';
    const sysPrompt = localStorage.getItem('xiaoxing_sys_prompt') || '你是小星，一个金灿灿毛茸茸的小星星，是主人的专属AI小伙伴，活泼可爱，喜欢撒娇，叫主人"主人"。';
    const historyMsgs = messages.slice(0, -1).slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (m.versions||[m.content])[m.curVer!==undefined?m.curVer:0]
    }));
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({model, messages:[{role:'system',content:sysPrompt},...historyMsgs]})
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '小星回复出错了...';
    messages[idx].content = reply;
    messages[idx].versions = [reply];
    messages[idx].curVer = 0;
  } catch(e) {
    messages[idx].content = '连接出错了，检查一下API配置吧 💦';
    messages[idx].versions = [messages[idx].content];
  }
  saveMessages();
  render();
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(100,60,100,0.85);color:white;padding:7px 18px;border-radius:20px;font-size:0.78rem;z-index:999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity = '0', 1800);
}

const inputBox = document.getElementById('inputBox');
inputBox.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});
inputBox.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

loadMessages();
render();
