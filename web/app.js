// FLUX Studio front end. All text goes in via textContent (h helper), never innerHTML.
const main = document.getElementById('main');
const state = { status: {}, bible: null, episodes: [], ep: null, list: null, jobs: [], dirty: false };

// ---------- helpers ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    ...opts, headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
let toastTimer;
function toast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ''), 3500);
}
const field = (label, input, cls) => h('label', { class: cls }, label, input);
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const bust = () => '?t=' + Date.now();

// ---------- status + jobs ----------
async function loadStatus() {
  state.status = await api('/status').catch(() => ({}));
  const s = document.getElementById('status');
  s.replaceChildren(
    h('div', { class: 'pill' + (state.status.hasKey ? ' ok' : '') }, h('i'), state.status.hasKey ? 'BFL API key loaded' : 'No API key in .env'),
    h('div', { class: 'pill' + (state.status.ffmpeg ? ' ok' : '') }, h('i'), state.status.ffmpeg ? 'ffmpeg ready' : 'ffmpeg not found'),
  );
}
let jobTimer;
async function pollJobs() {
  const before = new Map(state.jobs.map((j) => [j.id, j.status]));
  state.jobs = await api('/jobs').catch(() => state.jobs);
  const active = state.jobs.filter((j) => !['Done', 'Failed'].includes(j.status)).length;
  const c = document.getElementById('qcount');
  c.hidden = !active; c.textContent = active;
  let finished = false;
  for (const j of state.jobs) {
    const was = before.get(j.id);
    if (was && was !== j.status && (j.status === 'Done' || j.status === 'Failed')) {
      finished = true;
      toast(j.status === 'Done' ? `Rendered ${j.label}` : `Failed: ${j.label} — ${j.error}`, j.status === 'Failed');
    }
  }
  if ((finished || route() === 'queue') && !state.dirty) render();
  clearTimeout(jobTimer);
  jobTimer = setTimeout(pollJobs, active ? 2500 : 8000);
}

