/* ══════════════════════════════════════════
   NEJstudios — Training Portal
   Students look up their curriculum with an
   access code; tutors tick classes off and it
   shows on the student's portal on next load.
   ══════════════════════════════════════════ */

const TRAINING_KEY = 'nej_training';
const TUTOR_PIN    = 'nej2026';
const API          = '/api/sync.php?resource=training';

/* ── Default curriculum. Tutors edit these in the console. ── */
const DEFAULT_DATA = {
  updatedAt: 0,
  tracks: {
    photography: {
      name: 'Photography',
      desc: 'From first exposure to a paid shoot.',
      classes: [
        { id: 'p1',  title: 'Camera bodies, lenses and kit',      desc: 'What the buttons do, which lens for which job.' },
        { id: 'p2',  title: 'Exposure triangle',                  desc: 'Aperture, shutter, ISO, and reading light by eye.' },
        { id: 'p3',  title: 'Focus and composition',              desc: 'Focus modes, framing, and where to put your subject.' },
        { id: 'p4',  title: 'Natural light',                      desc: 'Direction, quality, golden hour, working with shade.' },
        { id: 'p5',  title: 'Studio lighting',                    desc: 'One light to three, modifiers, and metering.' },
        { id: 'p6',  title: 'Posing and directing',               desc: 'Getting real expressions out of nervous people.' },
        { id: 'p7',  title: 'Culling and Lightroom',              desc: 'Selecting, colour grading, and a consistent look.' },
        { id: 'p8',  title: 'Retouching in Photoshop',            desc: 'Skin, cleanup, and knowing when to stop.' },
        { id: 'p9',  title: 'Shooting a live event',              desc: 'On set with the team, real client, real pressure.' },
        { id: 'p10', title: 'Portfolio and pricing',              desc: 'Building your book and quoting your first jobs.' },
      ],
    },
    cinematography: {
      name: 'Cinematography',
      desc: 'Telling a story in moving pictures.',
      classes: [
        { id: 'c1',  title: 'Camera settings for video',          desc: 'Frame rate, shutter angle, picture profiles.' },
        { id: 'c2',  title: 'Movement and support',               desc: 'Gimbal, slider, handheld, and when to stay still.' },
        { id: 'c3',  title: 'Lighting for motion',                desc: 'Continuous light, contrast, and shaping a scene.' },
        { id: 'c4',  title: 'Sound on set',                       desc: 'Lavs, shotgun mics, levels, and room tone.' },
        { id: 'c5',  title: 'Shot lists and coverage',            desc: 'Planning a sequence so it cuts together.' },
        { id: 'c6',  title: 'Interview setups',                   desc: 'Framing, eyeline, backgrounds, two-camera setups.' },
        { id: 'c7',  title: 'Editing in Premiere',                desc: 'Assembly, pacing, and cutting to music.' },
        { id: 'c8',  title: 'Colour grading',                     desc: 'Log footage, LUTs, and matching shots.' },
        { id: 'c9',  title: 'Delivering a wedding film',          desc: 'Teaser, highlight, full film, and export settings.' },
        { id: 'c10', title: 'Working a real shoot',               desc: 'On a live production with the NEJ crew.' },
      ],
    },
    upgrade: {
      name: 'Upgrade',
      desc: 'For shooters who already work and want to level up.',
      classes: [
        { id: 'u1', title: 'Portfolio review',                    desc: 'An honest read on where your work stands.' },
        { id: 'u2', title: 'Advanced lighting',                   desc: 'Mixed sources, hard light, and difficult venues.' },
        { id: 'u3', title: 'Signature colour',                    desc: 'Building a grade that people recognise as yours.' },
        { id: 'u4', title: 'Speed and workflow',                  desc: 'Culling, backups, and delivering faster.' },
        { id: 'u5', title: 'Client experience',                   desc: 'Enquiry to delivery, and why couples refer you.' },
        { id: 'u6', title: 'Pricing and packaging',               desc: 'Raising your rates without losing bookings.' },
        { id: 'u7', title: 'Second shooting with NEJ',            desc: 'A paid day on a live wedding.' },
      ],
    },
  },
  students: [],
};

let data = JSON.parse(JSON.stringify(DEFAULT_DATA));
let serverOnline = false;   // set by loadData; drives honest error messages

/* ── Storage ── */
async function loadData() {
  try { const cached = JSON.parse(localStorage.getItem(TRAINING_KEY)); if (cached) data = cached; } catch (_) {}
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (r.ok) {
      serverOnline = true;
      const server = await r.json();
      if (server && server.tracks) {
        data = server;
        localStorage.setItem(TRAINING_KEY, JSON.stringify(data));
      }
    }
  } catch (_) { /* offline: fall back to whatever is cached */ }
  return data;
}

