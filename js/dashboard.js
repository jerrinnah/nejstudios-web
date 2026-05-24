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
// Reads local cache, filtering out server-marked tombstones.
function getBookings() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return raw.filter(b => !b.deletedAt);
}

/**
 * saveBookings(arr) — SAFE bulk save.
 * Uses the atomic merge endpoint so it upserts by id and never wipes
 * records added by other devices. Does NOT implicitly delete items
 * missing from `arr` — use deleteBooking(id) for deletions.
 */
function saveBookings(arr) {
  if (!Array.isArray(arr)) return;
  // Optimistic local cache for responsive UI
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const byId = new Map(existing.map(b => [b.id, b]));
  arr.forEach(b => { if (b && b.id) byId.set(b.id, b); });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(byId.values())));

  // Server atomic merge (upserts only — deletions use tombstones via deleteBooking)
  if (typeof dbUpsertBookings === 'function') {
    dbUpsertBookings(arr).catch(() => {});
  } else {
    // Fallback if db.js isn't loaded yet (shouldn't happen, but be safe)
    fetch('/api/sync.php?resource=bookings&op=merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upserts: arr, deletes: [] }),
    }).catch(() => {});
  }
}

/**
 * softDeleteBooking(id) — marks a booking as deleted via server tombstone.
 * Propagates to all other devices on next sync.
 */
async function softDeleteBooking(id) {
  if (typeof dbSoftDeleteBooking === 'function') {
    await dbSoftDeleteBooking(id);
  } else {
    await fetch('/api/sync.php?resource=bookings&op=merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upserts: [], deletes: [id] }),
    }).catch(() => {});
    // Mark locally
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idx = local.findIndex(b => b.id === id);
    if (idx >= 0) { local[idx].deletedAt = Date.now(); localStorage.setItem(STORAGE_KEY, JSON.stringify(local)); }
  }
}

// Pull bookings from server — ALWAYS authoritative, even if empty
async function syncBookingsFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=bookings', { cache: 'no-store' });
    if (!r.ok) return;
    const serverBookings = await r.json();
    if (!Array.isArray(serverBookings)) return;
    // Store full server state (including tombstones) so future merges are accurate
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serverBookings));
  } catch { /* server unreachable — local data used */ }
}
const TEAM_DELETED_KEY = 'nej_team_deleted';
function getDeletedTeamIds() {
  try { return JSON.parse(localStorage.getItem(TEAM_DELETED_KEY) || '[]'); } catch { return []; }
}
function saveDeletedTeamIds(ids) {
  localStorage.setItem(TEAM_DELETED_KEY, JSON.stringify(ids));
  fetch('/api/sync.php?resource=team_deleted', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids),
  }).catch(() => {});
}

const TEAM_OVERRIDES_KEY = 'nej_team_overrides';
function getTeamOverrides() {
  try { return JSON.parse(localStorage.getItem(TEAM_OVERRIDES_KEY) || '{}'); } catch { return {}; }
}
function saveTeamOverrides(map) {
  localStorage.setItem(TEAM_OVERRIDES_KEY, JSON.stringify(map));
  fetch('/api/sync.php?resource=team_overrides', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(map),
  }).catch(() => {});
}

function saveTeam(arr) {
  // Non-hardcoded members go to TEAM_KEY (full records).
  // Hardcoded members' edits (salary, etc.) go to TEAM_OVERRIDES_KEY keyed by id.
  const extras = [];
  const overrides = getTeamOverrides();
  arr.forEach(m => {
    const hc = TEAM_CONFIG.find(c => c.id === m.id);
    if (hc) {
      // Track only fields that differ from the hardcoded baseline
      const diff = {};
      ['name','username','pin','salary','role'].forEach(k => {
        if (m[k] !== undefined && m[k] !== hc[k]) diff[k] = m[k];
      });
      if (Object.keys(diff).length) overrides[m.id] = diff;
      else delete overrides[m.id];
    } else {
      extras.push(m);
    }
  });
  localStorage.setItem(TEAM_KEY, JSON.stringify(extras));
  fetch('/api/sync.php?resource=team_members', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extras),
  }).catch(() => {});
  saveTeamOverrides(overrides);
}

// Merges hardcoded TEAM_CONFIG with overrides and admin-added members.
// Filters out IDs in the deleted list so admin-removed members stay removed.
function getTeam() {
  const stored    = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
  const deleted   = new Set(getDeletedTeamIds());
  const overrides = getTeamOverrides();
  const merged    = TEAM_CONFIG.filter(c => !deleted.has(c.id)).map(c =>
    overrides[c.id] ? { ...c, ...overrides[c.id] } : c
  );
  stored.forEach(m => {
    if (deleted.has(m.id)) return;
    if (!merged.find(c => c.id === m.id || c.username.toLowerCase() === m.username.toLowerCase())) {
      merged.push(m);
    }
  });
  return merged;
}

async function syncTeamOverridesFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=team_overrides', { cache: 'no-store' });
    if (!r.ok) return;
    const server = await r.json();
    if (!server || typeof server !== 'object' || Array.isArray(server)) return;
    const local  = getTeamOverrides();
    const merged = { ...local, ...server };
    localStorage.setItem(TEAM_OVERRIDES_KEY, JSON.stringify(merged));
  } catch {}
}

async function syncTeamDeletedFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=team_deleted', { cache: 'no-store' });
    if (!r.ok) return;
    const serverDeleted = await r.json();
    if (!Array.isArray(serverDeleted) || serverDeleted.length === 0) return;
    const local = getDeletedTeamIds();
    const merged = Array.from(new Set([...local, ...serverDeleted]));
    localStorage.setItem(TEAM_DELETED_KEY, JSON.stringify(merged));
  } catch { /* server unreachable — local data used */ }
}

async function syncTeamFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=team_members', { cache: 'no-store' });
    if (!r.ok) return;
    const serverExtras = await r.json();
    if (!Array.isArray(serverExtras) || serverExtras.length === 0) return;
    const local = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
    const merged = [...local];
    serverExtras.forEach(m => {
      if (!merged.find(c => c.id === m.id)) merged.push(m);
    });
    localStorage.setItem(TEAM_KEY, JSON.stringify(merged));
  } catch { /* server unreachable — local data used */ }
}

function getApprovals() { return JSON.parse(localStorage.getItem(APPROVALS_KEY) || '{}'); }

async function fetchApprovals() {
  try {
    const r = await fetch('/api/sync.php?resource=approvals', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      localStorage.setItem(APPROVALS_KEY, JSON.stringify(data));
      return data;
    }
  } catch { /* server unreachable — use localStorage copy */ }
  return getApprovals();
}

function saveApproval(bookingId, imgId, value) {
  const all = getApprovals();
  if (!all[bookingId]) all[bookingId] = {};
  if (value === null) delete all[bookingId][imgId];
  else all[bookingId][imgId] = value;
  localStorage.setItem(APPROVALS_KEY, JSON.stringify(all));
  // Sync to server
  fetch('/api/sync.php?resource=approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(all),
  }).catch(() => {});
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
   CACHE VERSION — bump DATA_VERSION to force-clear
   all demo/stale localStorage on every device
   ════════════════════════════════════════════ */
const DATA_VERSION = 'v4';
function clearDemoCache() {
  if (localStorage.getItem('nej_data_version') === DATA_VERSION) return;
  // IMPORTANT: never clear 'nej_bookings' here — real bookings live on the server
  // and the local copy is a cache. Clearing and then saving before sync could
  // wipe the server. The old demo-seeded flag is the only booking-related key
  // that's safe to clear because seeding is disabled.
  ['nej_bookings_seeded', 'nej_tasks', 'nej_cms', 'nej_gallery'].forEach(k => localStorage.removeItem(k));
  localStorage.setItem('nej_data_version', DATA_VERSION);
}

/* ════════════════════════════════════════════
   SEED DEMO BOOKINGS — DISABLED (kept for reference)
   ════════════════════════════════════════════ */
function seedIfEmpty() {
  // Demo seeding disabled — real bookings come from server
  return;
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

/* ─ Team notification store (server-synced, keyed by memberId) ─ */
const NOTIF_KEY_PREFIX = 'nej_notif_';

async function pushTeamNotification(memberId, notif) {
  const newNotif = { ...notif, id: 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2,5), read: false, ts: notif.ts || Date.now() };

  // 1. Fetch current notifications from server, append, save back
  try {
    const r   = await fetch('/api/sync.php?resource=notifications', { cache: 'no-store' });
    let all   = r.ok ? await r.json() : {};
    // Guard: if server returned an array (legacy/empty), convert to object
    if (Array.isArray(all)) all = {};
    const pool = Array.isArray(all[memberId]) ? all[memberId] : [];
    pool.push(newNotif);
    all[memberId] = pool;
    await fetch('/api/sync.php?resource=notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(all),
    });
  } catch {
    // Server unreachable — fall back to localStorage
    const key    = NOTIF_KEY_PREFIX + memberId;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    stored.push(newNotif);
    localStorage.setItem(key, JSON.stringify(stored));
  }

  // 2. Send real push via OneSignal → PHP proxy (cross-device)
  fetch('/api/notify.php', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      external_id: memberId,
      title:       notif.title   || 'NEJstudios',
      message:     notif.message || '',
      url:         '/team',
    }),
  }).catch(() => {});
}
function getTeamNotifications(memberId) {
  return JSON.parse(localStorage.getItem(NOTIF_KEY_PREFIX + memberId) || '[]');
}
function markNotifRead(memberId, notifId) {
  const key    = NOTIF_KEY_PREFIX + memberId;
  const stored = JSON.parse(localStorage.getItem(key) || '[]');
  const item   = stored.find(n => n.id === notifId);
  if (item) { item.read = true; localStorage.setItem(key, JSON.stringify(stored)); }
}
function clearTeamNotifications(memberId) {
  localStorage.removeItem(NOTIF_KEY_PREFIX + memberId);
}

/* ════════════════════════════════════════════
   FORMATTERS
   ════════════════════════════════════════════ */
function fmtDate(ts)       { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'medium' }); }
function fmtTime(ts)       { if (!ts) return ''; return new Date(ts).toLocaleTimeString('en-NG', { timeStyle:'short' }); }
function fmtEventDate(str) { if (!str) return '—'; return new Date(str + 'T12:00:00').toLocaleDateString('en-NG', { dateStyle:'long' }); }
function fmtDateShort(ts)  { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'short' }); }

const SESSION_EMOJI = { 'Half Session':'', 'Regular Session':'', 'Birthday Session':'', 'Outdoor Session':'', Birthday:'', Family:'', Creative:'', Fashion:'', Product:'' };
const STATUS_LABELS  = { pending:'Pending', confirmed:'Confirmed', completed:'Completed', cancelled:'Cancelled', booked:'Booked' };
const EVENT_TYPE_LABELS = {
  'brand-film':'🎬 Brand Film','music-video':'🎵 Music Video','documentary':'🎥 Documentary',
  'corporate-event':'🏢 Corporate Event','other-production':'📹 Production',
  'traditional-wedding':'💛 Traditional Wedding','white-wedding':'🤍 White Wedding',
  'full-wedding':'💍 Full Wedding','engagement':'💌 Engagement Shoot',
  'funeral':'🕊️ Funeral / Memorial','service-of-songs':'🎶 Service of Songs',
  'birthday':'🎂 Birthday','other-event':'📅 Other Event',
};
const BUDGET_LABELS = { 'under150':'Under ₦150k','150-350':'₦150k–₦350k','350-600':'₦350k–₦600k','600-1m':'₦600k–₦1M','above1m':'Above ₦1M','800k-1m':'₦800k–₦1M','1m-1.2m':'₦1M–₦1.2M','1.2m-1.4m':'₦1.2M–₦1.4M','above1.4m':'Above ₦1.4M' };

// Format event budget: numeric → ₦ amount; legacy key → range label; anything else → raw value or —
function fmtBudget(b) {
  if (b == null || b === '') return '—';
  if (typeof b === 'number' && !isNaN(b)) return '₦' + b.toLocaleString('en-NG');
  if (typeof b === 'string' && /^\d+(\.\d+)?$/.test(b)) return '₦' + Number(b).toLocaleString('en-NG');
  return BUDGET_LABELS[b] || b;
}

function statusBadge(status) {
  // Show "Booked" badge for confirmed bookings that have a deposit paid flag, or always show Booked for confirmed
  const displayStatus = status === 'confirmed' ? 'booked' : status;
  const displayClass  = status === 'confirmed' ? 'booked' : status;
  return `<span class="status-badge status-badge--${displayClass}">${STATUS_LABELS[displayStatus] || displayStatus}</span>`;
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

function getAdminGreeting(name) {
  const visitKey = 'nej_greeted_admin_' + name;
  const idxKey   = visitKey + '_idx';
  const visited  = localStorage.getItem(visitKey);
  let msg, sub;
  if (visited) {
    const greetings = ['Howfar', 'Wida'];
    const idx = parseInt(localStorage.getItem(idxKey) || '0');
    const word = greetings[idx % 2];
    localStorage.setItem(idxKey, String((idx + 1) % 2));
    msg = `${word}, ${name}! 👋`;
    sub = 'Welcome back — here\'s the schedule overview.';
  } else {
    localStorage.setItem(visitKey, '1');
    const h = new Date().getHours();
    const timeWord = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    msg = `${timeWord}, ${name}! 👋`;
    sub = 'Here\'s your shoots & events schedule.';
  }
  return { msg, sub };
}

function renderAdminGreeting() {
  const el = document.getElementById('adminGreeting');
  if (!el) return;
  const s = getSession();
  const rawName = s ? (s.name || s.username || 'Admin') : 'Admin';
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const { msg, sub } = getAdminGreeting(name);
  const h = new Date().getHours();
  const icon = h < 12 ? '🌅' : h < 17 ? '☀️' : '🌙';
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="portal-greeting__icon">${icon}</div>
    <div class="portal-greeting__text">
      <div class="portal-greeting__msg">${msg}</div>
      <div class="portal-greeting__sub">${sub}</div>
    </div>`;
}

function showDash() {
  clearDemoCache();
  loginGate.classList.add('hidden');
  dashShell.style.display = 'flex';
  const s = getSession();
  document.getElementById('sidebarUser').textContent = s ? `Admin — ${s.username || 'admin'}` : 'Admin';
  renderAdminGreeting();
  // Sync bookings and gallery from server then render (server data takes precedence)
  syncGalleryFromServer().catch(() => {});
  syncTeamFromServer().catch(() => {});
  syncTeamDeletedFromServer().catch(() => {});
  syncTeamOverridesFromServer().catch(() => {});
  syncBookingsFromServer().then(async () => {
    await autoCreateEventDayTasks().catch(e => console.warn('Auto-task generation failed:', e));
    renderBookings();
    renderTasksBadge();
  });
  renderConfirmationsAlert();
  requestNotifPermission();
  // Register this device as 'admin' with OneSignal for push notifications
  if (window.OneSignalDeferred) {
    OneSignalDeferred.push(async function(OneSignal) {
      try { await OneSignal.login('admin'); } catch {}
    });
  }
}

/* ════════════════════════════════════════════
   CLIENT CONFIRMATIONS ALERT
   ════════════════════════════════════════════ */
async function renderConfirmationsAlert() {
  const alertEl = document.getElementById('confirmationsAlert');
  const listEl  = document.getElementById('confirmationsList');
  const badgeEl = document.getElementById('confirmBadgeCount');
  if (!alertEl || !listEl) return;

  const all    = await dbGetConfirmations();
  const unread = all.filter(c => !c.read);

  if (all.length === 0) { alertEl.style.display = 'none'; return; }

  alertEl.style.display = 'block';
  badgeEl.textContent   = unread.length > 0 ? `${unread.length} new` : `${all.length} total`;

  // Toggle show/hide
  const toggleBtn = document.getElementById('confirmToggle');
  let   listOpen  = false;
  toggleBtn.addEventListener('click', () => {
    listOpen = !listOpen;
    listEl.style.display = listOpen ? 'flex' : 'none';
    toggleBtn.textContent = listOpen ? 'Hide' : 'Show';
    if (listOpen) renderConfirmList(all, listEl, badgeEl);
  });
}

function renderConfirmList(all, listEl, badgeEl) {
  listEl.innerHTML = all.slice(0, 20).map(c => {
    const dt = c.confirmedAt ? new Date(c.confirmedAt).toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' }) : '—';
    return `
      <div data-conf-id="${c.id}" style="background:var(--bg-3);border:1px solid var(--border);border-radius:8px;padding:12px 14px;${c.read ? 'opacity:0.6' : ''}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-size:0.85rem;font-weight:600;color:var(--white)">${c.clientName || 'Client'}</div>
            <div style="font-size:0.72rem;color:var(--grey-3);margin-top:2px">${dt}${c.bookingId ? ' · ' + c.bookingId : ''}</div>
            ${c.pictureCount ? `<div style="font-size:0.78rem;color:var(--grey-2);margin-top:4px">📷 ${c.pictureCount} photos selected</div>` : ''}
            ${c.selection ? `<div style="font-size:0.75rem;color:var(--grey-3);margin-top:2px;font-style:italic">"${c.selection}"</div>` : ''}
            ${c.fileNames ? `<div style="font-size:0.72rem;color:var(--grey-4);margin-top:2px">Files: ${c.fileNames}</div>` : ''}
          </div>
          ${!c.read ? `<button data-mark-read="${c.id}" style="font-size:0.7rem;background:none;border:1px solid var(--green);color:var(--green);border-radius:5px;padding:3px 8px;cursor:pointer;flex-shrink:0">Mark Read</button>` : '<span style="font-size:0.68rem;color:var(--grey-4)">✓ Read</span>'}
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-mark-read]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await dbMarkConfirmationRead(btn.dataset.markRead);
      const updated = await dbGetConfirmations();
      const unread  = updated.filter(c => !c.read);
      badgeEl.textContent = unread.length > 0 ? `${unread.length} new` : `${updated.length} total`;
      renderConfirmList(updated, listEl, badgeEl);
    });
  });
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

