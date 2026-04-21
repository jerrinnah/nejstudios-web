/* ══════════════════════════════════════════════
   NEJstudios — db.js
   Server-backed database layer.
   Reads/writes to /api/sync.php (PHP + JSON files on server)
   so all devices share the same data.
   Falls back to localStorage if the server is unreachable.
   ══════════════════════════════════════════════ */

const DB_SCHEDULE_KEY = 'nej_schedule';
const DB_TASKS_KEY    = 'nej_tasks';
const API             = '/api/sync.php';

/* ════════════════════════════════════════════
   SERVER HELPERS
   ════════════════════════════════════════════ */

async function _serverGet(resource) {
  try {
    const r = await fetch(API + '?resource=' + resource, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch {
    // Fallback to localStorage
    const lsKey = resource === 'schedule' ? DB_SCHEDULE_KEY : DB_TASKS_KEY;
    return JSON.parse(localStorage.getItem(lsKey) || '[]');
  }
}

async function _serverSave(resource, data) {
  const lsKey = resource === 'schedule' ? DB_SCHEDULE_KEY : DB_TASKS_KEY;
  // Always save locally first so UI is never blocked
  localStorage.setItem(lsKey, JSON.stringify(data));
  try {
    await fetch(API + '?resource=' + resource, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
  } catch {
    // Server unreachable — localStorage copy will sync next time server is up
  }
}

/* ════════════════════════════════════════════
   SAFE BOOKING HELPERS — server-authoritative
   Every booking write goes through the atomic merge endpoint,
   so concurrent devices never wipe each other's records.
   ════════════════════════════════════════════ */

const DB_BOOKINGS_KEY = 'nej_bookings';

// Merge endpoint: { upserts: [...], deletes: [...ids] } → returns merged array
async function _dbMergeArray(resource, upserts, deletes) {
  const body = { upserts: upserts || [], deletes: deletes || [] };
  try {
    const r = await fetch(API + '?resource=' + resource + '&op=merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const merged = await r.json();
      if (Array.isArray(merged)) return merged;
    }
  } catch { /* offline */ }
  return null;
}

/**
 * dbUpsertBooking(booking) — saves/updates a single booking atomically.
 * Returns true on server success, false if fell back to local-only.
 */
async function dbUpsertBooking(booking) {
  if (!booking || !booking.id) return false;
  const merged = await _dbMergeArray('bookings', [booking], []);
  if (merged) {
    localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(merged));
    return true;
  }
  // Fallback: update local copy only; will re-sync on next successful save
  const local = JSON.parse(localStorage.getItem(DB_BOOKINGS_KEY) || '[]');
  const idx = local.findIndex(b => b.id === booking.id);
  if (idx >= 0) local[idx] = booking; else local.unshift(booking);
  localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(local));
  return false;
}

/**
 * dbSoftDeleteBooking(id) — marks a booking as deleted on the server (tombstone).
 * Other devices will see { deletedAt: <ts> } and hide it from the UI.
 */
async function dbSoftDeleteBooking(id) {
  if (!id) return false;
  const merged = await _dbMergeArray('bookings', [], [id]);
  if (merged) {
    localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(merged));
    return true;
  }
  const local = JSON.parse(localStorage.getItem(DB_BOOKINGS_KEY) || '[]');
  const idx = local.findIndex(b => b.id === id);
  if (idx >= 0) { local[idx].deletedAt = Date.now(); localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(local)); }
  return false;
}

/**
 * dbUpsertBookings(arr) — bulk upsert. Used when multiple bookings change at once.
 */
async function dbUpsertBookings(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return true;
  const merged = await _dbMergeArray('bookings', arr, []);
  if (merged) {
    localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(merged));
    return true;
  }
  return false;
}

/**
 * dbFetchBookings() — pulls server state, filters tombstones, updates local cache.
 */
async function dbFetchBookings() {
  try {
    const r = await fetch(API + '?resource=bookings', { cache: 'no-store' });
    if (r.ok) {
      const arr = await r.json();
      if (Array.isArray(arr)) {
        localStorage.setItem(DB_BOOKINGS_KEY, JSON.stringify(arr));
        return arr.filter(b => !b.deletedAt);
      }
    }
  } catch { /* offline */ }
  const local = JSON.parse(localStorage.getItem(DB_BOOKINGS_KEY) || '[]');
  return local.filter(b => !b.deletedAt);
}