async function saveData() {
  data.updatedAt = Date.now();
  localStorage.setItem(TRAINING_KEY, JSON.stringify(data));
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) warnLocalOnly();
    return r.ok;
  } catch (_) { warnLocalOnly(); return false; }
}

function warnLocalOnly() {
  // Without a server write the access code lives only in this browser,
  // so the student could never sign in with it
  if (typeof toast === 'function') {
    toast('Saved on this device only — the server did not answer. Students will not see this yet.');
  }
}

/* ── Helpers ── */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const trackOf = s => data.tracks[s.track] || { name: s.track, classes: [] };

function progressOf(student) {
  const classes = trackOf(student).classes || [];
  const done = classes.filter(c => student.completed && student.completed[c.id]).length;
  return { done, total: classes.length, pct: classes.length ? Math.round((done / classes.length) * 100) : 0 };
}

function findStudent(code) {
  let wanted = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!wanted) return null;
  const match = c => data.students.find(s => String(s.code).toUpperCase() === c);
  // Accept "NEJ-AB12", "nej-ab12" or just "AB12"
  return match(wanted) || match('NEJ-' + wanted.replace(/^NEJ-?/, '')) || null;
}

function newCode() {
  let code;
  do {
    code = 'NEJ-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (data.students.some(s => s.code === code));
  return code;
}

const fmtDate = ts => ts
  ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';

/* ══════════════════════════════════════════
   STUDENT PORTAL
   ══════════════════════════════════════════ */
const el = id => document.getElementById(id);

function showStudent(student) {
  const track = trackOf(student);
  const { done, total, pct } = progressOf(student);
  const classes = track.classes || [];
  const nextClass = classes.find(c => !(student.completed || {})[c.id]);

  el('studentGate').style.display = 'none';
  el('studentPortal').style.display = 'block';

  el('stName').textContent = student.name;
  el('stTrack').textContent = track.name;
  el('stTrackDesc').textContent = track.desc || '';
  el('stCount').textContent = `${done} of ${total} classes`;
  el('stPct').textContent = pct + '%';
  el('stBar').style.width = pct + '%';

  el('stNext').innerHTML = nextClass
    ? `<span class="tp-label">Next class</span><strong>${esc(nextClass.title)}</strong><p>${esc(nextClass.desc || '')}</p>`
    : `<span class="tp-label">Curriculum complete</span><strong>Every class ticked off</strong><p>Nice work. Ask your tutor about what comes next.</p>`;

  el('stClasses').innerHTML = classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    const isNext = nextClass && c.id === nextClass.id;
    return `
      <li class="tp-class${rec ? ' is-done' : ''}${isNext ? ' is-next' : ''}">
        <div class="tp-class__mark">${rec ? '✓' : String(i + 1).padStart(2, '0')}</div>
        <div class="tp-class__body">
          <div class="tp-class__title">${esc(c.title)}</div>
          ${c.desc ? `<div class="tp-class__desc">${esc(c.desc)}</div>` : ''}
          ${rec && rec.note ? `<div class="tp-class__note"><strong>Tutor:</strong> ${esc(rec.note)}</div>` : ''}
        </div>
        <div class="tp-class__meta">${rec ? esc(fmtDate(rec.at)) : isNext ? 'Up next' : ''}</div>
      </li>`;
  }).join('') || '<li class="tp-empty">No classes on this track yet.</li>';

  try { localStorage.setItem('nej_training_code', student.code); } catch (_) {}
}

function studentLookup(code, { quiet } = {}) {
  const student = findStudent(code);
  if (!student) {
    if (!quiet) {
      el('gateError').textContent = serverOnline
        ? 'We could not find that code. Check it with your tutor.'
        : 'We could not reach the server, so your code cannot be checked. Try again in a moment.';
      el('gateError').style.display = 'block';
    }
    return false;
  }
  el('gateError').style.display = 'none';
  showStudent(student);
  return true;
}

/* ══════════════════════════════════════════
   TUTOR CONSOLE
   ══════════════════════════════════════════ */
let selectedStudentId = null;

function renderTutor() {
  renderStudentList();
  renderCurriculum();
  if (selectedStudentId) renderChecklist();
}

function renderStudentList() {
  const list = el('tutorStudents');
  if (!data.students.length) {
    list.innerHTML = '<p class="tp-empty">No students yet. Add one above.</p>';
    return;
  }
  list.innerHTML = data.students.map(s => {
    const { done, total, pct } = progressOf(s);
    return `
      <div class="tp-row${s.id === selectedStudentId ? ' is-active' : ''}" data-student="${esc(s.id)}">
        <div class="tp-row__main">
          <div class="tp-row__name">${esc(s.name)}</div>
          <div class="tp-row__meta">${esc(trackOf(s).name)} · ${done}/${total} classes · code ${esc(s.code)}</div>
          <div class="tp-row__bar"><span style="width:${pct}%"></span></div>
        </div>
        <div class="tp-row__actions">
          <button class="tp-btn tp-btn--sm" data-open="${esc(s.id)}">Open</button>
          <button class="tp-btn tp-btn--sm" data-copy="${esc(s.code)}">Copy link</button>
          <button class="tp-btn tp-btn--sm tp-btn--danger" data-remove="${esc(s.id)}">Remove</button>
        </div>
      </div>`;
  }).join('');
}