/* ════════════════════════════════════════════
   BROADCAST PUSH NOTIFICATION MODAL
   ════════════════════════════════════════════ */
const broadcastModal     = document.getElementById('broadcastModal');
const broadcastTitleEl   = document.getElementById('broadcastTitle');
const broadcastMessageEl = document.getElementById('broadcastMessage');

function openBroadcastModal() {
  broadcastTitleEl.value   = '';
  broadcastMessageEl.value = '';
  broadcastModal.classList.add('open');
  broadcastTitleEl.focus();
}
function closeBroadcastModal() {
  broadcastModal.classList.remove('open');
}

document.getElementById('notifyTeamBtn').addEventListener('click', openBroadcastModal);
document.getElementById('broadcastModalClose').addEventListener('click', closeBroadcastModal);
document.getElementById('broadcastModalBackdrop').addEventListener('click', closeBroadcastModal);
document.getElementById('broadcastCancelBtn').addEventListener('click', closeBroadcastModal);

document.getElementById('broadcastSendBtn').addEventListener('click', async () => {
  const title   = broadcastTitleEl.value.trim();
  const message = broadcastMessageEl.value.trim();
  if (!title || !message) { showToast('Please enter both a title and message', 'err'); return; }

  const sendBtn = document.getElementById('broadcastSendBtn');
  sendBtn.textContent = 'Sending…';
  sendBtn.disabled = true;

  const team = getTeam().filter(m => m.id);
  const results = await Promise.allSettled(team.map(m =>
    pushTeamNotification(m.id, { title, message, ts: Date.now() })
  ));
  const sent = results.filter(r => r.status === 'fulfilled').length;

  sendBtn.textContent = 'Send to All';
  sendBtn.disabled = false;
  closeBroadcastModal();
  showToast(`Notification sent to ${sent} team member${sent !== 1 ? 's' : ''} ✓`);
});

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

// Close sidebar when any nav item is clicked (mobile — sidebar slides back out)
sidebar.querySelectorAll('.nav-item, .nav-panel-trigger').forEach(btn => {
  btn.addEventListener('click', () => {
    if (window.innerWidth <= 900) closeSidebar();
  });
});

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
  if (name === 'team')     { renderTeam(); renderAttendance(); renderCompletedTasksByMember(); renderLeaveRequests(); }
  if (name === 'calendar') renderBookingsCalendar();
  if (name === 'gallery')  renderGalleryPanel();
  if (name === 'summary')  { renderDailySummary(); renderMonthlyDeliveryAdmin(); }
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
    btns.push(`<button class="action-btn" style="border-color:var(--gold);color:var(--gold)" data-id="${b.id}" data-action="invoice">${b.bookingKind === 'event' ? 'Invoice' : 'Receipt'}</button>`);
    if (b.bookingKind === 'event') {
      btns.push(`<button class="action-btn" style="border-color:var(--green);color:var(--green)" data-id="${b.id}" data-action="share-event">Share</button>`);
    }
  }
  if (b.status === 'completed') {
    btns.push(`<button class="action-btn action-btn--pending"  data-id="${b.id}" data-action="pending">Reopen</button>`);
    btns.push(`<button class="action-btn" style="border-color:var(--gold);color:var(--gold)" data-id="${b.id}" data-action="invoice">${b.bookingKind === 'event' ? 'Invoice' : 'Receipt'}</button>`);
    btns.push(`<button class="action-btn" style="border-color:var(--green);color:var(--green)" data-id="${b.id}" data-action="send-gallery">Gallery</button>`);
  }
  if (b.status === 'cancelled') {
    btns.push(`<button class="action-btn action-btn--pending"  data-id="${b.id}" data-action="pending">Reopen</button>`);
  }
  btns.push(`<button class="action-btn" style="border-color:var(--blue);color:var(--blue)" data-id="${b.id}" data-action="edit">Edit</button>`);
  btns.push(`<button class="action-btn" style="border-color:var(--purple);color:var(--purple)" data-id="${b.id}" data-action="assign-team">Team</button>`);
  btns.push(`<button class="action-btn action-btn--delete" data-id="${b.id}" data-action="delete">Delete</button>`);
  btns.push(`<button class="action-btn" style="border-color:var(--border);color:var(--grey-3)" data-id="${b.id}" data-action="detail">Details</button>`);
  return btns.join('');
}

function assignedTeamHtml(b) {
  if (!b.assignedTeam || !b.assignedTeam.length) return '';
  const tags = b.assignedTeam.map(m =>
    `<span style="background:var(--gold-glow);border:1px solid rgba(201,168,76,.25);border-radius:4px;padding:1px 7px;font-size:0.7rem;color:var(--gold-lt)">${m.name}</span>`
  ).join(' ');
  return `<div class="meta-row" style="margin-top:4px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
    <span style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">Team: ${tags}</span>
  </div>`;
}

function buildStudioCard(b) {
  const shoot = b.shootDate || b.preferredDate || '';
  const shootLabel = shoot
    ? `<strong>${fmtEventDate(shoot)}</strong>${b.shootDate ? '' : ' <span style="color:var(--grey-4);font-size:0.7rem">(requested)</span>'}`
    : '<span style="color:var(--grey-4)">Not set</span>';
  const costLabel = (b.cost != null && b.cost !== '')
    ? `<strong>₦${Number(b.cost).toLocaleString('en-NG')}</strong>`
    : '<span style="color:var(--grey-4)">Cost not set</span>';
  return `
    <div class="booking-card" data-id="${b.id}">
      <div class="booking-card__top">
        <div>${kindBadge('studio')}<div class="booking-card__name">${b.clientName}</div><div class="booking-card__id">${b.id}</div></div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill">${b.sessionType}</span>
      <div class="booking-card__meta">
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Shoot Date: ${shootLabel}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg><span>Cost: ${costLabel}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg><span>${b.phone}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>${b.email}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Booked <strong>${fmtDate(b.createdAt)}</strong> at ${fmtTime(b.createdAt)}</span></div>
        ${assignedTeamHtml(b)}
      </div>
      <div class="booking-card__actions">${actionButtons(b)}</div>
    </div>`;
}