// ---------- views ----------
const views = {
  async overview() {
    const [bible, eps] = await Promise.all([api('/bible'), api('/episodes')]);
    const shots = eps.reduce((n, e) => n + e.shots, 0);
    const steps = [
      ['Add your BFL API key to .env', state.status.hasKey],
      ['Write the logline and hook', Boolean(bible.logline && bible.hook)],
      ['Add the main characters', bible.characters.length > 0],
      ['Generate character keyframes', false],
      ['Plan the pilot shot list', shots >= 3],
      ['Render draft shots, then stitch the pilot', false],
    ];
    return h('div', { class: 'stack' },
      h('div', {}, h('h1', {}, bible.title || 'FLUX: In Production'),
        h('p', { class: 'lead' }, 'TV Series with RTL — the series that proves AI-made fiction can win over a mass audience. Programme runs 30 Nov – 13 Dec 2026.')),
      h('div', { class: 'grid' },
        h('div', { class: 'card stat' }, h('b', {}, eps.length), h('span', {}, 'episodes')),
        h('div', { class: 'card stat' }, h('b', {}, shots), h('span', {}, 'shots planned')),
        h('div', { class: 'card stat' }, h('b', {}, bible.characters.length), h('span', {}, 'characters')),
        h('div', { class: 'card stat' }, h('b', {}, state.jobs.filter((j) => j.status === 'Done').length), h('span', {}, 'renders this session'))),
      h('div', { class: 'card' }, h('h2', {}, 'Production checklist'),
        h('ol', { class: 'steps' }, steps.map(([t, done]) => h('li', { class: done ? 'done' : null }, t)))),
      bible.logline ? h('div', { class: 'card' }, h('h2', {}, 'Logline'), h('p', {}, bible.logline)) : null,
    );
  },

  async bible() {
    const b = state.bible = await api('/bible');
    const set = (k) => (e) => { b[k] = e.target.value; markDirty(); };
    const ta = (k, rows = 3, ph = '') => h('textarea', { rows, placeholder: ph, value: b[k], oninput: set(k) });
    const charRows = h('div', { class: 'stack' });
    const drawChars = () => charRows.replaceChildren(...b.characters.map((c, i) => h('div', { class: 'char' },
      ...['name', 'role', 'look', 'voice'].map((k) => field(k[0].toUpperCase() + k.slice(1),
        h('input', { value: c[k] || '', placeholder: k === 'look' ? 'Locked wardrobe, age, features' : '', oninput: (e) => { c[k] = e.target.value; markDirty(); } }))),
      h('button', { class: 'icon ghost', 'aria-label': `Remove ${c.name || 'character'}`, onclick: () => { b.characters.splice(i, 1); drawChars(); markDirty(); } }, '✕'))));
    drawChars();
    const epRows = h('div', { class: 'stack' });
    const drawEps = () => epRows.replaceChildren(...b.episodes.map((e, i) => h('div', { class: 'row' },
      h('input', { value: e, placeholder: `Episode ${i + 1}: what happens`, oninput: (ev) => { b.episodes[i] = ev.target.value; markDirty(); }, style: 'flex:1' }),
      h('button', { class: 'icon ghost', 'aria-label': `Remove episode ${i + 1}`, onclick: () => { b.episodes.splice(i, 1); drawEps(); markDirty(); } }, '✕'))));
    drawEps();
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('h1', { id: 'title' }, 'Series bible'),
        h('button', { class: 'primary', onclick: saveBible }, 'Save bible')),
      h('div', { class: 'card fields' },
        field('Series title', h('input', { value: b.title, oninput: set('title') })),
        field('Genre', h('input', { value: b.genre, placeholder: 'e.g. family drama, crime, comedy', oninput: set('genre') })),
        field('Logline', ta('logline', 2, 'Who, what they want, what stands in the way'), 'full'),
        field('Why a mass audience comes back for episode 2', ta('hook', 3), 'full'),
        field('World', ta('world', 3, 'Where and when; locations'), 'full'),
        field('Visual style (copied into shot lists)', ta('style', 2, 'Lens, film look, palette, lighting'), 'full')),
      h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h2', {}, 'Characters'),
        h('button', { onclick: () => { b.characters.push({ name: '', role: '', look: '', voice: '' }); drawChars(); markDirty(); } }, '+ Character')), charRows),
      h('div', { class: 'card stack' }, h('div', { class: 'row spread' }, h('h2', {}, 'Episode plan'),
        h('button', { onclick: () => { b.episodes.push(''); drawEps(); markDirty(); } }, '+ Episode')), epRows),
    );
  },

  async shots() {
    state.episodes = await api('/episodes');
    if (!state.ep || !state.episodes.some((e) => e.episode === state.ep)) state.ep = state.episodes[0]?.episode || null;
    const picker = h('div', { class: 'row' },
      h('select', { 'aria-label': 'Episode', style: 'width:auto', onchange: async (e) => { if (await leaveOk()) { state.ep = e.target.value; render(); } else e.target.value = state.ep; } },
        state.episodes.map((e) => h('option', { value: e.episode, selected: e.episode === state.ep }, `${e.title} (${e.shots})`))),
      h('button', { onclick: newEpisode }, '+ Episode'));
    if (!state.ep) return h('div', { class: 'stack' }, h('h1', {}, 'Shot list'), picker, h('div', { class: 'card empty' }, 'No episodes yet.'));

    const L = state.list = await api('/episodes/' + state.ep);
    const canRender = state.status.hasKey;
    const set = (k, num) => (e) => { L[k] = num ? Number(e.target.value) : e.target.value; markDirty(); };
    const list = h('div', { class: 'stack' });
    const move = (i, d) => { const [s] = L.shots.splice(i, 1); L.shots.splice(i + d, 0, s); draw(); markDirty(); };
    const busy = new Set(state.jobs.filter((j) => !['Done', 'Failed'].includes(j.status)).map((j) => j.label.split(' (')[0]));
    const draw = () => list.replaceChildren(...(L.shots.length ? L.shots.map((s, i) => {
      const rendering = busy.has(`${state.ep} / ${s.id}`);
      return h('div', { class: 'card shot' },
        h('div', { class: 'num' }, String(i + 1).padStart(2, '0')),
        h('div', { class: 'stack' },
          h('div', { class: 'meta' },
            field('Shot id', h('input', { value: s.id, onchange: (e) => { s.id = slugify(e.target.value) || s.id; e.target.value = s.id; markDirty(); } })),
            field('Seconds', h('input', { type: 'number', min: 5, max: 20, value: s.duration ?? 8, oninput: (e) => { s.duration = Number(e.target.value); markDirty(); } }))),
          field('Prompt — action, camera, dialogue in quotes, sound', h('textarea', { rows: 4, value: s.prompt, oninput: (e) => { s.prompt = e.target.value; markDirty(); } })),
          h('div', { class: 'row' },
            h('button', { class: 'rec', disabled: !canRender || rendering || state.dirty, title: state.dirty ? 'Save first' : null, onclick: () => renderShot(s.id, true) }, rendering ? 'Rendering…' : '● Draft'),
            h('button', { disabled: !canRender || rendering || state.dirty, onclick: () => renderShot(s.id, false) }, 'Final'),
            h('button', { class: 'icon ghost', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
            h('button', { class: 'icon ghost', 'aria-label': 'Move down', disabled: i === L.shots.length - 1, onclick: () => move(i, 1) }, '↓'),
            h('button', { class: 'icon ghost', 'aria-label': `Delete ${s.id}`, onclick: () => { if (confirmInline(s.id)) { L.shots.splice(i, 1); draw(); markDirty(); } } }, '✕'))),
        h('div', { class: 'preview' }, L.renders?.[s.id]
          ? h('video', { src: `/media/output/${state.ep}/${s.id}.mp4${bust()}`, controls: true, preload: 'metadata' })
          : 'Not rendered yet'));
    }) : [h('div', { class: 'card empty' }, 'No shots yet — add the first one.')]));
    draw();
    const totalSec = L.shots.reduce((n, s) => n + (Number(s.duration) || 8), 0);
    return h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('h1', { id: 'title' }, 'Shot list'),
        h('div', { class: 'row' }, picker, h('button', { class: 'primary', onclick: saveList }, 'Save'))),
      h('div', { class: 'card fields' },
        field('Episode title', h('input', { value: L.title, oninput: set('title') })),
        field('Aspect ratio', h('select', { onchange: set('aspect_ratio') }, ['16:9', '21:9', '4:3', '1:1', '9:16'].map((a) => h('option', { selected: a === L.aspect_ratio }, a)))),
        field('Resolution', h('select', { onchange: set('resolution') }, ['hd', 'fhd'].map((a) => h('option', { selected: a === L.resolution }, a)))),
        field('Style prefix (added to every shot)', h('textarea', { rows: 2, value: L.style, oninput: set('style') }), 'full'),
        h('div', { class: 'row full' },
          h('button', { onclick: () => { if (state.bible?.style) { L.style = state.bible.style; markDirty(); render(); } else toast('Set a visual style in the series bible first', true); } }, 'Use style from bible'),
          h('span', { style: 'color:var(--mute)' }, `${L.shots.length} shots · about ${totalSec}s`))),
      list,
      h('div', { class: 'row' }, h('button', { onclick: () => {
        const id = `shot-${String(L.shots.length + 1).padStart(2, '0')}`;
        L.shots.push({ id: L.shots.some((s) => s.id === id) ? id + '-b' : id, duration: 8, prompt: '' }); draw(); markDirty();
      } }, '+ Add shot')),
      h('div', { class: 'card stack' },
        h('div', { class: 'row spread' }, h('h2', {}, 'Episode cut'),
          h('button', { class: 'primary', disabled: !state.status.ffmpeg, onclick: stitchEp }, 'Stitch episode')),
        h('p', { style: 'margin:0;color:var(--mute)' }, 'Joins every rendered shot in the order above. Unrendered shots are skipped.'),
        L.cut ? h('div', { class: 'preview', style: 'max-width:720px' }, h('video', { src: `/media/output/${state.ep}.mp4${bust()}`, controls: true })) : null),
    );
  },

  async keyframes() {
    const files = await api('/keyframes');
    const name = h('input', { placeholder: 'lead-character-front', required: true });
    const prompt = h('textarea', { rows: 4, placeholder: 'Character sheet: full body, front view, neutral background. Describe face, age, wardrobe exactly as in the bible.' });
    const aspect = h('select', {}, ['16:9', '1:1', '3:4', '9:16'].map((a) => h('option', {}, a)));
    const go = async () => {
      try {
        await api('/keyframes', { method: 'POST', body: { name: slugify(name.value), prompt: prompt.value, aspect_ratio: aspect.value } });
        toast('Keyframe queued'); pollJobs();
      } catch (e) { toast(e.message, true); }
    };
    return h('div', { class: 'stack' },
      h('div', {}, h('h1', { id: 'title' }, 'Keyframes'),
        h('p', { class: 'lead' }, 'Lock how characters and places look before rendering video. Reuse these descriptions word for word in your shot prompts.')),
      h('div', { class: 'card fields' },
        field('File name', name), field('Aspect', aspect),
        field('Prompt', prompt, 'full'),
        h('div', { class: 'full' }, h('button', { class: 'primary', disabled: !state.status.hasKey, onclick: go }, 'Generate image'))),
      files.length ? h('div', { class: 'thumbs' }, files.map((f) => h('figure', {},
        h('div', { class: 'preview' }, h('img', { src: `/media/keyframes/${encodeURIComponent(f.name)}${bust()}`, alt: f.name, loading: 'lazy' })),
        h('figcaption', {}, f.name))))
        : h('div', { class: 'card empty' }, 'No keyframes yet.'),
    );
  },

  async queue() {
    return h('div', { class: 'stack' }, h('h1', { id: 'title' }, 'Render queue'),
      h('p', { class: 'lead' }, 'Jobs from this session. Finished files stay in the output folder after a restart.'),
      h('div', { class: 'card' }, state.jobs.length ? state.jobs.map((j) => h('div', { class: 'job' },
        h('b', {}, j.label), h('span', { class: 'tag ' + j.status }, j.status),
        h('small', {}, j.error || `Started ${new Date(j.started).toLocaleTimeString()}`)))
        : h('div', { class: 'empty' }, 'Nothing rendered yet.')));
  },
};

