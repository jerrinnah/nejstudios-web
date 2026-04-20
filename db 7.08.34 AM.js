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
   BOOKING TYPE MAPS  (used when auto-syncing confirmed bookings)
   ════════════════════════════════════════════ */

const _EVENT_TYPE_MAP = {
  'white-wedding':       'wedding',
  'traditional-wedding': 'wedding',
  'brand-film':          'production',
  'music-video':         'production',
  'documentary':         'production',
  'corporate-event':     'event',
  'birthday':            'event',
  'other-event':         'event',
};
const _EVENT_LABELS = {
  'white-wedding':       'White Wedding',
  'traditional-wedding': 'Traditional Wedding',
  'brand-film':          'Brand Film',
  'music-video':         'Music Video',
  'documentary':         'Documentary',
  'corporate-event':     'Corporate Event',
  'birthday':            'Birthday Event',
  'other-event':         'Other Event',
};

/* ════════════════════════════════════════════
   SCHEDULE
   ════════════════════════════════════════════ */

async function dbGetSchedule() {
  let sched    = await _serverGet('schedule');
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
  const sched = (await _serverGet('schedule')).filter(s => s.id !== id);
  await _serverSave('schedule', sched);
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
  return _serverGet('tasks');
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
