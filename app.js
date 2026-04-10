window.XS = {
  toast(message){
    let el = document.getElementById('xs-toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'xs-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(()=>el.classList.remove('show'), 2200);
  },
  back(target='index.html'){
    location.href = target;
  },
  autosize(textarea){
    if(!textarea) return;
    textarea.style.height='auto';
    textarea.style.height=Math.min(textarea.scrollHeight, 160)+'px';
  },
  save(key, value){ localStorage.setItem(key, JSON.stringify(value)); },
  load(key, fallback){
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  uid(prefix='id'){
    return prefix + '_' + Math.random().toString(36).slice(2,10);
  },
  formatTime(ts){
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  escapeHtml(str=''){
    return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
};