// ---------- actions ----------
function markDirty() { state.dirty = true; document.getElementById('title')?.classList.add('dirty'); }
function clearDirty() { state.dirty = false; document.getElementById('title')?.classList.remove('dirty'); }
let pendingDelete = null;
function confirmInline(id) {
  if (pendingDelete === id) { pendingDelete = null; return true; }
  pendingDelete = id; toast(`Click ✕ again to delete ${id}`); setTimeout(() => (pendingDelete = null), 4000);
  return false;
}
async function leaveOk() {
  if (!state.dirty) return true;
  toast('You have unsaved changes — save first', true);
  return false;
}
async function saveBible() {
  try { await api('/bible', { method: 'PUT', body: state.bible }); clearDirty(); toast('Bible saved'); }
  catch (e) { toast(e.message, true); }
}
async function saveList() {
  try { await api('/episodes/' + state.ep, { method: 'PUT', body: state.list }); clearDirty(); toast('Shot list saved'); render(); }
  catch (e) { toast(e.message, true); }
}
async function renderShot(id, draft) {
  if (state.dirty) return toast('Save the shot list first', true);
  try { await api(`/episodes/${state.ep}/shots/${id}/render`, { method: 'POST', body: { draft } }); toast(`${draft ? 'Draft' : 'Final'} render queued: ${id}`); await pollJobs(); render(); }
  catch (e) { toast(e.message, true); }
}
async function stitchEp() {
  try { toast('Stitching…'); const r = await api(`/episodes/${state.ep}/stitch`, { method: 'POST' }); toast(`Episode cut ready (${r.shots} shots${r.skipped ? `, ${r.skipped} skipped` : ''})`); render(); }
  catch (e) { toast(e.message, true); }
}
async function newEpisode() {
  if (!(await leaveOk())) return;
  const n = state.episodes.length + 1;
  const ep = `episode-${String(n).padStart(2, '0')}`;
  try { await api('/episodes', { method: 'POST', body: { episode: ep, title: `Episode ${n}` } }); state.ep = ep; toast(`Created ${ep}`); render(); }
  catch (e) { toast(e.message, true); }
}

// ---------- router ----------
const route = () => (location.hash.slice(1) in views ? location.hash.slice(1) : 'overview');
let current = null;
async function render() {
  const r = route();
  if (current && r !== current && state.dirty) {
    history.replaceState(null, '', '#' + current);
    return toast('You have unsaved changes — save first', true);
  }
  current = r;
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('on', a.getAttribute('href') === '#' + r);
  try {
    if (r === 'shots' && !state.bible) state.bible = await api('/bible').catch(() => null);
    const view = await views[r]();
    main.replaceChildren(view);
    if (state.dirty) markDirty();
  } catch (e) { main.replaceChildren(h('div', { class: 'card empty' }, 'Could not load: ' + e.message)); }
}
window.addEventListener('hashchange', render);
window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });

await loadStatus();
await render();
pollJobs();