function buildEventCard(b) {
  const typeLabel   = EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—';
  const budgetLabel = fmtBudget(b.budget);
  const deliv       = b.deliverables ? b.deliverables.slice(0,120) + (b.deliverables.length > 120 ? '…' : '') : '—';
  const displayName = b.eventName || b.clientName || '—';
  return `
    <div class="booking-card booking-card--event" data-id="${b.id}">
      <div class="booking-card__top">
        <div>${kindBadge('event')}<div class="booking-card__name">${displayName}</div><div class="booking-card__id">${b.id}</div></div>
        ${statusBadge(b.status)}
      </div>
      <span class="session-pill event-pill">${typeLabel}</span>
      <div class="event-fields">
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div><span class="ef-label">Event Date</span><span class="ef-value">${fmtEventDate(b.eventDate)}</span></div></div>
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><div><span class="ef-label">Location</span><span class="ef-value">${b.location || '—'}</span></div></div>
        <div class="event-field"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg><div><span class="ef-label">Event Cost</span><span class="ef-value">${budgetLabel}</span></div></div>
        <div class="event-field event-field--full"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><div><span class="ef-label">Deliverables</span><span class="ef-value ef-deliverables">${deliv}</span></div></div>
      </div>
      <div class="booking-card__meta" style="margin-top:12px">
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-8-8 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg><span>${b.phone}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>${b.email}</span></div>
        <div class="meta-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>Booked <strong>${fmtDate(b.createdAt)}</strong></span></div>
        ${assignedTeamHtml(b)}
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
  // Sort: most-recently created first; within same createdAt, upcoming booking dates first
  bookings.sort((a, b) => {
    const ca = a.createdAt || 0, cb = b.createdAt || 0;
    if (cb !== ca) return cb - ca;
    const da = (a.bookingKind === 'studio' ? (a.shootDate || a.preferredDate) : a.eventDate) || '';
    const db_ = (b.bookingKind === 'studio' ? (b.shootDate || b.preferredDate) : b.eventDate) || '';
    return db_.localeCompare(da);
  });

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

async function openAssignTeamModal(bookingId) {
  const b    = getBookings().find(b => b.id === bookingId);
  if (!b) return;
  const team = getTeam().filter(m => m.role !== 'admin');
  if (team.length === 0) { showToast('No team members to assign'); return; }

  const assigned = b.assignedTeam || [];
  const checkboxes = team.map(m => {
    const checked = assigned.find(a => a.id === m.id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.88rem;color:var(--grey-2);margin-bottom:8px">
      <input type="checkbox" value="${m.id}" data-name="${m.name}" ${checked} style="accent-color:var(--gold);width:16px;height:16px;cursor:pointer"> ${m.name} <span style="margin-left:auto;font-size:0.72rem;color:var(--grey-4)">@${m.username}</span>
    </label>`;
  }).join('');

  // Reuse detail modal for team assignment
  modalContent.innerHTML = `
    <p style="font-size:0.8rem;color:var(--grey-3);margin-bottom:16px">Select team members to assign to <strong style="color:var(--white)">${b.clientName}</strong></p>
    <div id="assignTeamList">${checkboxes}</div>
    <button id="saveAssignTeam" style="margin-top:16px;width:100%;padding:11px;background:var(--gold);color:#000;font-weight:700;font-size:0.8rem;border:none;border-radius:8px;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase">Save Assignment</button>`;

  detailModal.querySelector('h3').textContent = 'Assign Team';

  document.getElementById('saveAssignTeam').addEventListener('click', () => {
    const selected = [];
    document.querySelectorAll('#assignTeamList input[type=checkbox]:checked').forEach(cb => {
      selected.push({ id: cb.value, name: cb.dataset.name });
    });
    const bookings = getBookings();
    const idx = bookings.findIndex(bk => bk.id === bookingId);
    if (idx !== -1) {
      bookings[idx].assignedTeam = selected;
      saveBookings(bookings);
      // Notify assigned members via localStorage
      selected.forEach(m => pushTeamNotification(m.id, {
        type:    'booking-assigned',
        title:   'New Booking Assigned',
        message: `You have been assigned to ${b.clientName} (${b.sessionType || b.eventType || 'booking'})`,
        bookingId, ts: Date.now(),
      }));
    }
    closeDetail();
    renderBookings();
    showToast(selected.length ? `Team assigned to ${b.clientName}` : 'Team assignment cleared');
  });

  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function handleBookingAction(id, action) {
  if (action === 'detail')       { openDetail(id);             return; }
  if (action === 'delete')       { deleteBooking(id);           return; }
  if (action === 'invoice')      { openInvoice(id);             return; }
  if (action === 'send-gallery') { openSendGallery(id);         return; }
  if (action === 'edit')         { openEditBooking(id);         return; }
  if (action === 'assign-team')  { openAssignTeamModal(id);     return; }
  if (action === 'share-event')  { shareEventToClient(id);      return; }
  const bookings = getBookings(), idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;
  bookings[idx].status = action;
  saveBookings(bookings);

  // When confirmed, push to Supabase schedule so team can see it
  if (action === 'confirmed') {
    const b = bookings[idx];
    const EVENT_MAP = {
      'white-wedding':'wedding', 'traditional-wedding':'wedding',
      'full-wedding':'wedding', 'engagement':'wedding',
      'brand-film':'production', 'corporate-event':'event',
      'music-video':'production', 'documentary':'production',
      'other-production':'production',
      'birthday':'event', 'funeral':'event', 'other-event':'event'
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

function shareEventToClient(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;
  // Short URL: the booking lives on the server, so we only need its ID.
  // booking-view.html fetches the full record and filters sensitive fields (budget, team).
  const url = `${location.origin}/booking-view?b=${b.id}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Confirmation link copied — send it to the client ✓'))
    .catch(() => prompt('Copy this link and send to the client:', url));
}

async function deleteBooking(id) {
  if (!confirm(`Delete booking ${id}? This cannot be undone.`)) return;
  await softDeleteBooking(id);
  showToast('Booking deleted');
  renderBookings();
}

/* ════════════════════════════════════════════
   BOOKING EDIT MODAL
   ════════════════════════════════════════════ */
const bookingEditModal = document.getElementById('bookingEditModal');

function closeBookingEditModal() {
  bookingEditModal.style.display = 'none';
  document.body.style.overflow = '';
}
document.getElementById('bookingEditClose').addEventListener('click', closeBookingEditModal);
document.getElementById('bookingEditCancel').addEventListener('click', closeBookingEditModal);
bookingEditModal.addEventListener('click', e => { if (e.target === bookingEditModal) closeBookingEditModal(); });

function openEditBooking(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;
  const isEvent = b.bookingKind === 'event';

  document.getElementById('bookingEditId').value    = id;
  document.getElementById('beFirstName').value      = b.firstName    || b.clientName || '';
  document.getElementById('beMiddleName').value     = b.middleName   || '';
  document.getElementById('bePhone').value          = b.phone        || '';
  document.getElementById('beEmail').value          = b.email        || '';

  // Events use a single "Event Name" field instead of first/middle name
  const nameRow = document.getElementById('beNameRow');
  if (nameRow) nameRow.style.display = isEvent ? 'none' : 'grid';
  document.getElementById('beStudioFields').style.display = isEvent ? 'none' : '';
  document.getElementById('beEventFields').style.display  = isEvent ? ''     : 'none';

  if (!isEvent) {
    document.getElementById('beSessionType').value  = b.sessionType  || '';
    document.getElementById('beNumOutfits').value   = b.numOutfits   || '1';
    document.getElementById('beShootDate').value    = b.shootDate    || b.preferredDate || '';
    document.getElementById('beCost').value         = b.cost != null ? b.cost : '';
    const hint = document.getElementById('bePreferredDateHint');
    if (hint) hint.textContent = b.preferredDate ? fmtEventDate(b.preferredDate) : '—';
  } else {
    document.getElementById('beEventName').value    = b.eventName    || b.clientName || '';
    document.getElementById('beEventType').value    = b.eventType    || '';
    document.getElementById('beEventDate').value    = b.eventDate    || '';
    document.getElementById('beLocation').value     = b.location     || '';
    // Budget may be legacy label key or a raw number. Number input accepts only numbers.
    document.getElementById('beBudget').value       = (typeof b.budget === 'number' || /^\d+(\.\d+)?$/.test(b.budget || '')) ? b.budget : '';
    document.getElementById('beDeliverables').value = b.deliverables || '';
  }

  bookingEditModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

document.getElementById('bookingEditForm').addEventListener('submit', e => {
  e.preventDefault();
  const id        = document.getElementById('bookingEditId').value;
  const bookings  = getBookings();
  const idx       = bookings.findIndex(b => b.id === id);
  if (idx === -1) return;

  const b         = bookings[idx];
  const isEvent   = b.bookingKind === 'event';
  const phone     = document.getElementById('bePhone').value.trim();
  const email     = document.getElementById('beEmail').value.trim();

  let updates = { phone, email };

  if (!isEvent) {
    const firstName  = document.getElementById('beFirstName').value.trim();
    const middleName = document.getElementById('beMiddleName').value.trim();
    if (!firstName || !phone || !email) { showToast('Name, phone and email are required'); return; }
    const clientName = middleName ? `${firstName} ${middleName}` : firstName;
    updates = { ...updates, firstName, middleName, clientName };
    updates.sessionType = document.getElementById('beSessionType').value;
    updates.numOutfits  = document.getElementById('beNumOutfits').value;
    updates.shootDate   = document.getElementById('beShootDate').value || '';
    const costRaw       = document.getElementById('beCost').value;
    updates.cost        = costRaw === '' ? null : Number(costRaw);
  } else {
    const eventName = document.getElementById('beEventName').value.trim();
    if (!eventName || !phone || !email) { showToast('Event name, phone and email are required'); return; }
    updates.eventName    = eventName;
    updates.clientName   = eventName;
    updates.eventType    = document.getElementById('beEventType').value;
    updates.eventDate    = document.getElementById('beEventDate').value;
    updates.location     = document.getElementById('beLocation').value.trim();
    const budgetRaw      = document.getElementById('beBudget').value;
    updates.budget       = budgetRaw === '' ? null : Number(budgetRaw);
    updates.deliverables = document.getElementById('beDeliverables').value.trim();
  }
  const clientName = updates.clientName;

  bookings[idx] = { ...b, ...updates };
  saveBookings(bookings);
  const schedPatch = { clientName };
  if (!isEvent && updates.shootDate) schedPatch.date = updates.shootDate;
  if (isEvent && updates.eventDate)  schedPatch.date = updates.eventDate;
  dbUpdateScheduleEntry('BK-' + id, schedPatch);
  closeBookingEditModal();
  showToast('Booking updated ✓');
  renderBookings();
});

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
  // Persist full gallery map to server so it survives localStorage clears
  fetch('/api/sync.php?resource=gallery', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(all),
  }).catch(() => {});
}

// Pull gallery from server on startup; server is authoritative
async function syncGalleryFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=gallery', { cache: 'no-store' });
    if (!r.ok) return;
    const serverGallery = await r.json();
    if (!serverGallery || typeof serverGallery !== 'object' || Array.isArray(serverGallery)) return;
    // Merge: server entries take precedence; keep any local-only booking galleries
    const local  = getGalleries();
    const merged = Object.assign({}, local, serverGallery);
    localStorage.setItem(GALLERY_KEY, JSON.stringify(merged));
  } catch { /* server unreachable — local data used */ }
}

function downloadDataUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

async function downloadAsZip(imgs, zipName) {
  if (!window.JSZip) { showToast('ZIP library not loaded yet, try again.', 'err'); return; }
  const zip = new JSZip();
  await Promise.all(imgs.map(async (img, i) => {
    const safeName = img.name || ('photo_' + (i + 1) + '.jpg');
    if (img.url && img.url.startsWith('data:')) {
      // Legacy base64 — split header and add directly
      const b64  = img.url.split(',')[1];
      zip.file(safeName, b64, { base64: true });
    } else if (img.url) {
      // Real server URL — fetch as blob
      try {
        const res  = await fetch(img.url);
        const blob = await res.blob();
        zip.file(safeName, blob);
      } catch { /* skip unreachable file */ }
    }
  }));
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
  const all  = getClientGallery(bookingId);
  const img  = all.find(i => i.id === imgId);
  const imgs = all.filter(i => i.id !== imgId);
  saveClientGallery(bookingId, imgs);
  renderGallery(bookingId);
  // If the image was stored as a real server file, delete it from disk too
  if (img && img.url && img.url.startsWith('/uploads/')) {
    const filename = img.url.split('/').pop();
    fetch('/api/upload.php?action=delete&file=' + encodeURIComponent(filename), { method: 'POST' })
      .catch(() => {}); // fire-and-forget; gallery metadata already removed
  }
}

function handleGalleryUpload(bookingId, files) {
  const list = document.getElementById('galleryProgressList');
  if (!list) return;
  const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!fileArr.length) { showToast('Please select image files.', 'err'); return; }

  fileArr.forEach(async file => {
    const itemId = 'prog-' + Math.random().toString(36).slice(2, 8);
    const item = document.createElement('div');
    item.className = 'gallery-progress-item';
    item.id = itemId;
    item.innerHTML = `
      <div class="gallery-progress-item__name">${file.name}</div>
      <div class="gallery-progress-bar"><div class="gallery-progress-bar__fill" style="width:0%"></div></div>
      <div class="gallery-progress-item__pct">Compressing…</div>`;
    list.appendChild(item);

    const fill  = item.querySelector('.gallery-progress-bar__fill');
    const pctEl = item.querySelector('.gallery-progress-item__pct');

    // Compress before upload (skips HEIC/HEIF automatically)
    const uploadFile = await compressImage(file);

    if (pctEl) pctEl.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 95); // go to 95% during upload
      if (fill)  fill.style.width  = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    });
    xhr.addEventListener('load', () => {
      if (fill)  fill.style.width  = '100%';
      if (pctEl) pctEl.textContent = '100%';
      item.classList.add('done');

      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = null; }

      if (!data || !data.ok) {
        const errMsg = (data && data.error) ? data.error : 'Upload failed (server error)';
        showToast(errMsg, 'err');
        if (pctEl) pctEl.textContent = 'Error';
        setTimeout(() => item.remove(), 2500);
        return;
      }

      const imgs = getClientGallery(bookingId);
      imgs.push({
        id:         'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name:       data.name || file.name,
        url:        data.url,
        uploadedAt: Date.now(),
      });
      saveClientGallery(bookingId, imgs);
      renderGallery(bookingId);

      setTimeout(() => item.remove(), 1200);
    });
    xhr.addEventListener('error', () => {
      if (pctEl) pctEl.textContent = 'Error';
      showToast('Upload failed — check your connection.', 'err');
      setTimeout(() => item.remove(), 2500);
    });

    const formData = new FormData();
    formData.append('file', uploadFile);
    xhr.open('POST', '/api/upload.php');
    xhr.send(formData);
  });
}

function openDetail(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;
  // Reset modal h3 title in case it was changed by assign-team flow
  detailModal.querySelector('h3').textContent = 'Booking Details';
  const isEvent = b.bookingKind === 'event';
  const displayStatus = b.status === 'confirmed' ? 'Booked' : (STATUS_LABELS[b.status] || b.status);
  const rows = [
    ['Booking ID', b.id], ['Type', isEvent ? 'Event / Wedding' : 'Studio Session'],
    ['Name', b.clientName], ['Phone', b.phone], ['Email', b.email],
    ['Status', displayStatus],
    ...(b.assignedTeam && b.assignedTeam.length ? [['Assigned Team', b.assignedTeam.map(m => m.name).join(', ')]] : []),
    ...(isEvent ? [
      ['Event Name', b.eventName || b.clientName || '—'],
      ['Event Type', EVENT_TYPE_LABELS[b.eventType] || b.eventType || '—'],
      ['Event Date', fmtEventDate(b.eventDate)], ['Location', b.location || '—'],
      ['Package', b.package || '—'], ['Event Cost', fmtBudget(b.budget)],
      ['Deliverables', b.deliverables || '—'],
    ] : [
      ['Session Type', `${SESSION_EMOJI[b.sessionType] || ''} ${b.sessionType}`],
      ['Shoot Date', b.shootDate ? fmtEventDate(b.shootDate) : (b.preferredDate ? `${fmtEventDate(b.preferredDate)} (client requested)` : '—')],
      ['Session Cost', (b.cost != null && b.cost !== '') ? `₦${Number(b.cost).toLocaleString('en-NG')}` : '—'],
    ]),
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
        <input type="file" id="galleryInput" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" multiple>
        <svg class="gallery-dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <div class="gallery-dropzone__label">Click or drag &amp; drop photos</div>
        <div class="gallery-dropzone__sub">JPG, JPEG, PNG, WEBP · multiple files supported</div>
      </div>
      <div class="gallery-progress-list" id="galleryProgressList"></div>
      <div class="gallery-grid" id="galleryGrid"></div>
    </div>`;

  // Wire up upload input
  const input = document.getElementById('galleryInput');
  const dropzone = document.getElementById('galleryDropzone');
  input.addEventListener('change', () => handleGalleryUpload(id, input.files));
  // Programmatic click fallback — ensures file picker opens even inside overflow modal
  dropzone.addEventListener('click', e => { if (e.target !== input) input.click(); });
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
    const link = window.location.origin + '/client?id=' + id;
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

/* ── Invoice deposit helpers ── */
const BUDGET_AMOUNTS = {
  'under150':  100000,  '150-350': 250000,  '350-600': 475000,
  '600-1m':    800000,  'above1m': 1200000, '800k-1m': 900000,
  '1m-1.2m':   1100000, '1.2m-1.4m': 1300000, 'above1.4m': 1500000,
};
function fmtNGN(amt) {
  if (!amt || isNaN(amt)) return '—';
  return '₦' + Number(amt).toLocaleString('en-NG');
}

function openInvoice(id) {
  const b = getBookings().find(b => b.id === id);
  if (!b) return;

  const isEvent = b.bookingKind === 'event';

  if (!isEvent) {
    // ── Studio booking → POS Receipt ──
    openStudioReceipt(b);
    return;
  }

  // ── Event booking → A4 Invoice ──
  const invoiceNum    = 'INV-' + id;
  const now           = new Date();
  const issued        = now.toLocaleDateString('en-NG', { dateStyle:'long' });
  const due           = new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-NG', { dateStyle:'long' });

  const savedDep  = JSON.parse(localStorage.getItem('nej_deposit_' + id) || 'null');
  let   depPct    = savedDep ? savedDep.pct    : 80;
  let   customAmt = savedDep ? savedDep.custom : null;

  const typeLabel   = EVENT_TYPE_LABELS[b.eventType] || b.eventType || 'Event';
  const pkgLabel    = b.package ? ` — ${b.package.charAt(0).toUpperCase() + b.package.slice(1)} Package` : '';
  const itemDesc    = typeLabel + pkgLabel;
  const itemPrice   = fmtBudget(b.budget);
  const numericAmt  = (typeof b.budget === 'number' && !isNaN(b.budget))
    ? b.budget
    : (typeof b.budget === 'string' && /^\d+(\.\d+)?$/.test(b.budget))
      ? Number(b.budget)
      : (BUDGET_AMOUNTS[b.budget] || null);

  function computeDeposit() {
    if (customAmt !== null && customAmt > 0) return { dep: customAmt, bal: numericAmt ? numericAmt - customAmt : null };
    if (numericAmt) return { dep: Math.round(numericAmt * depPct / 100), bal: Math.round(numericAmt * (100 - depPct) / 100) };
    return { dep: null, bal: null };
  }
  const { dep, bal } = computeDeposit();
  const depositStr  = dep !== null ? fmtNGN(dep)  : `${depPct}% of total`;
  const balanceStr  = bal !== null ? fmtNGN(bal)   : `${100 - depPct}% remaining`;
  const bookingStatus = (b.status === 'confirmed') ? 'Booked' : (STATUS_LABELS[b.status] || b.status);
  const deliverables  = b.deliverables || '';

  document.getElementById('invoiceModal').querySelector('.invoice-chrome h2').textContent = 'Invoice — ' + (b.clientName || id);

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
          ${b.phone  ? b.phone  + '<br/>' : ''}
          ${b.email  ? b.email  + '<br/>' : ''}
          ${b.location ? b.location : ''}
        </p>
      </div>
      <div class="inv-meta-block">
        <h4>Invoice Details</h4>
        <p>
          <strong>Invoice #:</strong> ${invoiceNum}<br/>
          <strong>Booking ID:</strong> ${id}<br/>
          <strong>Date Issued:</strong> ${issued}<br/>
          <strong>Deposit Due:</strong> ${due}<br/>
          <strong>Status:</strong> <span style="color:#c9a84c;font-weight:700">${bookingStatus}</span>
        </p>
      </div>
    </div>

    <div class="inv-deposit-ctrl" style="background:#f9f4e8;border:1px solid #c9a84c;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="font-size:0.78rem;font-weight:700;color:#a0832a;text-transform:uppercase;letter-spacing:0.08em">Deposit Settings</span>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:#555">
        Percent: <input id="invDepPct" type="number" min="1" max="100" value="${depPct}" style="width:56px;padding:4px 6px;border:1px solid #c9a84c;border-radius:4px;font-size:0.85rem;color:#111;background:#fff;text-align:center">%
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:#555">
        Or fixed (₦): <input id="invDepCustom" type="number" min="0" placeholder="e.g. 150000" value="${customAmt || ''}" style="width:110px;padding:4px 6px;border:1px solid #c9a84c;border-radius:4px;font-size:0.85rem;color:#111;background:#fff">
      </label>
      <button id="invDepApply" style="padding:6px 14px;background:#c9a84c;border:none;border-radius:6px;font-size:0.78rem;font-weight:700;color:#000;cursor:pointer">Apply</button>
      <span style="font-size:0.72rem;color:#888">(hidden on print)</span>
    </div>

    <table class="inv-table">
      <thead>
        <tr>
          <th style="width:55%">Description</th>
          <th>Qty</th>
          <th>Package / Rate</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${itemDesc}</td>
          <td>1</td>
          <td>${itemPrice}</td>
          <td>${numericAmt ? fmtNGN(numericAmt) : itemPrice}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:right;font-size:0.82rem;color:#555;letter-spacing:0.08em;text-transform:uppercase">Total</td>
          <td id="invTotalCell">${numericAmt ? fmtNGN(numericAmt) : itemPrice}</td>
        </tr>
        <tr style="background:#fff8e6">
          <td colspan="3" style="text-align:right;font-size:0.82rem;color:#a0832a;letter-spacing:0.08em;text-transform:uppercase;font-weight:700">Deposit Due (${depPct}%)</td>
          <td id="invDepositCell" style="color:#c9a84c;font-size:1rem;font-weight:700">${depositStr}</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align:right;font-size:0.78rem;color:#888;letter-spacing:0.06em;text-transform:uppercase">Balance on Delivery</td>
          <td id="invBalanceCell" style="color:#888;font-size:0.9rem">${balanceStr}</td>
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
        Bank: <strong>Kuda MFB</strong><br/>
        Account Name: <strong>NEJstudios</strong><br/>
        Account Number: <strong>3001571135</strong><br/>
        Reference: <strong>${invoiceNum}</strong>
      </p>
    </div>

    <div class="inv-section">
      <h4>Terms &amp; Notes</h4>
      <p>Deposit is due within 7 days to secure your booking date. The remaining balance is due upon delivery of all edited files.</p>
    </div>

    <div class="inv-footer">
      <strong>Thank you for choosing NEJstudios!</strong><br/>
      We appreciate your trust and look forward to delivering exceptional work.<br/>
      <span style="font-size:0.75rem;color:#aaa">NEJstudios · Lagos, Nigeria · nejstudios.com</span>
    </div>
  `;

  document.getElementById('invDepApply').addEventListener('click', () => {
    const pctInput    = document.getElementById('invDepPct');
    const customInput = document.getElementById('invDepCustom');
    depPct    = Math.max(1, Math.min(100, parseInt(pctInput.value, 10) || 80));
    customAmt = customInput.value ? parseFloat(customInput.value) : null;
    localStorage.setItem('nej_deposit_' + id, JSON.stringify({ pct: depPct, custom: customAmt }));
    const { dep: d2, bal: b2 } = computeDeposit();
    const label = customAmt ? '' : `${depPct}%`;
    document.querySelector('#invoiceBody tfoot tr:nth-child(2) td:first-child').innerHTML =
      `<span style="display:block;text-align:right;font-size:0.82rem;color:#a0832a;letter-spacing:0.08em;text-transform:uppercase;font-weight:700">Deposit Due${label ? ' (' + label + ')' : ''}</span>`;
    document.getElementById('invDepositCell').textContent = d2 !== null ? fmtNGN(d2) : (customAmt ? fmtNGN(customAmt) : `${depPct}%`);
    document.getElementById('invBalanceCell').textContent = b2 !== null ? fmtNGN(b2) : `${100 - depPct}% remaining`;
    pctInput.value = depPct;
  });

  document.getElementById('invoiceModal').classList.add('open');
}

/* ════════════════════════════════════════════
   POS RECEIPT  (studio bookings)
   ════════════════════════════════════════════ */
function openStudioReceipt(b) {
  const id         = b.id;
  const receiptNum = 'RCT-' + id;
  const now        = new Date();
  const issued     = now.toLocaleDateString('en-NG', { dateStyle:'medium' });
  const issuedTime = now.toLocaleTimeString('en-NG', { timeStyle:'short' });

  const savedDep   = JSON.parse(localStorage.getItem('nej_deposit_' + id) || 'null');
  let   depPct     = savedDep ? savedDep.pct    : 50;
  let   customAmt  = savedDep ? savedDep.custom : null;

  const sessionDesc = b.sessionType ? b.sessionType + ' Session' : 'Studio Session';
  const numericAmt  = b.agreedPrice ? Number(b.agreedPrice) : null;
  const totalStr    = numericAmt ? fmtNGN(numericAmt) : '—';
  const bookingStatus = (b.status === 'confirmed') ? 'CONFIRMED' : (b.status || 'PENDING').toUpperCase();

  function computeDep() {
    if (customAmt !== null && customAmt > 0) return { dep: customAmt, bal: numericAmt ? numericAmt - customAmt : null };
    if (numericAmt) return { dep: Math.round(numericAmt * depPct / 100), bal: Math.round(numericAmt * (100 - depPct) / 100) };
    return { dep: null, bal: null };
  }

  function renderReceipt() {
    const { dep, bal } = computeDep();
    const depStr = dep !== null ? fmtNGN(dep) : `${depPct}% of total`;
    const balStr = bal !== null ? fmtNGN(bal) : 'Balance on delivery';

    // Bar-code style ID from booking ID
    const barcode = id.split('').join(' ');

    return `
      <div class="pos-receipt-wrap">
        <!-- Deposit control (not printed) -->
        <div style="position:absolute;top:0;left:0;right:0;padding:12px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#e8e4de;z-index:2" class="pos-r-deposit-ctrl" id="posDepCtrl">
          <span style="font-size:0.72rem;font-weight:700;color:#a0832a;text-transform:uppercase;letter-spacing:0.08em">Deposit %</span>
          <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;color:#555">
            Pct: <input id="posDepPct" type="number" min="1" max="100" value="${depPct}" style="width:48px;padding:3px 5px;border:1px solid #c9a84c;border-radius:4px;font-size:0.82rem;text-align:center">%
          </label>
          <label style="display:flex;align-items:center;gap:5px;font-size:0.78rem;color:#555">
            Fixed(₦): <input id="posDepCustom" type="number" min="0" placeholder="amount" value="${customAmt || ''}" style="width:90px;padding:3px 5px;border:1px solid #c9a84c;border-radius:4px;font-size:0.82rem">
          </label>
          <button id="posDepApply" style="padding:4px 12px;background:#c9a84c;border:none;border-radius:5px;font-size:0.72rem;font-weight:700;color:#000;cursor:pointer">Apply</button>
        </div>

        <div class="pos-receipt" id="posReceiptBody" style="margin-top:56px">
          <div class="pos-r-center">
            <div class="pos-r-logo">NEJstudios</div>
            <div class="pos-r-tagline">PHOTOGRAPHY &amp; FILM PRODUCTION</div>
            <div class="pos-r-tagline">Lagos, Nigeria</div>
          </div>
          <hr class="pos-r-dashes"/>
          <div class="pos-r-center">
            <div class="pos-r-title">RECEIPT</div>
            <div class="pos-r-num">${receiptNum}</div>
            <div class="pos-r-date">${issued}  ${issuedTime}</div>
          </div>
          <hr class="pos-r-dashes"/>
          <table class="pos-r-table">
            <tr><td class="pos-r-label">CLIENT</td><td></td></tr>
            <tr><td colspan="2" style="font-weight:bold;padding-bottom:6px">${b.clientName || '—'}</td></tr>
            ${b.phone ? `<tr><td class="pos-r-label">PHONE</td><td style="text-align:right">${b.phone}</td></tr>` : ''}
            ${b.email ? `<tr><td class="pos-r-label">EMAIL</td><td style="text-align:right;font-size:10px">${b.email}</td></tr>` : ''}
            ${b.sessionDate ? `<tr><td class="pos-r-label">DATE</td><td style="text-align:right">${b.sessionDate}</td></tr>` : ''}
          </table>
          <hr class="pos-r-dashes"/>
          <table class="pos-r-table">
            <tr><td colspan="2" class="pos-r-label" style="padding-bottom:4px">ITEM</td></tr>
            <tr>
              <td>${sessionDesc}</td>
              <td style="text-align:right;font-weight:bold">${totalStr}</td>
            </tr>
            ${b.deliverables ? `<tr><td colspan="2" style="font-size:10px;color:#666;padding-top:2px">${b.deliverables}</td></tr>` : ''}
          </table>
          <hr class="pos-r-dashes"/>
          <table class="pos-r-table">
            <tr class="pos-r-total-row">
              <td>TOTAL</td>
              <td style="text-align:right;font-weight:bold">${totalStr}</td>
            </tr>
            <tr class="pos-r-deposit-row" id="posDepRow">
              <td>DEPOSIT (${customAmt ? 'FIXED' : depPct + '%'})</td>
              <td style="text-align:right" id="posDepCell">${depStr}</td>
            </tr>
            <tr class="pos-r-balance-row" id="posBalRow">
              <td>BAL. ON DELIVERY</td>
              <td style="text-align:right" id="posBalCell">${balStr}</td>
            </tr>
          </table>
          <hr class="pos-r-dashes"/>
          <div class="pos-r-center">
            <span class="pos-r-status">${bookingStatus}</span>
          </div>
          <hr class="pos-r-dashes"/>
          <div class="pos-r-payment">
            PAYMENT TO:<br/>
            BANK: KUDA MFB<br/>
            ACCT: NEJstudios<br/>
            NO: 3001571135<br/>
            REF: ${receiptNum}
          </div>
          <hr class="pos-r-dashes"/>
          <div class="pos-r-center pos-r-footer">
            THANK YOU FOR CHOOSING<br/>
            <strong>NEJSTUDIOS</strong><br/>
            hello@nejstudios.com<br/>
            <div class="pos-r-barcode" style="margin-top:8px">||| ${barcode} |||</div>
          </div>
        </div>
      </div>`;
  }

  document.getElementById('invoiceModal').querySelector('.invoice-chrome h2').textContent = 'Receipt — ' + (b.clientName || id);
  document.getElementById('invoiceBody').innerHTML = renderReceipt();
  document.getElementById('invoiceBody').style.cssText = 'padding:0;margin:0;background:#f0ede8;flex:1;display:flex;flex-direction:column;max-width:100%;position:relative;';

  document.getElementById('posDepApply').addEventListener('click', () => {
    depPct    = Math.max(1, Math.min(100, parseInt(document.getElementById('posDepPct').value, 10) || 50));
    customAmt = document.getElementById('posDepCustom').value ? parseFloat(document.getElementById('posDepCustom').value) : null;
    localStorage.setItem('nej_deposit_' + id, JSON.stringify({ pct: depPct, custom: customAmt }));
    const { dep, bal } = computeDep();
    document.getElementById('posDepRow').cells[0].textContent = `DEPOSIT (${customAmt ? 'FIXED' : depPct + '%'})`;
    document.getElementById('posDepCell').textContent = dep !== null ? fmtNGN(dep) : `${depPct}% of total`;
    document.getElementById('posBalCell').textContent = bal !== null ? fmtNGN(bal) : 'Balance on delivery';
  });

  document.getElementById('invoiceModal').classList.add('open');
}

document.getElementById('invoiceClose').addEventListener('click', () => {
  document.getElementById('invoiceModal').classList.remove('open');
  // Reset invoiceBody styles in case POS receipt was shown
  document.getElementById('invoiceBody').style.cssText = '';
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

/* ─ Image compression helper ─────────────────────────────────────── */
function compressImage(file, maxWidth = 2400, quality = 0.85) {
  return new Promise((resolve) => {
    // HEIC/HEIF cannot be decoded by Canvas API — skip compression
    const lowerName = file.name.toLowerCase();
    const lowerType = (file.type || '').toLowerCase();
    if (lowerType.includes('heic') || lowerType.includes('heif') ||
        lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Only scale down — never scale up
      const scale  = Math.min(1, maxWidth / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

      // PNG files: keep as PNG to preserve transparency
      const isPng   = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      const outMime = isPng ? 'image/png'  : 'image/jpeg';
      const outExt  = isPng ? '.png'       : '.jpg';
      const outQual = isPng ? undefined    : quality; // PNG ignores quality

      canvas.toBlob(blob => {
        // If canvas.toBlob returns null (some browsers), fall back to original file
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, outExt), { type: outMime }));
      }, outMime, outQual);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ─ Gallery panel uploaded images (stored in server gallery JSON) ─ */
const GALLERY_PANEL_KEY = '__panel__';

function getGalleryPanelImages() {
  return getClientGallery(GALLERY_PANEL_KEY);
}
function saveGalleryPanelImages(imgs) {
  saveClientGallery(GALLERY_PANEL_KEY, imgs);
}

function renderGalleryPanelGrid() {
  const imgs   = getGalleryPanelImages();
  const grid   = document.getElementById('galleryPanelGrid');
  const selbar = document.getElementById('galleryPanelSelbar');
  if (!grid) return;
  if (imgs.length === 0) { grid.innerHTML = ''; selbar.style.display = 'none'; return; }

  selbar.style.display = 'flex';
  grid.innerHTML = imgs.map(img => `
    <div class="gp-thumb" data-id="${img.id}" title="${img.name}">
      <img src="${img.url}" alt="${img.name}" loading="lazy">
      <div class="gp-thumb__check">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2 6 5 9 10 3"/></svg>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.gp-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumb.classList.toggle('selected');
      updateGPSelCount();
    });
  });
  updateGPSelCount();
}