/* ════════════════════════════════════════════
   BOOKING TYPE MAPS  (used when auto-syncing confirmed bookings)
   ════════════════════════════════════════════ */

const _EVENT_TYPE_MAP = {
  'white-wedding':       'wedding',
  'traditional-wedding': 'wedding',
  'full-wedding':        'wedding',
  'engagement':          'wedding',
  'brand-film':          'production',
  'music-video':         'production',
  'documentary':         'production',
  'other-production':    'production',
  'corporate-event':     'event',
  'birthday':            'event',
  'funeral':             'event',
  'other-event':         'event',
};
const _EVENT_LABELS = {
  'white-wedding':       'White Wedding',
  'traditional-wedding': 'Traditional Wedding',
  'full-wedding':        'Full Wedding',
  'engagement':          'Engagement Shoot',
  'brand-film':          'Brand Film',
  'music-video':         'Music Video',
  'documentary':         'Documentary',
  'other-production':    'Production',
  'corporate-event':     'Corporate Event',
  'birthday':            'Birthday Event',
  'funeral':             'Funeral / Memorial',
  'other-event':         'Other Event',
};

/* ════════════════════════════════════════════
   SCHEDULE
   ════════════════════════════════════════════ */

async function dbGetSchedule() {
  let sched    = await _serverGet('schedule');
  const deletedKey = 'nej_deleted_sched';
  const deletedIds = new Set(JSON.parse(localStorage.getItem(deletedKey) || '[]'));

  // Always filter deleted entries from server data (handles race conditions and stale cache)
  sched = sched.filter(s => !deletedIds.has(s.id));

  const schedIds = new Set(sched.map(s => s.id));
  let changed    = false;

  // Auto-sync all confirmed/completed bookings not yet in the schedule.
  // Bookings are fetched from the server so cross-device bookings appear too.
  let bookings = [];
  try {
    const r = await fetch(API + '?resource=bookings', { cache: 'no-store' });
    if (r.ok) bookings = await r.json();
  } catch { /* ignore */ }

  // Also merge any bookings in local storage (e.g. submitted on this device)
  const localBookings = JSON.parse(localStorage.getItem('nej_bookings') || '[]');
  const allIds        = new Set(bookings.map(b => b.id));
  localBookings.forEach(b => { if (!allIds.has(b.id)) bookings.push(b); });

  bookings.forEach(b => {
    if (b.status !== 'confirmed' && b.status !== 'completed') return;
    const schedId = 'BK-' + b.id;
    if (schedIds.has(schedId)) return;
    if (deletedIds.has(schedId)) return; // was manually deleted — don't re-add

    const schedType = b.bookingKind === 'event'
      ? (_EVENT_TYPE_MAP[b.eventType] || 'event')
      : 'studio';
    const typeLabel = b.bookingKind === 'event'
      ? (_EVENT_LABELS[b.eventType] || b.eventType || '')
      : (b.sessionType || '');

    sched.push({
      id:         schedId,
      title:      b.clientName + (typeLabel ? ' \u2014 ' + typeLabel : ''),
      date:       b.eventDate || new Date(b.createdAt).toISOString().slice(0, 10),
      time:       b.sessionTime || null,
      type:       schedType,
      clientName: b.clientName,
      location:   b.location    || null,
      notes:      b.deliverables || null,
      createdAt:  b.createdAt,
    });
    schedIds.add(schedId);
    changed = true;
  });

  if (changed) await _serverSave('schedule', sched);
  return sched;
}

async function dbAddScheduleEntry(entry) {
  const sched = await _serverGet('schedule');
  if (!sched.find(s => s.id === entry.id)) {
    sched.push(entry);
    await _serverSave('schedule', sched);
    _fireSchedule();
  }
}

