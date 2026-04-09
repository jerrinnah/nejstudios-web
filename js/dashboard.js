/* ══════════════════════════════════════════════
   NEJstudios — Dashboard JS (Admin)
   Auth: Firestore PIN validation (localStorage fallback)
   Data: Firestore (bookings, tasks, team, schedule)
   ══════════════════════════════════════════════ */

const ADMIN_PIN   = 'nej2026';
const STORAGE_KEY = 'nej_bookings';
const TASKS_KEY   = 'nej_tasks';
const TEAM_KEY    = 'nej_team';
const SESSION_KEY = 'nej_session';
const SCHEDULE_KEY = 'nej_schedule';

/* ════════════════════════════════════════════
   TEAM CONFIG  ← fallback / seed data
   ════════════════════════════════════════════ */
const TEAM_CONFIG = [
  { id: 'TM-001', name: 'Light',   username: 'light',   pin: '1234', role: 'team'  },
  { id: 'TM-002', name: 'Uzo',     username: 'uzo',     pin: '1234', role: 'team'  },
  { id: 'TM-003', name: 'Moses',   username: 'moses',   pin: '1234', role: 'team'  },
  { id: 'TM-004', name: 'Lolya',   username: 'lolya',   pin: '1234', role: 'team'  },
  { id: 'TM-005', name: 'Dorathy', username: 'dorathy', pin: '0000', role: 'admin' },
];

/* ════════════════════════════════════════════
   IN-MEMORY STATE (Firestore real-time cache)
   ════════════════════════════════════════════ */
let _bookings = [];
let _tasks    = [];
let _team     = [];
let _schedule = [];
let _unsubBookings = null;
let _unsubTasks    = null;
let _unsubTeam     = null;
let _unsubSchedule = null;

/* ════════════════════════════════════════════
   STORAGE HELPERS
   ════════════════════════════════════════════ */
function getBookings()     { return db ? _bookings : JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function getTasks()        { return db ? _tasks    : JSON.parse(localStorage.getItem(TASKS_KEY)   || '[]'); }
function getScheduleItems(){ return db ? _schedule : JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); }

function saveBookings(arr) { if (!db) localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
function saveTasks(arr)    { if (!db) localStorage.setItem(TASKS_KEY,   JSON.stringify(arr)); }
function saveTeamLS(arr)   { if (!db) localStorage.setItem(TEAM_KEY,    JSON.stringify(arr)); }

function getTeam() {
  if (db) return _team;
  const stored = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
  const merged  = [...TEAM_CONFIG];
  stored.forEach(m => {
    if (!merged.find(c => c.id === m.id || c.username.toLowerCase() === m.username.toLowerCase()))
      merged.push(m);
  });
  return merged;
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setSession(obj) {
  obj ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
      : sessionStorage.removeItem(SESSION_KEY);
}

/* ════════════════════════════════════════════
   FIRESTORE REAL-TIME LISTENERS
   ════════════════════════════════════════════ */
function setupFirestoreListeners() {
  if (!db) return;

  _unsubBookings = db.collection('bookings')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      _bookings = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (activeTab === 'bookings') renderBookings();
    }, err => console.error('[NEJ] Bookings listener:', err));

  _unsubTasks = db.collection('tasks').onSnapshot(snap => {
    _tasks = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (activeTab === 'tasks') renderTasks();
    renderTasksBadge();
  }, err => console.error('[NEJ] Tasks listener:', err));

  _unsubTeam = db.collection('team_members').onSnapshot(snap => {
    _team = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (activeTab === 'team') renderTeam();
    populateAssigneeSelect();
  }, err => console.error('[NEJ] Team listener:', err));

  _unsubSchedule = db.collection('schedule')
    .orderBy('date', 'asc')
    .onSnapshot(snap => {
      _schedule = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (activeTab === 'schedule') renderSchedulePanel();
    }, err => console.error('[NEJ] Schedule listener:', err));
}

function teardownListeners() {
  if (_unsubBookings) { _unsubBookings(); _unsubBookings = null; }
  if (_unsubTasks)    { _unsubTasks();    _unsubTasks    = null; }
  if (_unsubTeam)     { _unsubTeam();     _unsubTeam     = null; }
  if (_unsubSchedule) { _unsubSchedule(); _unsubSchedule = null; }
}

/* ════════════════════════════════════════════
   SEED DEMO BOOKINGS
   ════════════════════════════════════════════ */