function updateGPSelCount() {
  const grid    = document.getElementById('galleryPanelGrid');
  const countEl = document.getElementById('galleryPanelSelCount');
  if (!grid || !countEl) return;
  const count = grid.querySelectorAll('.gp-thumb.selected').length;
  countEl.textContent = `${count} selected`;
}

function handleGalleryPanelUpload(files) {
  const progress = document.getElementById('galleryPanelProgress');
  const fileArr  = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!fileArr.length) { showToast('Please select image files.'); return; }

  fileArr.forEach(async file => {
    const item = document.createElement('div');
    item.className = 'gallery-progress-item';
    item.innerHTML = `
      <div class="gallery-progress-item__name">${file.name}</div>
      <div class="gallery-progress-bar"><div class="gallery-progress-bar__fill" style="width:0%"></div></div>
      <div class="gallery-progress-item__pct">Compressing…</div>`;
    progress.appendChild(item);

    const fill  = item.querySelector('.gallery-progress-bar__fill');
    const pctEl = item.querySelector('.gallery-progress-item__pct');

    // Compress before upload (skips HEIC/HEIF automatically)
    const uploadFile = await compressImage(file);

    pctEl.textContent = '0%';

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 95);
      fill.style.width  = pct + '%';
      pctEl.textContent = pct + '%';
    });
    xhr.addEventListener('load', () => {
      fill.style.width  = '100%';
      pctEl.textContent = '100%';
      item.classList.add('done');

      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = null; }

      if (!data || !data.ok) {
        const errMsg = (data && data.error) ? data.error : 'Upload failed (server error)';
        showToast(errMsg);
        pctEl.textContent = 'Error';
        setTimeout(() => item.remove(), 2500);
        return;
      }

      const imgs = getGalleryPanelImages();
      imgs.push({
        id:         'gp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        name:       data.name || file.name,
        url:        data.url,
        uploadedAt: Date.now(),
      });
      saveGalleryPanelImages(imgs);
      renderGalleryPanelGrid();
      setTimeout(() => item.remove(), 1200);
    });
    xhr.addEventListener('error', () => {
      pctEl.textContent = 'Error';
      showToast('Upload failed — check your connection.');
      setTimeout(() => item.remove(), 2500);
    });

    const formData = new FormData();
    formData.append('file', uploadFile);
    xhr.open('POST', '/api/upload.php');
    xhr.send(formData);
  });
}

function initGalleryForm() {
  // Upload Single
  const inputSingle = document.getElementById('galleryPanelInputSingle');
  const inputMulti  = document.getElementById('galleryPanelInputMulti');
  document.getElementById('btnUploadSingle')?.addEventListener('click', () => inputSingle?.click());
  document.getElementById('btnUploadMulti')?.addEventListener('click',  () => inputMulti?.click());
  inputSingle?.addEventListener('change', () => { handleGalleryPanelUpload(inputSingle.files); inputSingle.value = ''; });
  inputMulti?.addEventListener('change',  () => { handleGalleryPanelUpload(inputMulti.files);  inputMulti.value  = ''; });

  // Select All / Delete Selected
  document.getElementById('btnGPSelectAll')?.addEventListener('click', () => {
    const grid    = document.getElementById('galleryPanelGrid');
    if (!grid) return;
    const thumbs  = grid.querySelectorAll('.gp-thumb');
    const allSel  = grid.querySelectorAll('.gp-thumb.selected').length === thumbs.length;
    thumbs.forEach(t => t.classList.toggle('selected', !allSel));
    updateGPSelCount();
  });
  document.getElementById('btnGPDeleteSel')?.addEventListener('click', () => {
    const grid    = document.getElementById('galleryPanelGrid');
    if (!grid) return;
    const ids     = Array.from(grid.querySelectorAll('.gp-thumb.selected')).map(t => t.dataset.id);
    if (!ids.length) { showToast('Select images first.'); return; }
    const allImgs   = getGalleryPanelImages();
    const toDelete  = allImgs.filter(img => ids.includes(img.id));
    const remaining = allImgs.filter(img => !ids.includes(img.id));
    saveGalleryPanelImages(remaining);
    renderGalleryPanelGrid();
    showToast(`${ids.length} image${ids.length > 1 ? 's' : ''} deleted`);
    toDelete.forEach(img => {
      if (img.url && img.url.startsWith('/uploads/')) {
        const filename = img.url.split('/').pop();
        fetch('/api/upload.php?action=delete&file=' + encodeURIComponent(filename), { method: 'POST' })
          .catch(() => {});
      }
    });
  });

  renderGalleryPanelGrid();

  // Add file row button
  document.getElementById('btnAddFile')?.addEventListener('click', () => {
    document.getElementById('galleryFilesList')?.appendChild(_makeFileRow());
  });

  // Create gallery link
  document.getElementById('btnCreateGallery')?.addEventListener('click', createGalleryLink);
}

async function createGalleryLink() {
  const clientName = document.getElementById('galleryClientName').value.trim();
  if (!clientName) { showToast('Client name is required'); return; }

  const bookingId = document.getElementById('galleryBookingId').value.trim() || null;
  const password  = document.getElementById('galleryPassword').value.trim()  || null;
  const expiry    = document.getElementById('galleryExpiry').value           || null;

  // Use uploaded panel images as the files for this gallery link
  const panelImgs = getGalleryPanelImages();
  const files = panelImgs.map(img => ({ label: img.name, url: img.url, id: img.id }));

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
  showToast(`Gallery link created for ${clientName} · ${files.length} image${files.length !== 1 ? 's' : ''} included`);

  // Reset form fields only (keep uploaded images for re-use)
  document.getElementById('galleryClientName').value = '';
  document.getElementById('galleryBookingId').value  = '';
  document.getElementById('galleryPassword').value   = '';
  document.getElementById('galleryExpiry').value     = '';

  await renderGalleryPanel();
}