async function dbDeleteScheduleEntry(id) {
  // Track deleted IDs so auto-sync from bookings doesn't re-add them
  const deletedKey = 'nej_deleted_sched';
  const deleted    = JSON.parse(localStorage.getItem(deletedKey) || '[]');
  if (!deleted.includes(id)) { deleted.push(id); localStorage.setItem(deletedKey, JSON.stringify(deleted)); }
  // Also push deleted list to server
  try {
    const current = await _serverGet('schedule');
    await _serverSave('schedule', current.filter(s => s.id !== id));
  } catch {
    const sched = JSON.parse(localStorage.getItem(DB_SCHEDULE_KEY) || '[]').filter(s => s.id !== id);
    localStorage.setItem(DB_SCHEDULE_KEY, JSON.stringify(sched));
  }
  _fireSchedule();
}

async function dbUpdateScheduleChecklist(id, checklist) {
  const sched = await _serverGet('schedule');
  const item  = sched.find(s => s.id === id);
  if (item) {
    item.checklist = checklist;
    await _serverSave('schedule', sched);
    _fireSchedule();
  }
}

async function dbUpdateScheduleEntry(id, updates) {
  const sched = await _serverGet('schedule');
  const item  = sched.find(s => s.id === id);
  if (item) {
    Object.assign(item, updates);
    await _serverSave('schedule', sched);
    _fireSchedule();
  }
}

/* ════════════════════════════════════════════
   TASKS
   ════════════════════════════════════════════ */

async function dbGetTasks() {
  let tasks = await _serverGet('tasks');
  // Merge any locally-saved tasks the server doesn't have yet (handles offline-created tasks)
  try {
    const local = JSON.parse(localStorage.getItem(DB_TASKS_KEY) || '[]');
    if (Array.isArray(local) && local.length > 0) {
      const serverIds = new Set(tasks.map(t => t.id));
      const extras    = local.filter(t => !serverIds.has(t.id));
      if (extras.length > 0) {
        tasks = [...tasks, ...extras];
        // Push merged list back to server silently so they're persisted
        _serverSave('tasks', tasks).catch(() => {});
      }
    }
  } catch {}
  return tasks;
}

async function dbGetTask(id) {
  const tasks = await _serverGet('tasks');
  return tasks.find(t => t.id === id) || null;
}

async function dbAddTask(task) {
  const tasks = await _serverGet('tasks');
  tasks.push(task);
  await _serverSave('tasks', tasks);
  _fireTasks(null);
}

async function dbUpdateTask(id, updates) {
  const tasks = await _serverGet('tasks');
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const old = { ...tasks[idx] };
  Object.assign(tasks[idx], updates);
  await _serverSave('tasks', tasks);
  _fireTasks({ new: { ...tasks[idx] }, old });
}

async function dbDeleteTask(id) {
  const tasks = (await _serverGet('tasks')).filter(t => t.id !== id);
  await _serverSave('tasks', tasks);
  _fireTasks(null);
}

/* ════════════════════════════════════════════
   ATTENDANCE  (daily sign-in / sign-out log)
   Stored as { [memberId]: [{ date, time, ts, name,
     signOutTime, signOutTs, daySummary }] }
   Backwards-compatible: old records only have { date, time, ts, name }
   ════════════════════════════════════════════ */

const ATTENDANCE_LS = 'nej_attendance';

async function dbGetAttendance() {
  try {
    const r = await fetch('/api/sync.php?resource=attendance', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    }
  } catch {}
  try { return JSON.parse(localStorage.getItem(ATTENDANCE_LS) || '{}'); } catch { return {}; }
}

