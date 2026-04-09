/* ══════════════════════════════════════════════
   NEJstudios — Studio Dashboard JS
   Handles: Studio Sessions + Events & Weddings
   ══════════════════════════════════════════════ */

const DASHBOARD_PIN = 'nej2026';   // ← change this
const STORAGE_KEY   = 'nej_bookings';

/* ════════════════════════════════════════════
   SEED demo bookings (runs once on empty store)
   ════════════════════════════════════════════ */
function seedIfEmpty() {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (existing.length > 0) return;

  const now = Date.now();
  const day = 86400000;

  const demos = [
    // Studio sessions
    { bookingKind:'studio', firstName:'Amaka',  middleName:'Chioma',  clientName:'Amaka Chioma',  phone:'+234 801 000 0001', email:'amaka@example.com',  sessionType:'Birthday', status:'pending',   createdAt: now - day*0 },
    { bookingKind:'studio', firstName:'Tunde',  middleName:'Adeyemi', clientName:'Tunde Adeyemi', phone:'+234 802 000 0002', email:'tunde@example.com',  sessionType:'Family',   status:'confirmed', createdAt: now - day*2 },
    { bookingKind:'studio', firstName:'Ngozi',  middleName:'Eze',     clientName:'Ngozi Eze',     phone:'+234 803 000 0003', email:'ngozi@example.com',  sessionType:'Creative', status:'completed', createdAt: now - day*5 },
    { bookingKind:'studio', firstName:'Fatima', middleName:'Bello',   clientName:'Fatima Bello',  phone:'+234 804 000 0004', email:'fatima@example.com', sessionType:'Fashion',  status:'pending',   createdAt: now - day*1 },
    // Event bookings
    {
      bookingKind:'event', firstName:'David', lastName:'Okonkwo', clientName:'David Okonkwo',
      phone:'+234 805 000 0005', email:'david@example.com',
      eventType:'white-wedding', package:'luxury', eventDate:'2026-06-14',
      location:'Eko Hotel, Lagos', budget:'above1m',
      deliverables:'Full-day coverage, same-day edit, drone shots, 3 photographers, highlight film + 30-min feature film.',
      status:'confirmed', createdAt: now - day*3,
    },
    {
      bookingKind:'event', firstName:'Chidi', lastName:'Nwosu', clientName:'Chidi Nwosu',
      phone:'+234 806 000 0006', email:'chidi@example.com',
      eventType:'traditional-wedding', package:'premium', eventDate:'2026-07-20',
      location:'Enugu State, Nigeria', budget:'350-600',
      deliverables:'Traditional ceremony film, 200+ edited photos, drone coverage.',
      status:'pending', createdAt: now - day*1,
    },
    {
      bookingKind:'event', firstName:'Kemi', lastName:'Afolabi', clientName:'Kemi Afolabi',
      phone:'+234 807 000 0007', email:'kemi@example.com',
      eventType:'brand-film', package:'premium', eventDate:'2026-05-10',
      location:'Victoria Island, Lagos', budget:'350-600',
      deliverables:'5-minute brand campaign film, 3 social media cuts (30s each), colour graded.',
      status:'completed', createdAt: now - day*10,
    },
    {
      bookingKind:'event', firstName:'Emeka', lastName:'Obi', clientName:'Emeka Obi',
      phone:'+234 808 000 0008', email:'emeka@example.com',
      eventType:'corporate-event', package:'essential', eventDate:'2026-05-28',
      location:'Abuja, Nigeria', budget:'150-350',
      deliverables:'4-hour event coverage, 60 edited photos, recap video.',
      status:'pending', createdAt: now - day*0,
    },
  ];

  const tagged = demos.map(b => ({ id: 'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(), ...b }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tagged));
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function getBookings()     { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function saveBookings(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-NG', { dateStyle: 'medium' });
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-NG', { timeStyle: 'short' });
}
function fmtEventDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-NG', { dateStyle: 'long' });
}

const SESSION_EMOJI = { Birthday:'🎂', Family:'👨‍👩‍👧', Creative:'✨', Fashion:'👗', Product:'📦' };
const STATUS_LABELS  = { pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled' };

const EVENT_TYPE_LABELS = {
  'brand-film':        '🎬 Brand Film',
  'music-video':       '🎵 Music Video',
  'documentary':       '🎥 Documentary',
  'corporate-event':   '🏢 Corporate Event',
  'other-production':  '📹 Production',
  'traditional-wedding':'💛 Traditional Wedding',
  'white-wedding':     '🤍 White Wedding',
  'full-wedding':      '💍 Full Wedding',
  'engagement':        '💌 Engagement Shoot',
};

const BUDGET_LABELS = {
  'under150':  'Under ₦150k',
  '150-350':   '₦150k – ₦350k',
  '350-600':   '₦350k – ₦600k',
  '600-1m':    '₦600k – ₦1M',
  'above1m':   'Above ₦1M',
};

function statusBadge(status) {
  return `<span class="status-badge status-badge--${status}">${STATUS_LABELS[status] || status}</span>`;
}
function kindBadge(kind) {
  return kind === 'event'
    ? `<span class="kind-badge kind-badge--event">Event</span>`
    : `<span class="kind-badge kind-badge--studio">Studio</span>`;
}

/* ════════════════════════════════════════════
   STATE  (must be declared before login runs)
   ════════════════════════════════════════════ */
let activeStatus  = 'all';
let activeKind    = 'all';
let activeType    = null;
let activeEtype   = null;
let searchQuery   = '';

/* ════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════ */
const loginGate  = document.getElementById('loginGate');
const dashShell  = document.getElementById('dashShell');
const pinInput   = document.getElementById('pinInput');
const loginBtn   = document.getElementById('loginBtn');
const loginErr   = document.getElementById('loginErr');
const logoutBtn  = document.getElementById('logoutBtn');

function isAuthed() { return sessionStorage.getItem('nej_auth') === '1'; }
function setAuth(v) { v ? sessionStorage.setItem('nej_auth','1') : sessionStorage.removeItem('nej_auth'); }

function showDash() {
  loginGate.classList.add('hidden');
  dashShell.style.display = 'flex';
  seedIfEmpty();
  render();
}

function tryLogin() {
  if (pinInput.value === DASHBOARD_PIN) {
    loginErr.textContent = '';
    setAuth(true);
    showDash();
  } else {
    loginErr.textContent = 'Incorrect PIN. Try again.';
    pinInput.value = '';
    pinInput.focus();
  }
}

loginBtn.addEventListener('click', tryLogin);
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
logoutBtn.addEventListener('click', () => { setAuth(false); location.reload(); });
if (isAuthed()) showDash();

/* ════════════════════════════════════════════
   STATS
   ════════════════════════════════════════════ */
function updateStats() {
  const all = getBookings();
  document.getElementById('statTotal').textContent   = all.length;
  document.getElementById('statStudio').textContent  = all.filter(b => b.bookingKind !== 'event').length;
  document.getElementById('statEvents').textContent  = all.filter(b => b.bookingKind === 'event').length;
  document.getElementById('statPending').textContent = all.filter(b => b.status === 'pending').length;
}

/* ════════════════════════════════════════════
   CARD BUILDERS
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
  }
  if (['cancelled','completed'].includes(b.status)) {
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
        <div>
          ${kindBadge('studio')}
          <div class="booking-card__name">${b.clientName}</div>
          <div class="booking-card__id">${b.id}</div>
        </div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill">${emoji} ${b.sessionType}</span>
      <div class="booking-card__meta">
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
          <span>${b.phone}</span>
        </div>
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>${b.email}</span>
        </div>
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Booked <strong>${fmtDate(b.createdAt)}</strong> at ${fmtTime(b.createdAt)}</span>
        </div>
      </div>
      <div class="booking-card__actions">${actionButtons(b)}</div>
    </div>`;
}

function buildEventCard(b) {
  const typeLabel    = EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—';
  const budgetLabel  = BUDGET_LABELS[b.budget] || b.budget || '—';
  const deliverables = b.deliverables ? b.deliverables.slice(0, 120) + (b.deliverables.length > 120 ? '…' : '') : '—';

  return `
    <div class="booking-card booking-card--event" data-id="${b.id}">
      <div class="booking-card__top">
        <div>
          ${kindBadge('event')}
          <div class="booking-card__name">${b.clientName}</div>
          <div class="booking-card__id">${b.id}</div>
        </div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill event-pill">${typeLabel}</span>

      <div class="event-fields">
        <div class="event-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div><span class="ef-label">Event Date</span><span class="ef-value">${fmtEventDate(b.eventDate)}</span></div>
        </div>
        <div class="event-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <div><span class="ef-label">Location</span><span class="ef-value">${b.location || '—'}</span></div>
        </div>
        <div class="event-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          <div><span class="ef-label">Budget</span><span class="ef-value">${budgetLabel}</span></div>
        </div>
        <div class="event-field event-field--full">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <div><span class="ef-label">Deliverables</span><span class="ef-value ef-deliverables">${deliverables}</span></div>
        </div>
      </div>

      <div class="booking-card__meta" style="margin-top:12px">
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
          <span>${b.phone}</span>
        </div>
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>${b.email}</span>
        </div>
        <div class="meta-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Booked <strong>${fmtDate(b.createdAt)}</strong></span>
        </div>
      </div>
      <div class="booking-card__actions">${actionButtons(b)}</div>
    </div>`;
}

/* ════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════ */
function render() {
  updateStats();
  let bookings = getBookings();

  // Kind filter
  if (activeKind === 'studio') bookings = bookings.filter(b => b.bookingKind !== 'event');
  if (activeKind === 'event')  bookings = bookings.filter(b => b.bookingKind === 'event');

  // Status filter
  if (activeStatus !== 'all') bookings = bookings.filter(b => b.status === activeStatus);

  // Studio session type filter
  if (activeType)  bookings = bookings.filter(b => b.sessionType === activeType);

  // Event type filter
  if (activeEtype) bookings = bookings.filter(b => b.eventType === activeEtype);

  // Search
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
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <h3>No bookings found</h3>
        <p>No bookings match the current filter.</p>
        <a href="booking.html" target="_blank">+ New Studio Booking</a>
      </div>`;
    return;
  }

  grid.innerHTML = bookings
    .map(b => b.bookingKind === 'event' ? buildEventCard(b) : buildStudioCard(b))
    .join('');

  grid.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleAction(btn.dataset.id, btn.dataset.action);
    });
  });
}

/* ════════════════════════════════════════════
   ACTIONS
   ════════════════════════════════════════════ */
function handleAction(id, action) {
  if (action === 'detail') { openDetail(id); return; }
  if (action === 'delete') { deleteBooking(id); return; }
  updateStatus(id, action);
}

function updateStatus(id, newStatus) {
  const bookings = getBookings();
  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;
  bookings[idx].status = newStatus;
  saveBookings(bookings);
  showToast(`${bookings[idx].clientName} marked as ${STATUS_LABELS[newStatus]}`);
  render();
}

function deleteBooking(id) {
  if (!confirm(`Delete booking ${id}? This cannot be undone.`)) return;
  saveBookings(getBookings().filter(b => b.id !== id));
  showToast('Booking deleted');
  render();
}

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
    ['Booking ID',    b.id],
    ['Type',          isEvent ? 'Event / Wedding' : 'Studio Session'],
    ['Name',          b.clientName],
    ['Phone',         b.phone],
    ['Email',         b.email],
    ['Status',        STATUS_LABELS[b.status] || b.status],
    ...(isEvent ? [
      ['Event Type',    EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—'],
      ['Event Date',    fmtEventDate(b.eventDate)],
      ['Location',      b.location || '—'],
      ['Package',       b.package || '—'],
      ['Budget',        BUDGET_LABELS[b.budget] || b.budget || '—'],
      ['Deliverables',  b.deliverables || '—'],
    ] : [
      ['Session Type',  `${SESSION_EMOJI[b.sessionType] || ''} ${b.sessionType}`],
    ]),
    ['Submitted',     `${fmtDate(b.createdAt)} at ${fmtTime(b.createdAt)}`],
  ];

  modalContent.innerHTML = rows.map(([k, v]) => `
    <div class="detail-row">
      <span class="detail-row__key">${k}</span>
      <span class="detail-row__val">${v}</span>
    </div>`).join('');

  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
  detailModal.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeDetail);
modalBackdrop.addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

/* ════════════════════════════════════════════
   SIDEBAR NAVIGATION
   ════════════════════════════════════════════ */
document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    activeStatus = item.dataset.view  || 'all';
    activeKind   = item.dataset.kind  || 'all';
    activeType   = item.dataset.type  || null;
    activeEtype  = item.dataset.etype || null;

    // If a specific type is selected, clear status filter
    if (activeType || activeEtype) activeStatus = 'all';

    // Update header title
    const titles = { all:'All Bookings', pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled' };
    document.getElementById('headerTitle').textContent =
      activeType  ? `Studio — ${activeType}` :
      activeEtype ? (EVENT_TYPE_LABELS[activeEtype] || activeEtype) :
      activeKind === 'studio' ? 'All Studio Sessions' :
      activeKind === 'event'  ? 'All Events & Weddings' :
      titles[activeStatus] || 'All Bookings';

    // Sync kind filter pills
    syncKindFilters();
    // Sync status filter pills
    document.querySelectorAll('.filter-btn[data-status]').forEach(b =>
      b.classList.toggle('active', b.dataset.status === activeStatus)
    );
    render();
  });
});

/* ════════════════════════════════════════════
   TOOLBAR KIND FILTERS
   ════════════════════════════════════════════ */
document.getElementById('kindFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-kind-f]');
  if (!btn) return;
  document.querySelectorAll('[data-kind-f]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeKind  = btn.dataset.kindF;
  activeType  = null;
  activeEtype = null;
  render();
});

function syncKindFilters() {
  document.querySelectorAll('[data-kind-f]').forEach(b =>
    b.classList.toggle('active', b.dataset.kindF === activeKind)
  );
}

/* ════════════════════════════════════════════
   TOOLBAR STATUS FILTERS
   ════════════════════════════════════════════ */
document.getElementById('statusFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-status]');
  if (!btn) return;
  document.querySelectorAll('[data-status]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeStatus = btn.dataset.status;
  render();
});

/* ════════════════════════════════════════════
   SEARCH
   ════════════════════════════════════════════ */
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  render();
});

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
   CROSS-TAB SYNC
   ════════════════════════════════════════════ */
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY && isAuthed()) render();
});