async function renderGalleryPanel() {
  const grid = document.getElementById('galleryLinksGrid');
  if (!grid) return;

  grid.innerHTML = '<p style="color:var(--grey-3);font-size:0.85rem">Loading…</p>';
  const deliveries = await dbGetAllGalleryDeliveries();

  // Fetch download logs to count per token
  let downloadLogs = [];
  try {
    const logsRes = await fetch('/api/data/download_logs.json', { cache: 'no-store' });
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      if (Array.isArray(logsData)) downloadLogs = logsData;
    }
  } catch { /* logs file may not exist yet */ }

  // Build a map: token → log count
  const logCountByToken = {};
  downloadLogs.forEach(entry => {
    if (entry.token) {
      logCountByToken[entry.token] = (logCountByToken[entry.token] || 0) + 1;
    }
  });

  if (deliveries.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><h3>No gallery links yet</h3><p>Create your first gallery link using the form.</p></div>`;
    return;
  }

  grid.innerHTML = deliveries.map(d => {
    const galleryUrl   = `${location.origin}/gallery.html?t=${d.token}`;
    const expired      = d.expires_at && d.expires_at < new Date().toISOString().slice(0, 10);
    const logCount     = logCountByToken[d.token] || 0;
    const downloadInfo = logCount > 0
      ? `${d.download_count || 0} download${(d.download_count || 0) !== 1 ? 's' : ''} · <span title="Individual file download events tracked by server">${logCount} file log${logCount !== 1 ? 's' : ''}</span>`
      : `${d.download_count || 0} download${(d.download_count || 0) !== 1 ? 's' : ''}`;
    return `
      <div class="gallery-link-card">
        <div class="gallery-link-card__top">
          <div>
            <div class="gallery-link-card__name">${d.client_name}</div>
            <div class="gallery-link-card__meta">
              ${d.booking_id ? `Booking: ${d.booking_id} · ` : ''}
              ${d.files ? d.files.length : 0} file${(d.files && d.files.length !== 1) ? 's' : ''} ·
              ${downloadInfo}
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

const schedCreateToggle = document.getElementById('schedCreateToggle');
const schedCreateBody   = document.getElementById('schedCreateBody');

// Wedding type → rename Client Name to Event Name + show Planner field
document.getElementById('schedType').addEventListener('change', function() {
  const isWedding = this.value === 'wedding';
  document.getElementById('schedClientLabel').textContent = isWedding ? 'Event Name' : 'Client Name';
  document.getElementById('schedClient').placeholder = isWedding ? 'e.g. Tunde & Ngozi Wedding' : 'e.g. Kemi Afolabi';
  document.getElementById('schedPlannerWrap').style.display = isWedding ? '' : 'none';
});

// Populate member checkboxes when schedule form opens
function populateSchedMembers() {
  const wrap = document.getElementById('schedMembersWrap');
  if (!wrap) return;
  const team = getTeam().filter(m => m.role !== 'admin');
  if (team.length === 0) { wrap.innerHTML = '<span style="color:var(--grey-3);font-size:0.78rem">No team members yet</span>'; return; }
  wrap.innerHTML = team.map(m => `
    <label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg-4);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.8rem;color:var(--grey-2)">
      <input type="checkbox" value="${m.id}" data-name="${m.name}" style="accent-color:var(--gold)"> ${m.name}
    </label>`).join('');
}
schedCreateToggle.addEventListener('click', () => {
  const open = schedCreateBody.classList.toggle('open');
  schedCreateToggle.classList.toggle('open', open);
  if (open) {
    populateSchedMembers();
    setTimeout(() => schedCreateBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
});

// Submit form
document.getElementById('schedForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title        = document.getElementById('schedTitle').value.trim();
  const date         = document.getElementById('schedDate').value;
  const time         = document.getElementById('schedTime').value;
  const type         = document.getElementById('schedType').value;
  const client       = document.getElementById('schedClient').value.trim();
  const planner      = document.getElementById('schedPlanner').value.trim();
  const location     = document.getElementById('schedLocation').value.trim();
  const notes        = document.getElementById('schedNotes').value.trim();
  const deliverables = document.getElementById('schedDeliverables').value.trim();
  if (!title || !date) return;

  // Collect selected team members
  const assignedMembers = [];
  document.querySelectorAll('#schedMembersWrap input[type=checkbox]:checked').forEach(cb => {
    assignedMembers.push({ id: cb.value, name: cb.dataset.name });
  });

  const entry = {
    id:              'SCH-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    title, date, type,
    time:            time             || null,
    clientName:      client           || null,
    planner:         planner          || null,
    location:        location         || null,
    notes:           notes            || null,
    deliverables:    deliverables     || null,
    assignedMembers: assignedMembers.length ? assignedMembers : null,
    createdAt:       Date.now(),
  };

  await dbAddScheduleEntry(entry);
  e.target.reset();
  document.getElementById('schedPlannerWrap').style.display = 'none';
  document.getElementById('schedClientLabel').textContent = 'Client Name';
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
          ${s.clientName ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${s.type === 'wedding' ? '<em>Event:</em>&nbsp;' : ''}${s.clientName}</div>` : ''}
          ${s.planner    ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><em>Planner:</em>&nbsp;${s.planner}</div>` : ''}
          ${s.location   ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${s.location}</div>` : ''}
          ${s.assignedMembers && s.assignedMembers.length ? `<div class="task-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>${s.assignedMembers.map(m => `<span style="background:var(--gold-glow);border:1px solid rgba(201,168,76,.25);border-radius:4px;padding:1px 7px;font-size:0.72rem;color:var(--gold-lt)">${m.name}</span>`).join(' ')}</div>` : ''}
        </div>
        ${s.notes ? `<div class="task-reports-preview">${s.notes}</div>` : ''}
        ${s.deliverables ? `<div class="task-reports-preview" style="margin-top:6px"><strong style="color:var(--gold-lt);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.1em">Deliverables:</strong> ${s.deliverables}</div>` : ''}
        ${(() => {
          if (!s.deadline) return '';
          const today    = new Date(); today.setHours(0,0,0,0);
          const deadDate = new Date(s.deadline + 'T00:00:00');
          const diffDays = Math.round((deadDate - today) / 86400000);
          const fmtDead  = deadDate.toLocaleDateString('en-NG', { dateStyle:'medium' });
          if (!isPast) {
            if (diffDays < 0) return `<div style="margin-top:8px;padding:6px 10px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:6px;font-size:0.75rem;color:#f87171;font-weight:700">⚠ Delivery OVERDUE · ${fmtDead}</div>`;
            if (diffDays === 0) return `<div style="margin-top:8px;padding:6px 10px;background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.3);border-radius:6px;font-size:0.75rem;color:var(--orange);font-weight:700">⏰ Delivery DUE TODAY</div>`;
            if (diffDays <= 3) return `<div style="margin-top:8px;padding:6px 10px;background:rgba(251,146,60,.07);border:1px solid rgba(251,146,60,.2);border-radius:6px;font-size:0.75rem;color:var(--orange)">Delivery due in <strong>${diffDays}d</strong> · ${fmtDead}</div>`;
          }
          return `<div style="margin-top:8px;padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.75rem;color:var(--grey-3)">📦 Delivery deadline: ${fmtDead}</div>`;
        })()}
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
          ${(() => {
            if (s.id.startsWith('BK-')) {
              const bookingId = s.id.slice(3);
              const linked = getBookings().find(b => b.id === bookingId);
              if (linked && linked.status === 'pending') {
                return `<button class="task-action-btn" style="border-color:var(--green);color:var(--green)" data-sched-confirm-bk="${bookingId}">Confirm Booking</button>`;
              }
              if (linked && (linked.status === 'confirmed' || linked.status === 'completed')) {
                return `<button class="task-action-btn" style="border-color:var(--green);color:var(--green);opacity:.5;cursor:default">Confirmed ✓</button>`;
              }
            } else {
              // Manually added SCH- entry — offer to create a confirmed booking from it
              return `<button class="task-action-btn" style="border-color:var(--green);color:var(--green)" data-sched-confirm-sch="${s.id}">Confirm → Booking</button>`;
            }
            return '';
          })()}
          <button class="task-action-btn" style="border-color:var(--blue);color:var(--blue)" data-sched-edit="${s.id}">Edit</button>
          <button class="task-action-btn task-action-btn--delete" data-sched-id="${s.id}">Delete</button>
        </div>
      </div>`;
  }).join('');

  // Confirm a BK- linked pending booking
  grid.querySelectorAll('[data-sched-confirm-bk]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bookingId = btn.dataset.schedConfirmBk;
      const bookings  = getBookings();
      const idx       = bookings.findIndex(b => b.id === bookingId);
      if (idx === -1) return;
      bookings[idx].status = 'confirmed';
      saveBookings(bookings);
      await renderAdminSchedule();
      renderBookings();
      showToast(`${bookings[idx].clientName} confirmed ✓`);
    });
  });

  // Confirm a manually-added SCH- entry → create a booking record
  grid.querySelectorAll('[data-sched-confirm-sch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const schedId = btn.dataset.schedConfirmSch;
      const sched   = await dbGetSchedule();
      const entry   = sched.find(s => s.id === schedId);
      if (!entry) return;

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let newId = 'NEJ-';
      for (let i = 0; i < 6; i++) newId += chars[Math.floor(Math.random() * chars.length)];

      const typeMap = { wedding:'full-wedding', event:'corporate-event', production:'other-production', funeral:'funeral', 'service-of-songs':'service-of-songs', studio:'', meeting:'' };
      const booking = {
        id:          newId,
        bookingKind: entry.type === 'studio' ? 'studio' : 'event',
        clientName:  entry.clientName || entry.title,
        firstName:   (entry.clientName || entry.title || '').split(' ')[0],
        lastName:    (entry.clientName || entry.title || '').split(' ').slice(1).join(' '),
        phone:       '',
        email:       '',
        eventType:   typeMap[entry.type] ?? 'corporate-event',
        sessionType: entry.type === 'studio' ? (entry.title || 'Studio') : '',
        eventDate:   entry.date || '',
        location:    entry.location || '',
        deliverables:entry.deliverables || entry.notes || '',
        status:      'confirmed',
        createdAt:   entry.createdAt || Date.now(),
      };

      // Persist booking atomically (server-authoritative)
      if (typeof dbUpsertBooking === 'function') {
        await dbUpsertBooking(booking);
      } else {
        const bookings = getBookings();
        bookings.unshift(booking);
        saveBookings(bookings);
      }

      // MOVE semantics: remove the schedule entry and tombstone the auto-sync
      // ID for the new booking so it doesn't reappear on the schedule.
      const deletedKey = 'nej_deleted_sched';
      const deleted    = JSON.parse(localStorage.getItem(deletedKey) || '[]');
      if (!deleted.includes(schedId))           deleted.push(schedId);
      if (!deleted.includes('BK-' + newId))     deleted.push('BK-' + newId);
      localStorage.setItem(deletedKey, JSON.stringify(deleted));
      await dbDeleteScheduleEntry(schedId);

      await renderAdminSchedule();
      renderBookings();
      showToast(`${booking.clientName} moved to Bookings ✓`);
    });
  });

  grid.querySelectorAll('[data-sched-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this schedule entry?')) return;
      await dbDeleteScheduleEntry(btn.dataset.schedId);
      await renderAdminSchedule();
      showToast('Removed from schedule');
    });
  });

  grid.querySelectorAll('[data-sched-edit]').forEach(btn => {
    btn.addEventListener('click', () => openSchedEditModal(btn.dataset.schedEdit));
  });
}

/* ════════════════════════════════════════════
   SCHEDULE EDIT MODAL
   ════════════════════════════════════════════ */

const schedEditModal = document.getElementById('schedEditModal');

function closeSchedEditModal() {
  schedEditModal.style.display = 'none';
  document.body.style.overflow = '';
}

document.getElementById('schedEditClose').addEventListener('click', closeSchedEditModal);
document.getElementById('schedEditCancel').addEventListener('click', closeSchedEditModal);
schedEditModal.addEventListener('click', e => { if (e.target === schedEditModal) closeSchedEditModal(); });

document.getElementById('schedEditType').addEventListener('change', function() {
  const isWedding = this.value === 'wedding';
  document.getElementById('schedEditClientLabel').textContent = isWedding ? 'Event Name' : 'Client Name';
  document.getElementById('schedEditPlannerWrap').style.display = isWedding ? '' : 'none';
});

async function openSchedEditModal(id) {
  const sched = await dbGetSchedule();
  const entry = sched.find(s => s.id === id);
  if (!entry) return;

  document.getElementById('schedEditId').value           = id;
  document.getElementById('schedEditTitle').value        = entry.title        || '';
  document.getElementById('schedEditDate').value         = entry.date         || '';
  document.getElementById('schedEditTime').value         = entry.time         || '';
  document.getElementById('schedEditType').value         = entry.type         || 'studio';
  document.getElementById('schedEditClient').value       = entry.clientName   || '';
  document.getElementById('schedEditPlanner').value      = entry.planner      || '';
  document.getElementById('schedEditLocation').value     = entry.location     || '';
  document.getElementById('schedEditNotes').value        = entry.notes        || '';
  document.getElementById('schedEditDeliverables').value = entry.deliverables || '';
  document.getElementById('schedEditDeadline').value     = entry.deadline     || '';

  const isWedding = entry.type === 'wedding';
  document.getElementById('schedEditClientLabel').textContent = isWedding ? 'Event Name' : 'Client Name';
  document.getElementById('schedEditPlannerWrap').style.display = isWedding ? '' : 'none';

  // Populate member checkboxes
  const wrap = document.getElementById('schedEditMembersWrap');
  const team = getTeam().filter(m => m.role !== 'admin');
  const assigned = entry.assignedMembers || [];
  wrap.innerHTML = team.length === 0
    ? '<span style="color:var(--grey-3);font-size:0.78rem">No team members yet</span>'
    : team.map(m => {
        const checked = assigned.find(a => a.id === m.id) ? 'checked' : '';
        return `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg-4);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:0.8rem;color:var(--grey-2)">
          <input type="checkbox" value="${m.id}" data-name="${m.name}" ${checked} style="accent-color:var(--gold)"> ${m.name}
        </label>`;
      }).join('');

  schedEditModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

document.getElementById('schedEditForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id           = document.getElementById('schedEditId').value;
  const title        = document.getElementById('schedEditTitle').value.trim();
  const date         = document.getElementById('schedEditDate').value;
  const time         = document.getElementById('schedEditTime').value;
  const type         = document.getElementById('schedEditType').value;
  const clientName   = document.getElementById('schedEditClient').value.trim();
  const planner      = document.getElementById('schedEditPlanner').value.trim();
  const location     = document.getElementById('schedEditLocation').value.trim();
  const notes        = document.getElementById('schedEditNotes').value.trim();
  const deliverables = document.getElementById('schedEditDeliverables').value.trim();
  const deadline     = document.getElementById('schedEditDeadline').value || null;
  if (!title || !date) return;

  const assignedMembers = [];
  document.querySelectorAll('#schedEditMembersWrap input[type=checkbox]:checked').forEach(cb => {
    assignedMembers.push({ id: cb.value, name: cb.dataset.name });
  });

  await dbUpdateScheduleEntry(id, {
    title, date, type, deadline,
    time:            time         || null,
    clientName:      clientName   || null,
    planner:         planner      || null,
    location:        location     || null,
    notes:           notes        || null,
    deliverables:    deliverables || null,
    assignedMembers: assignedMembers.length ? assignedMembers : null,
  });

  closeSchedEditModal();
  await renderAdminSchedule();
  showToast('Schedule entry updated ✓');
});

/* ════════════════════════════════════════════
   TASKS
   ════════════════════════════════════════════ */

// Create task toggle
const taskCreateToggle = document.getElementById('taskCreateToggle');
const taskCreateBody   = document.getElementById('taskCreateBody');
taskCreateToggle.addEventListener('click', () => {
  const open = taskCreateBody.classList.toggle('open');
  taskCreateToggle.classList.toggle('open', open);
  if (open) setTimeout(() => taskCreateBody.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
});

// Task form
document.getElementById('taskForm').addEventListener('submit', async e => {
  e.preventDefault();
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const assignee = document.getElementById('taskAssignee').value;
  const priority = document.getElementById('taskPriority').value;
  const deadline = document.getElementById('taskDeadline').value || null;
  if (!title) return;

  const team   = getTeam();
  const member = team.find(m => m.id === assignee);
  const task   = {
    id:           'TASK-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    title, desc,
    assignedTo:   assignee || null,
    assignedName: member ? member.name : null,
    priority,
    deadline,
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
  // Notify assigned team member
  if (member) {
    pushTeamNotification(member.id, {
      type:    'task-assigned',
      title:   'New Task Assigned',
      message: `"${title}" has been assigned to you.`,
      taskId:  task.id, ts: Date.now(),
    });
    notify('New Task — NEJstudios', `${member.name}: "${title}" has been assigned to you.`);
  }
  showToast('Task created' + (member ? ` & ${member.name} notified` : ''));
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

// Multi-select state for tasks
let tasksSelectMode = false;
const tasksSelectedIds = new Set();

function updateTasksSelectedCount() {
  const el = document.getElementById('tasksSelectedCount');
  if (el) el.textContent = `${tasksSelectedIds.size} selected`;
}

function setTasksSelectMode(on) {
  tasksSelectMode = on;
  tasksSelectedIds.clear();
  document.getElementById('tasksSelectAllBtn').style.display     = on ? '' : 'none';
  document.getElementById('tasksSelectedCount').style.display    = on ? '' : 'none';
  document.getElementById('tasksBulkDeleteBtn').style.display    = on ? '' : 'none';
  document.getElementById('tasksSelectCancelBtn').style.display  = on ? '' : 'none';
  document.getElementById('tasksSelectModeBtn').style.display    = on ? 'none' : '';
  updateTasksSelectedCount();
  renderTasks();
}

document.getElementById('tasksSelectModeBtn')?.addEventListener('click', () => setTasksSelectMode(true));
document.getElementById('tasksSelectCancelBtn')?.addEventListener('click', () => setTasksSelectMode(false));
document.getElementById('tasksSelectAllBtn')?.addEventListener('click', async () => {
  let tasks = await dbGetTasks();
  if (activeTaskStatus !== 'all') tasks = tasks.filter(t => t.status === activeTaskStatus);
  const allSelected = tasks.length > 0 && tasks.every(t => tasksSelectedIds.has(t.id));
  if (allSelected) tasksSelectedIds.clear();
  else tasks.forEach(t => tasksSelectedIds.add(t.id));
  updateTasksSelectedCount();
  renderTasks();
});
document.getElementById('tasksBulkDeleteBtn')?.addEventListener('click', async () => {
  if (tasksSelectedIds.size === 0) { showToast('No tasks selected', 'err'); return; }
  if (!confirm(`Delete ${tasksSelectedIds.size} selected task${tasksSelectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
  const ids = Array.from(tasksSelectedIds);
  for (const id of ids) {
    await dbDeleteTask(id).catch(() => {});
  }
  showToast(`${ids.length} task${ids.length > 1 ? 's' : ''} deleted ✓`);
  setTasksSelectMode(false);
  await renderTasksBadge();
});

async function renderTasks() {
  let tasks = await dbGetTasks();
  if (activeTaskStatus !== 'all') tasks = tasks.filter(t => t.status === activeTaskStatus);

  // Awaiting approval at the top, then in-progress, pending, completed; newest first
  const statusOrder = { 'awaiting-approval': 0, 'in-progress': 1, 'pending': 2, 'completed': 3 };
  tasks.sort((a, b) => {
    const sa = statusOrder[a.status] ?? 4;
    const sb = statusOrder[b.status] ?? 4;
    if (sa !== sb) return sa - sb;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const grid = document.getElementById('tasksGrid');
  if (tasks.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><h3>No tasks yet</h3><p>Create a task above to get started.</p></div>`;
    return;
  }

  grid.innerHTML = tasks.map(t => buildTaskCard(t)).join('');

  // Card click → toggle selection if in select mode, otherwise open detail modal
  grid.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (tasksSelectMode) {
        const id = card.dataset.taskId;
        if (tasksSelectedIds.has(id)) tasksSelectedIds.delete(id);
        else tasksSelectedIds.add(id);
        updateTasksSelectedCount();
        renderTasks();
      } else if (!e.target.closest('[data-task-action]')) {
        openTaskDetailModal(card.dataset.taskId);
      }
    });
  });

  grid.querySelectorAll('[data-task-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      handleTaskAction(btn.dataset.id, btn.dataset.taskAction);
    });
  });
}

function _escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildTaskCard(t) {
  const priorityMap = { high:'high', medium:'medium', low:'low' };
  const prClass     = priorityMap[t.priority] || 'medium';
  const lastReport  = t.reports && t.reports.length > 0 ? t.reports[t.reports.length - 1] : null;
  const reportCount = t.reports ? t.reports.length : 0;

  // Deadline display
  let deadlineBadge = '';
  if (t.deadline) {
    const today    = new Date(); today.setHours(0,0,0,0);
    const deadDate = new Date(t.deadline + 'T00:00:00');
    const diffDays = Math.round((deadDate - today) / 86400000);
    const fmtDead  = deadDate.toLocaleDateString('en-NG', { dateStyle:'medium' });
    if (t.status !== 'completed') {
      if (diffDays < 0) {
        deadlineBadge = `<span style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.3);color:#f87171;border-radius:5px;padding:2px 8px;font-size:0.65rem;font-weight:700">OVERDUE · ${fmtDead}</span>`;
      } else if (diffDays === 0) {
        deadlineBadge = `<span style="background:rgba(251,146,60,.12);border:1px solid rgba(251,146,60,.3);color:var(--orange);border-radius:5px;padding:2px 8px;font-size:0.65rem;font-weight:700">DUE TODAY</span>`;
      } else if (diffDays <= 3) {
        deadlineBadge = `<span style="background:rgba(251,146,60,.08);border:1px solid rgba(251,146,60,.25);color:var(--orange);border-radius:5px;padding:2px 8px;font-size:0.65rem;font-weight:600">Due in ${diffDays}d · ${fmtDead}</span>`;
      } else {
        deadlineBadge = `<span style="background:var(--bg-3);border:1px solid var(--border);color:var(--grey-3);border-radius:5px;padding:2px 8px;font-size:0.65rem">Deadline: ${fmtDead}</span>`;
      }
    }
  }

  const isSelected = tasksSelectMode && tasksSelectedIds.has(t.id);
  const selectCheck = tasksSelectMode ? `<div class="task-select-check" data-task-select-id="${t.id}" style="position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:5px;border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};background:${isSelected ? 'var(--gold)' : 'var(--bg-3)'};display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2">${isSelected ? '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>` : '';
  return `
    <div class="task-card task-card--${t.status}" data-task-id="${t.id}" style="position:relative${isSelected ? ';box-shadow:0 0 0 2px var(--gold)' : ''}">
      ${selectCheck}
      <div class="task-card__top">
        <div class="task-card__badges">
          <span class="priority-badge priority-badge--${prClass}">${t.priority}</span>
          <span class="status-badge status-badge--${t.status}">${t.status === 'in-progress' ? 'In Progress' : t.status === 'awaiting-approval' ? 'Awaiting Approval' : t.status.charAt(0).toUpperCase()+t.status.slice(1)}</span>
          ${t.impromptu ? '<span class="status-badge" style="background:rgba(168,85,247,0.18);color:#c4a4f8">SELF-ADDED</span>' : ''}
          ${deadlineBadge}
          ${t.deliveryStatus === 'approved' ? `<span class="delivery-badge delivery-badge--approved">✓ Delivery Approved</span>` : ''}
          ${t.deliveryStatus === 'failed'   ? `<span class="delivery-badge delivery-badge--failed">✗ Failed to Deliver</span>` : ''}
        </div>
      </div>
      <div class="task-card__title">${t.title}</div>
      ${t.desc ? `<div class="task-card__desc">${t.desc.slice(0,120)}${t.desc.length>120?'…':''}</div>` : ''}
      <div class="task-card__info">
        <div class="task-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Assigned: <strong>${t.assignedName || 'Unassigned'}</strong>
        </div>
        ${t.createdByName ? `
          <div class="task-info-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Added by: <strong>${_escHtml(t.createdByName)}</strong>
          </div>` : ''}
        <div class="task-info-row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Created: <strong>${fmtDateShort(t.createdAt)}</strong>
          ${t.startedAt   ? `&nbsp;·&nbsp; Started: <strong>${fmtDateShort(t.startedAt)}</strong>` : ''}
          ${t.completedAt ? `&nbsp;·&nbsp; Done: <strong>${fmtDateShort(t.completedAt)}</strong>` : ''}
        </div>
      </div>
      ${t.doneByBoss ? `<div class="task-info-row" style="margin-top:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>Handled by: <strong style="color:var(--gold)">${_escHtml(t.doneByBoss)}</strong></div>` : ''}
      ${lastReport ? `<div class="task-reports-preview"><strong>${reportCount} report${reportCount>1?'s':''}</strong> — "${lastReport.content.slice(0,80)}${lastReport.content.length>80?'…':''}"</div>` : ''}
      <div class="task-card__actions">
        ${t.status === 'awaiting-approval' ? `<button class="task-action-btn task-action-btn--approve" data-id="${t.id}" data-task-action="approve-impromptu">✓ Approve</button>` : ''}
        ${t.status === 'awaiting-approval' ? `<button class="task-action-btn task-action-btn--fail" data-id="${t.id}" data-task-action="reject-impromptu">✗ Reject</button>` : ''}
        ${t.status !== 'completed' ? `<button class="task-action-btn task-action-btn--approve" data-id="${t.id}" data-task-action="done-by-boss-1" style="border-color:var(--gold);color:var(--gold)">Done by Boss 1</button>` : ''}
        ${t.status !== 'completed' ? `<button class="task-action-btn task-action-btn--approve" data-id="${t.id}" data-task-action="done-by-boss-2" style="border-color:var(--gold);color:var(--gold)">Done by Boss 2</button>` : ''}
        <button class="task-action-btn task-action-btn--reports" data-id="${t.id}" data-task-action="reports">Reports (${reportCount})</button>
        <button class="task-action-btn task-action-btn--reassign" data-id="${t.id}" data-task-action="reassign">Reassign</button>
        ${t.status === 'completed' && t.deliveryStatus !== 'approved' ? `<button class="task-action-btn task-action-btn--approve" data-id="${t.id}" data-task-action="approve-delivery">✓ Approve Delivery</button>` : ''}
        ${t.status === 'completed' && t.deliveryStatus !== 'failed'   ? `<button class="task-action-btn task-action-btn--fail" data-id="${t.id}" data-task-action="fail-delivery">✗ Failed to Deliver</button>` : ''}
        <button class="task-action-btn task-action-btn--delete" data-id="${t.id}" data-task-action="delete">Delete</button>
      </div>
    </div>`;
}

async function handleTaskAction(id, action) {
  if (action === 'done-by-boss-1' || action === 'done-by-boss-2') {
    const boss = action === 'done-by-boss-1' ? 'Boss 1' : 'Boss 2';
    const task = await dbGetTask(id);
    if (!task) return;
    if (!confirm(`Mark this task as handled by ${boss}? It will be marked completed.`)) return;
    await dbUpdateTask(id, {
      status: 'completed',
      completed_at: Date.now(),
      doneByBoss: boss,
      doneByBossAt: Date.now(),
    });
    if (task.assignedTo) {
      pushTeamNotification(task.assignedTo, {
        type: 'task-completed',
        title: 'Task Handled by Admin',
        message: `Your task "${task.title}" was completed by ${boss}.`,
        taskId: id, ts: Date.now(),
      });
    }
    await renderTasks();
    await renderTasksBadge();
    showToast(`Task marked done by ${boss} ✓`);
    return;
  }
  if (action === 'approve-impromptu') {
    const task = await dbGetTask(id);
    if (!task) return;
    await dbUpdateTask(id, { status: 'completed', completed_at: Date.now(), approvedBy: 'admin', approvedAt: Date.now() });
    pushTeamNotification(task.assignedTo, {
      type: 'task-completed',
      title: 'Task Approved',
      message: `Your task "${task.title}" was approved by admin.`,
      taskId: id, ts: Date.now(),
    });
    await renderTasks();
    showToast(`${task.assignedName || 'Team member'}'s task approved ✓`);
    return;
  }
  if (action === 'reject-impromptu') {
    const task = await dbGetTask(id);
    if (!task) return;
    if (!confirm('Reject this completion? Task will go back to in-progress.')) return;
    await dbUpdateTask(id, { status: 'in-progress', rejectedAt: Date.now() });
    pushTeamNotification(task.assignedTo, {
      type: 'task-assigned',
      title: 'Task Needs More Work',
      message: `Your task "${task.title}" was sent back. Please complete it again.`,
      taskId: id, ts: Date.now(),
    });
    await renderTasks();
    showToast('Task rejected — sent back to team member');
    return;
  }
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
  if (action === 'approve-delivery') { await approveDelivery(id); return; }
  if (action === 'fail-delivery')    { await failDelivery(id);    return; }
}

async function approveDelivery(id) {
  const task = await dbGetTask(id);
  if (!task) return;
  await dbUpdateTask(id, { deliveryStatus: 'approved', deliveryStatusAt: Date.now() });
  if (task.assignedTo) {
    pushTeamNotification(task.assignedTo, {
      type: 'delivery-approved', title: 'Delivery Approved ✓',
      message: `Your delivery for "${task.title}" has been approved. Great work!`,
      taskId: id, ts: Date.now(),
    });
  }
  await renderTasks();
  showToast('Delivery approved ✓');
}

async function failDelivery(id) {
  const task = await dbGetTask(id);
  if (!task) return;
  await dbUpdateTask(id, { deliveryStatus: 'failed', deliveryStatusAt: Date.now() });
  if (task.assignedTo) {
    pushTeamNotification(task.assignedTo, {
      type: 'delivery-failed', title: 'Delivery Not Accepted',
      message: `Your delivery for "${task.title}" was not accepted. Please review and resubmit.`,
      taskId: id, ts: Date.now(),
    });
  }
  await renderTasks();
  showToast('Marked as failed to deliver');
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
   TASK DETAIL MODAL
   ════════════════════════════════════════════ */
const taskDetailModal        = document.getElementById('taskDetailModal');
const taskDetailModalClose   = document.getElementById('taskDetailModalClose');
const taskDetailModalBackdrop = document.getElementById('taskDetailModalBackdrop');

async function openTaskDetailModal(taskId) {
  const task = await dbGetTask(taskId);
  if (!task) return;

  const reportCount  = task.reports ? task.reports.length : 0;
  const statusLabel  = { 'pending': 'Pending', 'in-progress': 'In Progress', 'completed': 'Completed' }[task.status] || task.status;
  const prClass      = task.priority || 'medium';
  const prLabel      = prClass.charAt(0).toUpperCase() + prClass.slice(1);

  document.getElementById('taskDetailContent').innerHTML = `
    <div style="margin-bottom:20px;padding-right:32px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <span class="priority-badge priority-badge--${prClass}">${prLabel}</span>
        <span class="status-badge status-badge--${task.status}">${statusLabel}</span>
      </div>
      <h3 style="font-family:var(--serif);font-size:1.25rem;color:var(--white);margin-bottom:10px;line-height:1.35">${task.title}</h3>
      ${task.desc ? `<p style="font-size:0.875rem;color:var(--grey-2);line-height:1.65;white-space:pre-wrap;margin:0">${task.desc}</p>` : ''}
    </div>

    <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:20px">
      <div class="detail-row"><span class="detail-row__key">Assigned To</span><span class="detail-row__val">${task.assignedName || 'Unassigned'}</span></div>
      <div class="detail-row"><span class="detail-row__key">Created</span><span class="detail-row__val">${fmtDate(task.createdAt)} ${fmtTime(task.createdAt)}</span></div>
      ${task.startedAt ? `<div class="detail-row"><span class="detail-row__key">Started</span><span class="detail-row__val">${fmtDate(task.startedAt)}</span></div>` : ''}
      ${task.completedAt ? `<div class="detail-row"><span class="detail-row__key">Completed</span><span class="detail-row__val">${fmtDate(task.completedAt)}</span></div>` : ''}
    </div>

    ${reportCount > 0 ? `
      <div style="margin-bottom:20px">
        <div style="font-size:0.65rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--grey-4);margin-bottom:10px;display:flex;align-items:center;gap:8px">
          Reports (${reportCount})<span style="flex:1;height:1px;background:var(--border);display:block"></span>
        </div>
        <div class="reports-list">
          ${task.reports.map(r => `
            <div class="report-item">
              <div class="report-item__header">
                <span class="report-item__author">${r.memberName || 'Unknown'}</span>
                <span class="report-item__date">${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</span>
              </div>
              <div class="report-item__body">${r.content}</div>
            </div>`).join('')}
        </div>
      </div>` : `<p style="font-size:0.82rem;color:var(--grey-4);font-style:italic;margin-bottom:20px">No reports submitted yet.</p>`}

    <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:16px">
      <button class="task-action-btn task-action-btn--reassign" data-id="${task.id}" data-task-action="reassign">Reassign</button>
      <button class="task-action-btn task-action-btn--delete" data-id="${task.id}" data-task-action="delete">Delete</button>
    </div>`;

  document.querySelectorAll('#taskDetailContent [data-task-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      closeTaskDetailModal();
      await handleTaskAction(btn.dataset.id, btn.dataset.taskAction);
    });
  });

  taskDetailModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTaskDetailModal() {
  taskDetailModal.classList.remove('open');
  document.body.style.overflow = '';
}