async function _saveAttendance(data) {
  localStorage.setItem(ATTENDANCE_LS, JSON.stringify(data));
  try {
    await fetch('/api/sync.php?resource=attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {}
}

// Sign in today — returns { alreadySignedIn, record }
async function dbSignInToday(member) {
  const today = new Date().toISOString().slice(0, 10);
  const time  = new Date().toLocaleTimeString('en-NG', { timeStyle: 'short' });
  const ts    = Date.now();

  const data = await dbGetAttendance();
  if (!data[member.id]) data[member.id] = [];

  const existing = data[member.id].find(r => r.date === today);
  if (existing) return { alreadySignedIn: true, record: existing };

  const record = { date: today, time, ts, name: member.name, signOutTime: null, signOutTs: null, daySummary: null };
  data[member.id].unshift(record);
  data[member.id] = data[member.id].slice(0, 60); // keep last 60 entries per member
  await _saveAttendance(data);
  return { alreadySignedIn: false, record };
}

// Mark a member absent for today — only if no sign-in record already exists
async function dbMarkAbsent(member) {
  const today = new Date().toISOString().slice(0, 10);
  const data  = await dbGetAttendance();
  if (!data[member.id]) data[member.id] = [];
  const existing = data[member.id].find(r => r.date === today);
  if (existing) return { alreadyExists: true, record: existing };
  const record = { date: today, absent: true, name: member.name, time: null, ts: null, signOutTime: null, daySummary: null };
  data[member.id].unshift(record);
  data[member.id] = data[member.id].slice(0, 60);
  await _saveAttendance(data);
  return { marked: true, record };
}

// Sign out today — returns { alreadySignedOut, notSignedIn, record }
async function dbSignOutToday(member, summary) {
  const today = new Date().toISOString().slice(0, 10);
  const time  = new Date().toLocaleTimeString('en-NG', { timeStyle: 'short' });
  const ts    = Date.now();

  const data = await dbGetAttendance();
  if (!data[member.id]) return { notSignedIn: true };

  const record = data[member.id].find(r => r.date === today);
  if (!record) return { notSignedIn: true };
  if (record.signOutTime) return { alreadySignedOut: true, record };

  record.signOutTime = time;
  record.signOutTs   = ts;
  record.daySummary  = summary || null;
  await _saveAttendance(data);
  dbSaveSignOutBrief(member, summary || '', today, time);
  return { alreadySignedOut: false, record };
}

// Save a sign-out brief (called automatically from dbSignOutToday)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
function _pruneOldBriefs(arr) {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  return arr.filter(b => (b.ts || 0) >= cutoff);
}

async function dbSaveSignOutBrief(member, summary, date, signOutTime) {
  const brief = {
    id: 'SB-' + Date.now() + '-' + Math.random().toString(36).slice(2,5),
    memberId:   member.id,
    memberName: member.name,
    date, signOutTime,
    summary, ts: Date.now(),
  };
  try {
    const r   = await fetch('/api/sync.php?resource=sign_out_briefs', { cache: 'no-store' });
    const all = r.ok ? await r.json() : [];
    const arr = _pruneOldBriefs(Array.isArray(all) ? all : []);
    arr.push(brief);
    localStorage.setItem('nej_sign_out_briefs', JSON.stringify(arr));
    await fetch('/api/sync.php?resource=sign_out_briefs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arr),
    });
  } catch {
    const arr = _pruneOldBriefs(JSON.parse(localStorage.getItem('nej_sign_out_briefs') || '[]'));
    arr.push(brief);
    localStorage.setItem('nej_sign_out_briefs', JSON.stringify(arr));
  }
}

async function dbGetSignOutBriefs() {
  try {
    const r = await fetch('/api/sync.php?resource=sign_out_briefs', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) return d;
    }
  } catch {}
  try { return JSON.parse(localStorage.getItem('nej_sign_out_briefs') || '[]'); } catch { return []; }
}

// Get today's sign-in for a member (null if not signed in)
async function dbGetTodaySignIn(memberId) {
  const today = new Date().toISOString().slice(0, 10);
  const data  = await dbGetAttendance();
  if (!data[memberId]) return null;
  return data[memberId].find(r => r.date === today) || null;
}

// Get recent attendance for a member (last N days)
async function dbGetMemberAttendance(memberId, days = 14) {
  const data = await dbGetAttendance();
  return (data[memberId] || []).slice(0, days);
}

/* ════════════════════════════════════════════
   CLIENT CONFIRMATIONS
   Stored as array of { id, bookingId, clientName,
     scheduleId, pictureCount, selection, fileNames,
     confirmedAt, confirmedTs, read }
   Pushed to server + localStorage so admin/team see it.
   ════════════════════════════════════════════ */
const CONFIRMATIONS_LS = 'nej_confirmations';