async function seedIfEmpty() {
  if (db) {
    const snap = await db.collection('bookings').limit(1).get();
    if (!snap.empty) return;
  } else {
    if (getBookings().length > 0) return;
  }

  const now = Date.now(), day = 86400000;
  const demos = [
    { bookingKind:'studio', firstName:'Amaka',  middleName:'Chioma',  clientName:'Amaka Chioma',  phone:'+234 801 000 0001', email:'amaka@example.com',  sessionType:'Birthday', status:'pending',   createdAt: now - day*0 },
    { bookingKind:'studio', firstName:'Tunde',  middleName:'Adeyemi', clientName:'Tunde Adeyemi', phone:'+234 802 000 0002', email:'tunde@example.com',  sessionType:'Family',   status:'confirmed', createdAt: now - day*2 },
    { bookingKind:'studio', firstName:'Ngozi',  middleName:'Eze',     clientName:'Ngozi Eze',     phone:'+234 803 000 0003', email:'ngozi@example.com',  sessionType:'Creative', status:'completed', createdAt: now - day*5 },
    { bookingKind:'studio', firstName:'Fatima', middleName:'Bello',   clientName:'Fatima Bello',  phone:'+234 804 000 0004', email:'fatima@example.com', sessionType:'Fashion',  status:'pending',   createdAt: now - day*1 },
    { bookingKind:'event', firstName:'David', lastName:'Okonkwo', clientName:'David Okonkwo', phone:'+234 805 000 0005', email:'david@example.com', eventType:'white-wedding', package:'luxury', eventDate:'2026-06-14', location:'Eko Hotel, Lagos', budget:'above1m', deliverables:'Full-day coverage, same-day edit, drone shots.', status:'confirmed', createdAt: now - day*3 },
    { bookingKind:'event', firstName:'Chidi', lastName:'Nwosu', clientName:'Chidi Nwosu', phone:'+234 806 000 0006', email:'chidi@example.com', eventType:'traditional-wedding', package:'premium', eventDate:'2026-07-20', location:'Enugu State', budget:'350-600', deliverables:'Traditional ceremony film, 200+ edited photos.', status:'pending', createdAt: now - day*1 },
    { bookingKind:'event', firstName:'Kemi', lastName:'Afolabi', clientName:'Kemi Afolabi', phone:'+234 807 000 0007', email:'kemi@example.com', eventType:'brand-film', package:'premium', eventDate:'2026-05-10', location:'Victoria Island', budget:'350-600', deliverables:'5-minute brand campaign film, 3 social cuts.', status:'completed', createdAt: now - day*10 },
    { bookingKind:'event', firstName:'Emeka', lastName:'Obi', clientName:'Emeka Obi', phone:'+234 808 000 0008', email:'emeka@example.com', eventType:'corporate-event', package:'essential', eventDate:'2026-05-28', location:'Abuja', budget:'150-350', deliverables:'4-hour event coverage, recap video.', status:'pending', createdAt: now - day*0 },
  ];

  const withIds = demos.map(b => ({ id: 'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(), ...b }));

  if (db) {
    const batch = db.batch();
    withIds.forEach(b => {
      const ref = db.collection('bookings').doc(b.id);
      batch.set(ref, b);
    });
    await batch.commit();
  } else {
    saveBookings(withIds);
  }
}

/* ════════════════════════════════════════════
   SEED TEAM MEMBERS TO FIRESTORE
   One-time setup: pushes TEAM_CONFIG to Firestore
   ════════════════════════════════════════════ */
async function seedTeamToFirestore() {
  if (!db) return;
  const snap = await db.collection('team_members').limit(1).get();
  if (!snap.empty) return; // already seeded

  const batch = db.batch();
  TEAM_CONFIG.forEach(m => {
    const ref = db.collection('team_members').doc(m.id);
    batch.set(ref, { name: m.name, username: m.username, pin: m.pin, role: m.role, createdAt: Date.now() });
  });
  await batch.commit();
  console.log('[NEJ] Team members seeded to Firestore');
}

/* ════════════════════════════════════════════
   FORMATTERS
   ════════════════════════════════════════════ */
function fmtDate(ts)       { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'medium' }); }
function fmtTime(ts)       { if (!ts) return ''; return new Date(ts).toLocaleTimeString('en-NG', { timeStyle:'short' }); }
function fmtEventDate(str) { if (!str) return '—'; return new Date(str + 'T12:00:00').toLocaleDateString('en-NG', { dateStyle:'long' }); }
function fmtDateShort(ts)  { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'short' }); }

