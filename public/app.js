// TaskFlow board
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const TAG_COLORS = {
    DevOps: ['#eef2ff', '#4338ca'],
    Infra: ['#ecfeff', '#0e7490'],
    Testing: ['#fef3c7', '#92400e'],
    Frontend: ['#fce7f3', '#9d174d'],
    Backend: ['#dcfce7', '#166534'],
  };
  const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#d97706', '#db2777', '#059669', '#7c3aed'];

  let tasks = [];
  let editing = null;

  const api = async (url, opts = {}) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  };

  const toast = (msg) => {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  const initials = (name) => (name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const colorOf = (name) => {
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  };
  const tagStyle = (tag) => {
    const [bg, fg] = TAG_COLORS[tag] || ['#f3f4f6', '#374151'];
    return `background:${bg};color:${fg}`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

  // ---------- render ----------
  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const tag = $('#filterTag').value;
    const visible = tasks.filter((t) =>
      (!q || `${t.title} ${t.description} ${t.assignee}`.toLowerCase().includes(q)) && (!tag || t.tag === tag));

    for (const col of $$('.column')) {
      const list = visible.filter((t) => t.status === col.dataset.status);
      $('.count', col).textContent = list.length;
      $('.cards', col).innerHTML = list.length
        ? list.map(cardHtml).join('')
        : '<div class="empty-col">No tasks</div>';
    }

    const count = (s) => tasks.filter((t) => t.status === s).length;
    const done = count('done');
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    $('#sTotal').textContent = tasks.length;
    $('#sProgress').textContent = count('in_progress');
    $('#sReview').textContent = count('review');
    $('#sDone').textContent = done;
    $('#sPct').textContent = `${pct}%`;
    $('#sBar').style.width = `${pct}%`;

    const tags = [...new Set(tasks.map((t) => t.tag).filter(Boolean))].sort();
    const sel = $('#filterTag');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All tags</option>' + tags.map((t) => `<option ${t === cur ? 'selected' : ''}>${esc(t)}</option>`).join('');

    const people = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))];
    $('#team').innerHTML = people.map((p) => `<span class="avatar" title="${esc(p)}" style="background:${colorOf(p)}">${initials(p)}</span>`).join('');
  }

  function cardHtml(t) {
    const late = t.due && t.status !== 'done' && new Date(`${t.due}T23:59:59`) < new Date();
    return `<article class="card" draggable="true" data-id="${t.id}">
      <div class="card-top">
        ${t.tag ? `<span class="tag" style="${tagStyle(t.tag)}">${esc(t.tag)}</span>` : '<span></span>'}
        <span class="prio ${t.priority}" title="${t.priority} priority"><i></i><i></i><i></i></span>
      </div>
      <h3>${esc(t.title)}</h3>
      ${t.description ? `<p>${esc(t.description)}</p>` : ''}
      <div class="card-foot">
        ${t.due ? `<span class="due ${late ? 'late' : ''}"><svg viewBox="0 0 20 20"><path d="M6 2h2v2h4V2h2v2h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h2zm-1 6v7h10V8z"/></svg>${fmtDate(t.due)}</span>` : ''}
        ${t.assignee ? `<span class="avatar" title="${esc(t.assignee)}" style="background:${colorOf(t.assignee)}">${initials(t.assignee)}</span>` : ''}
      </div>
    </article>`;
  }

  // ---------- data ----------
  async function load() {
    tasks = await api('/api/tasks');
    render();
  }

  async function loadInfo() {
    try {
      const i = await api('/api/info');
      $('#envName').textContent = i.environment;
      $('#appVersion').textContent = i.version;
      $('#buildNo').textContent = i.build === 'local' ? 'local' : `#${i.build}`;
      $('#commitId').textContent = i.commit;
      $('#instanceId').textContent = i.instance;
    } catch { /* info panel is optional */ }
  }

  // ---------- drag and drop ----------
  let dragId = null;
  $('#board').addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  $('#board').addEventListener('dragend', (e) => {
    e.target.closest('.card')?.classList.remove('dragging');
    $$('.column').forEach((c) => c.classList.remove('drop'));
  });
  for (const col of $$('.column')) {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drop');
      const task = tasks.find((t) => t.id === dragId);
      if (!task || task.status === col.dataset.status) return;
      const before = task.status;
      task.status = col.dataset.status;
      render();
      try {
        await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: task.status }) });
        toast(`Moved to ${$('.col-head', col).textContent.replace(/\d+$/, '').trim()}`);
      } catch (err) {
        task.status = before;
        render();
        toast(err.message);
      }
    });
  }

  // ---------- dialog ----------
  const dlg = $('#taskDialog');
  const form = $('#taskForm');

  function openDialog(task) {
    editing = task || null;
    form.reset();
    $('#formError').textContent = '';
    $('#dialogTitle').textContent = task ? 'Edit task' : 'New task';
    $('#deleteBtn').style.visibility = task ? 'visible' : 'hidden';
    if (task) for (const [k, v] of Object.entries(task)) if (form.elements[k]) form.elements[k].value = v ?? '';
    dlg.showModal();
    form.elements.title.focus();
  }

  $('#newBtn').addEventListener('click', () => openDialog());
  $('#cancelBtn').addEventListener('click', () => dlg.close());
  $('#board').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) openDialog(tasks.find((t) => t.id === card.dataset.id));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      if (editing) {
        await api(`/api/tasks/${editing.id}`, { method: 'PATCH', body: JSON.stringify(data) });
        toast('Task updated');
      } else {
        await api('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
        toast('Task created');
      }
      dlg.close();
      await load();
    } catch (err) {
      $('#formError').textContent = err.message;
    }
  });

  $('#deleteBtn').addEventListener('click', async () => {
    if (!editing || !confirm(`Delete "${editing.title}"?`)) return;
    await api(`/api/tasks/${editing.id}`, { method: 'DELETE' });
    dlg.close();
    toast('Task deleted');
    await load();
  });

  // keyboard shortcuts: N = new task, / = search
  document.addEventListener('keydown', (e) => {
    if (dlg.open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openDialog(); }
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  });

  $('#search').addEventListener('input', render);
  $('#filterTag').addEventListener('change', render);
  $('#navMine').addEventListener('click', (e) => {
    e.preventDefault();
    $('#search').value = 'Abhay';
    render();
  });

  load();
  loadInfo();
})();