function renderChecklist() {
  const student = data.students.find(s => s.id === selectedStudentId);
  const wrap = el('tutorChecklist');
  if (!student) { wrap.style.display = 'none'; return; }

  const classes = trackOf(student).classes || [];
  const { done, total } = progressOf(student);
  wrap.style.display = 'block';
  el('ckName').textContent = student.name;
  el('ckMeta').textContent = `${trackOf(student).name} · ${done}/${total} done · portal code ${student.code}`;

  el('ckList').innerHTML = classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    return `
      <li class="tp-check${rec ? ' is-done' : ''}">
        <label class="tp-check__box">
          <input type="checkbox" data-tick="${esc(c.id)}" ${rec ? 'checked' : ''} />
          <span></span>
        </label>
        <div class="tp-check__body">
          <div class="tp-check__title">${String(i + 1).padStart(2, '0')} · ${esc(c.title)}</div>
          <input class="tp-note" data-note="${esc(c.id)}" placeholder="Note for the student (optional)"
                 value="${esc(rec && rec.note ? rec.note : '')}" ${rec ? '' : 'disabled'} />
        </div>
        <div class="tp-check__date">${rec ? esc(fmtDate(rec.at)) : ''}</div>
      </li>`;
  }).join('') || '<li class="tp-empty">This track has no classes yet.</li>';
}

function renderCurriculum() {
  const key = el('curriculumTrack').value;
  const track = data.tracks[key];
  el('curriculumList').innerHTML = (track.classes || []).map((c, i) => `
    <li class="tp-edit" data-class="${esc(c.id)}">
      <span class="tp-edit__no">${String(i + 1).padStart(2, '0')}</span>
      <div class="tp-edit__fields">
        <input class="tp-input" data-field="title" value="${esc(c.title)}" placeholder="Class title" />
        <input class="tp-input" data-field="desc" value="${esc(c.desc || '')}" placeholder="What it covers" />
      </div>
      <button class="tp-btn tp-btn--sm tp-btn--danger" data-delclass="${esc(c.id)}">Delete</button>
    </li>`).join('') || '<li class="tp-empty">No classes on this track yet.</li>';
}

/* ══════════════════════════════════════════
   EVENTS
   ══════════════════════════════════════════ */