const SESSION_EMOJI = { Birthday:'🎂', Family:'👨‍👩‍👧', Creative:'✨', Fashion:'👗', Product:'📦' };
const STATUS_LABELS  = { pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled' };
const EVENT_TYPE_LABELS = {
  'brand-film':'🎬 Brand Film','music-video':'🎵 Music Video','documentary':'🎥 Documentary',
  'corporate-event':'🏢 Corporate Event','other-production':'📹 Production',
  'traditional-wedding':'💛 Traditional Wedding','white-wedding':'🤍 White Wedding',
  'full-wedding':'💍 Full Wedding','engagement':'💌 Engagement Shoot',
};
const BUDGET_LABELS = { 'under150':'Under ₦150k','150-350':'₦150k–₦350k','350-600':'₦350k–₦600k','600-1m':'₦600k–₦1M','above1m':'Above ₦1M' };

function statusBadge(status) {
  return `<span class="status-badge status-badge--${status}">${STATUS_LABELS[status] || status}</span>`;
}
function kindBadge(kind) {
  return kind === 'event'
    ? `<span class="kind-badge kind-badge--event">Event</span>`
    : `<span class="kind-badge kind-badge--studio">Studio</span>`;
}

/* ════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════ */
let activeStatus     = 'all';
let activeKind       = 'all';
let activeType       = null;
let activeEtype      = null;
let searchQuery      = '';
let activeTaskStatus = 'all';
let editingMemberId  = null;
let activeTab        = 'bookings';

/* ════════════════════════════════════════════
   LOGIN / AUTH
   ════════════════════════════════════════════ */
const loginGate     = document.getElementById('loginGate');
const dashShell     = document.getElementById('dashShell');
const usernameInput = document.getElementById('usernameInput');
const pinInput      = document.getElementById('pinInput');
const loginBtn      = document.getElementById('loginBtn');
const loginErr      = document.getElementById('loginErr');
const logoutBtn     = document.getElementById('logoutBtn');

function isAdminAuthed() {
  const s = getSession();
  return s && s.role === 'admin';
}

async function showDash() {
  loginGate.classList.add('hidden');
  dashShell.style.display = 'flex';
  const s = getSession();
  document.getElementById('sidebarUser').textContent = s ? `Admin — ${s.username || 'admin'}` : 'Admin';
  setupFirestoreListeners();
  if (db) {
    await seedTeamToFirestore();
    await seedIfEmpty();
  } else {
    seedIfEmpty();
    renderBookings();
    renderTasksBadge();
  }
}

async function tryLogin() {
  const username = usernameInput.value.trim().toLowerCase();
  const pin      = pinInput.value.trim();

  if (!pin) { loginErr.textContent = 'Please enter your PIN.'; return; }

  loginBtn.disabled    = true;
  loginBtn.textContent = 'Signing in…';
  loginErr.textContent = '';

  try {
    if (db) {
      const snap   = await db.collection('team_members').get();
      const all    = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Admin master PIN (blank/admin username)
      if ((username === '' || username === 'admin') && pin === ADMIN_PIN) {
        setSession({ role:'admin', username:'admin', memberId:null, loginAt:Date.now() });
        showDash();
        return;
      }

      const member = all.find(m => m.username.toLowerCase() === username && m.pin === pin);
      if (member) {
        if (member.role === 'admin') {
          setSession({ role:'admin', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
          showDash();
        } else {
          setSession({ role:'team', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
          window.location.href = 'team';
        }
      } else {
        loginErr.textContent = 'Username or PIN not found. Try again.';
        pinInput.value = ''; pinInput.focus();
      }

    } else {
      // localStorage fallback
      if ((username === '' || username === 'admin') && pin === ADMIN_PIN) {
        setSession({ role:'admin', username:'admin', memberId:null, loginAt:Date.now() });
        showDash();
        return;
      }
      const team   = getTeam();
      const member = team.find(m => m.username.toLowerCase() === username && m.pin === pin);
      if (member) {
        if (member.role === 'admin') {
          setSession({ role:'admin', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
          showDash();
        } else {
          setSession({ role:'team', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
          window.location.href = 'team';
        }
      } else {
        loginErr.textContent = 'Username or PIN not found. Try again.';
        pinInput.value = ''; pinInput.focus();
      }
    }
  } catch (err) {
    console.error('[NEJ] Login error:', err);
    loginErr.textContent = 'Connection error — please try again.';
  } finally {
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Sign In';
  }
}

loginBtn.addEventListener('click', tryLogin);
pinInput.addEventListener('keydown',      e => { if (e.key === 'Enter') tryLogin(); });
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') pinInput.focus(); });

logoutBtn.addEventListener('click', () => { teardownListeners(); setSession(null); location.reload(); });

function initAuth() {
  const sess = getSession();
  if (sess && sess.role === 'admin') {
    showDash();
  } else if (sess && sess.role === 'team') {
    window.location.href = 'team';
  }
}

if (db) {
  auth.onAuthStateChanged(user => { if (user) initAuth(); });
} else {
  initAuth();
}

/* ════════════════════════════════════════════
   MOBILE SIDEBAR TOGGLE
   ════════════════════════════════════════════ */
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuBtn        = document.getElementById('menuBtn');

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); document.body.style.overflow = ''; }

menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* ════════════════════════════════════════════
   TAB SWITCHING
   ════════════════════════════════════════════ */
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const titles = { bookings:'All Bookings', tasks:'Task Management', team:'Team Members', schedule:'Shoot Schedule' };
  document.getElementById('headerTitle').textContent = titles[name] || 'Dashboard';
  if (name === 'tasks')    renderTasks();
  if (name === 'team')     renderTeam();
  if (name === 'schedule') renderSchedulePanel();
  closeSidebar();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.querySelectorAll('.nav-panel-trigger').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    switchTab(item.dataset.panel);
  });
});

/* ════════════════════════════════════════════
   BOOKING STATS
   ════════════════════════════════════════════ */
function updateStats() {
  const all = getBookings();
  document.getElementById('statTotal').textContent   = all.length;
  document.getElementById('statStudio').textContent  = all.filter(b => b.bookingKind !== 'event').length;
  document.getElementById('statEvents').textContent  = all.filter(b => b.bookingKind === 'event').length;
  document.getElementById('statPending').textContent = all.filter(b => b.status === 'pending').length;
}

/* ════════════════════════════════════════════
   BOOKING CARDS
   ════════════════════════════════════════════ */
function actionButtons(b) {
  const btns = [];
  if (b.status === 'pending') {
    btns.push(`<button class="action-btn action-btn--confirm"  data-id="${b.id}" data-action="confirmed">Confirm</button>`);
    btns.push(`<button class="action-btn action-btn--cancel"   data-id="${b.id}" data-action="cancelled">Cancel</button>`);
  }
  if (b.status === 'confirmed') {
    btns.push(`<button class="action-btn action-btn--complete" data-id="${b.id}" data-action="completed">Mark Done</button>`);
    btns.push(`<button class="action-btn action-btn--cancel"   data-id="${b.id}" data-action="cancelled">Cancel</button>`);
    // Event bookings with a date get "Add to Schedule" button
    if (b.bookingKind === 'event' && b.eventDate) {
      btns.push(`<button class="action-btn action-btn--schedule" data-id="${b.id}" data-action="add-schedule" title="Add this event to team schedule">📅 Schedule</button>`);
    }
  }
  if (['cancelled','completed'].includes(b.status)) {
    btns.push(`<button class="action-btn action-btn--pending" data-id="${b.id}" data-action="pending">Reopen</button>`);
  }
  btns.push(`<button class="action-btn action-btn--delete" data-id="${b.id}" data-action="delete">Delete</button>`);
  btns.push(`<button class="action-btn" style="border-color:var(--border);color:var(--grey-3)" data-id="${b.id}" data-action="detail">Details</button>`);
  return btns.join('');
}

function buildStudioCard(b) {
  const emoji = SESSION_EMOJI[b.sessionType] || '📸';
  return `
    <div class="booking-card" data-id="${b.id}">
      <div class="booking-card__top">
        <div>${kindBadge('studio')}<div class="booking-card__name">${b.clientName}</div><div class="booking-card__id">${b.id}</div></div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill">${emoji} ${b.sessionType}</span>
      <div class="booking-card__meta">
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg><span>${b.phone}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>${b.email}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Booked <strong>${fmtDate(b.createdAt)}</strong> at ${fmtTime(b.createdAt)}</span></div>
      </div>
      <div class="booking-card__actions">${actionButtons(b)}</div>
    </div>`;
}

function buildEventCard(b) {
  const typeLabel   = EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—';
  const budgetLabel = BUDGET_LABELS[b.budget] || b.budget || '—';
  const deliv       = b.deliverables ? b.deliverables.slice(0,120) + (b.deliverables.length > 120 ? '…' : '') : '—';
  return `
    <div class="booking-card booking-card--event" data-id="${b.id}">
      <div class="booking-card__top">
        <div>${kindBadge('event')}<div class="booking-card__name">${b.clientName}</div><div class="booking-card__id">${b.id}</div></div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill event-pill">${typeLabel}</span>
      <div class="event-fields">
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div><span class="ef-label">Event Date</span><span class="ef-value">${fmtEventDate(b.eventDate)}</span></div></div>
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><div><span class="ef-label">Location</span><span class="ef-value">${b.location || '—'}</span></div></div>
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg><div><span class="ef-label">Budget</span><span class="ef-value">${budgetLabel}</span></div></div>
        <div class="event-field event-field--full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><div><span class="ef-label">Deliverables</span><span class="ef-value ef-deliverables">${deliv}</span></div></div>
      </div>
      <div class="booking-card__meta" style="margin-top:12px">
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg><span>${b.phone}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>${b.email}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Booked <strong>${fmtDate(b.createdAt)}</strong></span></div>
      </div>
      <div class="booking-card__actions">${actionButtons(b)}</div>
    </div>`;
}

/* ════════════════════════════════════════════
   RENDER BOOKINGS
   ════════════════════════════════════════════ */
function renderBookings() {
  updateStats();
  let bookings = getBookings();
  if (activeKind === 'studio')  bookings = bookings.filter(b => b.bookingKind !== 'event');
  if (activeKind === 'event')   bookings = bookings.filter(b => b.bookingKind === 'event');
  if (activeStatus !== 'all')   bookings = bookings.filter(b => b.status === activeStatus);
  if (activeType)  bookings = bookings.filter(b => b.sessionType === activeType);
  if (activeEtype) bookings = bookings.filter(b => b.eventType === activeEtype);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    bookings = bookings.filter(b =>
      (b.clientName || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q) ||
      (b.location || '').toLowerCase().includes(q) ||
      (b.eventType || '').toLowerCase().includes(q)
    );
  }
  const grid = document.getElementById('bookingsGrid');
  if (bookings.length === 0) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><h3>No bookings found</h3><p>No bookings match the current filter.</p><a href="booking" target="_blank">+ New Studio Booking</a></div>`;
    return;
  }
  grid.innerHTML = bookings.map(b => b.bookingKind === 'event' ? buildEventCard(b) : buildStudioCard(b)).join('');
  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleBookingAction(btn.dataset.id, btn.dataset.action); });
  });
}

async function handleBookingAction(id, action) {
  if (action === 'detail')       { openDetail(id); return; }
  if (action === 'delete')       { deleteBooking(id); return; }
  if (action === 'add-schedule') { addBookingToSchedule(id); return; }

  try {
    if (db) {
      await db.collection('bookings').doc(id).update({ status: action });
      const b = getBookings().find(b => b.id === id);
      if (b) showToast(`${b.clientName} marked as ${STATUS_LABELS[action]}`);
      // onSnapshot will re-render
    } else {
      const bookings = getBookings(), idx = bookings.findIndex(b => b.id === id);
      if (idx === -1) return;
      bookings[idx].status = action;
      saveBookings(bookings);
      showToast(`${bookings[idx].clientName} marked as ${STATUS_LABELS[action]}`);
      renderBookings();
    }
  } catch (err) {
    console.error('[NEJ] Booking action error:', err);
    showToast('Error updating booking.');
  }
}

async function deleteBooking(id) {
  if (!confirm(`Delete booking ${id}? This cannot be undone.`)) return;
  try {
    if (db) {
      await db.collection('bookings').doc(id).delete();
    } else {
      saveBookings(getBookings().filter(b => b.id !== id));
      renderBookings();
    }
    showToast('Booking deleted');
  } catch (err) {
    console.error('[NEJ] Delete booking error:', err);
    showToast('Error deleting booking.');
  }
}

/* ════════════════════════════════════════════
   ADD BOOKING TO SCHEDULE
   ════════════════════════════════════════════ */
async function addBookingToSchedule(bookingId) {
  const b = getBookings().find(b => b.id === bookingId);
  if (!b || !b.eventDate) return;

  // Check if already on schedule
  const existing = getScheduleItems().find(s => s.bookingId === bookingId);
  if (existing) {
    showToast('Already on the schedule');
    switchTab('schedule');
    return;
  }

  const typeMap = {
    'white-wedding':'wedding','traditional-wedding':'wedding','full-wedding':'wedding','engagement':'wedding',
    'brand-film':'production','music-video':'production','documentary':'production',
    'corporate-event':'event','other-production':'production',
  };

  const item = {
    date:       b.eventDate,
    title:      (EVENT_TYPE_LABELS[b.eventType] || b.eventType || 'Event').replace(/^[^\w]*/, ''),
    type:       typeMap[b.eventType] || 'event',
    time:       null,
    clientName: b.clientName,
    location:   b.location || null,
    notes:      b.deliverables ? `Deliverables: ${b.deliverables.slice(0, 100)}` : null,
    bookingId,
    createdAt:  Date.now(),
  };

  try {
    if (db) {
      await db.collection('schedule').add(item);
    } else {
      const sched = getScheduleItems();
      sched.push({ id: 'SCH-' + Math.random().toString(36).slice(2,8).toUpperCase(), ...item });
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sched));
    }
    showToast(`${b.clientName} added to team schedule`);
    switchTab('schedule');
  } catch (err) {
    console.error('[NEJ] Add to schedule error:', err);
    showToast('Error adding to schedule.');
  }
}

/* ════════════════════════════════════════════
   SIDEBAR NAV (bookings)
   ════════════════════════════════════════════ */
document.querySelectorAll('.nav-item[data-view], .nav-item[data-type], .nav-item[data-etype]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    activeStatus = item.dataset.view  || 'all';
    activeKind   = item.dataset.kind  || 'all';
    activeType   = item.dataset.type  || null;
    activeEtype  = item.dataset.etype || null;
    if (activeType || activeEtype) activeStatus = 'all';
    const titles = { all:'All Bookings', pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled' };
    document.getElementById('headerTitle').textContent =
      activeType  ? `Studio — ${activeType}` :
      activeEtype ? (EVENT_TYPE_LABELS[activeEtype] || activeEtype) :
      activeKind === 'studio' ? 'All Studio Sessions' :
      activeKind === 'event'  ? 'All Events & Weddings' :
      titles[activeStatus] || 'All Bookings';
    switchTab('bookings');
    syncKindFilters();
    document.querySelectorAll('.filter-btn[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === activeStatus));
    renderBookings();
    closeSidebar();
  });
});

document.getElementById('kindFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-kind-f]');
  if (!btn) return;
  document.querySelectorAll('[data-kind-f]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeKind = btn.dataset.kindF; activeType = null; activeEtype = null;
  renderBookings();
});

function syncKindFilters() {
  document.querySelectorAll('[data-kind-f]').forEach(b => b.classList.toggle('active', b.dataset.kindF === activeKind));
}

document.getElementById('statusFilters').addEventListener('click', e => {
  const btn = e.target.closest('[data-status]');
  if (!btn) return;
  document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeStatus = btn.dataset.status;
  renderBookings();
});

document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value.trim();
  renderBookings();
});

/* ════════════════════════════════════════════
   DETAIL MODAL
   ════════════════════════════════════════════ */
const detailModal   = document.getElementById('detailModal');
const modalContent  = document.getElementById('modalContent');
const modalClose    = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');

function openDetail(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;
  const isEvent = b.bookingKind === 'event';
  const rows = [
    ['Booking ID', b.id], ['Type', isEvent ? 'Event / Wedding' : 'Studio Session'],
    ['Name', b.clientName], ['Phone', b.phone], ['Email', b.email],
    ['Status', STATUS_LABELS[b.status] || b.status],
    ...(isEvent ? [
      ['Event Type', EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—'],
      ['Event Date', fmtEventDate(b.eventDate)], ['Location', b.location || '—'],
      ['Package', b.package || '—'], ['Budget', BUDGET_LABELS[b.budget] || b.budget || '—'],
      ['Deliverables', b.deliverables || '—'],
    ] : [['Session Type', `${SESSION_EMOJI[b.sessionType] || ''} ${b.sessionType}`]]),
    ['Submitted', `${fmtDate(b.createdAt)} at ${fmtTime(b.createdAt)}`],
  ];
  modalContent.innerHTML = rows.map(([k,v]) => `<div class="detail-row"><span class="detail-row__key">${k}</span><span class="detail-row__val">${v}</span></div>`).join('');
  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() { detailModal.classList.remove('open'); document.body.style.overflow = ''; }
modalClose.addEventListener('click', closeDetail);
modalBackdrop.addEventListener('click', closeDetail);

/* ════════════════════════════════════════════
   TASKS
   ════════════════════════════════════════════ */
const taskCreateToggle = document.getElementById('taskCreateToggle');
const taskCreateBody   = document.getElementById('taskCreateBody');
taskCreateToggle.addEventListener('click', () => {
  const open = taskCreateBody.classList.toggle('open');
  taskCreateToggle.classList.toggle('open', open);
});

document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const assignee = document.getElementById('taskAssignee').value;
  const priority = document.getElementById('taskPriority').value;
  if (!title) return;

  const team   = getTeam();
  const member = team.find(m => m.id === assignee);
  const task = {
    id:           'TASK-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    title, desc,
    assignedTo:   assignee || null,
    assignedName: member ? member.name : null,
    priority,
    status:       'pending',
    createdAt:    Date.now(),
    startedAt:    null,
    completedAt:  null,
    reports:      [],
  };

  try {
    if (db) {
      await db.collection('tasks').doc(task.id).set(task);
    } else {
      const tasks = getTasks();
      tasks.unshift(task);
      saveTasks(tasks);
      renderTasks();
      renderTasksBadge();
    }
    e.target.reset();
    taskCreateBody.classList.remove('open');
    taskCreateToggle.classList.remove('open');
    showToast('Task created');
  } catch (err) {
    console.error('[NEJ] Create task error:', err);
    showToast('Error creating task.');
  }
});

document.querySelectorAll('[data-task-status]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-task-status]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTaskStatus = btn.dataset.taskStatus;
    renderTasks();
  });
});

function renderTasks() {
  let tasks = getTasks();
  if (activeTaskStatus !== 'all') tasks = tasks.filter(t => t.status === activeTaskStatus);

  const grid = document.getElementById('tasksGrid');
  if (tasks.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><h3>No tasks yet</h3><p>Create a task above to get started.</p></div>`;
    return;
  }
  grid.innerHTML = tasks.map(t => buildTaskCard(t)).join('');
  grid.querySelectorAll('[data-task-action]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); handleTaskAction(btn.dataset.id, btn.dataset.taskAction); });
  });
}