taskDetailModalClose.addEventListener('click', closeTaskDetailModal);
taskDetailModalBackdrop.addEventListener('click', closeTaskDetailModal);

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
    assignedTo:   member ? member.id   : null,
    assignedName: member ? member.name : null,
  });
  await renderTasks();
  if (member) {
    pushTeamNotification(member.id, {
      type:    'task-assigned',
      title:   'Task Reassigned to You',
      message: `"${task.title}" has been reassigned to you.`,
      taskId, ts: Date.now(),
    });
    notify('Task Reassigned — NEJstudios', `${member.name}: "${task.title}" reassigned to you.`);
  }
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
  const salary   = parseInt(document.getElementById('tmSalary').value, 10) || 0;
  const editId   = document.getElementById('editMemberId').value;

  if (!name || !username || !pin) return;
  if (pin.length < 4) { showToast('PIN must be at least 4 characters'); return; }

  const team = getTeam();

  const duplicate = team.find(m => m.username.toLowerCase() === username && m.id !== editId);
  if (duplicate) { showToast('Username already exists'); return; }

  if (editId) {
    const idx = team.findIndex(m => m.id === editId);
    if (idx !== -1) { team[idx] = { ...team[idx], name, username, pin, salary }; }
  } else {
    team.push({
      id:        'TM-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      name, username, pin, salary,
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
  const sal = document.getElementById('tmSalary'); if (sal) sal.value = '';
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

  const salaries = await Promise.all(team.map(m => dbGetMonthlySalary(m).catch(() => null)));
  grid.innerHTML = team.map((m, i) => {
    const initials  = m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    const memberTasks    = allTasks.filter(t => t.assignedTo === m.id);
    const taskCount      = memberTasks.length;
    const completedCount = memberTasks.filter(t => t.status === 'completed').length;
    const sal = salaries[i];
    return `
      <div class="member-card" data-member-id="${m.id}" style="cursor:pointer">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${m.name}</div>
          <div class="member-username">@${m.username}</div>
          <div class="member-meta">${taskCount} task${taskCount !== 1 ? 's' : ''} assigned · Added ${fmtDateShort(m.createdAt)}</div>
          ${completedCount > 0 ? `<div style="font-size:0.72rem;color:var(--green);margin-top:2px">✓ ${completedCount} completed</div>` : ''}
          ${sal && sal.baseSalary > 0 ? `
            <div style="font-size:0.72rem;color:var(--grey-3);margin-top:4px">
              Salary: <strong style="color:var(--white)">₦${sal.baseSalary.toLocaleString()}</strong>
              ${(sal.lateTotal || sal.absentTotal) ? `<span style="color:var(--red)"> · −₦${(sal.lateTotal + sal.absentTotal).toLocaleString()}</span>` : ''}
              ${sal.bonusAmount ? `<span style="color:var(--green)"> · +₦${sal.bonusAmount.toLocaleString()}</span>` : ''}
              · This month: <strong style="color:var(--gold)">₦${sal.expected.toLocaleString()}</strong>
            </div>` : ''}
        </div>
        <div class="member-actions">
          <button class="member-action-btn member-action-btn--link" data-mid="${m.id}" title="Copy login link to share with ${m.name}">🔗 Login Link</button>
          <button class="member-action-btn member-action-btn--edit" data-mid="${m.id}">Edit</button>
          <button class="member-action-btn member-action-btn--delete" data-mid="${m.id}" data-mname="${m.name}">Remove</button>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.member-action-btn--link').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); copyLoginLink(btn.dataset.mid); });
  });
  grid.querySelectorAll('.member-action-btn--edit').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); editMember(btn.dataset.mid); });
  });
  grid.querySelectorAll('.member-action-btn--delete').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); removeMember(btn.dataset.mid, btn.dataset.mname); });
  });
  grid.querySelectorAll('[data-member-id]').forEach(card => {
    card.addEventListener('click', () => openMemberDetailModal(card.dataset.memberId));
  });
}

async function openMemberDetailModal(id) {
  const team = getTeam();
  const m    = team.find(x => x.id === id);
  if (!m) return;
  const initials = m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();

  // Loading state
  modalContent.innerHTML = `<div style="text-align:center;padding:30px;color:var(--grey-3)">Loading…</div>`;
  detailModal.querySelector('h3').textContent = 'Team Member Profile';
  detailModal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Gather data
  const [sal, allTasks, attendance, points] = await Promise.all([
    dbGetMonthlySalary(m).catch(() => null),
    dbGetTasks().catch(() => []),
    dbGetAttendance().catch(() => ({})),
    dbGetMemberPoints(m.id).catch(() => ({ total: 0, entries: [] })),
  ]);

  const myTasks    = allTasks.filter(t => t.assignedTo === m.id);
  const completed  = myTasks.filter(t => t.status === 'completed');
  const inProgress = myTasks.filter(t => t.status === 'in-progress');
  const pending    = myTasks.filter(t => t.status === 'pending');
  const awaiting   = myTasks.filter(t => t.status === 'awaiting-approval');

  const records = (attendance[m.id] || []).slice(0, 14);
  const presentCount = records.filter(r => !r.absent).length;
  const absentCount  = records.filter(r => r.absent).length;

  const taskRow = (t) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;margin-bottom:6px;font-size:0.78rem">
      <div style="min-width:0;flex:1">
        <div style="color:var(--white);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_escHtml(t.title)}</div>
        ${t.completedAt ? `<div style="color:var(--grey-3);font-size:0.68rem;margin-top:1px">Completed ${fmtDateShort(t.completedAt)}</div>` : ''}
      </div>
      <span style="font-size:0.62rem;font-weight:700;text-transform:uppercase;color:${t.status==='completed'?'var(--green)':t.status==='in-progress'?'var(--gold)':t.status==='awaiting-approval'?'var(--orange)':'var(--grey-3)'};margin-left:8px;flex-shrink:0">${t.status}</span>
    </div>`;

  modalContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div style="width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,var(--gold),#a98c43);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:#000">${initials}</div>
      <div>
        <div style="font-size:1.05rem;color:var(--white);font-weight:700">${_escHtml(m.name)}</div>
        <div style="font-size:0.78rem;color:var(--grey-3)">@${_escHtml(m.username)} · ID ${_escHtml(m.id)}</div>
        <div style="font-size:0.7rem;color:var(--grey-4);margin-top:2px">Added ${fmtDateShort(m.createdAt)}${m.role==='admin'?' · ADMIN':''}</div>
      </div>
    </div>

    ${sal && sal.baseSalary > 0 ? `
      <div style="padding:14px;background:linear-gradient(135deg,rgba(201,168,76,0.08),rgba(201,168,76,0.02));border:1px solid rgba(201,168,76,0.3);border-radius:10px;margin-bottom:16px">
        <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--grey-3);margin-bottom:10px">Salary Breakdown — ${new Date().toLocaleDateString('en-NG', { month: 'long' })}</div>
        <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px"><span style="color:var(--grey-2)">Base salary</span><strong style="color:var(--white)">₦${sal.baseSalary.toLocaleString()}</strong></div>
        ${sal.lateTotal ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px"><span style="color:var(--grey-2)">Late deductions</span><strong style="color:var(--red)">− ₦${sal.lateTotal.toLocaleString()}</strong></div>` : ''}
        ${sal.absentTotal ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px"><span style="color:var(--grey-2)">Absent deductions</span><strong style="color:var(--red)">− ₦${sal.absentTotal.toLocaleString()}</strong></div>` : ''}
        ${sal.bonusAmount ? `<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px"><span style="color:var(--grey-2)">Bonus (${sal.bonusPoints} pts)</span><strong style="color:var(--green)">+ ₦${sal.bonusAmount.toLocaleString()}</strong></div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:6px;border-top:1px solid var(--border)"><span style="font-size:0.9rem;font-weight:600;color:var(--white)">Expected payout</span><strong style="color:var(--gold);font-size:1.1rem">₦${sal.expected.toLocaleString()}</strong></div>
      </div>` : '<div style="padding:12px;background:var(--bg-2);border:1px dashed var(--border);border-radius:8px;font-size:0.8rem;color:var(--grey-3);margin-bottom:16px">No salary configured. Click Edit to set a monthly salary.</div>'}

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1.1rem;color:var(--green);font-weight:700">${completed.length}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Completed</div></div>
      <div style="padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1.1rem;color:var(--gold);font-weight:700">${inProgress.length}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">In Progress</div></div>
      <div style="padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1.1rem;color:var(--grey-2);font-weight:700">${pending.length}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Pending</div></div>
      <div style="padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1.1rem;color:var(--orange);font-weight:700">${awaiting.length}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Awaiting</div></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <div style="flex:1;padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1rem;color:var(--green);font-weight:700">${presentCount}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Present (14d)</div></div>
      <div style="flex:1;padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1rem;color:var(--red);font-weight:700">${absentCount}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Absent (14d)</div></div>
      <div style="flex:1;padding:10px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-size:1rem;color:var(--gold);font-weight:700">${points.total}</div><div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Bonus Pts</div></div>
    </div>

    ${completed.length ? `
      <div style="margin-bottom:14px"><strong style="font-size:0.82rem;color:var(--white)">Completed Tasks (${completed.length})</strong></div>
      ${completed.slice(0, 10).map(taskRow).join('')}
      ${completed.length > 10 ? `<div style="font-size:0.72rem;color:var(--grey-3);text-align:center;padding:6px">+ ${completed.length - 10} more…</div>` : ''}
    ` : ''}

    ${(inProgress.length || pending.length || awaiting.length) ? `
      <div style="margin:18px 0 10px 0"><strong style="font-size:0.82rem;color:var(--white)">Active Tasks</strong></div>
      ${[...inProgress, ...awaiting, ...pending].slice(0, 8).map(taskRow).join('')}
    ` : ''}
  `;
}

async function renderCompletedTasksByMember() {
  const container = document.getElementById('completedTasksByMember');
  if (!container) return;
  const [allTasks] = await Promise.all([dbGetTasks()]);
  const team = getTeam();
  const completedTasks = allTasks.filter(t => t.status === 'completed');

  if (completedTasks.length === 0) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--grey-3)">No completed tasks yet.</p></div>`;
    return;
  }

  const byMember = {};
  completedTasks.forEach(t => {
    const key = t.assignedTo || 'unassigned';
    if (!byMember[key]) byMember[key] = [];
    byMember[key].push(t);
  });

  container.innerHTML = team.map(m => {
    const done = byMember[m.id] || [];
    if (done.length === 0) return '';
    done.sort((a, b) => (b.completed_at || b.completedAt || 0) - (a.completed_at || a.completedAt || 0));
    return `
      <div style="margin-bottom:20px">
        <div style="font-weight:700;color:var(--gold);margin-bottom:8px;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em">
          ${m.name} <span style="color:var(--green);font-size:0.8rem">${done.length} completed</span>
        </div>
        ${done.map(t => `
          <div style="padding:8px 12px;background:var(--bg-3);border-radius:6px;margin-bottom:6px;border-left:3px solid var(--green)">
            <div style="font-weight:600;font-size:0.85rem">${t.title}</div>
            ${t.completed_at || t.completedAt ? `<div style="font-size:0.72rem;color:var(--grey-4);margin-top:2px">Completed ${new Date(t.completed_at || t.completedAt).toLocaleDateString('en-NG', { dateStyle:'medium' })}</div>` : ''}
          </div>`).join('')}
      </div>`;
  }).join('');
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
  const sal = document.getElementById('tmSalary'); if (sal) sal.value = m.salary || '';
  document.getElementById('teamFormTitle').textContent  = 'Edit Team Member';
  document.getElementById('teamFormSubmit').textContent = 'Save Changes';
  document.getElementById('cancelEditBtn').classList.add('visible');
  document.querySelector('.team-form-card').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function unassignMemberTasks(id) {
  try {
    const tasks = await dbGetTasks();
    const mine  = tasks.filter(t => t.assignedTo === id);
    for (const t of mine) {
      await dbUpdateTask(t.id, { assignedTo: null, assignedName: null });
    }
  } catch (e) { console.error('unassignMemberTasks failed', e); }
}

async function removeMember(id, name) {
  if (!confirm(`Remove ${name} from the team? Their tasks will become unassigned.`)) return;
  try {
    await unassignMemberTasks(id);
  } catch (e) { console.error('unassign failed, continuing with removal', e); }
  // Track ID as deleted so hardcoded TEAM_CONFIG entries stay removed
  const deleted = getDeletedTeamIds();
  if (!deleted.includes(id)) {
    deleted.push(id);
    saveDeletedTeamIds(deleted);
  }
  saveTeam(getTeam().filter(m => m.id !== id));
  await renderTeam();
  if (typeof renderTasks === 'function') await renderTasks();
  if (typeof populateAssigneeSelect === 'function') populateAssigneeSelect();
  showToast(`${name} removed`);
}

/* ════════════════════════════════════════════
   ATTENDANCE VIEW (admin)
   ════════════════════════════════════════════ */
async function renderAttendance() {
  const grid = document.getElementById('attendanceGrid');
  if (!grid) return;

  const today    = new Date().toISOString().slice(0, 10);
  const data     = await dbGetAttendance();
  const team     = getTeam();

  const rows = team.map(m => {
    const records  = (data[m.id] || []);
    const todayRec = records.find(r => r.date === today);
    const initials = m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    return { member: m, todayRec, initials };
  });

  // Sort: signed in first
  rows.sort((a, b) => (b.todayRec ? 1 : 0) - (a.todayRec ? 1 : 0));

  const nowHour   = new Date().getHours();
  const nowDow    = new Date().getDay();
  const isWorkday = nowDow >= 1 && nowDow <= 5;
  const pastNoon  = nowHour >= 12;

  // Sort: signed-in first, then absent, then not yet
  rows.sort((a, b) => {
    const rank = r => (r.todayRec && !r.todayRec.absent) ? 0 : (r.todayRec && r.todayRec.absent) ? 1 : 2;
    return rank(a) - rank(b);
  });

  grid.innerHTML = rows.map(({ member: m, todayRec, initials }) => {
    const isAbsent   = todayRec && todayRec.absent;
    const signedIn   = todayRec && !todayRec.absent;
    const autoAbsent = !todayRec && isWorkday && pastNoon;
    let dotBg, dotBorder, dotColor, statusHtml;
    if (signedIn) {
      dotBg = 'rgba(62,207,142,.15)'; dotBorder = 'rgba(62,207,142,.3)'; dotColor = 'var(--green)';
      const lateStr = (() => {
        if (!todayRec.ts) return null;
        const d = new Date(todayRec.ts); const res = new Date(d); res.setHours(9,0,0,0);
        const mins = Math.floor((d - res) / 60000);
        if (mins <= 0) return null;
        const h = Math.floor(mins/60), rm = mins%60;
        return h > 0 ? `${h}h ${rm}m late` : `${mins}m late`;
      })();
      statusHtml = `<div style="text-align:right">
        <div style="font-size:0.75rem;font-weight:700;color:var(--green)">✓ Signed In${todayRec.signOutTime ? ' &amp; Out' : ''}</div>
        <div style="font-size:0.68rem;color:var(--grey-3)">${todayRec.time}${todayRec.signOutTime ? ' → ' + todayRec.signOutTime : ''}</div>
        ${lateStr ? `<div style="font-size:0.65rem;color:var(--red);font-weight:600">${lateStr}</div>` : ''}
      </div>`;
    } else if (isAbsent || autoAbsent) {
      dotBg = 'rgba(248,113,113,.12)'; dotBorder = 'rgba(248,113,113,.3)'; dotColor = 'var(--red)';
      const authorised = todayRec && todayRec.authorised;
      const todayDate  = new Date().toISOString().slice(0,10);
      statusHtml = `<div style="text-align:right">
        <div style="font-size:0.75rem;font-weight:700;color:var(--red)">✗ Absent${authorised ? ' (Authorised)' : ''}</div>
        <div style="font-size:0.65rem;color:var(--grey-4)">${authorised ? 'No deduction' : '₦5,000 deduction'}</div>
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px;flex-wrap:wrap">
          <button class="action-btn" data-manual-signin-id="${m.id}" data-manual-signin-name="${m.name.replace(/"/g,'&quot;')}" style="font-size:0.62rem;padding:3px 8px;border-color:var(--gold);color:var(--gold)">Sign In Manually</button>
          ${!authorised ? `<button class="action-btn" data-authorise-id="${m.id}" data-authorise-date="${todayDate}" data-authorise-name="${m.name.replace(/"/g,'&quot;')}" style="font-size:0.62rem;padding:3px 8px;border-color:var(--green);color:var(--green)">Authorise</button>` : ''}
        </div>
      </div>`;
    } else {
      dotBg = 'var(--bg-3)'; dotBorder = 'var(--border)'; dotColor = 'var(--grey-3)';
      statusHtml = `<div style="text-align:right">
        <div style="font-size:0.72rem;color:var(--grey-4);font-style:italic;margin-bottom:4px">Not yet signed in</div>
        <button class="action-btn" data-manual-signin-id="${m.id}" data-manual-signin-name="${m.name.replace(/"/g,'&quot;')}" style="font-size:0.62rem;padding:3px 8px;border-color:var(--gold);color:var(--gold)">Sign In Manually</button>
      </div>`;
    }
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px">
      <div style="width:34px;height:34px;border-radius:50%;background:${dotBg};border:1px solid ${dotBorder};display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:${dotColor};flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;font-weight:600;color:var(--white)">${m.name}</div>
        <div style="font-size:0.72rem;color:var(--grey-3)">@${m.username}</div>
      </div>
      ${statusHtml}
    </div>`;
  }).join('');

  if (rows.length === 0) {
    grid.innerHTML = '<div style="color:var(--grey-4);font-size:0.82rem;padding:16px 0">No team members added yet.</div>';
  }
}

document.getElementById('refreshAttendanceBtn')?.addEventListener('click', () => renderAttendance());
document.getElementById('refreshLeaveBtn')?.addEventListener('click', () => renderLeaveRequests());
document.getElementById('btnRefreshDelivery')?.addEventListener('click', () => renderMonthlyDeliveryAdmin());

async function renderMonthlyDeliveryAdmin() {
  const wrap = document.getElementById('monthlyDeliveryGrid');
  if (!wrap) return;
  const team = getTeam().filter(m => m.role !== 'admin');
  if (!team.length) { wrap.innerHTML = '<div style="color:var(--grey-4);font-size:0.85rem;padding:12px 0">No team members yet.</div>'; return; }
  wrap.innerHTML = '<div style="color:var(--grey-3);font-size:0.85rem;padding:12px 0">Loading…</div>';

  const boss = await dbGetBossDelivery();
  const rows = await Promise.all(team.map(async m => ({
    m,
    d: await dbGetMemberMonthlyDelivery(m.id),
  })));
  rows.sort((a, b) => b.d.totalCompleted - a.d.totalCompleted);

  // Boss 1/2 summary at top
  const bossCard = (label, s, color) => {
    const types = Object.entries(s.byType).map(([k, v]) =>
      `<span style="display:inline-block;padding:2px 8px;background:var(--bg-2);border:1px solid var(--border);border-radius:12px;font-size:0.66rem;color:var(--grey-2);margin:2px 4px 0 0">${k}: <strong style="color:var(--white)">${v}</strong></span>`
    ).join('');
    return `
      <div style="flex:1;min-width:240px;padding:14px;background:var(--bg-3);border:1px solid ${color};border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px">
          <div>
            <div style="font-size:0.95rem;color:${color};font-weight:700">${label}</div>
            <div style="font-size:0.7rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Tasks handled directly</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.62rem;color:var(--grey-3);text-transform:uppercase">This month / Total</div>
            <div><strong style="color:${color};font-size:1.2rem">${s.thisMonth}</strong> <span style="color:var(--grey-4)">/</span> <strong style="color:var(--white);font-size:1.2rem">${s.total}</strong></div>
          </div>
        </div>
        ${types || '<div style="font-size:0.72rem;color:var(--grey-4);font-style:italic">No tasks handled yet</div>'}
      </div>`;
  };

  const bossSection = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
      ${bossCard('Boss 1', boss['Boss 1'], 'var(--gold)')}
      ${bossCard('Boss 2', boss['Boss 2'], '#9b8cd4')}
    </div>`;

  const memberCards = rows.map(({ m, d }) => {
    const initials = (m.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
    const allTypes = new Set([...Object.keys(d.createdByType), ...Object.keys(d.byType)]);
    const typeChips = Array.from(allTypes).sort().map(k => {
      const cr  = d.createdByType[k] || 0;
      const del = d.byType[k]        || 0;
      return `<span style="display:inline-block;padding:2px 8px;background:var(--bg-3);border:1px solid var(--border);border-radius:12px;font-size:0.66rem;color:var(--grey-2);margin:2px 4px 0 0">${k}: <strong style="color:var(--white)">${del}</strong><span style="color:var(--grey-4)"> / ${cr}</span></span>`;
    }).join('');
    const fmtDateShort = (ts) => ts ? new Date(ts).toLocaleDateString('en-NG', { month:'short', day:'numeric' }) : '';
    const deliveredList = d.tasks.length ? `
      <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-3);margin:10px 0 4px">Delivered Tasks (${d.tasks.length})</div>
      <div style="display:flex;flex-direction:column;gap:4px">
      ${d.tasks.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 9px;background:var(--bg-3);border:1px solid var(--border);border-radius:5px;font-size:0.72rem">
          <div style="min-width:0;flex:1;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_escHtml(t.title)}</div>
          <span style="font-size:0.6rem;color:var(--grey-3);margin-left:8px;flex-shrink:0">${fmtDateShort(t.completedAt || t.completed_at)}</span>
          <span style="font-size:0.58rem;font-weight:700;text-transform:uppercase;color:${t.deliveryStatus==='approved'?'var(--green)':t.deliveryStatus==='failed'?'var(--red)':'var(--grey-3)'};margin-left:8px;flex-shrink:0">${t.deliveryStatus || 'pending'}</span>
        </div>`).join('')}
      </div>` : '';
    return `
      <div style="padding:14px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gold),#a98c43);display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700;color:#000;flex-shrink:0">${initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.9rem;font-weight:600;color:var(--white)">${_escHtml(m.name)}</div>
            <div style="font-size:0.7rem;color:var(--grey-3)">@${_escHtml(m.username)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:0.62rem;color:var(--grey-3);text-transform:uppercase">Delivered / Assigned</div>
            <div><strong style="color:var(--gold);font-size:1.2rem">${d.totalCompleted}</strong> <span style="color:var(--grey-4)">/</span> <strong style="color:var(--white);font-size:1.2rem">${d.totalCreated}</strong></div>
          </div>
        </div>
        <div style="display:flex;gap:14px;font-size:0.72rem;color:var(--grey-2);flex-wrap:wrap;margin-bottom:8px">
          <span><strong style="color:var(--green)">${d.approved}</strong> approved</span>
          <span><strong style="color:var(--red)">${d.failed}</strong> failed</span>
          <span><strong style="color:var(--grey-3)">${d.unrated}</strong> unrated</span>
          <span style="margin-left:auto"><strong style="color:var(--green)">${d.onTime}</strong> on-time · <strong style="color:var(--red)">${d.late}</strong> late</span>
          ${d.bonusPoints ? `<span><strong style="color:var(--gold)">+${d.bonusPoints}</strong> bonus pts</span>` : ''}
        </div>
        ${typeChips ? `<div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-3);margin:6px 0 4px">Categories — delivered / assigned</div><div>${typeChips}</div>` : ''}
        ${deliveredList}
      </div>`;
  }).join('');

  wrap.innerHTML = bossSection + memberCards;
}

/* ════════════════════════════════════════════
   LEAVE REQUESTS (admin approval)
   ════════════════════════════════════════════ */
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function renderLeaveRequests() {
  const wrap = document.getElementById('leaveRequestsList');
  if (!wrap) return;
  const all = await dbGetLeaveRequests();
  if (!all.length) { wrap.innerHTML = '<div style="color:var(--grey-4);font-size:0.82rem;padding:12px 0">No leave requests yet.</div>'; return; }
  // Pending first, then by date
  all.sort((a,b) => {
    const order = { pending: 0, approved: 1, rejected: 2 };
    return (order[a.status] - order[b.status]) || ((b.createdAt||0) - (a.createdAt||0));
  });
  wrap.innerHTML = all.slice(0, 20).map(e => {
    const color = e.status === 'approved' ? 'var(--green)' : e.status === 'rejected' ? 'var(--red)' : 'var(--gold)';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:600;color:var(--white)">${escHtml(e.memberName)}</div>
          <div style="font-size:0.74rem;color:var(--grey-3)">${escHtml(e.startDate)} → ${escHtml(e.endDate)}</div>
          ${e.reason ? `<div style="font-size:0.72rem;color:var(--grey-3);margin-top:3px">"${escHtml(e.reason)}"</div>` : ''}
        </div>
        <span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;color:${color};letter-spacing:0.08em">${e.status}</span>
        ${e.status === 'pending' ? `
          <button class="action-btn" data-leave-approve="${e.id}" style="font-size:0.7rem;padding:5px 10px;border-color:var(--green);color:var(--green)">Approve</button>
          <button class="action-btn" data-leave-reject="${e.id}" style="font-size:0.7rem;padding:5px 10px;border-color:var(--red);color:var(--red)">Reject</button>
        ` : ''}
      </div>`;
  }).join('');

  wrap.querySelectorAll('[data-leave-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const entry = await dbDecideLeaveRequest(btn.dataset.leaveApprove, 'approved');
      if (entry) {
        pushTeamNotification(entry.memberId, {
          type: 'leave-approved',
          title: 'Leave Approved',
          message: `Your leave ${entry.startDate} → ${entry.endDate} was approved.`,
          ts: Date.now(),
        });
        showToast('Leave approved ✓');
        renderLeaveRequests();
        renderAttendance();
      }
    });
  });
  wrap.querySelectorAll('[data-leave-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Reject this leave request?')) return;
      const entry = await dbDecideLeaveRequest(btn.dataset.leaveReject, 'rejected');
      if (entry) {
        pushTeamNotification(entry.memberId, {
          type: 'leave-rejected',
          title: 'Leave Rejected',
          message: `Your leave ${entry.startDate} → ${entry.endDate} was rejected.`,
          ts: Date.now(),
        });
        showToast('Leave rejected');
        renderLeaveRequests();
      }
    });
  });
}

