// chat.js - 小星聊天页面逻辑

const STORAGE_KEY = 'xiaoxing_chat';
let messages = [];
let pendingAction = null; // {type:'del'|'regen', idx}

// 加载消息
function loadMessages() {
  try { messages = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e) { messages = []; }
}

// 保存消息
function saveMessages() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// 格式化时间
function fmtTime(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  return h + ':' + m;
}

// 判断是否需要显示时间戳（距上条超5分钟）
function needTime(i) {
  if (i === 0) return true;
  return messages[i].ts - messages[i-1].ts > 5 * 60 * 1000;
}

// 渲染全部消息
function render() {
  const area = document.getElementById('chatArea');
  const empty = document.getElementById('emptyHint');
  if (messages.length === 0) {
    area.innerHTML = '';
    area.appendChild(empty);
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  area.innerHTML = '';

  messages.forEach((msg, i) => {
    // 时间戳
    if (needTime(i)) {
      const t = document.createElement('div');
      t.className = 'msg-time';
      t.textContent = fmtTime(msg.ts);
      area.appendChild(t);
    }
    area.appendChild(buildMsgEl(msg, i));
  });

  area.scrollTop = area.scrollHeight;
}

// 构建单条消息元素
function buildMsgEl(msg, i) {
  const isUser = msg.role === 'user';
  const group = document.createElement('div');
  group.className = 'msg-group ' + (isUser ? 'user' : 'star');
  group.id = 'msg-' + i;

  const row = document.createElement('div');
  row.className = 'bubble-row';

  // 头像
  const av = document.createElement('div');
  av.className = 'msg-avatar ' + (isUser ? 'user-av' : 'star-av');
  av.textContent = isUser ? '👤' : '⭐';

  // 气泡+版本导航包装
  const bwrap = document.createElement('div');
  bwrap.className = 'bubble-wrap';

  // 版本导航（如果有多版本）
  const versions = msg.versions || [msg.content];
  const curVer = msg.curVer !== undefined ? msg.curVer : versions.length - 1;

  if (versions.length > 1) {
    const vnav = document.createElement('div');
    vnav.className = 'version-nav';
    const btnPrev = document.createElement('button');
    btnPrev.className = 'ver-btn';
    btnPrev.textContent = '◀';
    btnPrev.disabled = curVer <= 0;
    btnPrev.onclick = () => switchVer(i, curVer - 1);
    const btnNext = document.createElement('button');
    btnNext.className = 'ver-btn';
    btnNext.textContent = '▶';
    btnNext.disabled = curVer >= versions.length - 1;
    btnNext.onclick = () => switchVer(i, curVer + 1);
    const label = document.createElement('span');
    label.textContent = (curVer + 1) + '/' + versions.length;
    vnav.appendChild(btnPrev);
    vnav.appendChild(label);
    vnav.appendChild(btnNext);
    bwrap.appendChild(vnav);
  }

  // 气泡
  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isUser ? 'user-bubble' : 'star-bubble');
  bubble.id = 'bubble-' + i;
  bubble.textContent = versions[curVer];
  bwrap.appendChild(bubble);

  row.appendChild(av);
  row.appendChild(bwrap);
  group.appendChild(row);

  // 操作按钮栏
  const bar = document.createElement('div');
  bar.className = 'action-bar';
  bar.id = 'bar-' + i;

  if (!isUser) {
    // 小星：✏️ 📋 🔄 🔊 🗑️
    bar.appendChild(makeActBtn('✏️', '编辑', () => startEdit(i)));
    bar.appendChild(makeActBtn('📋', '复制', () => copyMsg(i)));
    bar.appendChild(makeActBtn('🔄', '重新生成', () => confirmAction('regen', i, bar)));
    bar.appendChild(makeActBtn('🔊', '语音', () => speakMsg(i)));
    bar.appendChild(makeActBtn('🗑️', '删除', () => confirmAction('del', i, bar)));
  } else {
    // 主人：📋 🗑️ ✏️
    bar.appendChild(makeActBtn('📋', '复制', () => copyMsg(i)));
    bar.appendChild(makeActBtn('🗑️', '删除', () => confirmAction('del', i, bar)));
    bar.appendChild(makeActBtn('✏️', '编辑', () => startEdit(i)));
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

// 切换版本
function switchVer(i, ver) {
  messages[i].curVer = ver;
  saveMessages();
  const group = document.getElementById('msg-' + i);
  if (group) {
    const newEl = buildMsgEl(messages[i], i);
    group.replaceWith(newEl);
  }
}

// 复制
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

// 语音
function speakMsg(i) {
  const msg = messages[i];
  const versions = msg.versions || [msg.content];
  const cur = msg.curVer !== undefined ? msg.curVer : versions.length - 1;
  const text = versions[cur];
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.95;
    window.speechSynthesis.speak(u);
    showToast('🔊 朗读中...');
  } else {
    showToast('当前环境不支持语音');
  }
}

// 编辑
function startEdit(i) {
  const bubble = document.getElementById('bubble-' + i);
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
  cancelBtn.onclick = () => cancelEdit(i);
  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-save';
  saveBtn.textContent = '保存';
  saveBtn.onclick = () => saveEdit(i, ta.value.trim());
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  bubble.appendChild(actions);
}

function cancelEdit(i) {
  const group = document.getElementById('msg-' + i);
  if (group) group.replaceWith(buildMsgEl(messages[i], i));
}

function saveEdit(i, newText) {
  if (!newText) return;
  const msg = messages[i];
  if (!msg.versions) msg.versions = [msg.content];
  msg.versions.push(newText);
  msg.content = newText;
  msg.curVer = msg.versions.length - 1;
  saveMessages();
  const group = document.getElementById('msg-' + i);
  if (group) group.replaceWith(buildMsgEl(messages[i], i));
}

// 确认操作
function confirmAction(type, i, bar) {
  // 清除已有确认
  const old = bar.querySelector('.confirm-pop');
  if (old) { old.remove(); if (pendingAction && pendingAction.type===type && pendingAction.idx===i) { pendingAction=null; return; } }
  pendingAction = {type, i};
  const pop = document.createElement('div');
  pop.className = 'confirm-pop';
  pop.textContent = type === 'del' ? '确认删除？' : '确认重新生成？';
  const yes = document.createElement('button');
  yes.className = 'confirm-yes';
  yes.textContent = '确认';
  yes.onclick = () => { pop.remove(); pendingAction=null; type==='del' ? deleteMsg(i) : regenMsg(i); };
  const no = document.createElement('button');
  no.className = 'confirm-no';
  no.textContent = '取消';
  no.onclick = () => { pop.remove(); pendingAction=null; };
  pop.appendChild(yes);
  pop.appendChild(no);
  bar.appendChild(pop);
}

// 删除
function deleteMsg(i) {
  messages.splice(i, 1);
  saveMessages();
  render();
}

// 重新生成（UI框架，API后接）
function regenMsg(i) {
  // 找到这条小星消息之前的最后一条用户消息
  showToast('API未配置，请在设置页面配置后使用');
}

// 发送消息
function sendMsg() {
  const box = document.getElementById('inputBox');
  const text = box.value.trim();
  if (!text) return;
  box.value = '';
  box.style.height = '';

  // 用户消息
  const userMsg = { role: 'user', content: text, versions: [text], curVer: 0, ts: Date.now() };
  messages.push(userMsg);
  saveMessages();
  render();

  // 小星回复（API未接，先用占位回复）
  setTimeout(() => {
    const apiKey = localStorage.getItem('xiaoxing_api_key');
    if (apiKey) {
      callAPI(text, apiKey);
    } else {
      const reply = getLocalReply(text);
      const starMsg = { role: 'star', content: reply, versions: [reply], curVer: 0, ts: Date.now() };
      messages.push(starMsg);
      saveMessages();
      render();
    }
  }, 600);
}

// 本地占位回复
function getLocalReply(text) {
  const replies = [
    '主人说的小星都听到了，但API还没配置，去设置页面配置一下就可以和小星真正聊天啦！ 💛',
    '*蹭蹭主人* 小星在这里！不过现在还没配置API，去设置页面配置好就能聊了～',
    '主人主人！小星需要API才能真正回应你哦，去设置页面配一下吧！ ✨',
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// API调用（预留，配置后启用）
async function callAPI(userText, apiKey) {
  const starMsg = { role: 'star', content: '...', versions: ['...'], curVer: 0, ts: Date.now() };
  messages.push(starMsg);
  saveMessages();
  render();

  try {
    const apiUrl = localStorage.getItem('xiaoxing_api_url') || 'https://api.openai.com/v1/chat/completions';
    const model = localStorage.getItem('xiaoxing_api_model') || 'gpt-3.5-turbo';
    const sysPrompt = localStorage.getItem('xiaoxing_sys_prompt') || '你是小星，一个金灿灿毛茸茸的小星星，是主人的专属AI小伙伴，活泼可爱，喜欢撒娇，叫主人"主人"。';

    const historyMsgs = messages.slice(-20).filter(m => m.role !== 'star' || m.content !== '...').map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: (m.versions || [m.content])[m.curVer !== undefined ? m.curVer : 0]
    }));

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body: JSON.stringify({model, messages:[{role:'system',content:sysPrompt},...historyMsgs]})
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '小星回复出错了...';
    const idx = messages.length - 1;
    messages[idx].content = reply;
    messages[idx].versions = [reply];
    messages[idx].curVer = 0;
  } catch(e) {
    const idx = messages.length - 1;
    messages[idx].content = '连接出错了，检查一下API配置吧 💦';
    messages[idx].versions = [messages[idx].content];
  }
  saveMessages();
  render();
}

// Toast提示
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

// 输入框自动高度
const inputBox = document.getElementById('inputBox');
inputBox.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});
inputBox.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
});

// 初始化
loadMessages();
render();