function buildTaskCard(t) {
  const prClass    = t.priority || 'medium';
  const lastReport = t.reports && t.reports.length > 0 ? t.reports[t.reports.length - 1] : null;
  const reportCount = t.reports ? t.reports.length : 0;

  return `
    <div class="task-card task-card--${t.status}">
      <div class="task-card__top">
        <div class="task-card__badges">
          <span class="priority-badge priority-badge--${prClass}">${t.priority}</span>
          <span class="status-badge status-badge--${t.status}">${t.status === 'in-progress' ? 'In Progress' : t.status.charAt(0).toUpperCase()+t.status.slice(1)}</span>
        </div>
      </div>
      <div class="task-card__title">${t.title}</div>
      ${t.desc ? `<div class="task-card__desc">${t.desc.slice(0,120)}${t.desc.length>120?'…':''}</div>` : ''}
      <div class="task-card__info">
        <div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Assigned: <strong>${t.assignedName || 'Unassigned'}</strong></div>
        <div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Created: <strong>${fmtDateShort(t.createdAt)}</strong>${t.startedAt ? ` &nbsp;·&nbsp; Started: <strong>${fmtDateShort(t.startedAt)}</strong>` : ''}${t.completedAt ? ` &nbsp;·&nbsp; Done: <strong>${fmtDateShort(t.completedAt)}</strong>` : ''}</div>
      </div>
      ${lastReport ? `<div class="task-reports-preview"><strong>${reportCount} report${reportCount>1?'s':''}</strong> — "${lastReport.content.slice(0,80)}${lastReport.content.length>80?'…':''}"</div>` : ''}
      <div class="task-card__actions">
        <button class="task-action-btn task-action-btn--reports"  data-id="${t.id}" data-task-action="reports">Reports (${reportCount})</button>
        <button class="task-action-btn task-action-btn--reassign" data-id="${t.id}" data-task-action="reassign">Reassign</button>
        <button class="task-action-btn task-action-btn--delete"   data-id="${t.id}" data-task-action="delete">Delete</button>
      </div>
    </div>`;
}

