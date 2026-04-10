/* ══════════════════════════════════════════════
   NEJstudios — Dashboard JS (Admin)
   Auth: username+PIN multi-role · Bookings · Tasks · Team
   ══════════════════════════════════════════════ */

const ADMIN_PIN     = 'nej2026';      // ← change this
const STORAGE_KEY   = 'nej_bookings';
const TASKS_KEY     = 'nej_tasks';
const TEAM_KEY      = 'nej_team';
const SESSION_KEY   = 'nej_session';
const APPROVALS_KEY = 'nej_approvals';

/* ════════════════════════════════════════════
   TEAM CONFIG  ← add / edit team members here
   These work on ALL devices without needing localStorage.
   Format: { id, name, username, pin }
   ════════════════════════════════════════════ */
const TEAM_CONFIG = [
  { id: 'TM-001', name: 'Light',   username: 'light',   pin: '1234', role: 'team'  },
  { id: 'TM-002', name: 'Uzo',     username: 'uzo',     pin: '1234', role: 'team'  },
  { id: 'TM-003', name: 'Moses',   username: 'moses',   pin: '1234', role: 'team'  },
  { id: 'TM-004', name: 'Lolya',   username: 'lolya',   pin: '1234', role: 'team'  },
  { id: 'TM-005', name: 'Dorathy', username: 'dorathy', pin: '0000', role: 'admin' },
];

/* ════════════════════════════════════════════
   STORAGE HELPERS
   ════════════════════════════════════════════ */
