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
  { value: 'photography',    label: 'Photography',                  keys: ['photography'] },
  { value: 'cinematography', label: 'Cinematography',               keys: ['cinematography'] },
  { value: 'both',           label: 'Photography + Cinematography', keys: ['photography', 'cinematography'] },
  { value: 'upgrade',        label: 'Upgrade',                      keys: ['upgrade'] },
];

const DAY = 86400000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Helpers ── */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = n => '₦' + Number(n || 0).toLocaleString();
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = iso => { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d, 12); };

const fmtDate = ts => ts
  ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '';
const fmtDay = ts => ts
  ? new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  : '';
const fmtTime = hhmm => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
};

// Nigerian numbers: 0815… → 234815… so wa.me accepts them
function waNumber(phone) {
  let n = String(phone || '').replace(/[^0-9]/g, '');
  if (!n) return '';
  if (n.startsWith('234')) return n;
  if (n.startsWith('0')) return '234' + n.slice(1);
  return n;
}
const waLink = (phone, text) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

/* ── Students, cohorts, and the schedule they inherit ── */
const cohortOf = student => (data.cohorts || []).find(c => c.id === student.cohortId) || null;

function trackKeys(student) {
  const co = cohortOf(student);
  if (co && Array.isArray(co.tracks) && co.tracks.length) return co.tracks;
  if (Array.isArray(student.tracks) && student.tracks.length) return student.tracks;
  return student.track ? [student.track] : [];
}

function trackLabel(student) {
  const keys = trackKeys(student);
  const opt = TRACK_OPTIONS.find(o => o.keys.join() === keys.join());
  return opt ? opt.label : keys.map(k => (data.tracks[k] || {}).name || k).join(' + ');
}

// A student in a cohort follows the cohort's timetable
function timetableOf(student) {
  const co = cohortOf(student);
  const src = co || student;
  return {
    startDate: src.startDate || (student.startedAt ? isoOf(new Date(student.startedAt)) : todayISO()),
    days: Array.isArray(src.days) && src.days.length ? src.days.slice().sort() : null,
    time: src.time || '',
    intervalDays: Number(src.intervalDays) || 7,   // only used by older records
    cohort: co,
  };
}

const dayLabel = days => {
  if (!days || !days.length) return '';
  const names = days.map(d => DAY_NAMES[d]);
  return names.length === 1 ? names[0]
    : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
};

function classesFor(student) {
  const out = [];
  trackKeys(student).forEach(key => {
    const track = data.tracks[key];
    if (!track) return;
    (track.classes || []).forEach(c => out.push({ ...c, trackKey: key, trackName: track.name }));
  });
  return out;
}

/* Slot dates: the next `count` dates that fall on the chosen weekdays.
   Older records without weekdays fall back to a fixed interval. */