async function handleTaskAction(id, action) {
  if (action === 'delete') {
    if (!confirm('Delete this task?')) return;
    try {
      if (db) {
        await db.collection('tasks').doc(id).delete();
      } else {
        saveTasks(getTasks().filter(t => t.id !== id));
        renderTasks();
        renderTasksBadge();
      }
      showToast('Task deleted');
    } catch (err) {
      console.error('[NEJ] Delete task error:', err);
      showToast('Error deleting task.');
    }
    return;
  }
  if (action === 'reports')  { openReportsModal(id); return; }
  if (action === 'reassign') { openReassignModal(id); return; }
}

function renderTasksBadge() {
  const count    = getTasks().filter(t => t.status === 'pending').length;
  const badge    = document.getElementById('tabTasksBadge');
  const navCount = document.getElementById('navPendingTasks');
  const mnavBadge = document.getElementById('mnavTasksBadge');
  badge.textContent = count;
  badge.classList.toggle('zero', count === 0);
  if (navCount)   { navCount.textContent = count;  navCount.classList.toggle('hidden', count === 0); }
  if (mnavBadge)  { mnavBadge.textContent = count; mnavBadge.style.display = count > 0 ? 'block' : 'none'; }
}

/* ════════════════════════════════════════════
   REPORTS MODAL (admin view)
   ════════════════════════════════════════════ */