function getBookings()     { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveBookings(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
function saveTeam(arr)     { localStorage.setItem(TEAM_KEY, JSON.stringify(arr)); }

// Merges hardcoded TEAM_CONFIG with members added via the UI (localStorage).
// TEAM_CONFIG entries take precedence so credentials always work cross-device.
function getTeam() {
  const stored = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
  const merged = [...TEAM_CONFIG];
  stored.forEach(m => {
    if (!merged.find(c => c.id === m.id || c.username.toLowerCase() === m.username.toLowerCase())) {
      merged.push(m);
    }
  });
  return merged;
}

function getApprovals()               { return JSON.parse(localStorage.getItem(APPROVALS_KEY) || '{}'); }
function saveApproval(bookingId, imgId, value) {
  const all = getApprovals();
  if (!all[bookingId]) all[bookingId] = {};
  if (value === null) delete all[bookingId][imgId];
  else all[bookingId][imgId] = value;
  localStorage.setItem(APPROVALS_KEY, JSON.stringify(all));
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
   SEED DEMO BOOKINGS
   ════════════════════════════════════════════ */
function seedIfEmpty() {
  if (localStorage.getItem('nej_bookings_seeded')) return;
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
  saveBookings(demos.map(b => ({ id: 'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(), ...b })));
  localStorage.setItem('nej_bookings_seeded', '1');
}

/* ════════════════════════════════════════════
   PUSH NOTIFICATIONS
   ════════════════════════════════════════════ */
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
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
let activeStatus  = 'all';
let activeKind    = 'all';
let activeType    = null;
let activeEtype   = null;
let searchQuery   = '';
let activeTaskStatus = 'all';
let editingMemberId  = null;

/* ════════════════════════════════════════════
   LOGIN / AUTH
   ════════════════════════════════════════════ */
const loginGate   = document.getElementById('loginGate');
const dashShell   = document.getElementById('dashShell');
const usernameInput = document.getElementById('usernameInput');
const pinInput    = document.getElementById('pinInput');
const loginBtn    = document.getElementById('loginBtn');
const loginErr    = document.getElementById('loginErr');
const logoutBtn   = document.getElementById('logoutBtn');

function isAdminAuthed() {
  const s = getSession();
  return s && s.role === 'admin';
}

function showDash() {
  loginGate.classList.add('hidden');
  dashShell.style.display = 'flex';
  const s = getSession();
  document.getElementById('sidebarUser').textContent = s ? `Admin — ${s.username || 'admin'}` : 'Admin';
  seedIfEmpty();
  renderBookings();
  renderTasksBadge();
  requestNotifPermission();
}

function tryLogin() {
  const username = usernameInput.value.trim().toLowerCase();
  const pin      = pinInput.value.trim();

  if (!pin) { loginErr.textContent = 'Please enter your PIN.'; return; }

  // Admin login: blank username or "admin", correct PIN
  if (username === '' || username === 'admin') {
    if (pin === ADMIN_PIN) {
      loginErr.textContent = '';
      setSession({ role:'admin', username:'admin', memberId:null, loginAt:Date.now() });
      showDash();
    } else {
      loginErr.textContent = 'Incorrect PIN. Try again.';
      pinInput.value = ''; pinInput.focus();
    }
    return;
  }

  // Team / admin member login: look up by username + PIN
  const team   = getTeam();
  const member = team.find(m => m.username.toLowerCase() === username && m.pin === pin);
  if (member) {
    loginErr.textContent = '';
    if (member.role === 'admin') {
      setSession({ role:'admin', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
      showDash();
    } else {
      setSession({ role:'team', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
      window.location.href = 'team';
    }
    return;
  }

  // Wrong credentials
  loginErr.textContent = 'Username or PIN not found. Try again.';
  pinInput.value = ''; pinInput.focus();
}

loginBtn.addEventListener('click', tryLogin);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') pinInput.focus(); });

logoutBtn.addEventListener('click', () => { setSession(null); location.reload(); });

// On load: check session
const sess = getSession();
if (sess && sess.role === 'admin') {
  showDash();
} else if (sess && sess.role === 'team') {
  window.location.href = 'team';
}

/* ════════════════════════════════════════════
   MOBILE SIDEBAR TOGGLE
   ════════════════════════════════════════════ */
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebarOverlay');
const menuBtn         = document.getElementById('menuBtn');

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); document.body.style.overflow = ''; }

menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* ════════════════════════════════════════════
   TAB SWITCHING
   ════════════════════════════════════════════ */
function switchTab(name) {
  // Tab nav buttons
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  // Panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  // Mobile bottom nav
  document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  // Header title
  const titles = { bookings:'All Bookings', schedule:'Schedule', tasks:'Task Management', team:'Team Members', gallery:'Gallery Links', summary:'Daily Summary' };
  document.getElementById('headerTitle').textContent = titles[name] || 'Dashboard';
  // Load panel content
  if (name === 'schedule') renderAdminSchedule();
  if (name === 'tasks')    renderTasks();
  if (name === 'team')     renderTeam();
  if (name === 'gallery')  renderGalleryPanel();
  if (name === 'summary')  renderDailySummary();
  closeSidebar();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Sidebar panel triggers (Tasks / Team nav items)
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
    btns.push(`<button class="action-btn" style="border-color:var(--gold);color:var(--gold)" data-id="${b.id}" data-action="invoice">Invoice</button>`);
  }
  if (b.status === 'completed') {
    btns.push(`<button class="action-btn action-btn--pending"  data-id="${b.id}" data-action="pending">Reopen</button>`);
    btns.push(`<button class="action-btn" style="border-color:var(--gold);color:var(--gold)" data-id="${b.id}" data-action="invoice">Invoice</button>`);
    btns.push(`<button class="action-btn" style="border-color:var(--green);color:var(--green)" data-id="${b.id}" data-action="send-gallery">Gallery</button>`);
  }
  if (b.status === 'cancelled') {
    btns.push(`<button class="action-btn action-btn--pending"  data-id="${b.id}" data-action="pending">Reopen</button>`);
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
        <div class="event-field"><span style="font-size:1rem;flex-shrink:0">₦</span><div><span class="ef-label">Budget</span><span class="ef-value">${budgetLabel}</span></div></div>
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
  if (activeKind === 'studio') bookings = bookings.filter(b => b.bookingKind !== 'event');
  if (activeKind === 'event')  bookings = bookings.filter(b => b.bookingKind === 'event');
  if (activeStatus !== 'all')  bookings = bookings.filter(b => b.status === activeStatus);
  if (activeType)   bookings = bookings.filter(b => b.sessionType === activeType);
  if (activeEtype)  bookings = bookings.filter(b => b.eventType === activeEtype);
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
  if (action === 'detail')       { openDetail(id);      return; }
  if (action === 'delete')       { deleteBooking(id);   return; }
  if (action === 'invoice')      { openInvoice(id);     return; }
  if (action === 'send-gallery') { openSendGallery(id); return; }
  const bookings = getBookings(), idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;
  bookings[idx].status = action;
  saveBookings(bookings);

  // When confirmed, push to Supabase schedule so team can see it
  if (action === 'confirmed') {
    const b = bookings[idx];
    const EVENT_MAP = {
      'white-wedding':'wedding', 'traditional-wedding':'wedding',
      'brand-film':'production', 'corporate-event':'event',
      'music-video':'production', 'documentary':'production',
      'birthday':'event', 'other-event':'event'
    };
    const schedType = b.bookingKind === 'event' ? (EVENT_MAP[b.eventType] || 'event') : 'studio';
    const entry = {
      id:         'BK-' + id,
      title:      b.clientName + (b.sessionType ? ` — ${b.sessionType}` : b.eventType ? ` — ${EVENT_TYPE_LABELS[b.eventType] || b.eventType}` : ''),
      date:       b.eventDate || new Date().toISOString().slice(0, 10),
      time:       b.sessionTime || null,
      type:       schedType,
      clientName: b.clientName,
      location:   b.location || null,
      notes:      b.deliverables || null,
      createdAt:  Date.now(),
    };
    await dbAddScheduleEntry(entry);
    showToast(`${b.clientName} confirmed — added to team schedule ✓`);
  } else {
    showToast(`${bookings[idx].clientName} marked as ${STATUS_LABELS[action]}`);
  }

  renderBookings();
}

function deleteBooking(id) {
  if (!confirm(`Delete booking ${id}? This cannot be undone.`)) return;
  saveBookings(getBookings().filter(b => b.id !== id));
  showToast('Booking deleted');
  renderBookings();
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
    // Switch to bookings tab
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

/* ════════════════════════════════════════════
   CLIENT GALLERY — storage helpers
   ════════════════════════════════════════════ */
const GALLERY_KEY = 'nej_gallery';

function getGalleries()      { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '{}'); }
function getClientGallery(bookingId) { return getGalleries()[bookingId] || []; }
function saveClientGallery(bookingId, imgs) {
  const all = getGalleries();
  all[bookingId] = imgs;
  localStorage.setItem(GALLERY_KEY, JSON.stringify(all));
}

function downloadDataUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

async function downloadAsZip(imgs, zipName) {
  if (!window.JSZip) { showToast('ZIP library not loaded yet, try again.', 'err'); return; }
  const zip = new JSZip();
  imgs.forEach((img, i) => {
    const ext  = img.name.includes('.') ? '' : '.jpg';
    const name = img.name + ext;
    // strip data URL header → raw base64
    const b64  = img.url.split(',')[1];
    const mime = img.url.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    zip.file(name, b64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = zipName + '.zip'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function renderGallery(bookingId) {
  const imgs   = getClientGallery(bookingId);
  const grid   = document.getElementById('galleryGrid');
  const count  = document.getElementById('galleryCount');
  const dlBtn  = document.getElementById('galleryDlBtn');
  const selBtn = document.getElementById('gallerySelBtn');
  if (!grid) return;

  const approvals = (getApprovals()[bookingId]) || {};

  if (!imgs.length) {
    grid.innerHTML = '<div class="gallery-empty">No photos uploaded yet.</div>';
    if (dlBtn)  { dlBtn.disabled = true; }
    if (selBtn) { selBtn.disabled = true; }
  } else {
    grid.innerHTML = imgs.map(img => {
      const approval = approvals[img.id];
      let badgeHtml = '';
      if (approval === 'keep') {
        badgeHtml = `<div class="gallery-thumb__approval gallery-thumb__approval--keep" title="Client: Keep">✓</div>`;
      } else if (approval === 'remove') {
        badgeHtml = `<div class="gallery-thumb__approval gallery-thumb__approval--remove" title="Client: Remove">✕</div>`;
      }
      return `
      <div class="gallery-thumb" data-id="${img.id}" data-name="${img.name}">
        <img src="${img.url}" alt="${img.name}" loading="lazy">
        <div class="gallery-thumb__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        ${badgeHtml}
        <div class="gallery-thumb__overlay">
          <button class="gallery-thumb__btn dl" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="gallery-thumb__btn del" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');

    // wire thumb buttons
    grid.querySelectorAll('.gallery-thumb').forEach(thumb => {
      const id   = thumb.dataset.id;
      const name = thumb.dataset.name;
      const img  = imgs.find(i => i.id === id);
      thumb.querySelector('.dl').addEventListener('click', e => { e.stopPropagation(); downloadDataUrl(img.url, name); });
      thumb.querySelector('.del').addEventListener('click', e => { e.stopPropagation(); deleteGalleryImg(bookingId, id); });
      thumb.addEventListener('click', () => {
        if (grid.classList.contains('select-mode')) {
          thumb.classList.toggle('selected');
          updateSelectionUI(bookingId);
        } else {
          // Open lightbox
          openLightbox(bookingId, imgs, imgs.findIndex(i => i.id === id));
        }
      });
    });

    if (dlBtn)  dlBtn.disabled  = false;
    if (selBtn) selBtn.disabled = false;
  }
  if (count) count.textContent = imgs.length ? `· ${imgs.length} photo${imgs.length !== 1 ? 's' : ''}` : '';
}

function updateSelectionUI(bookingId) {
  const grid    = document.getElementById('galleryGrid');
  const dlBtn   = document.getElementById('galleryDlBtn');
  const selBtn  = document.getElementById('gallerySelBtn');
  if (!grid) return;
  const selected = grid.querySelectorAll('.gallery-thumb.selected');
  const inSelect = grid.classList.contains('select-mode');
  if (inSelect) {
    dlBtn.textContent = selected.length ? `↓ Download (${selected.length})` : '↓ Download All';
  }
}

function toggleSelectMode(bookingId) {
  const grid   = document.getElementById('galleryGrid');
  const selBtn = document.getElementById('gallerySelBtn');
  const dlBtn  = document.getElementById('galleryDlBtn');
  if (!grid) return;
  const on = grid.classList.toggle('select-mode');
  selBtn.classList.toggle('active', on);
  selBtn.textContent = on ? 'Done' : 'Select';
  if (!on) {
    grid.querySelectorAll('.gallery-thumb.selected').forEach(t => t.classList.remove('selected'));
    dlBtn.textContent = '↓ Download All';
  }
}

function deleteGalleryImg(bookingId, imgId) {
  const imgs = getClientGallery(bookingId).filter(i => i.id !== imgId);
  saveClientGallery(bookingId, imgs);
  renderGallery(bookingId);
}

function handleGalleryUpload(bookingId, files) {
  const list = document.getElementById('galleryProgressList');
  if (!list) return;
  const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!fileArr.length) { showToast('Please select image files.', 'err'); return; }

  fileArr.forEach(file => {
    const itemId = 'prog-' + Math.random().toString(36).slice(2, 8);
    const item = document.createElement('div');
    item.className = 'gallery-progress-item';
    item.id = itemId;
    item.innerHTML = `
      <div class="gallery-progress-item__name">${file.name}</div>
      <div class="gallery-progress-bar"><div class="gallery-progress-bar__fill" style="width:0%"></div></div>
      <div class="gallery-progress-item__pct">0%</div>`;
    list.appendChild(item);

    const reader = new FileReader();
    reader.onprogress = e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 90); // go to 90% during read
      const fill = item.querySelector('.gallery-progress-bar__fill');
      const pctEl = item.querySelector('.gallery-progress-item__pct');
      if (fill) fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    };
    reader.onload = e => {
      const fill = item.querySelector('.gallery-progress-bar__fill');
      const pctEl = item.querySelector('.gallery-progress-item__pct');
      if (fill) fill.style.width = '100%';
      if (pctEl) pctEl.textContent = '100%';
      item.classList.add('done');

      try {
        const imgs = getClientGallery(bookingId);
        imgs.push({ id: 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2,6), name: file.name, url: e.target.result, uploadedAt: Date.now() });
        saveClientGallery(bookingId, imgs);
        renderGallery(bookingId);
      } catch {
        showToast('Storage full — try smaller or fewer images.', 'err');
      }

      // Remove progress item after a short delay
      setTimeout(() => item.remove(), 1200);
    };
    reader.onerror = () => {
      item.querySelector('.gallery-progress-item__pct').textContent = 'Error';
      setTimeout(() => item.remove(), 2000);
    };
    reader.readAsDataURL(file);
  });
}

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

  modalContent.innerHTML =
    rows.map(([k,v]) => `<div class="detail-row"><span class="detail-row__key">${k}</span><span class="detail-row__val">${v}</span></div>`).join('') +
    `<div class="gallery-section">
      <div class="gallery-section__header">
        <div class="gallery-section__title">Client Gallery <span class="gallery-count" id="galleryCount"></span></div>
        <div class="gallery-section__actions">
          <button class="gallery-btn" id="galleryWatermarkBtn">Watermark</button>
          <button class="gallery-btn" id="galleryCopyLinkBtn">Copy Client Link</button>
          <button class="gallery-btn" id="gallerySelBtn" disabled>Select</button>
          <button class="gallery-btn" id="galleryDlBtn" disabled>↓ Download All</button>
        </div>
      </div>
      <div class="gallery-dropzone" id="galleryDropzone">
        <input type="file" id="galleryInput" accept="image/*" multiple>
        <svg class="gallery-dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <div class="gallery-dropzone__label">Click or drag &amp; drop photos</div>
        <div class="gallery-dropzone__sub">JPG, PNG, WEBP · multiple files supported</div>
      </div>
      <div class="gallery-progress-list" id="galleryProgressList"></div>
      <div class="gallery-grid" id="galleryGrid"></div>
    </div>`;

  // Wire up upload input
  const input = document.getElementById('galleryInput');
  const dropzone = document.getElementById('galleryDropzone');
  input.addEventListener('change', () => handleGalleryUpload(id, input.files));
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleGalleryUpload(id, e.dataTransfer.files);
  });

  renderGallery(id);

  // Watermark toggle
  document.getElementById('galleryWatermarkBtn').addEventListener('click', () => {
    const grid = document.getElementById('galleryGrid');
    const btn  = document.getElementById('galleryWatermarkBtn');
    if (!grid) return;
    const on = grid.classList.toggle('watermark-on');
    btn.classList.toggle('active', on);
    btn.textContent = on ? 'Watermark ✓' : 'Watermark';
  });

  // Copy Client Link
  document.getElementById('galleryCopyLinkBtn').addEventListener('click', () => {
    const link = window.location.origin + '/client.html?id=' + id;
    navigator.clipboard.writeText(link)
      .then(() => showToast('Client link copied to clipboard'))
      .catch(() => prompt('Copy this client link:', link));
  });

  // Download All / Download Selected
  document.getElementById('galleryDlBtn').addEventListener('click', async () => {
    const grid = document.getElementById('galleryGrid');
    const inSelect = grid.classList.contains('select-mode');
    const allImgs  = getClientGallery(id);
    const targets  = inSelect
      ? [...grid.querySelectorAll('.gallery-thumb.selected')].map(t => allImgs.find(i => i.id === t.dataset.id)).filter(Boolean)
      : allImgs;
    if (!targets.length) return;
    if (targets.length === 1) { downloadDataUrl(targets[0].url, targets[0].name); return; }
    const b = getBookings().find(b => b.id === id);
    showToast(`Preparing ZIP (${targets.length} files)…`);
    await downloadAsZip(targets, `${b?.clientName || id}-gallery`);
  });

  // Select mode toggle
  document.getElementById('gallerySelBtn').addEventListener('click', () => toggleSelectMode(id));

  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() { detailModal.classList.remove('open'); document.body.style.overflow = ''; }
modalClose.addEventListener('click', closeDetail);
modalBackdrop.addEventListener('click', closeDetail);

/* ════════════════════════════════════════════
   INVOICE GENERATOR
   ════════════════════════════════════════════ */

function openInvoice(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;

  const isEvent    = b.bookingKind === 'event';
  const invoiceNum = 'INV-' + id;
  const now        = new Date();
  const issued     = now.toLocaleDateString('en-NG', { dateStyle:'long' });
  const due        = new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-NG', { dateStyle:'long' });

  // Item description
  let itemDesc, itemPrice;
  if (isEvent) {
    const typeLabel   = EVENT_TYPE_LABELS[b.eventType] || b.eventType || 'Event';
    const pkgLabel    = b.package ? ` — ${b.package.charAt(0).toUpperCase() + b.package.slice(1)} Package` : '';
    itemDesc  = typeLabel + pkgLabel;
    itemPrice = BUDGET_LABELS[b.budget] || b.budget || '—';
  } else {
    const emoji  = SESSION_EMOJI[b.sessionType] || '';
    itemDesc  = `${emoji} ${b.sessionType || 'Studio'} Session`.trim();
    itemPrice = '—';
  }

  const deliverables = b.deliverables || (isEvent ? '' : '');

  document.getElementById('invoiceBody').innerHTML = `
    <div class="inv-header">
      <div>
        <div class="inv-logo-name"><span>NEJ</span>studios</div>
        <div class="inv-tagline">Premium Photography &amp; Film Production</div>
        <div style="font-size:0.75rem;color:#888;margin-top:4px">Lagos, Nigeria · nejstudios.com</div>
      </div>
      <div class="inv-title-block">
        <h1>Invoice</h1>
        <div class="inv-number">${invoiceNum}</div>
      </div>
    </div>

    <div class="inv-meta">
      <div class="inv-meta-block">
        <h4>Billed To</h4>
        <p>
          <strong>${b.clientName || '—'}</strong><br/>
          ${b.phone  ? 'Phone: ' + b.phone  + '<br/>' : ''}
          ${b.email  ? 'Email: ' + b.email  + '<br/>' : ''}
          ${isEvent && b.location ? 'Location: ' + b.location + '<br/>' : ''}
        </p>
      </div>
      <div class="inv-meta-block">
        <h4>Invoice Details</h4>
        <p>
          <strong>Invoice #:</strong> ${invoiceNum}<br/>
          <strong>Booking ID:</strong> ${id}<br/>
          <strong>Date Issued:</strong> ${issued}<br/>
          <strong>Due Date:</strong> ${due}<br/>
          <strong>Status:</strong> ${STATUS_LABELS[b.status] || b.status}<br/>
          ${isEvent && b.eventDate ? '<strong>Event Date:</strong> ' + fmtEventDate(b.eventDate) + '<br/>' : ''}
          ${isEvent && b.package  ? '<strong>Package:</strong> ' + (b.package.charAt(0).toUpperCase() + b.package.slice(1)) + '<br/>' : ''}
        </p>
      </div>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th style="width:55%">Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${itemDesc}</td>
          <td>1</td>
          <td>${itemPrice}</td>
          <td>${itemPrice}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right;font-size:0.82rem;color:#555;letter-spacing:0.08em;text-transform:uppercase">Total</td>
          <td style="text-align:right"><strong>${itemPrice}</strong></td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right;font-size:0.82rem;color:#555;letter-spacing:0.08em;text-transform:uppercase">Deposit Paid</td>
          <td style="text-align:right;color:#3ecf8e;font-weight:700">—</td>
        </tr>
        <tr style="border-top:2px solid #c9a84c">
          <td colspan="3" style="text-align:right;font-size:0.9rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Balance Due</td>
          <td style="text-align:right;color:#c9a84c;font-size:1.05rem;font-weight:700">—</td>
        </tr>
      </tfoot>
    </table>

    ${deliverables ? `
    <div class="inv-section">
      <h4>Agreed Deliverables</h4>
      <p>${deliverables}</p>
    </div>` : ''}

    <div class="inv-section">
      <h4>Payment Details</h4>
      <p>
        <strong>Bank:</strong> Kuda MFB<br/>
        <strong>Account Name:</strong> NEJstudios<br/>
        <strong>Account Number:</strong> 3001571135<br/>
        <strong>Reference:</strong> ${invoiceNum}
      </p>
    </div>

    <div class="inv-section">
      <h4>Terms &amp; Notes</h4>
      <p>
        Payment is due within 7 days of this invoice date.<br/>
        All deliverables will be provided upon receipt of full payment.<br/>
        A 50% non-refundable deposit is required to confirm your booking.<br/>
        For any queries, please contact us directly via email or phone.
      </p>
    </div>

    <div class="inv-footer">
      <strong>Thank you for choosing NEJstudios!</strong><br/>
      We appreciate your trust and look forward to delivering exceptional work.<br/>
      <span style="font-size:0.75rem;color:#aaa">NEJstudios · Lagos, Nigeria · nejstudios.com</span>
    </div>
  `;

  document.getElementById('invoiceModal').classList.add('open');
}

document.getElementById('invoiceClose').addEventListener('click', () => {
  document.getElementById('invoiceModal').classList.remove('open');
  document.getElementById('invAmount').value  = '';
  document.getElementById('invDeposit').value = '';
});
document.getElementById('invoicePrint').addEventListener('click', () => window.print());

// Apply deposit/balance to open invoice
document.getElementById('invApply').addEventListener('click', () => {
  const total   = parseFloat(document.getElementById('invAmount').value)  || 0;
  const deposit = parseFloat(document.getElementById('invDeposit').value) || 0;
  const balance = total - deposit;
  const fmt = n => '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Update tfoot rows
  const tfoot = document.querySelector('#invoiceBody .inv-table tfoot');
  if (!tfoot) return;
  tfoot.innerHTML = `
    <tr>
      <td colspan="3" style="text-align:right;font-size:0.82rem;color:#555;letter-spacing:0.08em;text-transform:uppercase">Total</td>
      <td style="text-align:right">${total ? fmt(total) : '—'}</td>
    </tr>
    <tr>
      <td colspan="3" style="text-align:right;font-size:0.82rem;color:#555;letter-spacing:0.08em;text-transform:uppercase">Deposit Paid</td>
      <td style="text-align:right;color:#3ecf8e;font-weight:700">${deposit ? '− ' + fmt(deposit) : '—'}</td>
    </tr>
    <tr style="border-top:2px solid #c9a84c">
      <td colspan="3" style="text-align:right;font-size:0.9rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">Balance Due</td>
      <td style="text-align:right;color:#c9a84c;font-size:1.05rem;font-weight:700">${total ? fmt(balance) : '—'}</td>
    </tr>`;

  // Update payment section note
  const paySection = [...document.querySelectorAll('#invoiceBody .inv-section')].find(s => s.querySelector('h4')?.textContent === 'Payment Details');
  if (paySection) {
    const balLine = paySection.querySelector('.inv-balance-line');
    if (balLine) balLine.remove();
    if (total) {
      const p = paySection.querySelector('p');
      const line = document.createElement('p');
      line.className = 'inv-balance-line';
      line.style.cssText = 'margin-top:10px;font-weight:700;color:#c9a84c;font-size:0.95rem';
      line.textContent = `Balance Due: ${fmt(balance)}`;
      p.after(line);
    }
  }
  showToast('Invoice updated ✓');
});

/* ════════════════════════════════════════════
   GALLERY PANEL
   ════════════════════════════════════════════ */

function _makeFileRow() {
  const row = document.createElement('div');
  row.className = 'gallery-file-row';
  row.innerHTML = `
    <input class="form-input" type="text" placeholder="File label e.g. Full Gallery" data-file-label />
    <input class="form-input" type="url" placeholder="Download URL (Drive, Dropbox, WeTransfer…)" data-file-url />
    <button type="button" class="btn-remove-file" title="Remove">✕</button>`;
  row.querySelector('.btn-remove-file').addEventListener('click', () => row.remove());
  return row;
}

function initGalleryForm() {
  // Wire existing remove buttons
  document.querySelectorAll('#galleryFilesList .btn-remove-file').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.gallery-file-row').remove());
  });

  // Add file row button
  document.getElementById('btnAddFile').addEventListener('click', () => {
    document.getElementById('galleryFilesList').appendChild(_makeFileRow());
  });

  // Create gallery link
  document.getElementById('btnCreateGallery').addEventListener('click', createGalleryLink);
}

async function createGalleryLink() {
  const clientName = document.getElementById('galleryClientName').value.trim();
  if (!clientName) { showToast('Client name is required'); return; }

  const bookingId = document.getElementById('galleryBookingId').value.trim() || null;
  const password  = document.getElementById('galleryPassword').value.trim()  || null;
  const expiry    = document.getElementById('galleryExpiry').value            || null;

  // Collect URL-based file rows
  const files = [];
  document.querySelectorAll('#galleryFilesList .gallery-file-row').forEach(row => {
    const label = row.querySelector('[data-file-label]').value.trim();
    const url   = row.querySelector('[data-file-url]').value.trim();
    if (label && url) files.push({ label, url });
  });
  if (files.length === 0) { showToast('Add at least one file with a label and URL'); return; }

  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const delivery = {
    id:             'GAL-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    booking_id:     bookingId,
    client_name:    clientName,
    token,
    password,
    files,
    expires_at:     expiry || null,
    download_count: 0,
    created_at:     Date.now(),
  };

  await dbCreateGalleryDelivery(delivery);
  showToast(`Gallery link created for ${clientName} · ${files.length} file${files.length !== 1 ? 's' : ''}`);

  // Reset form
  document.getElementById('galleryClientName').value = '';
  document.getElementById('galleryBookingId').value  = '';
  document.getElementById('galleryPassword').value   = '';
  document.getElementById('galleryExpiry').value     = '';
  const list = document.getElementById('galleryFilesList');
  list.innerHTML = '';
  list.appendChild(_makeFileRow());

  await renderGalleryPanel();
}

async function renderGalleryPanel() {
  const grid = document.getElementById('galleryLinksGrid');
  if (!grid) return;

  grid.innerHTML = '<p style="color:var(--grey-3);font-size:0.85rem">Loading…</p>';
  const deliveries = await dbGetAllGalleryDeliveries();

  if (deliveries.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><h3>No gallery links yet</h3><p>Create your first gallery link using the form.</p></div>`;
    return;
  }

  grid.innerHTML = deliveries.map(d => {
    const galleryUrl = `${location.origin}/gallery?t=${d.token}`;
    const expired    = d.expires_at && d.expires_at < new Date().toISOString().slice(0, 10);
    return `
      <div class="gallery-link-card">
        <div class="gallery-link-card__top">
          <div>
            <div class="gallery-link-card__name">${d.client_name}</div>
            <div class="gallery-link-card__meta">
              ${d.booking_id ? `Booking: ${d.booking_id} · ` : ''}
              ${d.files ? d.files.length : 0} file${(d.files && d.files.length !== 1) ? 's' : ''} ·
              ${d.download_count} download${d.download_count !== 1 ? 's' : ''}
              ${d.expires_at ? ` · Expires: ${d.expires_at}` : ''}
              ${expired ? ' · <span style="color:var(--red)">EXPIRED</span>' : ''}
              ${d.password ? ' · 🔒 Password protected' : ''}
            </div>
          </div>
        </div>
        ${d.files && d.files.length > 0 ? `
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
          ${d.files.map(f => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;">
              <span style="font-size:1rem;flex-shrink:0">📄</span>
              <span style="font-size:0.78rem;color:var(--grey-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.label}">${f.label}</span>
              <a href="${f.url}" target="_blank" rel="noopener" style="font-size:0.68rem;font-weight:700;color:var(--gold);padding:3px 8px;border:1px solid rgba(201,168,76,.3);border-radius:4px;white-space:nowrap;flex-shrink:0">↓ Open</a>
            </div>`).join('')}
        </div>` : ''}
        <div class="gallery-link-card__url">
          <a href="${galleryUrl}" target="_blank">${galleryUrl}</a>
          <button class="btn-copy-link" data-copy="${galleryUrl}">Copy</button>
        </div>
        <div class="gallery-link-card__actions">
          ${d.files && d.files.length > 1 ? `<button class="btn-del-gallery" style="border-color:var(--border-l);color:var(--grey-2)" data-dl-all="${d.id}">↓ Download All</button>` : ''}
          <button class="btn-del-gallery" data-gal-id="${d.id}" data-gal-name="${d.client_name}">Delete</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy)
        .then(() => showToast('Gallery link copied!'))
        .catch(() => prompt('Copy this link:', btn.dataset.copy));
    });
  });

  // Download All — opens each file URL in a new tab sequentially
  grid.querySelectorAll('[data-dl-all]').forEach(btn => {
    btn.addEventListener('click', () => {
      const galId = btn.dataset.dlAll;
      const del = deliveries.find(d => d.id === galId);
      if (!del || !del.files) return;
      del.files.forEach((f, i) => {
        setTimeout(() => window.open(f.url, '_blank'), i * 400);
      });
      showToast(`Opening ${del.files.length} files for download…`);
    });
  });

  grid.querySelectorAll('.btn-del-gallery').forEach(btn => {
    if (!btn.dataset.galId) return;
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete gallery link for ${btn.dataset.galName}?`)) return;
      await dbDeleteGalleryDelivery(btn.dataset.galId);
      await renderGalleryPanel();
      showToast('Gallery link deleted');
    });
  });
}

function openSendGallery(bookingId) {
  const b = getBookings().find(b => b.id === bookingId);
  if (!b) return;
  // Pre-fill form
  document.getElementById('galleryClientName').value = b.clientName || '';
  document.getElementById('galleryBookingId').value  = bookingId;
  // Switch to gallery tab
  switchTab('gallery');
  showToast(`Pre-filled gallery form for ${b.clientName}`);
}

// Init gallery form once DOM is ready
initGalleryForm();

/* ════════════════════════════════════════════
   SCHEDULE
   ════════════════════════════════════════════ */

// Toggle form
const schedCreateToggle = document.getElementById('schedCreateToggle');
const schedCreateBody   = document.getElementById('schedCreateBody');
schedCreateToggle.addEventListener('click', () => {
  const open = schedCreateBody.classList.toggle('open');
  schedCreateToggle.classList.toggle('open', open);
});

// Submit form
document.getElementById('schedForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title        = document.getElementById('schedTitle').value.trim();
  const date         = document.getElementById('schedDate').value;
  const time         = document.getElementById('schedTime').value;
  const type         = document.getElementById('schedType').value;
  const client       = document.getElementById('schedClient').value.trim();
  const location     = document.getElementById('schedLocation').value.trim();
  const notes        = document.getElementById('schedNotes').value.trim();
  const deliverables = document.getElementById('schedDeliverables').value.trim();
  if (!title || !date) return;

  const entry = {
    id:           'SCH-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    title, date, type,
    time:         time         || null,
    clientName:   client       || null,
    location:     location     || null,
    notes:        notes        || null,
    deliverables: deliverables || null,
    createdAt:    Date.now(),
  };

  await dbAddScheduleEntry(entry);
  e.target.reset();
  schedCreateBody.classList.remove('open');
  schedCreateToggle.classList.remove('open');
  await renderAdminSchedule();
  showToast('Added to schedule — team can see it now');
});

async function renderAdminSchedule() {
  const grid = document.getElementById('adminScheduleGrid');
  if (!grid) return;
  const sched = (await dbGetSchedule()).slice().sort((a, b) => a.date.localeCompare(b.date));

  if (sched.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <h3>No schedule entries yet</h3>
      <p>Add upcoming shoots and events above — they'll appear on the team portal.</p>
    </div>`;
    return;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const typeLabel = { studio:'Studio', wedding:'Wedding', event:'Event', production:'Production', meeting:'Meeting' };

  grid.innerHTML = sched.map(s => {
    const isPast = s.date < todayStr;
    const d      = new Date(s.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-NG', { dateStyle:'medium' });
    const lbl    = typeLabel[s.type] || s.type;
    return `
      <div class="task-card${isPast ? ' task-card--completed' : ''}">
        <div class="task-card__top">
          <div class="task-card__badges">
            <span class="priority-badge priority-badge--${s.type === 'meeting' ? 'low' : s.type === 'studio' ? 'medium' : 'high'}">${lbl}</span>
            ${isPast ? '<span class="status-badge status-badge--completed">Past</span>' : '<span class="status-badge status-badge--pending">Upcoming</span>'}
          </div>
        </div>
        <div class="task-card__title">${s.title}</div>
        <div class="task-card__info">
          <div class="task-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <strong>${dateStr}${s.time ? ' · ' + s.time : ''}</strong>
          </div>
          ${s.clientName ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${s.clientName}</div>` : ''}
          ${s.location   ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${s.location}</div>` : ''}
        </div>
        ${s.notes ? `<div class="task-reports-preview">${s.notes}</div>` : ''}
        ${s.deliverables ? `<div class="task-reports-preview" style="margin-top:6px"><strong style="color:var(--gold-lt);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em">Deliverables:</strong> ${s.deliverables}</div>` : ''}
        ${(() => {
          const cl = s.checklist || [];
          if (cl.length === 0) return '';
          const done = cl.filter(item => typeof item === 'object' ? item.checked : false).length;
          const total = cl.length;
          const pct = Math.round((done / total) * 100);
          return `<div style="margin-top:10px;padding:8px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.75rem;color:var(--grey-3)">
            Checklist: <strong style="color:${done===total?'var(--green)':'var(--white)'}">${done}/${total}</strong> items done
            <div style="margin-top:6px;height:4px;background:var(--border);border-radius:99px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${done===total?'var(--green)':'var(--gold)'};border-radius:99px;transition:width 0.3s"></div>
            </div>
          </div>`;
        })()}
        <div class="task-card__actions">
          <button class="task-action-btn task-action-btn--delete" data-sched-id="${s.id}">Delete</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-sched-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this schedule entry?')) return;
      await dbDeleteScheduleEntry(btn.dataset.schedId);
      await renderAdminSchedule();
      showToast('Removed from schedule');
    });
  });
}

/* ════════════════════════════════════════════
   TASKS
   ════════════════════════════════════════════ */

// Create task toggle
const taskCreateToggle = document.getElementById('taskCreateToggle');
const taskCreateBody   = document.getElementById('taskCreateBody');
taskCreateToggle.addEventListener('click', () => {
  const open = taskCreateBody.classList.toggle('open');
  taskCreateToggle.classList.toggle('open', open);
});

// Task form
document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const assignee = document.getElementById('taskAssignee').value;
  const priority = document.getElementById('taskPriority').value;
  if (!title) return;

  const team   = getTeam();
  const member = team.find(m => m.id === assignee);
  const task   = {
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

  await dbAddTask(task);
  e.target.reset();
  taskCreateBody.classList.remove('open');
  taskCreateToggle.classList.remove('open');
  await renderTasks();
  await renderTasksBadge();
  showToast('Task created');
});

// Task status filter
document.querySelectorAll('[data-task-status]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-task-status]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTaskStatus = btn.dataset.taskStatus;
    renderTasks();
  });
});

async function renderTasks() {
  let tasks = await dbGetTasks();
  if (activeTaskStatus !== 'all') tasks = tasks.filter(t => t.status === activeTaskStatus);

  const grid = document.getElementById('tasksGrid');
  if (tasks.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><h3>No tasks yet</h3><p>Create a task above to get started.</p></div>`;
    return;
  }

  grid.innerHTML = tasks.map(t => buildTaskCard(t)).join('');
  grid.querySelectorAll('[data-task-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleTaskAction(btn.dataset.id, btn.dataset.taskAction);
    });
  });
}

function buildTaskCard(t) {
  const priorityMap = { high:'high', medium:'medium', low:'low' };
  const prClass = priorityMap[t.priority] || 'medium';
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
        <div class="task-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Assigned: <strong>${t.assignedName || 'Unassigned'}</strong>
        </div>
        <div class="task-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Created: <strong>${fmtDateShort(t.createdAt)}</strong>
          ${t.startedAt ? `&nbsp;·&nbsp; Started: <strong>${fmtDateShort(t.startedAt)}</strong>` : ''}
          ${t.completedAt ? `&nbsp;·&nbsp; Done: <strong>${fmtDateShort(t.completedAt)}</strong>` : ''}
        </div>
      </div>
      ${lastReport ? `<div class="task-reports-preview"><strong>${reportCount} report${reportCount>1?'s':''}</strong> — "${lastReport.content.slice(0,80)}${lastReport.content.length>80?'…':''}"</div>` : ''}
      <div class="task-card__actions">
        <button class="task-action-btn task-action-btn--reports" data-id="${t.id}" data-task-action="reports">Reports (${reportCount})</button>
        <button class="task-action-btn task-action-btn--reassign" data-id="${t.id}" data-task-action="reassign">Reassign</button>
        <button class="task-action-btn task-action-btn--delete" data-id="${t.id}" data-task-action="delete">Delete</button>
      </div>
    </div>`;
}

async function handleTaskAction(id, action) {
  if (action === 'delete') {
    if (!confirm('Delete this task?')) return;
    await dbDeleteTask(id);
    await renderTasks();
    await renderTasksBadge();
    showToast('Task deleted');
    return;
  }
  if (action === 'reports')  { openReportsModal(id); return; }
  if (action === 'reassign') { openReassignModal(id); return; }
}

async function renderTasksBadge() {
  const count = (await dbGetTasks()).filter(t => t.status === 'pending').length;
  const badge = document.getElementById('tabTasksBadge');
  const navCount = document.getElementById('navPendingTasks');
  const mnavBadge = document.getElementById('mnavTasksBadge');
  badge.textContent = count;
  badge.classList.toggle('zero', count === 0);
  if (navCount) { navCount.textContent = count; navCount.classList.toggle('hidden', count === 0); }
  if (mnavBadge) { mnavBadge.textContent = count; mnavBadge.style.display = count > 0 ? 'block' : 'none'; }
}

/* ════════════════════════════════════════════
   REPORTS MODAL (admin view)
   ════════════════════════════════════════════ */
const reportsModal        = document.getElementById('reportsModal');
const reportsModalContent = document.getElementById('reportsModalContent');
const reportsModalTitle   = document.getElementById('reportsModalTitle');
const reportsModalClose   = document.getElementById('reportsModalClose');
const reportsModalBack    = document.getElementById('reportsModalBackdrop');

async function openReportsModal(taskId) {
  const task = await dbGetTask(taskId);
  if (!task) return;
  reportsModalTitle.textContent = `Reports — ${task.title}`;
  if (!task.reports || task.reports.length === 0) {
    reportsModalContent.innerHTML = `<p class="no-reports">No reports written yet. Team members can submit progress reports from the Team Portal.</p>`;
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
   REASSIGN MODAL (inline prompt)
   ════════════════════════════════════════════ */
async function openReassignModal(taskId) {
  const task = await dbGetTask(taskId);
  if (!task) return;
  const team = getTeam();
  if (team.length === 0) { showToast('Add team members first'); return; }

  const options = ['0: Unassigned', ...team.map((m, i) => `${i+1}: ${m.name} (@${m.username})`)].join('\n');
  const choice  = prompt(`Reassign "${task.title}"\n\n${options}\n\nEnter number:`);
  if (choice === null) return;
  const idx = parseInt(choice, 10);
  if (isNaN(idx) || idx < 0 || idx > team.length) { showToast('Invalid choice'); return; }

  const member = idx === 0 ? null : team[idx - 1];
  await dbUpdateTask(taskId, {
    assigned_to:   member ? member.id   : null,
    assigned_name: member ? member.name : null,
  });
  await renderTasks();
  showToast(member ? `Assigned to ${member.name}` : 'Unassigned');
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
document.getElementById('teamForm').addEventListener('submit', e => {
  e.preventDefault();
  const name     = document.getElementById('tmName').value.trim();
  const username = document.getElementById('tmUsername').value.trim().toLowerCase();
  const pin      = document.getElementById('tmPin').value.trim();
  const editId   = document.getElementById('editMemberId').value;

  if (!name || !username || !pin) return;
  if (pin.length < 4) { showToast('PIN must be at least 4 characters'); return; }

  const team = getTeam();

  // Check username uniqueness (exclude self when editing)
  const duplicate = team.find(m => m.username.toLowerCase() === username && m.id !== editId);
  if (duplicate) { showToast('Username already exists'); return; }

  if (editId) {
    // Edit existing
    const idx = team.findIndex(m => m.id === editId);
    if (idx !== -1) { team[idx] = { ...team[idx], name, username, pin }; }
  } else {
    // Add new
    team.push({
      id:        'TM-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      name, username, pin,
      createdAt: Date.now(),
    });
  }

  saveTeam(team);
  e.target.reset();
  cancelEdit();
  renderTeam();
  populateAssigneeSelect();
  showToast(editId ? 'Member updated' : `${name} added to team`);
});

function cancelEdit() {
  editingMemberId = null;
  document.getElementById('editMemberId').value = '';
  document.getElementById('teamFormTitle').textContent = 'Add Team Member';
  document.getElementById('teamFormSubmit').textContent = 'Add Member';
  document.getElementById('cancelEditBtn').classList.remove('visible');
  document.getElementById('tmName').value = '';
  document.getElementById('tmUsername').value = '';
  document.getElementById('tmPin').value = '';
}

document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

async function renderTeam() {
  const team     = getTeam();
  const allTasks = await dbGetTasks();
  document.getElementById('teamCount').textContent = team.length;
  const grid = document.getElementById('teamGrid');

  if (team.length === 0) {
    grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><h3>No team members yet</h3><p>Add your first team member using the form.</p></div>`;
    return;
  }

  grid.innerHTML = team.map(m => {
    const initials  = m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    const taskCount = allTasks.filter(t => t.assignedTo === m.id).length;
    return `
      <div class="member-card">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${m.name}</div>
          <div class="member-username">@${m.username}</div>
          <div class="member-meta">${taskCount} task${taskCount !== 1 ? 's' : ''} assigned · Added ${fmtDateShort(m.createdAt)}</div>
        </div>
        <div class="member-actions">
          <button class="member-action-btn member-action-btn--link" data-mid="${m.id}" title="Copy login link to share with ${m.name}">🔗 Login Link</button>
          <button class="member-action-btn member-action-btn--edit" data-mid="${m.id}">Edit</button>
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
    .then(() => showToast(`Login link for ${m.name} copied — send it to them`))
    .catch(() => prompt(`Copy this link and send to ${m.name}:`, url));
}

function editMember(id) {
  const m = getTeam().find(m => m.id === id);
  if (!m) return;
  editingMemberId = id;
  document.getElementById('editMemberId').value = id;
  document.getElementById('tmName').value     = m.name;
  document.getElementById('tmUsername').value = m.username;
  document.getElementById('tmPin').value      = m.pin;
  document.getElementById('teamFormTitle').textContent  = 'Edit Team Member';
  document.getElementById('teamFormSubmit').textContent = 'Save Changes';
  document.getElementById('cancelEditBtn').classList.add('visible');
  document.querySelector('.team-form-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function removeMember(id, name) {
  if (!confirm(`Remove ${name} from the team? Their tasks will become unassigned.`)) return;
  await dbUnassignMemberTasks(id);
  saveTeam(getTeam().filter(m => m.id !== id));
  await renderTeam();
  await renderTasks();
  populateAssigneeSelect();
  showToast(`${name} removed`);
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
   LIGHTBOX
   ════════════════════════════════════════════ */
let _lbBookingId = null;
let _lbImgs      = [];
let _lbIdx       = 0;

const lightbox   = document.getElementById('lightbox');
const lbImg      = document.getElementById('lbImg');
const lbFilename = document.getElementById('lbFilename');
const lbCounter  = document.getElementById('lbCounter');
const lbApproval = document.getElementById('lbApproval');
const lbClose    = document.getElementById('lbClose');
const lbPrev     = document.getElementById('lbPrev');
const lbNext     = document.getElementById('lbNext');
const lbDownload = document.getElementById('lbDownload');

function openLightbox(bookingId, imgs, idx) {
  _lbBookingId = bookingId;
  _lbImgs      = imgs;
  _lbIdx       = idx;
  renderLightboxFrame();
  lightbox.classList.add('open');
}

function renderLightboxFrame() {
  const img = _lbImgs[_lbIdx];
  if (!img) return;
  lbImg.src       = img.url;
  lbImg.alt       = img.name;
  lbFilename.textContent = img.name;
  lbCounter.textContent  = `${_lbIdx + 1} / ${_lbImgs.length}`;

  // Approval status
  const approvals = (getApprovals()[_lbBookingId]) || {};
  const status    = approvals[img.id];
  lbApproval.className = 'lightbox__approval-label';
  if (status === 'keep') {
    lbApproval.classList.add('lightbox__approval-label--keep');
    lbApproval.textContent = 'Client: Keep';
  } else if (status === 'remove') {
    lbApproval.classList.add('lightbox__approval-label--remove');
    lbApproval.textContent = 'Client: Remove';
  } else {
    lbApproval.classList.add('lightbox__approval-label--none');
    lbApproval.textContent = 'No client selection';
  }

  // Arrow visibility
  lbPrev.style.visibility = _lbIdx > 0 ? 'visible' : 'hidden';
  lbNext.style.visibility = _lbIdx < _lbImgs.length - 1 ? 'visible' : 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lbImg.src = '';
}

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click',  () => { if (_lbIdx > 0) { _lbIdx--; renderLightboxFrame(); } });
lbNext.addEventListener('click',  () => { if (_lbIdx < _lbImgs.length - 1) { _lbIdx++; renderLightboxFrame(); } });
lbDownload.addEventListener('click', () => {
  const img = _lbImgs[_lbIdx];
  if (img) downloadDataUrl(img.url, img.name);
});

// Click outside image area closes lightbox
lightbox.addEventListener('click', e => {
  if (e.target === lightbox || e.target.classList.contains('lightbox__body')) closeLightbox();
});

/* ════════════════════════════════════════════
   KEYBOARD + CROSS-TAB SYNC
   ════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) {
    e.stopPropagation();
    if (e.key === 'Escape')     { closeLightbox(); return; }
    if (e.key === 'ArrowLeft')  { if (_lbIdx > 0) { _lbIdx--; renderLightboxFrame(); } return; }
    if (e.key === 'ArrowRight') { if (_lbIdx < _lbImgs.length - 1) { _lbIdx++; renderLightboxFrame(); } return; }
    return;
  }
  if (e.key === 'Escape') {
    closeDetail();
    closeReportsModal();
    if (typeof closeNewBookingModal === 'function') closeNewBookingModal();
    const inv = document.getElementById('invoiceModal');
    if (inv) inv.classList.remove('open');
  }
});
window.addEventListener('storage', e => {
  if (!isAdminAuthed()) return;
  if (e.key === STORAGE_KEY) renderBookings();
  if (e.key === TEAM_KEY)    renderTeam();
});

// Real-time sync: reflect changes made on other devices (e.g. team updating task status/reports)
dbSubscribeTasks(payload => {
  renderTasks();
  renderTasksBadge();
  // Push notifications for task status changes
  if (payload && payload.new && payload.old) {
    const n = payload.new;
    const o = payload.old;
    if (n.status === 'in-progress' && o.status === 'pending') {
      notify('Task Started', (n.assigned_name || 'A team member') + ' started: ' + n.title);
    }
    if (n.status === 'completed' && o.status !== 'completed') {
      notify('Task Completed', (n.assigned_name || 'A team member') + ' completed: ' + n.title);
    }
  }
});
dbSubscribeSchedule(() => { renderAdminSchedule(); });

/* ════════════════════════════════════════════
   DAILY SUMMARY
   ════════════════════════════════════════════ */
async function renderDailySummary() {
  const container = document.getElementById('summarySections');
  const dateLabel = document.getElementById('summaryDateLabel');
  if (!container) return;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  if (dateLabel) {
    dateLabel.textContent = today.toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }

  container.innerHTML = `<div class="summary-section"><p class="summary-empty">Loading…</p></div>`;

  const [schedule, tasks] = await Promise.all([dbGetSchedule(), dbGetTasks()]);
  const bookings = getBookings();

  // Schedule today
  const schedToday = schedule.filter(s => s.date === todayStr);

  // Task counts
  const total       = tasks.length;
  const pending     = tasks.filter(t => t.status === 'pending').length;
  const inProgress  = tasks.filter(t => t.status === 'in-progress').length;
  const completed   = tasks.filter(t => t.status === 'completed').length;

  // Completed today
  const completedToday = tasks.filter(t => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt).toISOString().slice(0, 10) === todayStr;
  });

  // Started today
  const startedToday = tasks.filter(t => {
    if (!t.startedAt) return false;
    return new Date(t.startedAt).toISOString().slice(0, 10) === todayStr;
  });

  // Bookings today (by createdAt)
  const bookingsToday = bookings.filter(b => {
    if (!b.createdAt) return false;
    return new Date(b.createdAt).toISOString().slice(0, 10) === todayStr;
  });

  const typeLabel = { studio:'Studio', wedding:'Wedding', event:'Event', production:'Production', meeting:'Meeting' };

  container.innerHTML = `
    <div class="summary-section">
      <div class="summary-section-title">Schedule Today</div>
      ${schedToday.length === 0
        ? `<p class="summary-empty">No scheduled shoots or events today.</p>`
        : `<div class="summary-list">${schedToday.map(s => `
            <div class="summary-list-item">
              <strong>${s.title}</strong>
              <span style="color:var(--grey-4)"> — ${typeLabel[s.type] || s.type}${s.time ? ' · ' + s.time : ''}${s.location ? ' · ' + s.location : ''}</span>
              ${s.deliverables ? `<div style="font-size:0.75rem;color:var(--grey-3);margin-top:4px">Deliverables: ${s.deliverables}</div>` : ''}
            </div>`).join('')}</div>`
      }
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Tasks Overview</div>
      <div class="summary-counts">
        <div class="summary-count-item">
          <div class="summary-count-item__value" style="color:var(--white)">${total}</div>
          <div class="summary-count-item__label">Total</div>
        </div>
        <div class="summary-count-item">
          <div class="summary-count-item__value" style="color:var(--orange)">${pending}</div>
          <div class="summary-count-item__label">Pending</div>
        </div>
        <div class="summary-count-item">
          <div class="summary-count-item__value" style="color:var(--purple)">${inProgress}</div>
          <div class="summary-count-item__label">In Progress</div>
        </div>
        <div class="summary-count-item">
          <div class="summary-count-item__value" style="color:var(--green)">${completed}</div>
          <div class="summary-count-item__label">Completed</div>
        </div>
      </div>
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Completed Today</div>
      ${completedToday.length === 0
        ? `<p class="summary-empty">No tasks completed today.</p>`
        : `<div class="summary-list">${completedToday.map(t => `
            <div class="summary-list-item">
              <strong>${t.title}</strong>
              ${t.assignedName ? `<span style="color:var(--grey-4)"> — ${t.assignedName}</span>` : ''}
            </div>`).join('')}</div>`
      }
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Started Today</div>
      ${startedToday.length === 0
        ? `<p class="summary-empty">No tasks started today.</p>`
        : `<div class="summary-list">${startedToday.map(t => `
            <div class="summary-list-item">
              <strong>${t.title}</strong>
              ${t.assignedName ? `<span style="color:var(--grey-4)"> — ${t.assignedName}</span>` : ''}
            </div>`).join('')}</div>`
      }
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Team Task Reports</div>
      ${tasks.filter(t => t.reports && t.reports.length > 0).length === 0
        ? `<p class="summary-empty">No team reports submitted yet.</p>`
        : tasks.filter(t => t.reports && t.reports.length > 0).map(t => {
            const latestReports = [...t.reports].reverse().slice(0, 3);
            const statusColor = t.status === 'completed' ? 'var(--green)' : t.status === 'in-progress' ? 'var(--purple)' : 'var(--orange)';
            return `
            <div style="background:var(--bg-3);border:1px solid var(--border);border-left:3px solid ${statusColor};border-radius:8px;padding:12px 14px;margin-bottom:10px">
              <div style="font-size:0.85rem;font-weight:600;color:var(--white);margin-bottom:6px">${t.title}
                ${t.assignedName ? `<span style="font-size:0.72rem;color:var(--grey-3);font-weight:400"> · ${t.assignedName}</span>` : ''}
                <span style="font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:99px;background:${statusColor}22;color:${statusColor};margin-left:6px;text-transform:uppercase;letter-spacing:.06em">${t.status}</span>
              </div>
              ${latestReports.map(r => `
                <div style="font-size:0.78rem;color:var(--grey-2);padding:6px 0;border-top:1px solid var(--border)">
                  <span style="font-size:0.68rem;color:var(--grey-4);margin-right:6px">${r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-NG',{dateStyle:'short',timeStyle:'short'}) : ''}</span>
                  ${r.text || r.message || r.note || ''}
                </div>`).join('')}
            </div>`;
          }).join('')
      }
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Bookings Today</div>
      ${bookingsToday.length === 0
        ? `<p class="summary-empty">No new bookings received today.</p>`
        : `<div class="summary-list">${bookingsToday.map(b => `
            <div class="summary-list-item">
              <strong>${b.clientName}</strong>
              <span style="color:var(--grey-4)"> — ${b.bookingKind === 'event' ? (EVENT_TYPE_LABELS[b.eventType] || b.eventType || 'Event') : b.sessionType || 'Studio'} · ${STATUS_LABELS[b.status] || b.status}</span>
              ${b.sessionDate ? `<div style="font-size:0.75rem;color:var(--grey-3);margin-top:2px">📅 ${b.sessionDate}${b.sessionTime ? ' · ' + b.sessionTime : ''}</div>` : ''}
            </div>`).join('')}</div>`
      }
    </div>`;
}

document.getElementById('btnRefreshSummary').addEventListener('click', renderDailySummary);

/* ════════════════════════════════════════════
   REAL-TIME: detect new bookings from public booking form
   (localStorage 'storage' event fires in other tabs/windows)
   ════════════════════════════════════════════ */
let _lastBookingCount = getBookings().length;
window.addEventListener('storage', e => {
  if (e.key !== 'nej_bookings') return;
  const bookings = getBookings();
  const newCount  = bookings.length;
  if (newCount > _lastBookingCount) {
    const newest = bookings[0];
    const name   = newest ? newest.clientName || newest.firstName || 'A client' : 'A client';
    const type   = newest ? (newest.sessionType || (EVENT_TYPE_LABELS[newest.eventType]) || 'session') : 'session';
    showToast(`🔔 New booking from ${name} — ${type}`);
    notify('New Booking Received', `${name} just booked a ${type} session`);
    _lastBookingCount = newCount;
    renderBookings();
    renderStatCards();
  }
});

/* ════════════════════════════════════════════
   INLINE BOOKING MODAL
   ════════════════════════════════════════════ */
const newBookingModal        = document.getElementById('newBookingModal');
const newBookingModalClose   = document.getElementById('newBookingModalClose');
const newBookingModalBack    = document.getElementById('newBookingModalBackdrop');

function openNewBookingModal() {
  newBookingModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeNewBookingModal() {
  newBookingModal.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnNewBooking').addEventListener('click', openNewBookingModal);
newBookingModalClose.addEventListener('click', closeNewBookingModal);
newBookingModalBack.addEventListener('click', closeNewBookingModal);

// Tab switching inside booking modal
document.querySelectorAll('.bm-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bm-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bm-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('bm-panel-' + btn.dataset.bmTab).classList.add('active');
  });
});

// Session type picker in studio modal
let bmSelectedSession = '';
document.querySelectorAll('.bm-sp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bm-sp-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    bmSelectedSession = btn.dataset.session;
  });
});

// Studio booking form submit
document.getElementById('bmStudioForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = document.getElementById('bmStudioErr');
  const firstName  = document.getElementById('bmFirstName').value.trim();
  const middleName = document.getElementById('bmMiddleName').value.trim();
  const phone      = document.getElementById('bmPhone').value.trim();
  const email      = document.getElementById('bmEmail').value.trim();

  if (!firstName || !phone || !email) { err.textContent = 'First name, phone, and email are required.'; return; }
  if (!bmSelectedSession) { err.textContent = 'Please select a session type.'; return; }
  err.textContent = '';

  const clientName = [firstName, middleName].filter(Boolean).join(' ');
  const booking = {
    id:          'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    bookingKind: 'studio',
    firstName, middleName,
    clientName, phone, email,
    sessionType: bmSelectedSession,
    status:      'pending',
    createdAt:   Date.now(),
  };

  const bookings = getBookings();
  bookings.unshift(booking);
  saveBookings(bookings);

  e.target.reset();
  document.querySelectorAll('.bm-sp-btn').forEach(b => b.classList.remove('selected'));
  bmSelectedSession = '';
  closeNewBookingModal();
  renderBookings();
  showToast(`Booking for ${clientName} added ✓`);
});

// Event booking form submit
document.getElementById('bmEventForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = document.getElementById('bmEventErr');
  const firstName  = document.getElementById('bmEFirstName').value.trim();
  const lastName   = document.getElementById('bmELastName').value.trim();
  const phone      = document.getElementById('bmEPhone').value.trim();
  const email      = document.getElementById('bmEEmail').value.trim();
  const eventType  = document.getElementById('bmEType').value;
  const pkg        = document.getElementById('bmEPackage').value;
  const eventDate  = document.getElementById('bmEDate').value;
  const budget     = document.getElementById('bmEBudget').value;
  const location   = document.getElementById('bmELocation').value.trim();
  const deliverables = document.getElementById('bmEDeliverables').value.trim();

  if (!firstName || !phone || !email) { err.textContent = 'First name, phone, and email are required.'; return; }
  if (!eventType) { err.textContent = 'Please select an event type.'; return; }
  err.textContent = '';

  const clientName = [firstName, lastName].filter(Boolean).join(' ');
  const booking = {
    id:          'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    bookingKind: 'event',
    firstName, lastName,
    clientName, phone, email,
    eventType,
    package:      pkg || null,
    eventDate:    eventDate || null,
    budget:       budget || null,
    location:     location || null,
    deliverables: deliverables || null,
    status:       'pending',
    createdAt:    Date.now(),
  };

  const bookings = getBookings();
  bookings.unshift(booking);
  saveBookings(bookings);

  e.target.reset();
  closeNewBookingModal();
  renderBookings();
  showToast(`Event booking for ${clientName} added ✓`);
});
