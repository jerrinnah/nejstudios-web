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
      classes: (window.NEJ_CURRICULUM && window.NEJ_CURRICULUM.photography) || [],
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

const PROGRAMME = (window.NEJ_CURRICULUM && window.NEJ_CURRICULUM.programme) || null;

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
      // Accept a payload with either half present: a record saved without
      // tracks must not throw the students (and their codes) away
      if (server && (server.tracks || server.students)) {
        data = {
          ...DEFAULT_DATA,
          ...server,
          tracks: { ...DEFAULT_DATA.tracks, ...(server.tracks || {}) },
          students: Array.isArray(server.students) ? server.students : [],
        };
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

/* ── Track options. "both" runs the photography and cinematography
   curricula back to back as one course. ── */
const TRACK_OPTIONS = [
  { value: 'photography',   label: 'Photography',                  keys: ['photography'] },
  { value: 'cinematography', label: 'Cinematography',              keys: ['cinematography'] },
  { value: 'both',          label: 'Photography + Cinematography',  keys: ['photography', 'cinematography'] },
  { value: 'upgrade',       label: 'Upgrade',                       keys: ['upgrade'] },
];

const DAY = 86400000;

/* ── Helpers ── */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Older records stored a single `track` string
function trackKeys(student) {
  if (Array.isArray(student.tracks) && student.tracks.length) return student.tracks;
  return student.track ? [student.track] : [];
}

function trackLabel(student) {
  const keys = trackKeys(student);
  const opt = TRACK_OPTIONS.find(o => o.keys.join() === keys.join());
  if (opt) return opt.label;
  return keys.map(k => (data.tracks[k] || {}).name || k).join(' + ');
}

// Every class the student takes, in teaching order, tagged with its track
function classesFor(student) {
  const out = [];
  trackKeys(student).forEach(key => {
    const track = data.tracks[key];
    if (!track) return;
    (track.classes || []).forEach(c => out.push({ ...c, trackKey: key, trackName: track.name }));
  });
  return out;
}

const startOf = student => {
  const iso = student.startDate;
  if (iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  return new Date(student.startedAt || Date.now());
};

/* Schedule.
   Classes run one per slot from the start date. A skipped session still uses
   up its slot, so that class and everything after it move one slot later and
   the course finishes later by the same amount. */
function scheduleFor(student) {
  const classes = classesFor(student);
  const interval = Number(student.intervalDays) || 7;
  const start = startOf(student);
  const skipped = student.skipped || {};
  const completed = student.completed || {};

  let shift = 0;
  const dates = {};
  classes.forEach((c, i) => {
    if (skipped[c.id]) shift += 1;          // the missed session pushes this one on
    dates[c.id] = new Date(start.getTime() + (i + shift) * interval * DAY);
  });

  const done = classes.filter(c => completed[c.id]).length;
  const total = classes.length;
  const last = classes.length ? dates[classes[classes.length - 1].id] : null;
  const daysLeft = last ? Math.ceil((last - new Date()) / DAY) : 0;

  return {
    classes, dates, interval, start,
    endsAt: last,
    done, total,
    classesLeft: total - done,
    pct: total ? Math.round((done / total) * 100) : 0,
    weeksLeft: Math.max(0, Math.ceil(daysLeft / 7)),
    daysLeft: Math.max(0, daysLeft),
    skips: Object.keys(skipped).length,
  };
}

function progressOf(student) { return scheduleFor(student); }

/* Classes group by week when the curriculum is timetabled, otherwise by track */
function groupKey(c, multiTrack) {
  if (c.week) {
    return {
      key: c.trackKey + '|w' + c.week,
      label: (multiTrack ? c.trackName + ' · ' : '') + 'Week ' + c.week,
    };
  }
  return multiTrack ? { key: c.trackKey, label: c.trackName } : null;
}

/* Full class detail, collapsed until the student opens it */
function classDetail(c) {
  const list = (items, cls) => items && items.length
    ? `<ul class="${cls}">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
  const lessons = (c.lessons || []).map(l => `
    <div class="tp-lesson">
      <div class="tp-lesson__title">${esc(l.title)}</div>
      ${list(l.points || [], 'tp-points')}
    </div>`).join('');
  const projects = (c.projects || []).map(pr => `
    <div class="tp-project">
      <strong>${esc(pr.name)}</strong>
      <span>${esc(pr.brief)}</span>
    </div>`).join('');

  if (!(c.objectives || c.lessons || c.projects || c.tools)) return '';
  return `
    <details class="tp-detail">
      <summary>What this class covers</summary>
      <div class="tp-detail__body">
        ${c.objectives && c.objectives.length ? `<div class="tp-detail__sec"><span class="tp-label">What we cover</span>${list(c.objectives, 'tp-points')}</div>` : ''}
        ${lessons ? `<div class="tp-detail__sec"><span class="tp-label">Lessons</span>${lessons}</div>` : ''}
        ${projects ? `<div class="tp-detail__sec"><span class="tp-label">Projects</span>${projects}</div>` : ''}
        ${c.tools && c.tools.length ? `<div class="tp-detail__sec"><span class="tp-label">What you need</span>${list(c.tools, 'tp-points')}</div>` : ''}
      </div>
    </details>`;
}

const durationText = s =>
  s.total ? `${s.total} classes over ${Math.max(1, Math.ceil(((s.total - 1) * s.interval + 1) / 7))} weeks` : 'No classes yet';

const remainingText = s => {
  if (!s.total) return '';
  if (!s.classesLeft) return 'Course complete';
  const weeks = s.weeksLeft;
  const time = weeks > 1 ? `${weeks} weeks left` : s.daysLeft > 0 ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left` : 'Final class due';
  return `${s.classesLeft} class${s.classesLeft === 1 ? '' : 'es'} left · ${time}`;
};

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
  const s = scheduleFor(student);
  const nextClass = s.classes.find(c => !(student.completed || {})[c.id]);

  el('studentGate').style.display = 'none';
  el('studentPortal').style.display = 'block';

  el('stName').textContent = student.name;
  el('stTrack').textContent = trackLabel(student);
  el('stTrackDesc').textContent = durationText(s);
  el('stCount').textContent = `${s.done} of ${s.total} classes`;
  el('stPct').textContent = s.pct + '%';
  el('stBar').style.width = s.pct + '%';

  el('stSchedule').innerHTML = s.total ? `
    <div class="tp-stat"><span class="tp-label">Started</span><strong>${esc(fmtDate(s.start))}</strong></div>
    <div class="tp-stat"><span class="tp-label">Finishes</span><strong>${esc(fmtDate(s.endsAt))}</strong></div>
    <div class="tp-stat"><span class="tp-label">Classes left</span><strong>${s.classesLeft}</strong></div>
    <div class="tp-stat"><span class="tp-label">Time left</span><strong>${s.classesLeft ? (s.weeksLeft > 1 ? s.weeksLeft + ' weeks' : s.daysLeft + ' days') : 'Complete'}</strong></div>
  ` : '';

  el('stNext').innerHTML = nextClass
    ? `<span class="tp-label">Next class${s.dates[nextClass.id] ? ' · ' + esc(fmtDate(s.dates[nextClass.id])) : ''}</span>
       <strong>${esc(nextClass.title)}</strong><p>${esc(nextClass.desc || '')}</p>`
    : `<span class="tp-label">Curriculum complete</span><strong>Every class ticked off</strong><p>Nice work. Ask your tutor about what comes next.</p>`;

  if (s.skips) {
    el('stNote').style.display = 'block';
    el('stNote').textContent = `${s.skips} class${s.skips === 1 ? ' was' : 'es were'} moved, so the finish date has shifted to ${fmtDate(s.endsAt)}.`;
  } else {
    el('stNote').style.display = 'none';
  }

  const prog = el('stProgramme');
  if (PROGRAMME && prog) {
    prog.innerHTML = `
      <h2>${esc(PROGRAMME.title)}</h2>
      <p class="tp-prog__dur">${esc(PROGRAMME.duration)}</p>
      <div class="tp-prog__grid">
        <div>
          <span class="tp-label">How we teach</span>
          <ul class="tp-points">${PROGRAMME.philosophy.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul>
        </div>
        <div>
          <span class="tp-label">The path</span>
          <ul class="tp-points">${PROGRAMME.structure.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul>
        </div>
      </div>`;
    prog.style.display = 'block';
  }

  let lastGroup = null;
  const multi = trackKeys(student).length > 1;
  el('stClasses').innerHTML = s.classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    const skip = (student.skipped || {})[c.id];
    const isNext = nextClass && c.id === nextClass.id;
    const group = groupKey(c, multi);
    const heading = group && group.key !== lastGroup ? `<li class="tp-group">${esc(group.label)}</li>` : '';
    lastGroup = group ? group.key : lastGroup;
    const when = rec ? fmtDate(rec.at) : s.dates[c.id] ? fmtDate(s.dates[c.id]) : '';
    return heading + `
      <li class="tp-class${rec ? ' is-done' : ''}${isNext ? ' is-next' : ''}${skip ? ' is-skipped' : ''}">
        <div class="tp-class__mark">${rec ? '✓' : String(i + 1).padStart(2, '0')}</div>
        <div class="tp-class__body">
          ${c.module ? `<span class="tp-chip">${esc(c.module)}</span>` : ''}
          <div class="tp-class__title">${esc(c.title)}</div>
          ${c.desc ? `<div class="tp-class__desc">${esc(c.desc)}</div>` : ''}
          ${skip ? `<div class="tp-class__skip">Moved${skip.reason ? ': ' + esc(skip.reason) : ''} · now ${esc(fmtDate(s.dates[c.id]))}</div>` : ''}
          ${rec && rec.note ? `<div class="tp-class__note"><strong>Tutor:</strong> ${esc(rec.note)}</div>` : ''}
          ${classDetail(c)}
        </div>
        <div class="tp-class__meta">${esc(when)}${isNext ? '<br />Up next' : ''}</div>
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
  list.innerHTML = data.students.map(st => {
    const s = scheduleFor(st);
    return `
      <div class="tp-row${st.id === selectedStudentId ? ' is-active' : ''}" data-student="${esc(st.id)}">
        <div class="tp-row__main">
          <div class="tp-row__name">${esc(st.name)}</div>
          <div class="tp-row__meta">${esc(trackLabel(st))} · ${s.done}/${s.total} classes · code ${esc(st.code)}</div>
          <div class="tp-row__meta tp-row__meta--gold">${esc(remainingText(s))}${s.endsAt ? ' · ends ' + esc(fmtDate(s.endsAt)) : ''}</div>
          <div class="tp-row__bar"><span style="width:${s.pct}%"></span></div>
        </div>
        <div class="tp-row__actions">
          <button class="tp-btn tp-btn--sm" data-open="${esc(st.id)}">Open</button>
          <button class="tp-btn tp-btn--sm" data-copy="${esc(st.code)}">Copy link</button>
          <button class="tp-btn tp-btn--sm tp-btn--danger" data-remove="${esc(st.id)}">Remove</button>
        </div>
      </div>`;
  }).join('');
}

function renderChecklist() {
  const student = data.students.find(x => x.id === selectedStudentId);
  const wrap = el('tutorChecklist');
  if (!student) { wrap.style.display = 'none'; return; }

  const s = scheduleFor(student);
  wrap.style.display = 'block';
  el('ckName').textContent = student.name;
  el('ckMeta').textContent =
    `${trackLabel(student)} · ${s.done}/${s.total} done · ${remainingText(s)} · code ${student.code}`;

  // Schedule controls reflect the student being edited
  el('ckStart').value = student.startDate || new Date(student.startedAt || Date.now()).toISOString().slice(0, 10);
  el('ckInterval').value = String(Number(student.intervalDays) || 7);
  el('ckEnds').textContent = s.endsAt ? fmtDate(s.endsAt) : '—';

  let lastGroup = null;
  const multi = trackKeys(student).length > 1;
  el('ckList').innerHTML = s.classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    const skip = (student.skipped || {})[c.id];
    const group = groupKey(c, multi);
    const heading = group && group.key !== lastGroup ? `<li class="tp-group">${esc(group.label)}</li>` : '';
    lastGroup = group ? group.key : lastGroup;
    return heading + `
      <li class="tp-check${rec ? ' is-done' : ''}${skip ? ' is-skipped' : ''}">
        <label class="tp-check__box">
          <input type="checkbox" data-tick="${esc(c.id)}" ${rec ? 'checked' : ''} />
          <span></span>
        </label>
        <div class="tp-check__body">
          <div class="tp-check__title">${String(i + 1).padStart(2, '0')} · ${esc(c.title)}</div>
          <input class="tp-note" data-note="${esc(c.id)}" placeholder="Note for the student (optional)"
                 value="${esc(rec && rec.note ? rec.note : '')}" ${rec ? '' : 'disabled'} />
          ${skip ? `<div class="tp-check__skipnote">Moved${skip.reason ? ': ' + esc(skip.reason) : ''}</div>` : ''}
        </div>
        <div class="tp-check__side">
          <div class="tp-check__date">${esc(rec ? fmtDate(rec.at) : fmtDate(s.dates[c.id]))}</div>
          ${rec ? '' : `<button class="tp-btn tp-btn--sm ${skip ? 'tp-btn--on' : ''}" data-skip="${esc(c.id)}">${skip ? 'Un-skip' : 'Skip'}</button>`}
        </div>
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
    const opt = TRACK_OPTIONS.find(o => o.value === el('nsTrack').value) || TRACK_OPTIONS[0];
    const student = {
      id: 's_' + Date.now().toString(36),
      name,
      phone: el('nsPhone').value.trim(),
      tracks: opt.keys.slice(),
      code: newCode(),
      startedAt: Date.now(),
      startDate: el('nsStart').value || new Date().toISOString().slice(0, 10),
      intervalDays: Number(el('nsInterval').value) || 3,
      completed: {},
      skipped: {},
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
    const id = tick.dataset.tick;
    student.completed = student.completed || {};

    if (!tick.checked) {
      // Un-ticking restores the Skip control and the scheduled date, so redraw
      delete student.completed[id];
      await saveData();
      renderChecklist();
      renderStudentList();
      toast('Class reopened');
      return;
    }

    student.completed[id] = { at: Date.now(), note: '' };
    // A class that was taught is no longer a moved one
    if (student.skipped) delete student.skipped[id];

    // Patch this row rather than re-rendering the list, so a note being typed
    // in another row is not destroyed mid-edit
    const row  = tick.closest('.tp-check');
    const note = row.querySelector('[data-note]');
    const date = row.querySelector('.tp-check__date');
    const rec  = student.completed[id];
    row.classList.add('is-done');
    row.classList.remove('is-skipped');
    row.querySelector('[data-skip]')?.remove();
    row.querySelector('.tp-check__skipnote')?.remove();
    if (note) note.disabled = false;
    if (date) date.textContent = fmtDate(rec.at);
    el('ckMeta').textContent = (() => {
      const sch = scheduleFor(student);
      return `${trackLabel(student)} · ${sch.done}/${sch.total} done · ${remainingText(sch)} · code ${student.code}`;
    })();

    renderStudentList();
    await saveData();
    toast('Class ticked off');
  });

  // Skip a class: the session is used up, so this class and the rest move on a slot
  el('ckList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-skip]');
    if (!btn) return;
    const student = data.students.find(x => x.id === selectedStudentId);
    if (!student) return;
    student.skipped = student.skipped || {};
    const id = btn.dataset.skip;
    if (student.skipped[id]) {
      delete student.skipped[id];
    } else {
      const reason = prompt('Why is this class moving? (optional, the student sees it)', '') ?? '';
      student.skipped[id] = { at: Date.now(), reason: reason.trim() };
    }
    await saveData();
    renderChecklist();
    renderStudentList();
    toast(student.skipped[id] ? 'Class moved, schedule shifted' : 'Class restored to its slot');
  });

  // Start date and cadence drive the whole schedule
  ['ckStart', 'ckInterval'].forEach(id => {
    el(id).addEventListener('change', async () => {
      const student = data.students.find(x => x.id === selectedStudentId);
      if (!student) return;
      student.startDate = el('ckStart').value;
      student.intervalDays = Number(el('ckInterval').value) || 7;
      await saveData();
      renderChecklist();
      renderStudentList();
      toast('Schedule updated');
    });
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