const reportsModal        = document.getElementById('reportsModal');
const reportsModalContent = document.getElementById('reportsModalContent');
const reportsModalTitle   = document.getElementById('reportsModalTitle');
const reportsModalClose   = document.getElementById('reportsModalClose');
const reportsModalBack    = document.getElementById('reportsModalBackdrop');

function openReportsModal(taskId) {
  const task = getTasks().find(t => t.id === taskId);
  if (!task) return;
  reportsModalTitle.textContent = `Reports — ${task.title}`;
  if (!task.reports || task.reports.length === 0) {
    reportsModalContent.innerHTML = `<p class="no-reports">No reports written yet. Team members submit progress reports from the Team Portal.</p>`;
  } else {
    reportsModalContent.innerHTML = `<div class="reports-list">${task.reports.map(r => `
      <div class="report-item">
        <div class="report-item__header">
          <span class="report-item__author">${r.memberName || 'Unknown'}</span>
          <span class="report-item__date">${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</span>
        </div>
        <div class="report-item__body">${r.content}</div>
      </div>`).join('')}</div>`;
  }
  reportsModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReportsModal() { reportsModal.classList.remove('open'); document.body.style.overflow = ''; }
reportsModalClose.addEventListener('click', closeReportsModal);
reportsModalBack.addEventListener('click', closeReportsModal);

/* ════════════════════════════════════════════
   REASSIGN MODAL
   ════════════════════════════════════════════ */
async function openReassignModal(taskId) {
  const task = getTasks().find(t => t.id === taskId);
  if (!task) return;
  const team = getTeam();
  if (team.length === 0) { showToast('Add team members first'); return; }

  const options = ['0: Unassigned', ...team.map((m, i) => `${i+1}: ${m.name} (@${m.username})`)].join('\n');
  const choice  = prompt(`Reassign "${task.title}"\n\n${options}\n\nEnter number:`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (isNaN(idx) || idx < 0 || idx > team.length) { showToast('Invalid choice'); return; }

  const member = idx === 0 ? null : team[idx - 1];
  try {
    if (db) {
      await db.collection('tasks').doc(taskId).update({
        assignedTo:   member ? member.id   : null,
        assignedName: member ? member.name : null,
      });
    } else {
      const tasks = getTasks();
      const tIdx  = tasks.findIndex(t => t.id === taskId);
      if (tIdx === -1) return;
      tasks[tIdx].assignedTo   = member ? member.id   : null;
      tasks[tIdx].assignedName = member ? member.name : null;
      saveTasks(tasks);
      renderTasks();
    }
    showToast(member ? `Assigned to ${member.name}` : 'Unassigned');
  } catch (err) {
    console.error('[NEJ] Reassign error:', err);
    showToast('Error reassigning task.');
  }
}

/* ════════════════════════════════════════════
   POPULATE TASK ASSIGNEE SELECT
   ════════════════════════════════════════════ */
function populateAssigneeSelect() {
  const sel  = document.getElementById('taskAssignee');
  const team = getTeam();
  const cur  = sel.value;
  sel.innerHTML = '<option value="">— Unassigned —</option>' +
    team.map(m => `<option value="${m.id}">${m.name} (@${m.username})</option>`).join('');
  if (cur) sel.value = cur;
}

/* ════════════════════════════════════════════
   TEAM MEMBERS
   ════════════════════════════════════════════ */
document.getElementById('teamForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name     = document.getElementById('tmName').value.trim();
  const username = document.getElementById('tmUsername').value.trim().toLowerCase();
  const pin      = document.getElementById('tmPin').value.trim();
  const editId   = document.getElementById('editMemberId').value;

  if (!name || !username || !pin) return;
  if (pin.length < 4) { showToast('PIN must be at least 4 characters'); return; }

  const team = getTeam();
  const duplicate = team.find(m => m.username.toLowerCase() === username && m.id !== editId);
  if (duplicate) { showToast('Username already exists'); return; }

  try {
    if (db) {
      if (editId) {
        await db.collection('team_members').doc(editId).update({ name, username, pin });
      } else {
        const newId = 'TM-' + Math.random().toString(36).slice(2,8).toUpperCase();
        await db.collection('team_members').doc(newId).set({ name, username, pin, role: 'team', createdAt: Date.now() });
      }
    } else {
      if (editId) {
        const idx = team.findIndex(m => m.id === editId);
        if (idx !== -1) { team[idx] = { ...team[idx], name, username, pin }; }
      } else {
        team.push({ id: 'TM-' + Math.random().toString(36).slice(2,8).toUpperCase(), name, username, pin, createdAt: Date.now() });
      }
      saveTeamLS(team);
      renderTeam();
      populateAssigneeSelect();
    }
    e.target.reset();
    cancelEdit();
    showToast(editId ? 'Member updated' : `${name} added to team`);
  } catch (err) {
    console.error('[NEJ] Team save error:', err);
    showToast('Error saving team member.');
  }
});

function cancelEdit() {
  editingMemberId = null;
  document.getElementById('editMemberId').value = '';
  document.getElementById('teamFormTitle').textContent  = 'Add Team Member';
  document.getElementById('teamFormSubmit').textContent = 'Add Member';
  document.getElementById('cancelEditBtn').classList.remove('visible');
  document.getElementById('tmName').value     = '';
  document.getElementById('tmUsername').value = '';
  document.getElementById('tmPin').value      = '';
}
document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

function renderTeam() {
  const team = getTeam();
  document.getElementById('teamCount').textContent = team.length;
  const grid = document.getElementById('teamGrid');

  if (team.length === 0) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><h3>No team members yet</h3><p>Add your first team member using the form.</p></div>`;
    return;
  }

  grid.innerHTML = team.map(m => {
    const initials  = m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    const taskCount = getTasks().filter(t => t.assignedTo === m.id).length;
    return `
      <div class="member-card">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${m.name}</div>
          <div class="member-username">@${m.username}</div>
          <div class="member-meta">${taskCount} task${taskCount !== 1 ? 's' : ''} assigned · Added ${fmtDateShort(m.createdAt)}</div>
        </div>
        <div class="member-actions">
          <button class="member-action-btn member-action-btn--link"   data-mid="${m.id}" title="Copy login link">🔗 Login Link</button>
          <button class="member-action-btn member-action-btn--edit"   data-mid="${m.id}">Edit</button>
          <button class="member-action-btn member-action-btn--delete" data-mid="${m.id}" data-mname="${m.name}">Remove</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.member-action-btn--link').forEach(btn => {
    btn.addEventListener('click', () => copyLoginLink(btn.dataset.mid));
  });
  grid.querySelectorAll('.member-action-btn--edit').forEach(btn => {
    btn.addEventListener('click', () => editMember(btn.dataset.mid));
  });
  grid.querySelectorAll('.member-action-btn--delete').forEach(btn => {
    btn.addEventListener('click', () => removeMember(btn.dataset.mid, btn.dataset.mname));
  });
}