async function dbSaveConfirmation(data) {
  let all = [];
  try {
    const r = await fetch('/api/sync.php?resource=confirmations', { cache: 'no-store' });
    if (r.ok) { try { all = await r.json(); } catch {} }
  } catch {}
  if (!Array.isArray(all)) {
    try { all = JSON.parse(localStorage.getItem(CONFIRMATIONS_LS) || '[]'); } catch { all = []; }
  }
  // Avoid duplicates (same bookingId confirmed within same day)
  const today = new Date().toISOString().slice(0, 10);
  const dup = all.find(c => c.bookingId === data.bookingId && c.confirmedAt && c.confirmedAt.startsWith(today));
  if (!dup) {
    const entry = { ...data, id: 'CONF-' + Date.now(), confirmedTs: Date.now(), confirmedAt: new Date().toISOString(), read: false };
    all.unshift(entry);
    all = all.slice(0, 200);
    localStorage.setItem(CONFIRMATIONS_LS, JSON.stringify(all));
    try {
      await fetch('/api/sync.php?resource=confirmations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all),
      });
    } catch {}
  }
}

async function dbGetConfirmations() {
  try {
    const r = await fetch('/api/sync.php?resource=confirmations', { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); if (Array.isArray(d)) return d; }
  } catch {}
  try { return JSON.parse(localStorage.getItem(CONFIRMATIONS_LS) || '[]'); } catch { return []; }
}

async function dbMarkConfirmationRead(confirmId) {
  const all = await dbGetConfirmations();
  const item = all.find(c => c.id === confirmId);
  if (item) {
    item.read = true;
    localStorage.setItem(CONFIRMATIONS_LS, JSON.stringify(all));
    try {
      await fetch('/api/sync.php?resource=confirmations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all),
      });
    } catch {}
  }
}

/* ════════════════════════════════════════════
   SUBSCRIPTIONS
   Callbacks fire after same-tab mutations and
   on storage events from other tabs.
   Poll every 30 s for cross-device updates.
   ════════════════════════════════════════════ */

const _taskCbs     = [];
const _scheduleCbs = [];

function dbSubscribeTasks(cb)     { _taskCbs.push(cb); }
function dbSubscribeSchedule(cb)  { _scheduleCbs.push(cb); }

function _fireTasks(payload)  { _taskCbs.forEach(cb => cb(payload)); }
function _fireSchedule()      { _scheduleCbs.forEach(cb => cb()); }

// Same-tab cross-key sync
window.addEventListener('storage', e => {
  if (e.key === DB_TASKS_KEY)    _fireTasks(null);
  if (e.key === DB_SCHEDULE_KEY) _fireSchedule();
});

// Manual refresh — call this explicitly (e.g. from a refresh button or on login)
function dbRefreshAll() {
  if (_scheduleCbs.length > 0) _fireSchedule();
  if (_taskCbs.length > 0)     _fireTasks(null);
}

/* ════════════════════════════════════════════
   GALLERY DELIVERY LINKS
   Stored server-side via gallery_links resource.
   Falls back to localStorage if server unreachable.
   ════════════════════════════════════════════ */
const GALLERY_LINKS_LS = 'nej_gallery_links';

async function dbGetAllGalleryDeliveries() {
  try {
    const r = await fetch(API + '?resource=gallery_links', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return JSON.parse(localStorage.getItem(GALLERY_LINKS_LS) || '[]');
  }
}

async function dbCreateGalleryDelivery(delivery) {
  const all = await dbGetAllGalleryDeliveries();
  all.push(delivery);
  localStorage.setItem(GALLERY_LINKS_LS, JSON.stringify(all));
  try {
    await fetch(API + '?resource=gallery_links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all),
    });
  } catch { /* server unreachable — localStorage copy used */ }
}

async function dbDeleteGalleryDelivery(id) {
  const all = (await dbGetAllGalleryDeliveries()).filter(d => d.id !== id);
  localStorage.setItem(GALLERY_LINKS_LS, JSON.stringify(all));
  try {
    await fetch(API + '?resource=gallery_links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all),
    });
  } catch { /* server unreachable */ }
}

// Look up a single delivery by token (used by gallery.html)
async function dbGetGalleryDelivery(token) {
  const all = await dbGetAllGalleryDeliveries();
  return all.find(d => d.token === token) || null;
}

// Increment download count for a delivery
async function dbIncrementDownload(deliveryId) {
  const all = await dbGetAllGalleryDeliveries();
  const d   = all.find(x => x.id === deliveryId);
  if (!d) return;
  d.download_count = (d.download_count || 0) + 1;
  localStorage.setItem(GALLERY_LINKS_LS, JSON.stringify(all));
  try {
    await fetch(API + '?resource=gallery_links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all),
    });
  } catch {}
}