function slotDates(tt, count) {
  const out = [];
  const start = parseISO(tt.startDate);
  if (!tt.days) {
    for (let i = 0; i < count; i++) out.push(new Date(start.getTime() + i * tt.intervalDays * DAY));
    return out;
  }
  const d = new Date(start);
  let guard = 0;
  while (out.length < count && guard < 4000) {
    if (tt.days.includes(d.getDay())) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

/* A skipped session still uses its slot, so that class and the ones after
   it move to the next available date and the course ends later. */
function scheduleFor(student) {
  const classes = classesFor(student);
  const tt = timetableOf(student);
  const skipped = student.skipped || {};
  const completed = student.completed || {};
  const absences = student.absences || {};

  const slots = slotDates(tt, classes.length + Object.keys(skipped).length + 2);
  const dates = {};
  let shift = 0;
  classes.forEach((c, i) => {
    if (skipped[c.id]) shift += 1;
    dates[c.id] = slots[i + shift] || null;
  });

  const done = classes.filter(c => completed[c.id]).length;
  const total = classes.length;
  const last = classes.length ? dates[classes[classes.length - 1].id] : null;
  const daysLeft = last ? Math.ceil((last - new Date()) / DAY) : 0;

  return {
    classes, dates, tt,
    endsAt: last,
    done, total,
    classesLeft: total - done,
    missed: Object.keys(absences).length,
    pct: total ? Math.round((done / total) * 100) : 0,
    weeksLeft: Math.max(0, Math.ceil(daysLeft / 7)),
    daysLeft: Math.max(0, daysLeft),
    skips: Object.keys(skipped).length,
  };
}

const progressOf = scheduleFor;

/* The class a student is due on a given day, if any */
function classOnDate(student, iso) {
  const s = scheduleFor(student);
  const hit = s.classes.find(c => s.dates[c.id] && isoOf(s.dates[c.id]) === iso);
  return hit ? { cls: hit, sched: s } : null;
}

function registerFor(iso) {
  return data.students
    .map(st => {
      const due = classOnDate(st, iso);
      return due ? { student: st, cls: due.cls, sched: due.sched } : null;
    })
    .filter(Boolean);
}

/* ── Fees ── */
const feePaid  = st => (st.payments || []).reduce((n, p) => n + Number(p.amount || 0), 0);
const feeTotal = st => Number((st.fee && st.fee.total) || 0);
const feeOwed  = st => Math.max(0, feeTotal(st) - feePaid(st));

function findStudent(code) {
  let wanted = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!wanted) return null;
  const match = c => data.students.find(s => String(s.code).toUpperCase() === c);
  return match(wanted) || match('NEJ-' + wanted.replace(/^NEJ-?/, '')) || null;
}

function newCode() {
  let code;
  do { code = 'NEJ-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  while (data.students.some(s => s.code === code));
  return code;
}

function nextClassMessage(student) {
  const s = scheduleFor(student);
  const next = s.classes.find(c => !(student.completed || {})[c.id]);
  if (!next) return `Hi ${student.name}, you have finished the ${trackLabel(student)} course. Well done.`;
  const when = s.dates[next.id];
  const t = s.tt.time ? ` at ${fmtTime(s.tt.time)}` : '';
  return `Hi ${student.name}, your next NEJ class is "${next.title}" on ${fmtDay(when)}${t}. See you then.`;
}

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
    <div class="tp-project"><strong>${esc(pr.name)}</strong><span>${esc(pr.brief)}</span></div>`).join('');

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

const durationText = s => {
  if (!s.total) return 'No classes yet';
  const weeks = s.endsAt ? Math.max(1, Math.ceil((s.endsAt - parseISO(s.tt.startDate)) / DAY / 7)) : 0;
  const when = s.tt.days ? `${dayLabel(s.tt.days)}${s.tt.time ? ' · ' + fmtTime(s.tt.time) : ''}` : '';
  return `${s.total} classes over ${weeks} weeks${when ? ' · ' + when : ''}`;
};

const remainingText = s => {
  if (!s.total) return '';
  if (!s.classesLeft) return 'Course complete';
  const weeks = s.weeksLeft;
  const time = weeks > 1 ? `${weeks} weeks left`
    : s.daysLeft > 0 ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`
    : 'Final class due';
  return `${s.classesLeft} class${s.classesLeft === 1 ? '' : 'es'} left · ${time}`;
};

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
  el('stTrack').textContent = trackLabel(student) + (s.tt.cohort ? ` · ${s.tt.cohort.name}` : '');
  el('stTrackDesc').textContent = durationText(s);
  el('stCount').textContent = `${s.done} of ${s.total} classes`;
  el('stPct').textContent = s.pct + '%';
  el('stBar').style.width = s.pct + '%';

  el('stSchedule').innerHTML = s.total ? `
    <div class="tp-stat"><span class="tp-label">Started</span><strong>${esc(fmtDate(parseISO(s.tt.startDate)))}</strong></div>
    <div class="tp-stat"><span class="tp-label">Finishes</span><strong>${esc(fmtDate(s.endsAt))}</strong></div>
    <div class="tp-stat"><span class="tp-label">Classes left</span><strong>${s.classesLeft}</strong></div>
    <div class="tp-stat"><span class="tp-label">Time left</span><strong>${s.classesLeft ? (s.weeksLeft > 1 ? s.weeksLeft + ' weeks' : s.daysLeft + ' days') : 'Complete'}</strong></div>
  ` : '';

  el('stNext').innerHTML = nextClass
    ? `<span class="tp-label">Next class${s.dates[nextClass.id] ? ' · ' + esc(fmtDay(s.dates[nextClass.id])) + (s.tt.time ? ', ' + esc(fmtTime(s.tt.time)) : '') : ''}</span>
       <strong>${esc(nextClass.title)}</strong><p>${esc(nextClass.desc || '')}</p>`
    : `<span class="tp-label">Curriculum complete</span><strong>Every class ticked off</strong><p>Nice work. Ask your tutor about what comes next.</p>`;

  const notes = [];
  if (s.skips) notes.push(`${s.skips} class${s.skips === 1 ? ' was' : 'es were'} moved, so the finish date has shifted to ${fmtDate(s.endsAt)}.`);
  if (s.missed) notes.push(`${s.missed} class${s.missed === 1 ? '' : 'es'} marked as missed. Speak to your tutor about catching up.`);
  el('stNote').innerHTML = notes.map(esc).join('<br />');
  el('stNote').style.display = notes.length ? 'block' : 'none';

  // Fees
  const total = feeTotal(student);
  if (total) {
    el('stFees').style.display = 'block';
    el('stFees').innerHTML = `
      <h2>Course fee</h2>
      <div class="tp-stats" style="border-top:none;padding-top:0;margin-top:0">
        <div class="tp-stat"><span class="tp-label">Course fee</span><strong>${money(total)}</strong></div>
        <div class="tp-stat"><span class="tp-label">Paid</span><strong>${money(feePaid(student))}</strong></div>
        <div class="tp-stat"><span class="tp-label">Balance</span><strong style="color:${feeOwed(student) ? 'var(--gold)' : 'inherit'}">${money(feeOwed(student))}</strong></div>
      </div>
      ${(student.payments || []).length ? `<ul class="tp-points" style="margin-top:16px">${student.payments.map(p =>
        `<li>${esc(fmtDate(p.at))} · ${esc(money(p.amount))}${p.note ? ' · ' + esc(p.note) : ''}</li>`).join('')}</ul>` : ''}`;
  } else {
    el('stFees').style.display = 'none';
  }

  const prog = el('stProgramme');
  if (PROGRAMME && prog) {
    prog.innerHTML = `
      <h2>${esc(PROGRAMME.title)}</h2>
      <p class="tp-prog__dur">${esc(PROGRAMME.duration)}</p>
      <div class="tp-prog__grid">
        <div><span class="tp-label">How we teach</span>
          <ul class="tp-points">${PROGRAMME.philosophy.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul></div>
        <div><span class="tp-label">The path</span>
          <ul class="tp-points">${PROGRAMME.structure.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul></div>
      </div>`;
    prog.style.display = 'block';
  }

  let lastGroup = null;
  const multi = trackKeys(student).length > 1;
  el('stClasses').innerHTML = s.classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    const skip = (student.skipped || {})[c.id];
    const miss = (student.absences || {})[c.id];
    const isNext = nextClass && c.id === nextClass.id;
    const group = groupKey(c, multi);
    const heading = group && group.key !== lastGroup ? `<li class="tp-group">${esc(group.label)}</li>` : '';
    lastGroup = group ? group.key : lastGroup;
    const when = rec ? fmtDate(rec.at) : s.dates[c.id] ? fmtDay(s.dates[c.id]) : '';
    return heading + `
      <li class="tp-class${rec ? ' is-done' : ''}${isNext ? ' is-next' : ''}${skip ? ' is-skipped' : ''}${miss ? ' is-missed' : ''}">
        <div class="tp-class__mark">${rec ? '✓' : miss ? '!' : String(i + 1).padStart(2, '0')}</div>
        <div class="tp-class__body">
          ${c.module ? `<span class="tp-chip">${esc(c.module)}</span>` : ''}
          <div class="tp-class__title">${esc(c.title)}</div>
          ${c.desc ? `<div class="tp-class__desc">${esc(c.desc)}</div>` : ''}
          ${skip ? `<div class="tp-class__skip">Moved${skip.reason ? ': ' + esc(skip.reason) : ''} · now ${esc(fmtDay(s.dates[c.id]))}</div>` : ''}
          ${miss ? `<div class="tp-class__skip">Marked missed on ${esc(fmtDate(miss.at))}${miss.note ? ' · ' + esc(miss.note) : ''}</div>` : ''}
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
  renderRegister();
  renderCohorts();
  renderStudentList();
  renderCurriculum();
  if (selectedStudentId) renderChecklist();
}

/* ── 1. Today's register ── */
function renderRegister() {
  const iso = el('regDate').value || todayISO();
  const rows = registerFor(iso);
  el('regCount').textContent = rows.length
    ? `${rows.length} class${rows.length === 1 ? '' : 'es'} on ${fmtDay(parseISO(iso))}`
    : `Nothing scheduled on ${fmtDay(parseISO(iso))}`;

  el('register').innerHTML = rows.map(({ student, cls, sched }) => {
    const rec = (student.completed || {})[cls.id];
    const miss = (student.absences || {})[cls.id];
    const co = sched.tt.cohort;
    return `
      <div class="tp-reg${rec ? ' is-done' : ''}${miss ? ' is-missed' : ''}" data-reg="${esc(student.id)}">
        <div class="tp-reg__main">
          <div class="tp-reg__name">${esc(student.name)}${co ? ` <span class="tp-chip">${esc(co.name)}</span>` : ''}</div>
          <div class="tp-reg__class">${esc(cls.title)}${sched.tt.time ? ' · ' + esc(fmtTime(sched.tt.time)) : ''}</div>
          ${rec ? `<div class="tp-reg__state">Taught${rec.attendance === 'absent' ? ', student absent' : ''} · ${esc(fmtDate(rec.at))}</div>` : ''}
          ${miss ? `<div class="tp-reg__state">Marked missed</div>` : ''}
        </div>
        <div class="tp-reg__actions">
          <button class="tp-btn tp-btn--sm${rec ? ' tp-btn--on' : ''}" data-present="${esc(student.id)}|${esc(cls.id)}">Present</button>
          <button class="tp-btn tp-btn--sm${miss ? ' tp-btn--on' : ''}" data-absent="${esc(student.id)}|${esc(cls.id)}">Absent</button>
          <button class="tp-btn tp-btn--sm" data-regskip="${esc(student.id)}|${esc(cls.id)}">Skip class</button>
          <a class="tp-btn tp-btn--sm" target="_blank" rel="noopener"
             href="${esc(waLink(student.phone, nextClassMessage(student)))}">Remind</a>
        </div>
      </div>`;
  }).join('') || '<p class="tp-empty">No classes scheduled for this day.</p>';
}

/* ── 3. Cohorts ── */
function renderCohorts() {
  const list = el('cohortList');
  const cohorts = data.cohorts || [];
  list.innerHTML = cohorts.length ? cohorts.map(c => {
    const members = data.students.filter(s => s.cohortId === c.id);
    return `
      <div class="tp-row">
        <div class="tp-row__main">
          <div class="tp-row__name">${esc(c.name)}</div>
          <div class="tp-row__meta">${esc((c.tracks || []).map(k => (data.tracks[k] || {}).name || k).join(' + '))} · starts ${esc(fmtDate(parseISO(c.startDate)))} · ${esc(dayLabel(c.days))}${c.time ? ' · ' + esc(fmtTime(c.time)) : ''}</div>
          <div class="tp-row__meta tp-row__meta--gold">${members.length} student${members.length === 1 ? '' : 's'}</div>
        </div>
        <div class="tp-row__actions">
          <button class="tp-btn tp-btn--sm tp-btn--danger" data-delcohort="${esc(c.id)}">Delete</button>
        </div>
      </div>`;
  }).join('') : '<p class="tp-empty">No cohorts yet. Students can also run on their own timetable.</p>';

  // keep the pickers in sync
  const opts = '<option value="">On their own timetable</option>' +
    cohorts.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const ns = el('nsCohort');
  if (ns) { const v = ns.value; ns.innerHTML = opts; ns.value = v; }
  const ck = el('ckCohort');
  if (ck) { const v = ck.value; ck.innerHTML = opts; ck.value = v; }
}

function renderStudentList() {
  const list = el('tutorStudents');
  if (!data.students.length) {
    list.innerHTML = '<p class="tp-empty">No students yet. Add one above.</p>';
    return;
  }
  list.innerHTML = data.students.map(st => {
    const s = scheduleFor(st);
    const owed = feeOwed(st);
    return `
      <div class="tp-row${st.id === selectedStudentId ? ' is-active' : ''}">
        <div class="tp-row__main">
          <div class="tp-row__name">${esc(st.name)}${s.tt.cohort ? ` <span class="tp-chip">${esc(s.tt.cohort.name)}</span>` : ''}</div>
          <div class="tp-row__meta">${esc(trackLabel(st))} · ${s.done}/${s.total} classes · code ${esc(st.code)}</div>
          <div class="tp-row__meta tp-row__meta--gold">${esc(remainingText(s))}${s.endsAt ? ' · ends ' + esc(fmtDate(s.endsAt)) : ''}${feeTotal(st) ? ' · ' + (owed ? money(owed) + ' owing' : 'fees paid') : ''}</div>
          <div class="tp-row__bar"><span style="width:${s.pct}%"></span></div>
        </div>
        <div class="tp-row__actions">
          <button class="tp-btn tp-btn--sm" data-open="${esc(st.id)}">Open</button>
          <button class="tp-btn tp-btn--sm" data-copy="${esc(st.code)}">Copy link</button>
          <a class="tp-btn tp-btn--sm" target="_blank" rel="noopener" href="${esc(waLink(st.phone, nextClassMessage(st)))}">Remind</a>
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

  el('ckStart').value = s.tt.startDate;
  el('ckTime').value = s.tt.time || '';
  el('ckCohort').value = student.cohortId || '';
  el('ckEnds').textContent = s.endsAt ? fmtDate(s.endsAt) : '—';
  el('ckDays').innerHTML = DAY_NAMES.map((n, i) => `
    <label class="tp-day${(s.tt.days || []).includes(i) ? ' is-on' : ''}">
      <input type="checkbox" data-day="${i}" ${(s.tt.days || []).includes(i) ? 'checked' : ''} />${n}
    </label>`).join('');
  const inCohort = !!s.tt.cohort;
  ['ckStart', 'ckTime'].forEach(id => { el(id).disabled = inCohort; });
  el('ckDays').style.opacity = inCohort ? '.45' : '1';
  el('ckCohortNote').style.display = inCohort ? 'block' : 'none';

  // fees
  el('ckFeeTotal').value = feeTotal(student) || '';
  el('ckFeeSummary').innerHTML = feeTotal(student)
    ? `Paid ${money(feePaid(student))} of ${money(feeTotal(student))} · <strong style="color:var(--gold)">${money(feeOwed(student))} outstanding</strong>`
    : 'No fee set for this student yet.';
  el('ckPayments').innerHTML = (student.payments || []).map((p, i) => `
    <li>${esc(fmtDate(p.at))} · ${esc(money(p.amount))}${p.note ? ' · ' + esc(p.note) : ''}
      <button class="tp-link" data-delpay="${i}">remove</button></li>`).join('');

  let lastGroup = null;
  const multi = trackKeys(student).length > 1;
  el('ckList').innerHTML = s.classes.map((c, i) => {
    const rec = (student.completed || {})[c.id];
    const skip = (student.skipped || {})[c.id];
    const miss = (student.absences || {})[c.id];
    const group = groupKey(c, multi);
    const heading = group && group.key !== lastGroup ? `<li class="tp-group">${esc(group.label)}</li>` : '';
    lastGroup = group ? group.key : lastGroup;
    return heading + `
      <li class="tp-check${rec ? ' is-done' : ''}${skip ? ' is-skipped' : ''}${miss ? ' is-missed' : ''}">
        <label class="tp-check__box">
          <input type="checkbox" data-tick="${esc(c.id)}" ${rec ? 'checked' : ''} />
          <span></span>
        </label>
        <div class="tp-check__body">
          <div class="tp-check__title">${String(i + 1).padStart(2, '0')} · ${esc(c.title)}</div>
          <input class="tp-note" data-note="${esc(c.id)}" placeholder="Note for the student (optional)"
                 value="${esc(rec && rec.note ? rec.note : '')}" ${rec ? '' : 'disabled'} />
          ${skip ? `<div class="tp-check__skipnote">Moved${skip.reason ? ': ' + esc(skip.reason) : ''}</div>` : ''}
          ${miss ? `<div class="tp-check__skipnote">Student missed this class</div>` : ''}
        </div>
        <div class="tp-check__side">
          <div class="tp-check__date">${esc(rec ? fmtDate(rec.at) : fmtDay(s.dates[c.id]))}</div>
          ${rec ? '' : `
            <button class="tp-btn tp-btn--sm${miss ? ' tp-btn--on' : ''}" data-miss="${esc(c.id)}">${miss ? 'Missed' : 'Absent'}</button>
            <button class="tp-btn tp-btn--sm${skip ? ' tp-btn--on' : ''}" data-skip="${esc(c.id)}">${skip ? 'Un-skip' : 'Skip'}</button>`}
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
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

const studentById = id => data.students.find(s => s.id === id);
const pickedDays = () => [...document.querySelectorAll('#ckDays [data-day]:checked')].map(i => Number(i.dataset.day));

/* Mark a class taught. `attendance` is 'present' or 'absent'. */
async function markTaught(student, classId, attendance) {
  student.completed = student.completed || {};
  student.completed[classId] = { at: Date.now(), note: (student.completed[classId] || {}).note || '', attendance };
  if (student.skipped) delete student.skipped[classId];
  if (student.absences) delete student.absences[classId];
  await saveData();
}

async function markMissed(student, classId) {
  student.absences = student.absences || {};
  if (student.absences[classId]) delete student.absences[classId];
  else student.absences[classId] = { at: Date.now(), note: '' };
  if (student.completed) delete student.completed[classId];
  await saveData();
}

async function toggleSkip(student, classId) {
  student.skipped = student.skipped || {};
  if (student.skipped[classId]) {
    delete student.skipped[classId];
  } else {
    const reason = prompt('Why is this class moving? (optional, the student sees it)', '') ?? '';
    student.skipped[classId] = { at: Date.now(), reason: reason.trim() };
  }
  await saveData();
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

  /* ── Register ── */
  el('regDate').addEventListener('change', renderRegister);
  el('regToday').addEventListener('click', () => { el('regDate').value = todayISO(); renderRegister(); });

  el('register').addEventListener('click', async e => {
    const present = e.target.closest('[data-present]');
    const absent  = e.target.closest('[data-absent]');
    const skip    = e.target.closest('[data-regskip]');
    const hit = present || absent || skip;
    if (!hit) return;
    const [sid, cid] = (hit.dataset.present || hit.dataset.absent || hit.dataset.regskip).split('|');
    const student = studentById(sid);
    if (!student) return;

    if (present) { await markTaught(student, cid, 'present'); toast(`${student.name} marked present`); }
    if (absent)  { await markMissed(student, cid);            toast(`${student.name} marked absent`); }
    if (skip)    { await toggleSkip(student, cid);            toast('Class moved, schedule shifted'); }

    renderRegister();
    renderStudentList();
    if (selectedStudentId === sid) renderChecklist();
  });

  /* ── Cohorts ── */
  el('addCohortForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = el('coName').value.trim();
    if (!name) return;
    const days = [...document.querySelectorAll('#coDays [data-coday]:checked')].map(i => Number(i.dataset.coday));
    const opt = TRACK_OPTIONS.find(o => o.value === el('coTrack').value) || TRACK_OPTIONS[0];
    data.cohorts = data.cohorts || [];
    data.cohorts.push({
      id: 'co_' + Date.now().toString(36),
      name,
      tracks: opt.keys.slice(),
      startDate: el('coStart').value || todayISO(),
      days: days.length ? days.sort() : [1, 3, 5],
      time: el('coTime').value || '',
    });
    await saveData();
    renderTutor();
    e.target.reset();
    toast('Cohort created');
  });

  el('cohortList').addEventListener('click', async e => {
    const del = e.target.closest('[data-delcohort]');
    if (!del) return;
    const co = (data.cohorts || []).find(c => c.id === del.dataset.delcohort);
    const members = data.students.filter(s => s.cohortId === co.id);
    if (!confirm(`Delete ${co.name}?${members.length ? ` ${members.length} student(s) will move to their own timetable.` : ''}`)) return;
    members.forEach(s => {
      s.cohortId = null;
      s.startDate = co.startDate; s.days = co.days.slice(); s.time = co.time;
    });
    data.cohorts = data.cohorts.filter(c => c.id !== co.id);
    await saveData();
    renderTutor();
    toast('Cohort deleted');
  });

  /* ── Add a student ── */
  el('addStudentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = el('nsName').value.trim();
    if (!name) return;
    const opt = TRACK_OPTIONS.find(o => o.value === el('nsTrack').value) || TRACK_OPTIONS[0];
    const days = [...document.querySelectorAll('#nsDays [data-nsday]:checked')].map(i => Number(i.dataset.nsday));
    const student = {
      id: 's_' + Date.now().toString(36),
      name,
      phone: el('nsPhone').value.trim(),
      tracks: opt.keys.slice(),
      cohortId: el('nsCohort').value || null,
      code: newCode(),
      startedAt: Date.now(),
      startDate: el('nsStart').value || todayISO(),
      days: days.length ? days.sort() : [1, 3, 5],
      time: el('nsTime').value || '',
      fee: { total: Number(el('nsFee').value) || 0 },
      payments: [],
      completed: {},
      skipped: {},
      absences: {},
    };
    data.students.push(student);
    await saveData();
    selectedStudentId = student.id;
    renderTutor();
    e.target.reset();
    toast(`${student.name} added · code ${student.code}`);
  });

  /* ── Student rows ── */
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
      const student = studentById(remove.dataset.remove);
      if (!student || !confirm(`Remove ${student.name} and their progress?`)) return;
      data.students = data.students.filter(s => s.id !== student.id);
      if (selectedStudentId === student.id) selectedStudentId = null;
      await saveData();
      renderTutor();
      el('tutorChecklist').style.display = selectedStudentId ? 'block' : 'none';
      toast('Student removed');
    }
  });

  /* ── Checklist: taught, absent, skipped ── */
  el('ckList').addEventListener('change', async e => {
    const tick = e.target.closest('[data-tick]');
    if (!tick) return;
    const student = studentById(selectedStudentId);
    if (!student) return;
    if (tick.checked) await markTaught(student, tick.dataset.tick, 'present');
    else { delete student.completed[tick.dataset.tick]; await saveData(); }
    renderChecklist();
    renderStudentList();
    renderRegister();
    toast(tick.checked ? 'Class ticked off' : 'Class reopened');
  });

  el('ckList').addEventListener('click', async e => {
    const skip = e.target.closest('[data-skip]');
    const miss = e.target.closest('[data-miss]');
    if (!skip && !miss) return;
    const student = studentById(selectedStudentId);
    if (!student) return;
    if (skip) { await toggleSkip(student, skip.dataset.skip); toast('Schedule updated'); }
    if (miss) { await markMissed(student, miss.dataset.miss); toast('Attendance updated'); }
    renderChecklist();
    renderStudentList();
    renderRegister();
  });

  el('ckList').addEventListener('input', e => {
    const note = e.target.closest('[data-note]');
    if (!note) return;
    const student = studentById(selectedStudentId);
    const rec = student && student.completed && student.completed[note.dataset.note];
    if (!rec) return;
    rec.note = note.value;
    clearTimeout(note._save);
    note._save = setTimeout(() => { saveData(); toast('Note saved'); }, 700);
  });

  /* ── Per-student timetable ── */
  async function saveTimetable() {
    const student = studentById(selectedStudentId);
    if (!student) return;
    student.cohortId = el('ckCohort').value || null;
    if (!student.cohortId) {
      student.startDate = el('ckStart').value || student.startDate;
      student.time = el('ckTime').value;
      const days = pickedDays();
      if (days.length) student.days = days;
    }
    await saveData();
    renderChecklist();
    renderStudentList();
    renderRegister();
    toast('Schedule updated');
  }
  ['ckStart', 'ckTime', 'ckCohort'].forEach(id => el(id).addEventListener('change', saveTimetable));
  el('ckDays').addEventListener('change', saveTimetable);

  /* ── Fees ── */
  el('ckFeeTotal').addEventListener('change', async () => {
    const student = studentById(selectedStudentId);
    if (!student) return;
    student.fee = { total: Number(el('ckFeeTotal').value) || 0 };
    await saveData();
    renderChecklist();
    renderStudentList();
    toast('Course fee saved');
  });

  el('addPaymentForm').addEventListener('submit', async e => {
    e.preventDefault();
    const student = studentById(selectedStudentId);
    const amount = Number(el('payAmount').value);
    if (!student || !amount) return;
    student.payments = student.payments || [];
    student.payments.push({ at: Date.now(), amount, note: el('payNote').value.trim() });
    await saveData();
    e.target.reset();
    renderChecklist();
    renderStudentList();
    toast(`Payment of ${money(amount)} recorded`);
  });

  el('ckPayments').addEventListener('click', async e => {
    const del = e.target.closest('[data-delpay]');
    if (!del) return;
    const student = studentById(selectedStudentId);
    if (!student || !confirm('Remove this payment?')) return;
    student.payments.splice(Number(del.dataset.delpay), 1);
    await saveData();
    renderChecklist();
    renderStudentList();
    toast('Payment removed');
  });

  /* ── Curriculum ── */
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
  if (!el('regDate').value) el('regDate').value = todayISO();
  renderTutor();
}

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
  data.cohorts = data.cohorts || [];
  wireStudent();
  wireTutor();

  el('tabStudent').addEventListener('click', () => showView('student'));
  el('tabTutor').addEventListener('click', () => showView('tutor'));

  const fromUrl = new URLSearchParams(location.search).get('code');
  const remembered = (() => { try { return localStorage.getItem('nej_training_code'); } catch (_) { return null; } })();
  if (fromUrl) studentLookup(fromUrl);
  else if (remembered) studentLookup(remembered, { quiet: true });

  el('tpLoading').style.display = 'none';
  el('tpApp').style.display = 'block';
})();