function copyLoginLink(id) {
  const m = getTeam().find(m => m.id === id);
  if (!m) return;
  const payload = btoa(JSON.stringify({ id: m.id, name: m.name, username: m.username, pin: m.pin }));
  const url = `${location.origin}/team?setup=${payload}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast(`Login link for ${m.name} copied`))
    .catch(() => prompt(`Copy and send to ${m.name}:`, url));
}

function editMember(id) {
  const m = getTeam().find(m => m.id === id);
  if (!m) return;
  editingMemberId = id;
  document.getElementById('editMemberId').value  = id;
  document.getElementById('tmName').value        = m.name;
  document.getElementById('tmUsername').value    = m.username;
  document.getElementById('tmPin').value         = m.pin;
  document.getElementById('teamFormTitle').textContent  = 'Edit Team Member';
  document.getElementById('teamFormSubmit').textContent = 'Save Changes';
  document.getElementById('cancelEditBtn').classList.add('visible');
  document.querySelector('.team-form-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function removeMember(id, name) {
  if (!confirm(`Remove ${name} from the team? Their tasks will become unassigned.`)) return;
  try {
    if (db) {
      // Unassign their tasks
      const myTasks = getTasks().filter(t => t.assignedTo === id);
      const batch   = db.batch();
      myTasks.forEach(t => {
        batch.update(db.collection('tasks').doc(t.id), { assignedTo: null, assignedName: null });
      });
      batch.delete(db.collection('team_members').doc(id));
      await batch.commit();
    } else {
      const tasks = getTasks().map(t => t.assignedTo === id ? { ...t, assignedTo:null, assignedName:null } : t);
      saveTasks(tasks);
      saveTeamLS(getTeam().filter(m => m.id !== id));
      renderTeam();
      renderTasks();
      populateAssigneeSelect();
    }
    showToast(`${name} removed`);
  } catch (err) {
    console.error('[NEJ] Remove member error:', err);
    showToast('Error removing member.');
  }
}

/* ════════════════════════════════════════════
   SCHEDULE PANEL (admin management)
   ════════════════════════════════════════════ */
let editingShootId = null;

const shootCreateToggle = document.getElementById('shootCreateToggle');
const shootCreateBody   = document.getElementById('shootCreateBody');
shootCreateToggle.addEventListener('click', () => {
  const open = shootCreateBody.classList.toggle('open');
  shootCreateToggle.classList.toggle('open', open);
});

document.getElementById('shootForm').addEventListener('submit', async e => {
  e.preventDefault();
  const date       = document.getElementById('shootDate').value;
  const title      = document.getElementById('shootTitle').value.trim();
  const type       = document.getElementById('shootType').value;
  const time       = document.getElementById('shootTime').value.trim() || null;
  const clientName = document.getElementById('shootClient').value.trim() || null;
  const location   = document.getElementById('shootLocation').value.trim() || null;
  const notes      = document.getElementById('shootNotes').value.trim() || null;

  if (!date || !title) return;

  const item = { date, title, type, time, clientName, location, notes, createdAt: Date.now() };

  try {
    if (db) {
      if (editingShootId) {
        await db.collection('schedule').doc(editingShootId).update({ date, title, type, time, clientName, location, notes });
      } else {
        await db.collection('schedule').add(item);
      }
    } else {
      const sched = getScheduleItems();
      if (editingShootId) {
        const idx = sched.findIndex(s => s.id === editingShootId);
        if (idx !== -1) Object.assign(sched[idx], { date, title, type, time, clientName, location, notes });
      } else {
        sched.push({ id: 'SCH-' + Math.random().toString(36).slice(2,8).toUpperCase(), ...item });
      }
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sched));
      renderSchedulePanel();
    }
    e.target.reset();
    cancelShootEdit();
    showToast(editingShootId ? 'Shoot updated' : 'Shoot added to schedule');
  } catch (err) {
    console.error('[NEJ] Save shoot error:', err);
    showToast('Error saving shoot.');
  }
});

function cancelShootEdit() {
  editingShootId = null;
  document.getElementById('shootFormTitle').textContent  = 'Add Shoot / Event';
  document.getElementById('shootFormSubmit').textContent = 'Add to Schedule';
  document.getElementById('cancelShootEditBtn').classList.remove('visible');
  document.getElementById('shootDate').value     = '';
  document.getElementById('shootTitle').value    = '';
  document.getElementById('shootTime').value     = '';
  document.getElementById('shootClient').value   = '';
  document.getElementById('shootLocation').value = '';
  document.getElementById('shootNotes').value    = '';
  shootCreateBody.classList.remove('open');
  shootCreateToggle.classList.remove('open');
}
document.getElementById('cancelShootEditBtn').addEventListener('click', cancelShootEdit);

function renderSchedulePanel() {
  const grid     = document.getElementById('scheduleAdminGrid');
  const todayStr = new Date().toISOString().slice(0, 10);
  const items    = getScheduleItems().slice().sort((a, b) => a.date.localeCompare(b.date));

  const upcoming = items.filter(s => s.date >= todayStr);
  const past     = items.filter(s => s.date < todayStr).slice(-10).reverse();

  document.getElementById('scheduleUpcomingCount').textContent = upcoming.length;

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>No shoots scheduled yet</h3>
        <p>Add a shoot above — it will instantly appear in the Team Portal.</p>
      </div>`;
    return;
  }

  const typeLabel = { studio:'Studio', wedding:'Wedding', event:'Event', production:'Production', meeting:'Meeting' };

  function buildAdminCard(s, isPast) {
    const d       = new Date(s.date + 'T00:00:00');
    const day     = d.getDate();
    const month   = d.toLocaleString('en-NG', { month:'short' }).toUpperCase();
    const isToday = s.date === todayStr;
    const cls     = isToday ? 'sch-card--today' : (isPast ? 'sch-card--past' : '');
    const lbl     = typeLabel[s.type] || s.type;
    return `
      <div class="sch-card ${cls}">
        <div class="sch-date-block">
          <div class="sch-date-block__day">${day}</div>
          <div class="sch-date-block__month">${month}</div>
        </div>
        <div class="sch-body">
          <div class="sch-body__top">
            <span class="sch-type-badge sch-type--${s.type}">${lbl}</span>
            ${isToday ? '<span class="sch-today-pill">Today</span>' : ''}
            ${s.bookingId ? '<span class="sch-booking-pill">From Booking</span>' : ''}
          </div>
          <div class="sch-body__title">${s.title}</div>
          <div class="sch-body__meta">
            ${s.time       ? `<span>🕐 ${s.time}</span>`       : ''}
            ${s.clientName ? `<span>👤 ${s.clientName}</span>` : ''}
            ${s.location   ? `<span>📍 ${s.location}</span>`   : ''}
          </div>
          ${s.notes ? `<div class="sch-body__notes">${s.notes}</div>` : ''}
          <div class="sch-admin-actions">
            <button class="sch-admin-btn sch-admin-btn--edit"   data-sid="${s.id}">Edit</button>
            <button class="sch-admin-btn sch-admin-btn--delete" data-sid="${s.id}">Delete</button>
          </div>
        </div>
      </div>`;
  }

  let html = '';
  if (upcoming.length > 0) {
    html += upcoming.map(s => buildAdminCard(s, false)).join('');
  } else {
    html += `<div class="sch-section-label" style="margin-bottom:8px">No upcoming shoots. Add one above.</div>`;
  }
  if (past.length > 0) {
    html += `<div class="sch-section-label">Past</div>`;
    html += past.map(s => buildAdminCard(s, true)).join('');
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.sch-admin-btn--edit').forEach(btn => {
    btn.addEventListener('click', () => editShoot(btn.dataset.sid));
  });
  grid.querySelectorAll('.sch-admin-btn--delete').forEach(btn => {
    btn.addEventListener('click', () => deleteShoot(btn.dataset.sid));
  });
}