document.getElementById('attendanceGrid')?.addEventListener('click', async (e) => {
  const authBtn = e.target.closest('[data-authorise-id]');
  if (authBtn) {
    const memberId = authBtn.dataset.authoriseId;
    const date     = authBtn.dataset.authoriseDate;
    if (!confirm('Mark this absence as authorised? The ₦5,000 deduction will be waived.')) return;
    // Create absent record first if it doesn't exist yet (auto-absent state)
    const team   = getTeam();
    const member = team.find(m => m.id === memberId);
    if (member) await dbMarkAbsent(member);
    const ok = await dbAuthoriseAbsence(memberId, date);
    if (ok) { showToast('Absence authorised — deduction waived ✓'); renderAttendance(); }
    else    { showToast('Could not authorise absence', 'err'); }
    return;
  }

  const signBtn = e.target.closest('[data-manual-signin-id]');
  if (signBtn) {
    const memberId   = signBtn.dataset.manualSigninId;
    const memberName = signBtn.dataset.manualSigninName;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const timeStr = prompt(`Enter sign-in time for ${memberName} (24-hour HH:MM):`, hhmm);
    if (!timeStr) return;
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) { showToast('Invalid time format. Use HH:MM', 'err'); return; }
    const team = getTeam();
    const member = team.find(m => m.id === memberId);
    if (!member) { showToast('Member not found', 'err'); return; }
    const result = await dbAdminSignInForMember(member, timeStr);
    if (result.alreadySignedIn) {
      showToast(`${memberName} already signed in today`, 'err');
    } else {
      const ded = result.record.lateDeduction;
      showToast(`${memberName} signed in at ${timeStr}${ded ? ` (₦${ded.toLocaleString()} late deduction)` : ''} ✓`);
      renderAttendance();
    }
  }
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
    closeTaskDetailModal();
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

  const [schedule, tasks, signOutBriefs] = await Promise.all([dbGetSchedule(), dbGetTasks(), dbGetSignOutBriefs()]);
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
      <div class="summary-section-title">Bookings Today</div>
      ${bookingsToday.length === 0
        ? `<p class="summary-empty">No new bookings received today.</p>`
        : `<div class="summary-list">${bookingsToday.map(b => `
            <div class="summary-list-item">
              <strong>${b.clientName}</strong>
              <span style="color:var(--grey-4)"> — ${b.bookingKind === 'event' ? (EVENT_TYPE_LABELS[b.eventType] || b.eventType || 'Event') : b.sessionType || 'Studio'} · ${STATUS_LABELS[b.status] || b.status}</span>
            </div>`).join('')}</div>`
      }
    </div>

    <div class="summary-section">
      <div class="summary-section-title">Team Sign-Out Briefs</div>
      ${(() => {
        const todayBriefs = (signOutBriefs || []).filter(b => b.date === todayStr);
        if (todayBriefs.length === 0) return `<p class="summary-empty">No team sign-out reports submitted today.</p>`;
        return `<div class="summary-list">${todayBriefs.map(b => `
          <div class="summary-list-item" style="border-left:3px solid var(--gold);padding-left:10px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${b.memberName}</strong>
              <span style="font-size:0.72rem;color:var(--grey-4)">Signed out ${b.signOutTime}</span>
            </div>
            <div style="font-size:0.82rem;color:var(--grey-2);margin-top:4px;font-style:italic">"${b.summary}"</div>
          </div>`).join('')}</div>`;
      })()}
    </div>`;
}

document.getElementById('btnRefreshSummary').addEventListener('click', renderDailySummary);

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

// Studio booking form submit
document.getElementById('bmStudioForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = document.getElementById('bmStudioErr');
  const firstName   = document.getElementById('bmFirstName').value.trim();
  const middleName  = document.getElementById('bmMiddleName').value.trim();
  const phone       = document.getElementById('bmPhone').value.trim();
  const email       = document.getElementById('bmEmail').value.trim();
  const sessionType = document.getElementById('bmSessionPicker').value;

  if (!firstName || !phone || !email) { err.textContent = 'First name, phone, and email are required.'; return; }
  if (!sessionType) { err.textContent = 'Please select a session type.'; return; }
  err.textContent = '';

  const clientName = [firstName, middleName].filter(Boolean).join(' ');
  const booking = {
    id:          'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    bookingKind: 'studio',
    firstName, middleName,
    clientName, phone, email,
    sessionType,
    status:      'pending',
    createdAt:   Date.now(),
  };

  const bookings = getBookings();
  bookings.unshift(booking);
  saveBookings(bookings);

  e.target.reset();
  closeNewBookingModal();
  renderBookings();
  showToast(`Booking for ${clientName} added ✓`);
});

// Event booking form submit
document.getElementById('bmEventForm').addEventListener('submit', e => {
  e.preventDefault();
  const err = document.getElementById('bmEventErr');
  const eventName  = document.getElementById('bmEventName').value.trim();
  const phone      = document.getElementById('bmEPhone').value.trim();
  const email      = document.getElementById('bmEEmail').value.trim();
  const eventType  = document.getElementById('bmEType').value;
  const pkg        = document.getElementById('bmEPackage').value;
  const eventDate  = document.getElementById('bmEDate').value;
  const budgetRaw  = document.getElementById('bmEBudget').value;
  const location   = document.getElementById('bmELocation').value.trim();
  const deliverables = document.getElementById('bmEDeliverables').value.trim();

  if (!eventName || !phone || !email) { err.textContent = 'Event name, phone, and email are required.'; return; }
  if (!eventType) { err.textContent = 'Please select an event type.'; return; }
  err.textContent = '';

  const booking = {
    id:          'NEJ-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    bookingKind: 'event',
    eventName,
    clientName: eventName,
    phone, email,
    eventType,
    package:      pkg || null,
    eventDate:    eventDate || null,
    budget:       budgetRaw === '' ? null : Number(budgetRaw),
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
  showToast(`Event booking for ${eventName} added ✓`);
});

/* ════════════════════════════════════════════
   AUTO-GENERATE POST-EVENT TASKS
   When a booking's event/shoot date hits, create 5 standard tasks:
   Backup (same-day), Lightroom (3d), Thriller (3d), Full video (3d), Photobook (3d).
   ════════════════════════════════════════════ */
async function autoCreateEventDayTasks() {
  const today = new Date().toISOString().slice(0, 10);
  const bookings = (await dbFetchBookings()).filter(b => !b.deletedAt);
  const tasks = await dbGetTasks();
  const allBookings = getBookings();
  const team = getTeam();

  // Helper: find a team member by username (case-insensitive) → returns {id, name} or null
  const findMember = (username) => {
    const m = team.find(t => (t.username || '').toLowerCase() === username.toLowerCase());
    return m ? { id: m.id, name: m.name } : null;
  };
  const LIGHT   = findMember('light');
  const UZO     = findMember('uzo');
  const DORATHY = findMember('dorathy');
  const NEJ     = findMember('nej');
  const LOLYA   = findMember('lolya');

  for (const b of bookings) {
    const eventDate = b.bookingKind === 'studio' ? (b.shootDate || b.preferredDate) : b.eventDate;
    if (!eventDate || eventDate > today) continue;     // event hasn't happened yet
    if (b.postEventTasksCreated) continue;             // already done
    if (b.status === 'cancelled') continue;

    const eventName = b.clientName || (b.bookingKind === 'studio' ? 'Studio Shoot' : 'Event');
    const isStudio  = b.bookingKind === 'studio';
    const addDays = (n) => {
      const d = new Date(eventDate + 'T00:00:00');
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const sameDay = eventDate;
    const plus3   = addDays(3);

    // Default assignment rules (admin can reassign anytime):
    //   Backup (studio) → shared/unassigned, listed for all staff to claim
    //   Backup (event)  → Dorathy
    //   Lightroom (studio) → Uzo
    //   Lightroom (event)  → split into 2 tasks: Dorathy + Lolya
    //   Thriller   → Light
    //   Photobook  → Dorathy
    //   Full video → nej001 (@nej)
    const templates = [];

    // Backup
    if (isStudio) {
      templates.push({ title: `Backup ${eventName}`, deadline: sameDay, priority: 'high', assignee: null, shared: true });
    } else {
      templates.push({ title: `Backup ${eventName}`, deadline: sameDay, priority: 'high', assignee: DORATHY });
    }

    if (isStudio) {
      // Studio shoots: only Retouching after Backup (no Lightroom, Photobook, Thriller, or Full video)
      templates.push({ title: `Retouching ${eventName}`, deadline: plus3, priority: 'high', assignee: UZO });
    } else {
      // Event/wedding: Lightroom split between Dorathy + Lolya
      templates.push({ title: `Lightroom ${eventName} (Dorathy)`, deadline: plus3, priority: 'high', assignee: DORATHY });
      templates.push({ title: `Lightroom ${eventName} (Lolya)`,   deadline: plus3, priority: 'high', assignee: LOLYA   });
      // Thriller (Light)
      templates.push({ title: `Create Thriller for ${eventName}`, deadline: plus3, priority: 'medium', assignee: LIGHT });
      // Full video split between Nej + Lolya
      templates.push({ title: `Create full video ${eventName} (Nej)`,   deadline: plus3, priority: 'medium', assignee: NEJ   });
      templates.push({ title: `Create full video ${eventName} (Lolya)`, deadline: plus3, priority: 'medium', assignee: LOLYA });
      // Photobook (Dorathy)
      templates.push({ title: `Design Photobook ${eventName}`, deadline: plus3, priority: 'medium', assignee: DORATHY });
    }

    for (const t of templates) {
      const exists = tasks.some(x => x.bookingId === b.id && x.title === t.title);
      if (exists) continue;
      const newTask = {
        id:           'TASK-' + Math.random().toString(36).slice(2,8).toUpperCase(),
        bookingId:    b.id,
        title:        t.title,
        desc:         `Auto-generated for ${eventName} on ${eventDate}${t.shared ? ' — any staff can claim this task' : ''}`,
        assignedTo:   t.assignee ? t.assignee.id   : null,
        assignedName: t.assignee ? t.assignee.name : null,
        priority:     t.priority,
        deadline:     t.deadline,
        status:       'pending',
        createdAt:    Date.now(),
        startedAt:    null,
        completedAt:  null,
        reports:      [],
        autoGenerated: true,
        sharedTask:    !!t.shared,
      };
      await dbAddTask(newTask);
      if (t.assignee) {
        pushTeamNotification(t.assignee.id, {
          type: 'task-assigned',
          title: 'New Task Assigned',
          message: `${t.title} (due ${t.deadline})`,
          taskId: newTask.id, ts: Date.now(),
        });
      } else if (t.shared) {
        // Notify every team member that a shared task is available
        team.filter(m => m.role !== 'admin').forEach(m => {
          pushTeamNotification(m.id, {
            type: 'task-assigned',
            title: 'Shared Task Available',
            message: `${t.title} — any staff can claim it`,
            taskId: newTask.id, ts: Date.now(),
          });
        });
      }
    }

    // Mark booking so we don't recreate on next load
    const idx = allBookings.findIndex(x => x.id === b.id);
    if (idx !== -1) {
      allBookings[idx].postEventTasksCreated = true;
      await dbUpsertBooking(allBookings[idx]);
    }
  }
}

/* ════════════════════════════════════════════
   BOOKINGS CALENDAR (month view)
   ════════════════════════════════════════════ */
let _calCursor = new Date(); _calCursor.setDate(1);

function _bookingDate(b) {
  if (b.bookingKind === 'studio') return b.shootDate || b.preferredDate || '';
  return b.eventDate || '';
}

function _bookingLabel(b) {
  if (b.bookingKind === 'studio') return b.sessionType ? `${b.clientName} — ${b.sessionType}` : (b.clientName || 'Studio');
  return b.clientName || 'Event';
}

async function renderBookingsCalendar() {
  const grid       = document.getElementById('bookingsCalendar');
  const monthLabel = document.getElementById('calMonthLabel');
  if (!grid) return;

  const year  = _calCursor.getFullYear();
  const month = _calCursor.getMonth();
  monthLabel.textContent = _calCursor.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  // Fetch and filter bookings for this month (and adjacent days for grid completeness)
  const bookings = (await dbFetchBookings()).filter(b => !b.deletedAt);
  const byDate = {};
  bookings.forEach(b => {
    const d = _bookingDate(b);
    if (!d) return;
    (byDate[d] = byDate[d] || []).push(b);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const lastDate       = new Date(year, month + 1, 0).getDate();
  const todayStr       = new Date().toISOString().slice(0,10);

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);background:var(--border);gap:1px">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += `<div style="background:var(--bg-3);padding:8px 6px;text-align:center;font-size:0.7rem;font-weight:700;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">${d}</div>`;
  });
  // Leading blanks
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div style="background:var(--bg-2);min-height:84px"></div>`;
  }
  // Days
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const list    = byDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const dots = list.slice(0, 4).map(b => {
      const color = b.status === 'pending' ? '#f87171'
        : b.bookingKind === 'studio' ? 'var(--gold)' : '#4ade80';
      return `<div style="font-size:0.66rem;background:rgba(255,255,255,0.04);border-left:3px solid ${color};color:var(--white);padding:2px 5px;margin-bottom:2px;border-radius:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escHtml(_bookingLabel(b))}</div>`;
    }).join('');
    const more = list.length > 4 ? `<div style="font-size:0.62rem;color:var(--grey-3);padding:0 5px">+${list.length - 4} more</div>` : '';
    const booked = list.length > 0;
    const bg = booked ? 'rgba(230,57,70,0.45)' : 'var(--bg-2)';
    html += `
      <div data-day="${dateStr}" style="background:${bg};min-height:84px;padding:6px;cursor:pointer;${isToday ? 'box-shadow:inset 0 0 0 1px var(--gold)' : ''}">
        <div style="font-size:0.78rem;font-weight:600;color:${isToday ? 'var(--gold)' : 'var(--white)'};margin-bottom:4px">${day}</div>
        ${dots}${more}
      </div>`;
  }
  // Trailing blanks
  const totalCells = firstDayOfWeek + lastDate;
  const trail = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trail; i++) {
    html += `<div style="background:var(--bg-2);min-height:84px"></div>`;
  }
  html += `</div>`;
  grid.innerHTML = html;

  grid.querySelectorAll('[data-day]').forEach(cell => {
    cell.addEventListener('click', () => renderCalDayDetail(cell.dataset.day, byDate[cell.dataset.day] || []));
  });
}