function toast(msg) {
  const t = el('tpToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function wireStudent() {
  el('gateForm').addEventListener('submit', e => {
    e.preventDefault();
    studentLookup(el('gateCode').value);
  });
  el('stSignOut').addEventListener('click', () => {
    try { localStorage.removeItem('nej_training_code'); } catch (_) {}
    el('studentPortal').style.display = 'none';
    el('studentGate').style.display = 'block';
    el('gateCode').value = '';
  });
}

function wireTutor() {
  // PIN gate
  el('pinForm').addEventListener('submit', e => {
    e.preventDefault();
    if (el('pinInput').value === TUTOR_PIN) {
      sessionStorage.setItem('nej_training_tutor', '1');
      openTutor();
    } else {
      el('pinError').style.display = 'block';
      el('pinInput').value = '';
    }
  });

  // Add a student
  el('addStudentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = el('nsName').value.trim();
    if (!name) return;
    const student = {
      id: 's_' + Date.now().toString(36),
      name,
      phone: el('nsPhone').value.trim(),
      track: el('nsTrack').value,
      code: newCode(),
      startedAt: Date.now(),
      completed: {},
    };
    data.students.push(student);
    await saveData();
    selectedStudentId = student.id;
    renderTutor();
    e.target.reset();
    toast(`${student.name} added · code ${student.code}`);
  });

  // Student rows: open, copy link, remove
  el('tutorStudents').addEventListener('click', async e => {
    const open = e.target.closest('[data-open]');
    const copy = e.target.closest('[data-copy]');
    const remove = e.target.closest('[data-remove]');

    if (open) {
      selectedStudentId = open.dataset.open;
      renderStudentList();
      renderChecklist();
      el('tutorChecklist').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (copy) {
      const url = `${location.origin}/training?code=${encodeURIComponent(copy.dataset.copy)}`;
      try { await navigator.clipboard.writeText(url); toast('Portal link copied'); }
      catch (_) { prompt('Copy the student portal link:', url); }
    }
    if (remove) {
      const student = data.students.find(s => s.id === remove.dataset.remove);
      if (!student || !confirm(`Remove ${student.name} and their progress?`)) return;
      data.students = data.students.filter(s => s.id !== student.id);
      if (selectedStudentId === student.id) selectedStudentId = null;
      await saveData();
      renderTutor();
      el('tutorChecklist').style.display = selectedStudentId ? 'block' : 'none';
      toast('Student removed');
    }
  });

  // Tick a class off, or note against a completed one
  el('ckList').addEventListener('change', async e => {
    const student = data.students.find(s => s.id === selectedStudentId);
    if (!student) return;
    const tick = e.target.closest('[data-tick]');
    if (!tick) return;
    student.completed = student.completed || {};
    if (tick.checked) {
      student.completed[tick.dataset.tick] = { at: Date.now(), note: '' };
    } else {
      delete student.completed[tick.dataset.tick];
    }

    // Patch this row rather than re-rendering the list, so a note being typed
    // in another row is not destroyed mid-edit
    const row  = tick.closest('.tp-check');
    const note = row.querySelector('[data-note]');
    const date = row.querySelector('.tp-check__date');
    const rec  = student.completed[tick.dataset.tick];
    row.classList.toggle('is-done', tick.checked);
    if (note) { note.disabled = !tick.checked; if (!tick.checked) note.value = ''; }
    if (date) date.textContent = rec ? fmtDate(rec.at) : '';
    el('ckMeta').textContent = (() => {
      const { done, total } = progressOf(student);
      return `${trackOf(student).name} · ${done}/${total} done · portal code ${student.code}`;
    })();

    renderStudentList();
    await saveData();
    toast(tick.checked ? 'Class ticked off' : 'Class reopened');
  });

  el('ckList').addEventListener('input', e => {
    const note = e.target.closest('[data-note]');
    if (!note) return;
    const student = data.students.find(s => s.id === selectedStudentId);
    const rec = student && student.completed && student.completed[note.dataset.note];
    if (!rec) return;
    rec.note = note.value;
    clearTimeout(note._save);
    note._save = setTimeout(() => { saveData(); toast('Note saved'); }, 700);
  });

  // Curriculum editing
  el('curriculumTrack').addEventListener('change', renderCurriculum);

  el('addClassBtn').addEventListener('click', async () => {
    const track = data.tracks[el('curriculumTrack').value];
    track.classes = track.classes || [];
    track.classes.push({ id: 'k_' + Date.now().toString(36), title: 'New class', desc: '' });
    await saveData();
    renderCurriculum();
    if (selectedStudentId) renderChecklist();
  });

  el('curriculumList').addEventListener('input', e => {
    const field = e.target.closest('[data-field]');
    if (!field) return;
    const id = field.closest('[data-class]').dataset.class;
    const track = data.tracks[el('curriculumTrack').value];
    const cls = (track.classes || []).find(c => c.id === id);
    if (!cls) return;
    cls[field.dataset.field] = field.value;
    clearTimeout(field._save);
    field._save = setTimeout(() => { saveData(); toast('Curriculum saved'); }, 700);
  });

  el('curriculumList').addEventListener('click', async e => {
    const del = e.target.closest('[data-delclass]');
    if (!del) return;
    const track = data.tracks[el('curriculumTrack').value];
    const cls = (track.classes || []).find(c => c.id === del.dataset.delclass);
    if (!cls || !confirm(`Delete "${cls.title}" from ${track.name}?`)) return;
    track.classes = track.classes.filter(c => c.id !== cls.id);
    await saveData();
    renderCurriculum();
    renderStudentList();
    if (selectedStudentId) renderChecklist();
    toast('Class deleted');
  });
}

function openTutor() {
  el('tutorGate').style.display = 'none';
  el('tutorConsole').style.display = 'block';
  renderTutor();
}

/* ── View switching ── */
function showView(view) {
  const student = view === 'student';
  el('viewStudent').style.display = student ? 'block' : 'none';
  el('viewTutor').style.display = student ? 'none' : 'block';
  el('tabStudent').classList.toggle('is-active', student);
  el('tabTutor').classList.toggle('is-active', !student);
  if (!student && sessionStorage.getItem('nej_training_tutor') === '1') openTutor();
}

/* ── Boot ── */
(async function init() {
  await loadData();
  wireStudent();
  wireTutor();

  el('tabStudent').addEventListener('click', () => showView('student'));
  el('tabTutor').addEventListener('click', () => showView('tutor'));

  // A code in the link, or the one this browser used last, signs the student straight in
  const fromUrl = new URLSearchParams(location.search).get('code');
  const remembered = (() => { try { return localStorage.getItem('nej_training_code'); } catch (_) { return null; } })();
  if (fromUrl) studentLookup(fromUrl);
  else if (remembered) studentLookup(remembered, { quiet: true });

  el('tpLoading').style.display = 'none';
  el('tpApp').style.display = 'block';
})();