function editShoot(id) {
  const s = getScheduleItems().find(s => s.id === id);
  if (!s) return;
  editingShootId = id;
  document.getElementById('shootDate').value     = s.date     || '';
  document.getElementById('shootTitle').value    = s.title    || '';
  document.getElementById('shootType').value     = s.type     || 'studio';
  document.getElementById('shootTime').value     = s.time     || '';
  document.getElementById('shootClient').value   = s.clientName || '';
  document.getElementById('shootLocation').value = s.location || '';
  document.getElementById('shootNotes').value    = s.notes    || '';
  document.getElementById('shootFormTitle').textContent  = 'Edit Shoot';
  document.getElementById('shootFormSubmit').textContent = 'Save Changes';
  document.getElementById('cancelShootEditBtn').classList.add('visible');
  shootCreateBody.classList.add('open');
  shootCreateToggle.classList.add('open');
  document.querySelector('.shoot-create-wrap').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function deleteShoot(id) {
  if (!confirm('Remove this shoot from the schedule?')) return;
  try {
    if (db) {
      await db.collection('schedule').doc(id).delete();
    } else {
      const sched = getScheduleItems().filter(s => s.id !== id);
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(sched));
      renderSchedulePanel();
    }
    showToast('Shoot removed from schedule');
  } catch (err) {
    console.error('[NEJ] Delete shoot error:', err);
    showToast('Error removing shoot.');
  }
}

/* ════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════ */
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ════════════════════════════════════════════
   KEYBOARD + CROSS-TAB SYNC (localStorage only)
   ════════════════════════════════════════════ */
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetail(); closeReportsModal(); } });
window.addEventListener('storage', e => {
  if (!isAdminAuthed() || db) return;
  if (e.key === STORAGE_KEY)  renderBookings();
  if (e.key === TASKS_KEY)    { renderTasks(); renderTasksBadge(); }
  if (e.key === TEAM_KEY)     renderTeam();
  if (e.key === SCHEDULE_KEY) renderSchedulePanel();
});