function renderCalDayDetail(dateStr, list) {
  const wrap = document.getElementById('calDayDetail');
  if (!wrap) return;
  const fmt = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  if (!list.length) {
    wrap.style.display = 'block';
    wrap.innerHTML = `<h3 style="font-size:0.95rem;color:var(--white);margin:0 0 6px 0">${fmt}</h3><p style="color:var(--grey-3);font-size:0.85rem;margin:0">No bookings — date is available ✓</p>`;
    return;
  }
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <h3 style="font-size:0.95rem;color:var(--white);margin:0 0 12px 0">${fmt} — ${list.length} booking${list.length>1?'s':''}</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${list.map(b => {
        const color = b.status === 'pending' ? '#f87171' : b.bookingKind === 'studio' ? 'var(--gold)' : '#4ade80';
        const subtype = b.sessionType || EVENT_TYPE_LABELS[b.eventType] || b.eventType || '';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-left:3px solid ${color};border-radius:6px">
            <div>
              <div style="font-size:0.88rem;font-weight:600;color:var(--white)">${_escHtml(b.clientName)}</div>
              <div style="font-size:0.75rem;color:var(--grey-3);margin-top:2px">${_escHtml(subtype)} ${b.location ? '· ' + _escHtml(b.location) : ''}</div>
            </div>
            <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${color}">${b.status}</span>
          </div>`;
      }).join('')}
    </div>`;
}

document.getElementById('calPrev')?.addEventListener('click', () => { _calCursor.setMonth(_calCursor.getMonth() - 1); renderBookingsCalendar(); });
document.getElementById('calNext')?.addEventListener('click', () => { _calCursor.setMonth(_calCursor.getMonth() + 1); renderBookingsCalendar(); });
document.getElementById('calToday')?.addEventListener('click', () => { _calCursor = new Date(); _calCursor.setDate(1); renderBookingsCalendar(); });
