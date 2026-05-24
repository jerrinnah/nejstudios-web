/* ══════════════════════════════════════════════
   NEJstudios — Team Portal JS
   Auth: team member username+PIN
   Features: all tasks bar, my tasks, start/end, reports
   ══════════════════════════════════════════════ */

const TEAM_KEY    = 'nej_team';
const SESSION_KEY = 'nej_session';

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

const TEAM_DELETED_KEY   = 'nej_team_deleted';
const TEAM_OVERRIDES_KEY = 'nej_team_overrides';
function getDeletedTeamIds() {
  try { return JSON.parse(localStorage.getItem(TEAM_DELETED_KEY) || '[]'); } catch { return []; }
}
function getTeamOverrides() {
  try { return JSON.parse(localStorage.getItem(TEAM_OVERRIDES_KEY) || '{}'); } catch { return {}; }
}

// Merges hardcoded TEAM_CONFIG with overrides + admin-added members, filtering deleted IDs.
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

async function syncTeamFromServer() {
  try {
    const r = await fetch('/api/sync.php?resource=team_members', { cache: 'no-store' });
    if (r.ok) {
      const serverExtras = await r.json();
      if (Array.isArray(serverExtras) && serverExtras.length > 0) {
        const local = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
        const merged = [...local];
        serverExtras.forEach(m => {
          if (!merged.find(c => c.id === m.id)) merged.push(m);
        });
        localStorage.setItem(TEAM_KEY, JSON.stringify(merged));
      }
    }
  } catch { /* server unreachable */ }
  // Also sync deleted IDs
  try {
    const r = await fetch('/api/sync.php?resource=team_deleted', { cache: 'no-store' });
    if (r.ok) {
      const serverDeleted = await r.json();
      if (Array.isArray(serverDeleted) && serverDeleted.length > 0) {
        const local = getDeletedTeamIds();
        const merged = Array.from(new Set([...local, ...serverDeleted]));
        localStorage.setItem(TEAM_DELETED_KEY, JSON.stringify(merged));
      }
    }
  } catch {}
  // Sync overrides (salary etc.) for hardcoded members
  try {
    const r = await fetch('/api/sync.php?resource=team_overrides', { cache: 'no-store' });
    if (!r.ok) return;
    const server = await r.json();
    if (server && typeof server === 'object' && !Array.isArray(server)) {
      const local  = getTeamOverrides();
      const merged = { ...local, ...server };
      localStorage.setItem(TEAM_OVERRIDES_KEY, JSON.stringify(merged));
    }
  } catch {}
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
   BOOKING STORAGE (for walk-in bookings)
   ════════════════════════════════════════════ */
const STORAGE_KEY = 'nej_bookings';

function getBookings() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }

async function saveWalkinBooking(booking) {
  // Fetch server first so we don't overwrite other bookings
  let existing = [];
  try {
    const r = await fetch('/api/sync.php?resource=bookings', { cache: 'no-store' });
    if (r.ok) existing = await r.json();
  } catch { /* server unreachable */ }
  if (!Array.isArray(existing) || existing.length === 0) existing = getBookings();
  if (!existing.find(b => b.id === booking.id)) existing.unshift(booking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  // Push to server
  try {
    await fetch('/api/sync.php?resource=bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(existing),
    });
  } catch { /* saved locally */ }
}

function genBookingId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'NEJ-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
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
function fmtDate(ts)  { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'medium' }); }
function fmtTime(ts)  { if (!ts) return ''; return new Date(ts).toLocaleTimeString('en-NG', { timeStyle:'short' }); }
function fmtShort(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'short' }); }

/* ════════════════════════════════════════════
   CHECKLIST TEMPLATES
   ════════════════════════════════════════════ */
const CHECKLIST_TEMPLATES = {
  studio:     ['Camera bodies charged', 'Memory cards formatted', 'Lighting rigs set up', 'Backdrops ready', 'Props arranged', 'Release forms printed'],
  wedding:    ['Camera bodies charged', 'Backup camera ready', 'Flash units charged', 'Memory cards (x4 minimum)', 'Drone charged & permitted', 'Shot list printed', 'Venue scouted', 'Emergency kit packed'],
  event:      ['Camera bodies charged', 'Memory cards formatted', 'Lighting equipment', 'Audio recorder', 'Shot list confirmed', 'Parking arranged'],
  production: ['Camera bodies charged', 'Gimbal calibrated', 'Drone charged & permitted', 'Lights & diffusers', 'Audio kit checked', 'Script/shot list printed', 'Hard drives (2x backup)'],
  meeting:    ['Notebook & pen', 'Contract documents', 'Pricing guide', 'Portfolio samples'],
};

/* ════════════════════════════════════════════
   SESSION / CURRENT MEMBER
   ════════════════════════════════════════════ */
let currentMember = null; // populated after login / session restore
let activeTab     = 'schedule';
let _walkinInited = false;

/* ════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════ */
const loginGate     = document.getElementById('loginGate');
const teamShell     = document.getElementById('teamShell');
const mobileNav     = document.getElementById('mobileBottomNav');
const usernameInput = document.getElementById('usernameInput');
const pinInput      = document.getElementById('pinInput');
const loginBtn      = document.getElementById('loginBtn');
const loginErr      = document.getElementById('loginErr');

function getPortalGreeting(name, memberId) {
  const visitKey = 'nej_greeted_' + memberId;
  const idxKey   = visitKey + '_idx';
  const visited  = localStorage.getItem(visitKey);
  let msg, sub;
  if (visited) {
    const greetings = ['Howfar', 'Wida'];
    const idx = parseInt(localStorage.getItem(idxKey) || '0');
    const word = greetings[idx % 2];
    localStorage.setItem(idxKey, String((idx + 1) % 2));
    msg = `${word}, ${name}! 👋`;
    sub = 'Welcome back — here\'s what\'s coming up.';
  } else {
    localStorage.setItem(visitKey, '1');
    const h = new Date().getHours();
    const timeWord = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
    msg = `${timeWord}, ${name}! 👋`;
    sub = 'Here\'s what\'s coming up for you.';
  }
  return { msg, sub };
}

function renderPortalGreeting(member) {
  const el = document.getElementById('portalGreeting');
  if (!el) return;
  const { msg, sub } = getPortalGreeting(member.name, member.id);
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

function showPortal(member) {
  currentMember = member;
  loginGate.classList.add('hidden');
  teamShell.style.display = 'flex';
  mobileNav.classList.add('nav-active');
  document.getElementById('userBadgeName').textContent = member.name;
  renderPortalGreeting(member);
  // Fresh server fetch on login so tasks and schedule are always current
  dbRefreshAll();
  switchTab('schedule');
  updateBadges();
  requestNotifPermission();
  // Register this device with OneSignal under the member's ID
  oneSignalLogin(member.id);
  // Init notification bell after member is set
  initNotifBell();
  initImpromptuModal();
  initLeaveModal();
  renderMyLeaveRequests();
  renderTeamBookingsCalendar();
  // Schedule 11pm reminder if not yet signed in today
  scheduleSignInReminder(member);
}

function scheduleSignInReminder(member) {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return; // no reminder on weekends
  const target = new Date(now);
  target.setHours(11, 0, 0, 0); // 11am
  let delay = target - now;
  if (delay < 0) return; // already past 11am
  setTimeout(async () => {
    const todayDow = new Date().getDay();
    if (todayDow === 0 || todayDow === 6) return; // safety check at fire time
    const record = await dbGetTodaySignIn(member.id);
    if (!record) {
      notify('Sign-In Reminder', `${member.name}, you haven't signed in today. Please sign in before the day ends.`);
      // Also push via OneSignal so it arrives even if tab is closed
      if (window.OneSignalDeferred) {
        OneSignalDeferred.push(async function(OneSignal) {
          try {
            await OneSignal.Notifications.requestPermission();
            // Rely on the server-side push via notify.php for cross-device delivery
            await fetch('/api/notify.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                memberId: member.id,
                title:    'Sign-In Reminder',
                message:  `${member.name}, you haven't signed in today. Please sign in.`,
              }),
            }).catch(() => {});
          } catch {}
        });
      }
    }
  }, delay);
}

/* Link this browser/device to the team member's ID in OneSignal */
function oneSignalLogin(memberId) {
  if (!window.OneSignalDeferred) return;
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.login(memberId);
    } catch(e) { /* subscription may not be granted yet */ }
  });
}

function tryLogin() {
  const username = usernameInput.value.trim().toLowerCase();
  const pin      = pinInput.value.trim();
  if (!pin) { loginErr.textContent = 'Enter your PIN.'; return; }

  const team = getTeam();
  // Match by PIN alone, or PIN + username if username was provided
  const member = username
    ? team.find(m => m.pin === pin && m.username.toLowerCase() === username)
    : team.find(m => m.pin === pin);

  if (member) {
    loginErr.textContent = '';
    if (member.role === 'admin') {
      setSession({ role:'admin', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
      window.location.href = 'dashboard';
    } else {
      setSession({ role:'team', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
      showPortal(member);
    }
  } else {
    loginErr.textContent = 'PIN not recognised. Check with your admin.';
    pinInput.value = ''; pinInput.focus();
  }
}

loginBtn.addEventListener('click', tryLogin);
pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') pinInput.focus(); });

// Logout
function doLogout() { setSession(null); location.reload(); }
document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.getElementById('mobileLogout').addEventListener('click', doLogout);

// ── Handle admin-generated setup link: ?setup=BASE64 ──
(function handleSetupLink() {
  const params  = new URLSearchParams(location.search);
  const payload = params.get('setup');
  if (!payload) return;

  try {
    const creds = JSON.parse(atob(payload));
    if (!creds.id || !creds.pin) return;

    // Save member to this device's local team store
    const stored = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]');
    const exists = stored.find(m => m.id === creds.id);
    if (!exists) {
      stored.push({ id: creds.id, name: creds.name, username: creds.username || '', pin: creds.pin });
      localStorage.setItem(TEAM_KEY, JSON.stringify(stored));
    }

    // Auto-fill the PIN field and show a welcome message
    pinInput.value = creds.pin;
    loginErr.style.color = 'var(--green)';
    loginErr.textContent = `Welcome ${creds.name}! Your account is set up — click Sign In.`;

    // Clean the URL without reloading
    history.replaceState(null, '', location.pathname);
  } catch { /* malformed payload — ignore */ }
})();

// Sync server team data (members + overrides + deleted IDs) BEFORE restoring session
// so currentMember has the latest salary/role/overrides applied.
(async () => {
  await syncTeamFromServer().catch(() => {});

  const sess = getSession();
  if (sess && sess.role === 'team') {
    const team   = getTeam();
    const member = team.find(m => m.id === sess.memberId);
    if (member) {
      showPortal(member);
    } else if (sess.name && sess.memberId) {
      showPortal({ id: sess.memberId, name: sess.name, username: sess.username || '' });
    } else {
      setSession(null);
    }
  } else if (sess && sess.role === 'admin') {
    window.location.href = 'dashboard';
  }
})();

// Auto-refresh currentMember overrides every 60s while logged in,
// so a salary update from admin reflects without re-login
setInterval(async () => {
  if (!currentMember) return;
  await syncTeamFromServer().catch(() => {});
  const fresh = getTeam().find(m => m.id === currentMember.id);
  if (fresh) {
    currentMember = fresh;
    if (document.getElementById('salaryCard')) renderMyTasks().catch(() => {});
  }
}, 60000);

/* ════════════════════════════════════════════
   TAB SWITCHING
   ════════════════════════════════════════════ */
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.t-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.t-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'schedule')  renderSchedule();
  if (name === 'all-tasks') renderAllTasksBar();
  if (name === 'my-tasks')  renderMyTasks();
  if (name === 'signin')    renderSignIn();
  if (name === 'walkin')    { if (!_walkinInited) { initWalkinForm(); _walkinInited = true; } }
  if (name === 'summary')   renderSummaryPanel();
}

async function renderSummaryPanel() {
  if (!currentMember) return;
  // Hide empty-state initially; show after renders if none of the cards display
  const empty = document.getElementById('summaryEmptyState');
  if (empty) empty.style.display = 'none';
  await Promise.all([
    renderMonthlyDelivery(),
    renderSalaryCard(),
    renderDeductionsCard(),
  ]);
  // Show empty-state if nothing rendered
  if (empty) {
    const anyVisible = ['monthlyDeliveryCard', 'salaryCard', 'deductionsSummary']
      .some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
      });
    empty.style.display = anyVisible ? 'none' : 'block';
  }
}

document.querySelectorAll('.t-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

/* ════════════════════════════════════════════
   SCHEDULE
   ════════════════════════════════════════════ */
async function renderSchedule() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;

  grid.innerHTML = `<div class="sch-empty" style="opacity:0.5"><p style="color:var(--grey-3);font-size:0.85rem">Loading…</p></div>`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const shots    = (await dbGetSchedule()).slice().sort((a, b) => a.date.localeCompare(b.date));

  const upcoming = shots.filter(s => s.date >= todayStr);
  const past     = shots.filter(s => s.date < todayStr).slice(-5).reverse();

  if (shots.length === 0) {
    grid.innerHTML = `
      <div class="sch-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3>No upcoming shots yet</h3>
        <p>Ask your admin to add upcoming shoots and events.</p>
      </div>`;
    return;
  }

  const typeLabel = { studio:'Studio', wedding:'Wedding', event:'Event', production:'Production', meeting:'Meeting' };

  function buildCard(s, isPast) {
    const d       = new Date(s.date + 'T00:00:00');
    const day     = d.getDate();
    const month   = d.toLocaleString('en-NG', { month:'short' }).toUpperCase();
    const isToday = s.date === todayStr;
    const cls     = isToday ? 'sch-card--today' : (isPast ? 'sch-card--past' : '');
    const lbl     = typeLabel[s.type] || s.type;

    // Determine checklist items: saved items take priority, else use template
    const savedItems    = s.checklist && s.checklist.length > 0 ? s.checklist : null;
    const templateItems = CHECKLIST_TEMPLATES[s.type] || CHECKLIST_TEMPLATES['studio'];
    const rawItems      = savedItems
      ? savedItems
      : templateItems.map(text => ({ text, checked: false }));

    // Normalise items to { text, checked }
    const items = rawItems.map(item =>
      typeof item === 'string' ? { text: item, checked: false } : item
    );

    const doneCount  = items.filter(it => it.checked).length;
    const totalCount = items.length;
    const allDone    = doneCount === totalCount && totalCount > 0;
    const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const checklistHtml = `
      <div class="sch-checklist" id="checklist-${s.id}" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold)">Checklist</span>
          ${allDone ? `<span style="font-size:0.7rem;font-weight:700;color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:99px">All done ✓</span>` : `<span style="font-size:0.72rem;color:var(--grey-3)">${doneCount}/${totalCount}</span>`}
        </div>
        <div style="height:4px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:12px">
          <div style="height:100%;width:${pct}%;background:${allDone?'var(--green)':'var(--gold)'};border-radius:99px;transition:width 0.3s"></div>
        </div>
        <div class="sch-checklist-items" data-sched-id="${s.id}">
          ${items.map((item, idx) => `
            <label style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:0.82rem;color:${item.checked ? 'var(--grey-4)' : 'var(--grey-1)'};${item.checked ? 'text-decoration:line-through' : ''}">
              <input type="checkbox" data-item-idx="${idx}" data-sched-id="${s.id}" ${item.checked ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--gold);cursor:pointer;flex-shrink:0" />
              ${item.text}
            </label>`).join('')}
        </div>
      </div>`;

    return `
      <div class="sch-card ${cls}" data-sched-card="${s.id}">
        <div class="sch-date-block">
          <div class="sch-date-block__day">${day}</div>
          <div class="sch-date-block__month">${month}</div>
        </div>
        <div class="sch-body">
          <div class="sch-body__top">
            <span class="sch-type-badge sch-type--${s.type}">${lbl}</span>
            ${isToday ? '<span class="sch-today-pill">Today</span>' : ''}
          </div>
          <div class="sch-body__title">${s.title}</div>
          <div class="sch-body__meta">
            ${s.time       ? `<span>🕐 ${s.time}</span>`       : ''}
            ${s.clientName ? `<span>👤 ${s.type === 'wedding' ? 'Event: ' : ''}${s.clientName}</span>` : ''}
            ${s.planner    ? `<span>📋 Planner: ${s.planner}</span>` : ''}
            ${s.location   ? `<span>📍 ${s.location}</span>`   : ''}
            ${s.assignedMembers && s.assignedMembers.length ? (() => {
              const amIAssigned = currentMember && s.assignedMembers.find(m => m.id === currentMember.id);
              const names = s.assignedMembers.map(m => m.name).join(', ');
              return `<span style="${amIAssigned ? 'color:var(--gold);font-weight:600' : ''}">👥 ${names}${amIAssigned ? ' <span style="background:var(--gold-glow);border:1px solid rgba(201,168,76,.3);border-radius:4px;padding:1px 6px;font-size:0.65rem;margin-left:4px">You</span>' : ''}</span>`;
            })() : ''}
          </div>
          ${s.notes ? `<div class="sch-body__notes">${s.notes}</div>` : ''}
          ${s.deliverables ? `<div class="sch-body__notes" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px"><span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);display:block;margin-bottom:2px">Deliverables</span>${s.deliverables}</div>` : ''}
          ${(() => {
            if (!s.deadline) return '';
            const today    = new Date(); today.setHours(0,0,0,0);
            const deadDate = new Date(s.deadline + 'T00:00:00');
            const diffDays = Math.round((deadDate - today) / 86400000);
            const fmtDead  = deadDate.toLocaleDateString('en-NG', { dateStyle:'medium' });
            if (diffDays < 0)  return `<div style="margin-top:8px;padding:6px 10px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:6px;font-size:0.75rem;color:#f87171;font-weight:700">⚠ Delivery OVERDUE · ${fmtDead}</div>`;
            if (diffDays === 0) return `<div style="margin-top:8px;padding:6px 10px;background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.3);border-radius:6px;font-size:0.75rem;color:var(--amber);font-weight:700">⏰ Delivery DUE TODAY</div>`;
            if (diffDays <= 3)  return `<div style="margin-top:8px;padding:6px 10px;background:rgba(251,146,60,.07);border:1px solid rgba(251,146,60,.2);border-radius:6px;font-size:0.75rem;color:var(--amber)">Delivery in <strong>${diffDays}d</strong> · ${fmtDead}</div>`;
            return `<div style="margin-top:8px;padding:6px 10px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.75rem;color:var(--grey-3)">📦 Delivery: ${fmtDead}</div>`;
          })()}
          ${!(s.type === 'studio' && s.shootCompleted) ? `
          <button class="sch-checklist-toggle" data-toggle-id="${s.id}" style="margin-top:12px;width:100%;padding:7px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.72rem;font-weight:600;color:var(--grey-3);display:flex;align-items:center;justify-content:space-between;transition:var(--trans)">
            <span>Checklist ${doneCount > 0 ? `(${doneCount}/${totalCount})` : ''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          ${checklistHtml}` : ''}
          ${s.type === 'studio' ? (() => {
            if (s.shootCompleted) {
              const dateStr = s.shootCompletedAt ? ' · ' + new Date(s.shootCompletedAt).toLocaleDateString('en-NG', { dateStyle:'medium' }) : '';
              return '<div style="margin-top:14px;padding:12px 14px;background:var(--green-bg);border:1px solid rgba(62,207,142,.25);border-radius:8px">'
                + '<div style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--green);margin-bottom:8px">✓ Shoot Completed' + dateStr + '</div>'
                + (s.shootPictureCount ? '<div style="font-size:0.8rem;color:var(--grey-2);margin-bottom:4px">📷 <strong>' + s.shootPictureCount + '</strong> pictures</div>' : '')
                + (s.shootSelection ? '<div style="font-size:0.8rem;color:var(--grey-2);margin-bottom:4px">🎯 ' + s.shootSelection + '</div>' : '')
                + (s.shootFileNames ? '<div style="font-size:0.75rem;color:var(--grey-3);white-space:pre-wrap;margin-top:6px;padding-top:6px;border-top:1px solid rgba(62,207,142,.15)">📁 ' + s.shootFileNames + '</div>' : '')
                + '<button data-share-selection="' + s.id + '" style="margin-top:12px;width:100%;padding:8px 14px;background:transparent;border:1px solid var(--gold);color:var(--gold);border-radius:6px;font-size:0.75rem;font-weight:600;letter-spacing:0.04em;cursor:pointer;transition:0.2s" onmouseover="this.style.background=\'rgba(201,168,76,.1)\'" onmouseout="this.style.background=\'transparent\'">'
                + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:5px"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>'
                + ' Share Selection with Client</button>'
                + '</div>';
            }
            return '<button class="btn-complete" data-shoot-complete="' + s.id + '" style="margin-top:12px;width:100%;padding:9px 14px;background:transparent;border:1px solid var(--green);color:var(--green);border-radius:6px;font-size:0.78rem;font-weight:600;letter-spacing:0.04em;transition:var(--trans)" onmouseover="this.style.background=\'var(--green-bg)\'" onmouseout="this.style.background=\'transparent\'">'
              + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>'
              + ' Mark Shoot Done</button>';
          })() : ''}
        </div>
      </div>`;
  }

  let html = '';
  if (upcoming.length > 0) {
    html += upcoming.map(s => buildCard(s, false)).join('');
  } else {
    html += `<div class="sch-empty" style="padding:32px 0">
      <p style="color:var(--grey-3);font-size:0.85rem">No upcoming shots scheduled.</p>
    </div>`;
  }
  if (past.length > 0) {
    html += `<div class="sch-section-label">Past</div>`;
    html += past.map(s => buildCard(s, true)).join('');
  }

  grid.innerHTML = html;

  // Checklist toggle buttons
  grid.querySelectorAll('.sch-checklist-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggleId;
      const cl = document.getElementById('checklist-' + id);
      if (!cl) return;
      const open = cl.style.display === 'none' || cl.style.display === '';
      cl.style.display = open ? 'block' : 'none';
      btn.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
    });
  });

  // Checklist checkboxes
  grid.querySelectorAll('.sch-checklist-items input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const schedId  = cb.dataset.schedId;
      const itemIdx  = parseInt(cb.dataset.itemIdx, 10);
      const schedObj = shots.find(s => s.id === schedId);
      if (!schedObj) return;

      // Build normalised items array with saved data
      const templateItems = CHECKLIST_TEMPLATES[schedObj.type] || CHECKLIST_TEMPLATES['studio'];
      const rawItems      = schedObj.checklist && schedObj.checklist.length > 0
        ? schedObj.checklist
        : templateItems.map(text => ({ text, checked: false }));
      const items = rawItems.map(item =>
        typeof item === 'string' ? { text: item, checked: false } : { ...item }
      );

      items[itemIdx].checked = cb.checked;

      // Persist
      await dbUpdateScheduleChecklist(schedId, items);
      schedObj.checklist = items;

      // Update UI: progress bar, counter, label, allDone badge
      const container = cb.closest('.sch-checklist');
      const allItems  = Array.from(container.querySelectorAll('input[type=checkbox]'));
      const done      = allItems.filter(c => c.checked).length;
      const total     = allItems.length;
      const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
      const allDone   = done === total && total > 0;

      // Update progress bar
      const bar = container.querySelector('div[style*="height:4px"] > div');
      if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = allDone ? 'var(--green)' : 'var(--gold)';
      }

      // Update counter/badge
      const headerSpan = container.querySelector('div:first-child > span:last-child');
      if (headerSpan) {
        if (allDone) {
          headerSpan.textContent = 'All done ✓';
          headerSpan.style.cssText = 'font-size:0.7rem;font-weight:700;color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:99px';
        } else {
          headerSpan.textContent = `${done}/${total}`;
          headerSpan.style.cssText = 'font-size:0.72rem;color:var(--grey-3)';
        }
      }

      // Update toggle button label
      const card   = container.closest('[data-sched-card]');
      const toggle = card ? card.querySelector('.sch-checklist-toggle span') : null;
      if (toggle) toggle.textContent = `Checklist (${done}/${total})`;

      // Update label style
      cb.closest('label').style.color          = cb.checked ? 'var(--grey-4)' : 'var(--grey-1)';
      cb.closest('label').style.textDecoration = cb.checked ? 'line-through' : '';
    });
  });

  // Mark Shoot Done buttons (studio sessions only)
  grid.querySelectorAll('[data-shoot-complete]').forEach(btn => {
    btn.addEventListener('click', () => openShootCompleteModal(btn.dataset.shootComplete));
  });

  // Share selection with client
  grid.querySelectorAll('[data-share-selection]').forEach(btn => {
    btn.addEventListener('click', () => shareSelectionLink(btn.dataset.shareSelection, shots));
  });
}

/* ════════════════════════════════════════════
   ALL TASKS BAR
   ════════════════════════════════════════════ */
let barFilter = 'all';

document.querySelectorAll('[data-bar-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-bar-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    barFilter = btn.dataset.barFilter;
    renderAllTasksBar();
  });
});

async function renderAllTasksBar() {
  document.getElementById('allTasksBar').innerHTML = `<div class="tasks-bar-empty" style="opacity:0.5">Loading…</div>`;
  const allTasks = await dbGetTasks();
  let tasks = allTasks;
  if (barFilter !== 'all') tasks = tasks.filter(t => t.status === barFilter);

  const bar     = document.getElementById('allTasksBar');
  const countEl = document.getElementById('allTasksCount');

  countEl.textContent = allTasks.length + ' task' + (allTasks.length !== 1 ? 's' : '');

  if (tasks.length === 0) {
    bar.innerHTML = `<div class="tasks-bar-empty">No tasks${barFilter !== 'all' ? ' with status "' + barFilter + '"' : ''}</div>`;
    return;
  }

  bar.innerHTML = tasks.map(t => {
    const statusLabel = t.status === 'in-progress' ? 'In Progress'
      : t.status.charAt(0).toUpperCase() + t.status.slice(1);
    const mine = currentMember && t.assignedTo === currentMember.id;
    return `
      <div class="task-pill task-pill--${t.status}">
        <div class="task-pill__top">
          <div class="task-pill__title">${t.title}${mine ? ' <span style="color:var(--gold);font-size:0.6rem">(mine)</span>' : ''}</div>
          <span class="task-pill__status task-pill__status--${t.status}">${statusLabel}</span>
        </div>
        <div class="task-pill__meta">
          ${t.assignedName ? `👤 ${t.assignedName}` : 'Unassigned'}
          ${t.reports && t.reports.length > 0 ? ` · ${t.reports.length} report${t.reports.length > 1 ? 's' : ''}` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   MY TASKS
   ════════════════════════════════════════════ */
async function renderMyTasks() {
  if (!currentMember) return;
  document.getElementById('myTasksGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;opacity:0.5"><p style="color:var(--grey-3);font-size:0.85rem">Loading…</p></div>`;
  const myTasks   = (await dbGetTasks()).filter(t => t.assignedTo === currentMember.id);
  const grid      = document.getElementById('myTasksGrid');
  const total     = myTasks.length;
  const done      = myTasks.filter(t => t.status === 'completed').length;
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

  // Progress rate bar
  const rateWrap  = document.getElementById('taskRateWrap');
  const rateLabel = document.getElementById('taskRateLabel');
  const ratePct   = document.getElementById('taskRatePct');
  const rateFill  = document.getElementById('taskRateFill');
  if (rateWrap) {
    rateWrap.style.display = total > 0 ? '' : 'none';
    if (rateLabel) rateLabel.textContent = `${done} of ${total} task${total !== 1 ? 's' : ''} completed`;
    if (ratePct)   ratePct.textContent   = `${pct}%`;
    if (rateFill)  { setTimeout(() => { rateFill.style.width = pct + '%'; }, 80); }
  }

  // Month-end performance banner (show 3 days before end of month)
  const banner = document.getElementById('monthEndBanner');
  if (banner) {
    const today   = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - today.getDate();
    if (daysLeft <= 3 && total > 0) {
      const monthName = today.toLocaleDateString('en-NG', { month: 'long' });
      const inProg    = myTasks.filter(t => t.status === 'in-progress').length;
      const pending   = myTasks.filter(t => t.status === 'pending').length;
      banner.style.display = '';
      banner.innerHTML = `
        <div class="month-end-banner__title">📊 ${monthName} Performance — ${daysLeft === 0 ? 'Last day!' : daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + ' left'}</div>
        <div class="month-end-banner__body">
          You completed <span class="month-end-banner__stat">${done}/${total}</span> tasks this month
          (<span class="month-end-banner__stat" style="color:${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)'}">${pct}%</span>).
          ${inProg > 0 ? `&nbsp;<span style="color:var(--orange)">${inProg} still in progress.</span>` : ''}
          ${pending > 0 ? `&nbsp;<span style="color:var(--grey-3)">${pending} pending.</span>` : ''}
        </div>`;
    } else {
      banner.style.display = 'none';
    }
  }

  if (myTasks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <h3>No tasks assigned yet</h3>
        <p>Your admin will assign tasks to you. Check back soon.</p>
      </div>`;
    renderHelpWanted();
    renderBonusPoints();
    renderSharedTasks();
    return;
  }

  // Sort: in-progress, awaiting-approval, pending, completed
  const order = { 'in-progress': 0, 'awaiting-approval': 1, pending: 2, completed: 3 };
  myTasks.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  grid.innerHTML = myTasks.map(t => buildMyTaskCard(t)).join('');

  // Attach action listeners
  grid.querySelectorAll('[data-my-action]').forEach(btn => {
    btn.addEventListener('click', () => handleMyTaskAction(btn.dataset.id, btn.dataset.myAction));
  });

  // Render Help Wanted (overdue tasks from other members)
  renderHelpWanted();
  // Render bonus points summary
  renderBonusPoints();
  // Render shared tasks (any staff can claim)
  renderSharedTasks();
}

async function renderMonthlyDelivery() {
  const el = document.getElementById('monthlyDeliveryCard');
  if (!el || !currentMember) return;
  const d = await dbGetMemberMonthlyDelivery(currentMember.id);
  if (d.totalCreated === 0 && d.totalCompleted === 0 && d.bonusPoints === 0) { el.style.display = 'none'; return; }
  el.style.display = '';
  const monthName = new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  // Per-category rows: Created / Delivered for the month
  const allTypes = new Set([...Object.keys(d.createdByType), ...Object.keys(d.byType)]);
  const typeRows = Array.from(allTypes).sort().map(k => {
    const cr  = d.createdByType[k] || 0;
    const del = d.byType[k]        || 0;
    return `<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--grey-2);padding:4px 0"><span>${k}</span><strong style="color:var(--white)">${del} <span style="color:var(--grey-4);font-weight:400">delivered of ${cr}</span></strong></div>`;
  }).join('');

  // Delivered tasks list
  const fmtDateShort = (ts) => ts ? new Date(ts).toLocaleDateString('en-NG', { month:'short', day:'numeric' }) : '';
  const deliveredList = d.tasks.length ? d.tasks.map(t => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;margin-top:6px;font-size:0.76rem">
      <div style="min-width:0;flex:1">
        <div style="color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
        ${t.completedAt ? `<div style="color:var(--grey-4);font-size:0.66rem;margin-top:1px">Delivered ${fmtDateShort(t.completedAt)}</div>` : ''}
      </div>
      <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;color:${t.deliveryStatus==='approved'?'var(--green)':t.deliveryStatus==='failed'?'var(--red)':'var(--grey-3)'};margin-left:8px;flex-shrink:0">${t.deliveryStatus || 'pending'}</span>
    </div>`).join('') : '<div style="font-size:0.75rem;color:var(--grey-4);font-style:italic;padding:8px 0">No deliveries yet this month</div>';

  el.innerHTML = `
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--grey-3);margin-bottom:10px">Delivery Summary — ${monthName}</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">
      <div style="padding:12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center">
        <div style="font-size:1.5rem;color:var(--white);font-weight:700">${d.totalCreated}</div>
        <div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Assigned/Created</div>
      </div>
      <div style="padding:12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;text-align:center">
        <div style="font-size:1.5rem;color:var(--gold);font-weight:700">${d.totalCompleted}</div>
        <div style="font-size:0.65rem;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">Delivered</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
      <div style="padding:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;text-align:center">
        <div style="font-size:1rem;color:var(--green);font-weight:700">${d.approved}</div>
        <div style="font-size:0.58rem;color:var(--grey-3);text-transform:uppercase">Approved</div>
      </div>
      <div style="padding:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;text-align:center">
        <div style="font-size:1rem;color:var(--red);font-weight:700">${d.failed}</div>
        <div style="font-size:0.58rem;color:var(--grey-3);text-transform:uppercase">Failed</div>
      </div>
      <div id="unratedTile" style="padding:8px;background:var(--bg-2);border:1px solid var(--gold);border-radius:6px;text-align:center;cursor:pointer" title="Click to see all team deliveries this month">
        <div style="font-size:1rem;color:var(--gold);font-weight:700">${d.totalCompleted} <span style="color:var(--grey-4);font-weight:400">/ ${d.totalCreated}</span></div>
        <div style="font-size:0.58rem;color:var(--gold);text-transform:uppercase">Delivered / Assigned · View All</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--grey-2);padding:4px 0">
      <span>On-time</span><strong style="color:var(--green)">${d.onTime}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--grey-2);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:8px">
      <span>Late</span><strong style="color:var(--red)">${d.late}</strong>
    </div>
    <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-3);margin-bottom:4px">By Category (Delivered / Assigned)</div>
    ${typeRows || '<div style="font-size:0.75rem;color:var(--grey-4);font-style:italic">No tasks yet</div>'}
    <div style="font-size:0.62rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--grey-3);margin:14px 0 4px">Delivered Tasks This Month</div>
    ${deliveredList}
    ${d.bonusPoints ? `<div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:8px;border-top:1px solid var(--border)"><span style="font-size:0.85rem;color:var(--gold);font-weight:600">Bonus points earned this month</span><strong style="color:var(--gold);font-size:1rem">+${d.bonusPoints}</strong></div>` : ''}
  `;
  document.getElementById('unratedTile')?.addEventListener('click', () => openAllDeliveriesModal());
}

async function renderSharedTasks() {
  const wrap = document.getElementById('sharedTasksSection');
  if (!wrap || !currentMember) return;
  const all = await dbGetTasks();
  const shared = all.filter(t => t.sharedTask && !t.assignedTo && t.status !== 'completed');
  if (!shared.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const grid = document.getElementById('sharedTasksGrid');
  grid.innerHTML = shared.map(t => `
    <div class="my-task-card" style="border-color:rgba(74,222,128,0.3);background:rgba(74,222,128,0.05)">
      <div class="my-task-card__top">
        <div class="my-task-card__badges">
          <span class="priority-badge priority-badge--${t.priority || 'medium'}">${t.priority || 'medium'}</span>
          <span class="status-badge" style="background:rgba(74,222,128,0.18);color:#4ade80">SHARED</span>
        </div>
      </div>
      <div class="my-task-card__title">${esc(t.title)}</div>
      ${t.desc ? `<div class="my-task-card__desc">${esc(t.desc)}</div>` : ''}
      <div class="my-task-card__timestamps">
        ${t.deadline ? `<div class="ts-row">Due: <strong>${esc(t.deadline)}</strong></div>` : ''}
      </div>
      <div class="my-task-card__actions">
        <button class="btn-start" data-claim-id="${t.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
          Claim This Task
        </button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-claim-id]').forEach(btn => {
    btn.addEventListener('click', () => claimSharedTask(btn.dataset.claimId));
  });
}

async function claimSharedTask(taskId) {
  if (!currentMember) return;
  await dbUpdateTask(taskId, { assignedTo: currentMember.id, assignedName: currentMember.name });
  showToast('Task claimed — added to your list ✓');
  renderMyTasks();
}

async function renderHelpWanted() {
  const wrap = document.getElementById('helpWantedSection');
  if (!wrap || !currentMember) return;
  const overdue = await dbGetOverdueTasksForOthers(currentMember.id);
  console.log('[Help Wanted] overdue tasks for others:', overdue.length, overdue);
  if (!overdue.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const cards = overdue.map(t => {
    const myReq = (t.takeoverRequests || []).find(r => r.requesterId === currentMember.id);
    const pending = myReq && myReq.status === 'pending';
    return `
      <div class="my-task-card" style="border-color:var(--orange);background:rgba(255,168,76,0.05)">
        <div class="my-task-card__top">
          <div class="my-task-card__badges">
            <span class="priority-badge priority-badge--${t.priority || 'medium'}">${t.priority || 'medium'}</span>
            <span class="status-badge" style="background:rgba(255,80,80,0.15);color:var(--red)">OVERDUE</span>
          </div>
        </div>
        <div class="my-task-card__title">${esc(t.title)}</div>
        ${t.desc ? `<div class="my-task-card__desc">${esc(t.desc)}</div>` : ''}
        <div class="my-task-card__timestamps">
          <div class="ts-row">Assigned to: <strong>${esc(t.assignedName || 'Unassigned')}</strong></div>
          <div class="ts-row">Due: <strong style="color:var(--red)">${esc(t.deadline || t.dueDate || 'No date')}</strong></div>
        </div>
        <div class="my-task-card__actions">
          ${pending
            ? `<button class="btn-report" disabled style="opacity:0.6">⏳ Request Pending</button>`
            : `<button class="btn-start" data-takeover-id="${t.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Request to Take Over</button>`}
        </div>
      </div>`;
  }).join('');
  document.getElementById('helpWantedGrid').innerHTML = cards;
  document.querySelectorAll('[data-takeover-id]').forEach(btn => {
    btn.addEventListener('click', () => requestTakeover(btn.dataset.takeoverId));
  });
}

async function requestTakeover(taskId) {
  if (!currentMember) return;
  const result = await dbRequestTaskTakeover(taskId, currentMember);
  if (result.error) { showToast(result.error, 'err'); return; }
  // Notify the original assignee
  if (result.task && result.task.previousAssignedTo !== currentMember.id) {
    const origId = result.task.assignedTo;
    pushNotifToMember(origId, {
      type: 'task-takeover-request',
      title: 'Task Takeover Request',
      message: `${currentMember.name} wants to take over: "${result.task.title}". Open Tasks to approve.`,
      taskId, requesterId: currentMember.id, ts: Date.now(),
    });
  }
  showToast('Request sent — waiting for assignee to release the task.');
  renderHelpWanted();
}

async function renderBonusPoints() {
  const el = document.getElementById('bonusPointsCard');
  if (!el || !currentMember) return;
  const pts = await dbGetMemberPoints(currentMember.id);
  if (!pts.total) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = `
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--grey-3);margin-bottom:6px">Bonus Points</div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:0.85rem;color:var(--grey-2)">For taken-over tasks completed within 3 days</span>
      <strong style="color:var(--gold);font-size:1.2rem">+${pts.total}</strong>
    </div>`;
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ════════════════════════════════════════════
   BOOKINGS CALENDAR (read-only for team)
   ════════════════════════════════════════════ */
let _tCalCursor = new Date(); _tCalCursor.setDate(1);

const T_EVENT_LABELS = {
  'brand-film':'Brand Film','music-video':'Music Video','documentary':'Documentary',
  'corporate-event':'Corporate Event','other-production':'Production',
  'traditional-wedding':'Traditional Wedding','white-wedding':'White Wedding',
  'full-wedding':'Full Wedding','engagement':'Engagement',
  'funeral':'Funeral','service-of-songs':'Service of Songs',
  'birthday':'Birthday','other-event':'Event',
};

function _tBookingDate(b) {
  if (b.bookingKind === 'studio') return b.shootDate || b.preferredDate || '';
  return b.eventDate || '';
}

function _tBookingLabel(b) {
  if (b.bookingKind === 'studio') return b.sessionType ? `${b.clientName} — ${b.sessionType}` : (b.clientName || 'Studio');
  return b.clientName || 'Event';
}

async function renderTeamBookingsCalendar() {
  const grid       = document.getElementById('tBookingsCalendar');
  const monthLabel = document.getElementById('tCalMonthLabel');
  if (!grid) return;

  const year  = _tCalCursor.getFullYear();
  const month = _tCalCursor.getMonth();
  monthLabel.textContent = _tCalCursor.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

  let bookings = [];
  try {
    bookings = (await dbFetchBookings()).filter(b => !b.deletedAt);
  } catch {}
  const byDate = {};
  bookings.forEach(b => {
    const d = _tBookingDate(b);
    if (!d) return;
    (byDate[d] = byDate[d] || []).push(b);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const lastDate       = new Date(year, month + 1, 0).getDate();
  const todayStr       = new Date().toISOString().slice(0,10);

  let html = `<div style="display:grid;grid-template-columns:repeat(7,1fr);background:var(--border);gap:1px">`;
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    html += `<div style="background:var(--bg-3);padding:6px 4px;text-align:center;font-size:0.62rem;font-weight:700;color:var(--grey-3);text-transform:uppercase;letter-spacing:0.06em">${d}</div>`;
  });
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += `<div style="background:var(--bg-2);min-height:60px"></div>`;
  }
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const list    = byDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const dots = list.slice(0, 3).map(b => {
      const color = b.status === 'pending' ? '#f87171'
        : b.bookingKind === 'studio' ? 'var(--gold)' : '#4ade80';
      return `<div style="font-size:0.6rem;background:rgba(255,255,255,0.04);border-left:2px solid ${color};color:var(--white);padding:1px 4px;margin-bottom:1px;border-radius:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(_tBookingLabel(b))}</div>`;
    }).join('');
    const more = list.length > 3 ? `<div style="font-size:0.58rem;color:var(--grey-3);padding:0 4px">+${list.length - 3}</div>` : '';
    const booked = list.length > 0;
    const bg = booked ? 'rgba(230,57,70,0.45)' : 'var(--bg-2)';
    html += `
      <div data-tday="${dateStr}" style="background:${bg};min-height:60px;padding:4px;cursor:pointer;${isToday ? 'box-shadow:inset 0 0 0 1px var(--gold)' : ''}">
        <div style="font-size:0.7rem;font-weight:600;color:${isToday ? 'var(--gold)' : 'var(--white)'};margin-bottom:3px">${day}</div>
        ${dots}${more}
      </div>`;
  }
  const totalCells = firstDayOfWeek + lastDate;
  const trail = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < trail; i++) html += `<div style="background:var(--bg-2);min-height:60px"></div>`;
  html += `</div>`;
  grid.innerHTML = html;

  grid.querySelectorAll('[data-tday]').forEach(cell => {
    cell.addEventListener('click', () => renderTeamCalDayDetail(cell.dataset.tday, byDate[cell.dataset.tday] || []));
  });
}

function renderTeamCalDayDetail(dateStr, list) {
  const wrap = document.getElementById('tCalDayDetail');
  if (!wrap) return;
  const fmt = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NG', { weekday:'long', month:'long', day:'numeric' });
  if (!list.length) {
    wrap.style.display = 'block';
    wrap.innerHTML = `<strong style="font-size:0.85rem;color:var(--white)">${fmt}</strong><p style="color:var(--grey-3);font-size:0.78rem;margin:6px 0 0 0">No bookings — date is available ✓</p>`;
    return;
  }
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <strong style="font-size:0.85rem;color:var(--white);display:block;margin-bottom:8px">${fmt} — ${list.length} booking${list.length>1?'s':''}</strong>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${list.map(b => {
        const color = b.status === 'pending' ? '#f87171' : b.bookingKind === 'studio' ? 'var(--gold)' : '#4ade80';
        const subtype = b.sessionType || T_EVENT_LABELS[b.eventType] || b.eventType || '';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-3);border:1px solid var(--border);border-left:3px solid ${color};border-radius:6px">
            <div>
              <div style="font-size:0.8rem;font-weight:600;color:var(--white)">${esc(b.clientName)}</div>
              <div style="font-size:0.68rem;color:var(--grey-3);margin-top:2px">${esc(subtype)} ${b.location ? '· ' + esc(b.location) : ''}</div>
            </div>
            <span style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${color}">${b.status}</span>
          </div>`;
      }).join('')}
    </div>`;
}

document.getElementById('tCalPrev')?.addEventListener('click', () => { _tCalCursor.setMonth(_tCalCursor.getMonth() - 1); renderTeamBookingsCalendar(); });
document.getElementById('tCalNext')?.addEventListener('click', () => { _tCalCursor.setMonth(_tCalCursor.getMonth() + 1); renderTeamBookingsCalendar(); });
document.getElementById('tCalToday')?.addEventListener('click', () => { _tCalCursor = new Date(); _tCalCursor.setDate(1); renderTeamBookingsCalendar(); });

function buildMyTaskCard(t) {
  const prClass     = t.priority || 'medium';
  const reportCount = t.reports ? t.reports.length : 0;
  const lastReport  = reportCount > 0 ? t.reports[reportCount - 1] : null;

  const canStart    = t.status === 'pending';
  const canComplete = t.status === 'in-progress';
  const isCompleted = t.status === 'completed';

  const statusLabel = t.status === 'in-progress' ? 'In Progress'
    : t.status === 'awaiting-approval' ? 'Awaiting Approval'
    : t.status.charAt(0).toUpperCase() + t.status.slice(1);

  return `
    <div class="my-task-card my-task-card--${t.status}">
      <div class="my-task-card__top">
        <div class="my-task-card__badges">
          <span class="priority-badge priority-badge--${prClass}">${t.priority || 'medium'}</span>
          <span class="status-badge status-badge--${t.status}">${statusLabel}</span>
          ${t.impromptu ? '<span class="status-badge" style="background:rgba(168,85,247,0.18);color:#c4a4f8">SELF-ADDED</span>' : ''}
          ${t.doneByBoss ? `<span class="status-badge" style="background:rgba(201,168,76,0.18);color:var(--gold)">${esc(t.doneByBoss)} HANDLED</span>` : ''}
        </div>
      </div>

      <div class="my-task-card__title">${t.title}</div>
      ${t.desc ? `<div class="my-task-card__desc">${t.desc}</div>` : ''}

      <div class="my-task-card__timestamps">
        <div class="ts-row">Created: <strong>${fmtShort(t.createdAt)}</strong></div>
        ${t.startedAt   ? `<div class="ts-row">Started: <strong>${fmtDate(t.startedAt)} ${fmtTime(t.startedAt)}</strong></div>` : ''}
        ${t.completedAt ? `<div class="ts-row">Completed: <strong>${fmtDate(t.completedAt)} ${fmtTime(t.completedAt)}</strong></div>` : ''}
      </div>

      <div class="my-task-card__actions">
        ${canStart    ? `<button class="btn-start" data-id="${t.id}" data-my-action="start"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Task</button>` : ''}
        ${canComplete ? `<button class="btn-complete" data-id="${t.id}" data-my-action="complete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Complete Task</button>` : ''}
        ${!isCompleted ? `<button class="btn-report" data-id="${t.id}" data-my-action="report"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Write Report</button>` : ''}
        ${isCompleted  ? `<button class="btn-report" data-id="${t.id}" data-my-action="report"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View Reports</button>` : ''}
      </div>

      ${reportCount > 0 ? `
        <div class="reports-count">${reportCount} progress report${reportCount > 1 ? 's' : ''}</div>
        ${lastReport ? `<div class="last-report-preview">"${lastReport.content.slice(0, 90)}${lastReport.content.length > 90 ? '…' : ''}"</div>` : ''}
      ` : ''}
    </div>`;
}

function handleMyTaskAction(id, action) {
  if (action === 'start')    { startTask(id); return; }
  if (action === 'complete') { completeTask(id); return; }
  if (action === 'report')   { openReportModal(id); return; }
}

async function startTask(id) {
  const task = await dbGetTask(id);
  if (!task || task.status !== 'pending') return;
  await dbUpdateTask(id, { status: 'in-progress', started_at: Date.now() });
  renderMyTasks();
  renderAllTasksBar();
  updateBadges();
  showToast('Task started — good luck!');
}

async function pushNotifToMember(memberId, notif) {
  const n = { ...notif, id: 'N-' + Date.now() + '-' + Math.random().toString(36).slice(2,5), read: false, ts: notif.ts || Date.now() };
  try {
    const r   = await fetch('/api/sync.php?resource=notifications', { cache: 'no-store' });
    let all   = r.ok ? await r.json() : {};
    if (Array.isArray(all)) all = {};
    const pool = Array.isArray(all[memberId]) ? all[memberId] : [];
    pool.push(n);
    all[memberId] = pool;
    await fetch('/api/sync.php?resource=notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(all),
    });
  } catch {}
}

async function completeTask(id) {
  const task = await dbGetTask(id);
  if (!task || task.status !== 'in-progress') return;

  // Impromptu (self-created) tasks need admin approval before going to completed
  if (task.impromptu) {
    await dbUpdateTask(id, { status: 'awaiting-approval', submittedForApprovalAt: Date.now() });
    // Notify all admins
    const admins = getTeam().filter(m => m.role === 'admin');
    admins.forEach(a => {
      pushNotifToMember(a.id, {
        type: 'task-awaiting-approval',
        title: 'Task Needs Approval',
        message: `${currentMember.name} completed an impromptu task: "${task.title}". Open Dashboard to approve.`,
        taskId: id, ts: Date.now(),
      });
    });
    renderMyTasks();
    renderAllTasksBar();
    updateBadges();
    showToast('Task submitted for admin approval ✓');
    return;
  }

  await dbUpdateTask(id, { status: 'completed', completed_at: Date.now() });
  const updated = await dbGetTask(id);
  const bonus   = await dbAwardTakeoverBonusIfEligible(updated);
  renderMyTasks();
  renderAllTasksBar();
  updateBadges();
  if (currentMember) {
    const allMembers = getTeam().filter(m => m.id !== currentMember.id);
    allMembers.forEach(m => {
      pushNotifToMember(m.id, {
        type: 'task-completed',
        title: 'Task Completed',
        message: `${currentMember.name} completed: "${task.title}"`,
        taskId: id, ts: Date.now(),
      });
    });
  }
  showToast(bonus ? `Task completed! 🎉 +${bonus} bonus points awarded.` : 'Task completed!');
}

/* ════════════════════════════════════════════
   LEAVE REQUEST — team member requests leave/excuse
   ════════════════════════════════════════════ */
function initLeaveModal() {
  const btn    = document.getElementById('btnRequestLeave');
  const modal  = document.getElementById('leaveModal');
  const close  = document.getElementById('leaveCloseBtn');
  const submit = document.getElementById('leaveSubmitBtn');
  if (!btn || !modal) return;

  const openModal = () => {
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('leaveStartDate').value = today;
    document.getElementById('leaveEndDate').value   = today;
    document.getElementById('leaveReason').value    = '';
    modal.style.display = 'flex';
  };
  const closeModal = () => { modal.style.display = 'none'; };

  btn.addEventListener('click', openModal);
  close?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  submit?.addEventListener('click', async () => {
    if (!currentMember) return;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate   = document.getElementById('leaveEndDate').value;
    const reason    = document.getElementById('leaveReason').value.trim();
    if (!startDate || !endDate) { showToast('Pick both start and end dates', 'err'); return; }
    if (endDate < startDate)    { showToast('End date must be after start date', 'err'); return; }
    submit.disabled = true; submit.textContent = 'Submitting…';
    try {
      await dbAddLeaveRequest(currentMember, startDate, endDate, reason);
    } catch (e) {
      submit.disabled = false; submit.textContent = 'Submit Request';
      showToast('Submission failed — ' + (e.message || 'check your connection'), 'err');
      return;
    }
    // Notify admins
    const admins = getTeam().filter(m => m.role === 'admin');
    admins.forEach(a => pushNotifToMember(a.id, {
      type: 'leave-request',
      title: 'Leave Request',
      message: `${currentMember.name} requested leave ${startDate} → ${endDate}. Open Dashboard to approve.`,
      ts: Date.now(),
    }));
    submit.disabled = false; submit.textContent = 'Submit Request';
    closeModal();
    showToast('Leave request submitted ✓');
    renderMyLeaveRequests();
  });
}

async function renderMyLeaveRequests() {
  const wrap = document.getElementById('myLeaveRequests');
  if (!wrap || !currentMember) return;
  const all = await dbGetLeaveRequests();
  const mine = all.filter(e => e.memberId === currentMember.id).sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 6);
  if (!mine.length) { wrap.innerHTML = '<div style="font-size:0.78rem;color:var(--grey-4);padding:6px 0">No leave requests yet</div>'; return; }
  wrap.innerHTML = mine.map(e => {
    const color = e.status === 'approved' ? 'var(--green)' : e.status === 'rejected' ? 'var(--red)' : 'var(--gold)';
    return `
      <div style="padding:10px 12px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;color:var(--white)">${esc(e.startDate)} → ${esc(e.endDate)}</div>
          ${e.reason ? `<div style="font-size:0.72rem;color:var(--grey-3);margin-top:2px">"${esc(e.reason)}"</div>` : ''}
        </div>
        <span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;color:${color};letter-spacing:0.08em">${esc(e.status)}</span>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   IMPROMPTU TASK MODAL — team member creates own task
   ════════════════════════════════════════════ */
function initImpromptuModal() {
  const btn    = document.getElementById('btnAddImpromptu');
  const modal  = document.getElementById('impromptuModal');
  const close  = document.getElementById('impromptuCloseBtn');
  const submit = document.getElementById('impromptuSubmit');
  if (!btn || !modal) return;

  const openModal = () => {
    document.getElementById('impromptuTitle').value    = '';
    document.getElementById('impromptuDesc').value     = '';
    document.getElementById('impromptuPriority').value = 'medium';
    document.getElementById('impromptuDeadline').value = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('impromptuTitle').focus(), 100);
  };
  const closeModal = () => { modal.style.display = 'none'; };

  btn.addEventListener('click', openModal);
  close?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  submit?.addEventListener('click', async () => {
    if (!currentMember) return;
    const title    = document.getElementById('impromptuTitle').value.trim();
    const desc     = document.getElementById('impromptuDesc').value.trim();
    const priority = document.getElementById('impromptuPriority').value;
    const deadline = document.getElementById('impromptuDeadline').value || null;
    if (!title) { showToast('Title is required', 'err'); return; }

    const task = {
      id:           'TASK-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      title, desc,
      assignedTo:   currentMember.id,
      assignedName: currentMember.name,
      createdBy:    currentMember.id,
      createdByName: currentMember.name,
      impromptu:    true,
      priority,
      deadline,
      status:       'pending',
      createdAt:    Date.now(),
      startedAt:    null,
      completedAt:  null,
      reports:      [],
    };

    submit.disabled = true;
    submit.textContent = 'Adding…';
    await dbAddTask(task);
    submit.disabled = false;
    submit.textContent = 'Add Task';
    closeModal();
    showToast('Task added to your list ✓');
    renderMyTasks();
    updateBadges();
  });
}

/* ════════════════════════════════════════════
   REPORT MODAL
   ════════════════════════════════════════════ */
const reportModal         = document.getElementById('reportModal');
const reportModalBackdrop = document.getElementById('reportModalBackdrop');
const reportModalClose    = document.getElementById('reportModalClose');
const reportModalTitle    = document.getElementById('reportModalTitle');
const reportModalSubtitle = document.getElementById('reportModalSubtitle');
const reportTextarea      = document.getElementById('reportTextarea');
const submitReportBtn     = document.getElementById('submitReportBtn');
const pastReportsList     = document.getElementById('pastReportsList');

let activeReportTaskId = null;

async function openReportModal(taskId) {
  const task = await dbGetTask(taskId);
  if (!task) return;

  activeReportTaskId = taskId;
  reportModalTitle.textContent    = task.title;
  reportModalSubtitle.textContent = `Task ID: ${taskId} · Status: ${task.status}`;
  reportTextarea.value            = '';

  // Hide write section for completed tasks
  const formSection = reportModal.querySelector('.report-form-section');
  if (task.status === 'completed') {
    formSection.style.display = 'none';
  } else {
    formSection.style.display = '';
  }

  renderPastReports(task);
  reportModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (task.status !== 'completed') reportTextarea.focus();
}

function renderPastReports(task) {
  const reports = task.reports || [];
  if (reports.length === 0) {
    pastReportsList.innerHTML = `<div class="no-reports">No reports yet. Write your first update above.</div>`;
    return;
  }
  pastReportsList.innerHTML = `<div class="reports-list">${
    [...reports].reverse().map(r => `
      <div class="report-item">
        <div class="report-item__header">
          <span class="report-item__author">${r.memberName}</span>
          <span class="report-item__date">${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</span>
        </div>
        <div class="report-item__body">${r.content}</div>
      </div>`).join('')
  }</div>`;
}

submitReportBtn.addEventListener('click', async () => {
  const content = reportTextarea.value.trim();
  if (!content) { reportTextarea.focus(); return; }
  if (!currentMember || !activeReportTaskId) return;

  const task = await dbGetTask(activeReportTaskId);
  if (!task) return;

  const reports = [...(task.reports || []), {
    memberId:   currentMember.id,
    memberName: currentMember.name,
    content,
    createdAt:  Date.now(),
  }];

  await dbUpdateTask(activeReportTaskId, { reports });
  reportTextarea.value = '';
  renderPastReports({ ...task, reports });
  renderMyTasks();
  showToast('Report submitted');
});

function closeReportModal() {
  reportModal.classList.remove('open');
  document.body.style.overflow = '';
  activeReportTaskId = null;
}

reportModalClose.addEventListener('click', closeReportModal);
reportModalBackdrop.addEventListener('click', closeReportModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeReportModal(); });

/* ════════════════════════════════════════════
   BADGES
   ════════════════════════════════════════════ */
async function updateBadges() {
  const [allTasks, schedule] = await Promise.all([dbGetTasks(), dbGetSchedule()]);

  // Schedule badge: count today's shots
  const todayStr   = new Date().toISOString().slice(0, 10);
  const todayCount = schedule.filter(s => s.date === todayStr).length;
  const schBadge   = document.getElementById('scheduleBadge');
  schBadge.textContent = todayCount;
  schBadge.classList.toggle('hidden', todayCount === 0);

  // All tasks badge: count pending
  const pendingCount = allTasks.filter(t => t.status === 'pending').length;
  const allBadge     = document.getElementById('allTasksBadge');
  allBadge.textContent = pendingCount;
  allBadge.classList.toggle('hidden', pendingCount === 0);

  // My tasks badge: count my active tasks
  if (currentMember) {
    const myActive = allTasks.filter(t => t.assignedTo === currentMember.id && t.status !== 'completed').length;
    const myBadge  = document.getElementById('myTasksBadge');
    myBadge.textContent = myActive;
    myBadge.classList.toggle('hidden', myActive === 0);
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
   IN-APP NOTIFICATIONS  (server-synced)
   ════════════════════════════════════════════ */
const NOTIF_KEY_PREFIX = 'nej_notif_';
let _cachedNotifs = null; // in-memory cache for current session

async function fetchServerNotifs() {
  try {
    const r  = await fetch('/api/sync.php?resource=notifications', { cache: 'no-store' });
    let all  = r.ok ? await r.json() : {};
    // Guard: if server returned an array (legacy/empty), convert to object
    if (Array.isArray(all)) all = {};
    const mine = Array.isArray(all[currentMember.id]) ? all[currentMember.id] : [];
    _cachedNotifs = mine;
    return mine;
  } catch {
    // Fall back to localStorage if server unreachable
    _cachedNotifs = JSON.parse(localStorage.getItem(NOTIF_KEY_PREFIX + currentMember.id) || '[]');
    return _cachedNotifs;
  }
}

async function saveServerNotifs(notifs) {
  try {
    const r  = await fetch('/api/sync.php?resource=notifications', { cache: 'no-store' });
    let all  = r.ok ? await r.json() : {};
    if (Array.isArray(all)) all = {};
    all[currentMember.id] = notifs;
    await fetch('/api/sync.php?resource=notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(all),
    });
    _cachedNotifs = notifs;
  } catch {
    localStorage.setItem(NOTIF_KEY_PREFIX + currentMember.id, JSON.stringify(notifs));
    _cachedNotifs = notifs;
  }
}

function getMyNotifications() {
  // Return cached — refreshed async by renderNotifPanel
  return _cachedNotifs || [];
}

async function markAllNotifsRead() {
  if (!currentMember) return;
  const notifs = getMyNotifications().map(n => ({ ...n, read: true }));
  await saveServerNotifs(notifs);
  renderNotifPanel();
}

async function clearAllNotifs() {
  if (!currentMember) return;
  await saveServerNotifs([]);
  renderNotifPanel();
}

async function renderNotifPanel() {
  // Always fetch fresh from server
  const notifs = currentMember ? await fetchServerNotifs() : [];
  const unread = notifs.filter(n => !n.read).length;
  const dot    = document.getElementById('notifDot');
  const list   = document.getElementById('notifList');
  if (dot) { dot.classList.toggle('visible', unread > 0); }

  if (!list) return;
  if (notifs.length === 0) {
    list.innerHTML = '<div class="notif-panel__empty">No notifications</div>';
    return;
  }

  const icons = { 'task-assigned': '📋', 'task-completed': '✅', 'booking-assigned': '📸', 'delivery-approved': '✅', 'delivery-failed': '⚠️', 'task-takeover-request': '🤝', 'task-released': '✅', default: '🔔' };
  list.innerHTML = [...notifs].reverse().map(n => {
    const isTakeover = n.type === 'task-takeover-request' && n.taskId && n.requesterId;
    const actions = isTakeover ? `
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn-start" data-takeover-approve="${n.taskId}" data-requester="${n.requesterId}" style="font-size:0.72rem;padding:6px 10px">Release Task</button>
        <button class="btn-report" data-takeover-reject="${n.taskId}" data-requester="${n.requesterId}" style="font-size:0.72rem;padding:6px 10px">Reject</button>
      </div>` : '';
    return `
    <div class="notif-item${n.read ? '' : ' unread'}">
      <div class="notif-item__icon">${icons[n.type] || icons.default}</div>
      <div>
        <div class="notif-item__title">${n.title || 'Notification'}</div>
        <div>${n.message || ''}</div>
        <div class="notif-item__time">${n.ts ? new Date(n.ts).toLocaleString('en-NG', { dateStyle:'short', timeStyle:'short' }) : ''}</div>
        ${actions}
      </div>
    </div>`;
  }).join('');

  // Wire takeover approve/reject buttons
  list.querySelectorAll('[data-takeover-approve]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId      = btn.dataset.takeoverApprove;
      const requesterId = btn.dataset.requester;
      if (!confirm('Release this task to the requesting team member?')) return;
      const result = await dbApproveTaskTakeover(taskId, requesterId);
      if (result.error) { showToast(result.error, 'err'); return; }
      pushNotifToMember(requesterId, {
        type: 'task-released',
        title: 'Task Released to You',
        message: `${currentMember.name} released "${result.task.title}" to you. Complete within 3 days for +5 bonus points!`,
        taskId, ts: Date.now(),
      });
      showToast('Task released ✓');
      renderMyTasks();
      renderNotifPanel();
    });
  });
  list.querySelectorAll('[data-takeover-reject]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId      = btn.dataset.takeoverReject;
      const requesterId = btn.dataset.requester;
      await dbRejectTaskTakeover(taskId, requesterId);
      pushNotifToMember(requesterId, {
        type: 'task-takeover-request',
        title: 'Takeover Request Declined',
        message: `Your request to take over a task was declined.`,
        taskId, ts: Date.now(),
      });
      showToast('Request rejected');
      renderNotifPanel();
    });
  });
}

function initNotifBell() {
  const bell  = document.getElementById('notifBell');
  const panel = document.getElementById('notifPanel');
  const clear = document.getElementById('notifClearBtn');

  if (!bell || !currentMember) return;
  bell.style.display = 'flex';

  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    if (open) {
      await renderNotifPanel();
      await markAllNotifsRead();
    }
  });
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== bell) {
      panel.classList.remove('open');
    }
  });
  if (clear) clear.addEventListener('click', clearAllNotifs);

  // Fetch from server then show toast for unread
  fetchServerNotifs().then(notifs => {
    renderNotifPanel();
    const unread = notifs.filter(n => !n.read);
    if (unread.length > 0) {
      showToast(`You have ${unread.length} new notification${unread.length > 1 ? 's' : ''}`);
      const latest = [...unread].reverse()[0];
      if (latest) notify(latest.title || 'NEJstudios', latest.message || '');
    }
  });
}

/* ════════════════════════════════════════════
   REAL-TIME SYNC
   ════════════════════════════════════════════ */
window.addEventListener('storage', e => {
  if (!currentMember) return;
  if (e.key === TEAM_KEY) {
    const team   = getTeam();
    const exists = team.find(m => m.id === currentMember.id);
    if (!exists) { doLogout(); }
  }
});

// Live updates from Supabase — admin changes appear instantly on team portal
dbSubscribeTasks(payload => {
  if (!currentMember) return;
  renderAllTasksBar();
  renderMyTasks();
  updateBadges();
  // Notify when a task is newly assigned to this member
  if (payload && payload.new && payload.eventType === 'INSERT') {
    const n = payload.new;
    if (n.assigned_to === currentMember.id && n.status === 'pending') {
      notify('New Task Assigned', n.title);
    }
  }
  if (payload && payload.new && payload.eventType === 'UPDATE') {
    const n = payload.new;
    const o = payload.old || {};
    // Notify if this task was just assigned to the current member (was unassigned or assigned to someone else)
    if (n.assigned_to === currentMember.id && n.status === 'pending' && o.assigned_to !== currentMember.id) {
      notify('New Task Assigned', n.title);
    }
  }
});

dbSubscribeSchedule(() => {
  if (!currentMember) return;
  if (activeTab === 'schedule') renderSchedule();
  updateBadges();
});

/* ════════════════════════════════════════════
   SHARE SELECTION LINK
   ════════════════════════════════════════════ */
function shareSelectionLink(schedId, shots) {
  const s = shots.find(x => x.id === schedId);
  if (!s) return;

  const payload = {
    clientName:    s.clientName  || s.title || '',
    sessionTitle:  s.title       || '',
    date:          s.date        || '',
    pictureCount:  s.shootPictureCount || null,
    selection:     s.shootSelection   || null,
    fileNames:     s.shootFileNames   || null,
    completedAt:   s.shootCompletedAt || null,
    completedBy:   s.shootCompletedBy || null,
  };

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url     = window.location.origin + '/selection-confirm?d=' + encoded;

  navigator.clipboard.writeText(url)
    .then(() => showToast('Client link copied — send it to ' + (s.clientName || 'client')))
    .catch(() => {
      prompt('Copy this link and send to your client:', url);
    });
}

/* ════════════════════════════════════════════
   WALK-IN BOOKING
   ════════════════════════════════════════════ */
const WALKIN_OUTFIT_LIMITS = {
  'Half Session':     [1],
  'Regular Session':  [1, 2],
  'Birthday Session': [1, 2, 3],
  'Outdoor Session':  [1, 2, 3, 4, 5, 6],
};

function initWalkinForm() {
  const form          = document.getElementById('walkinForm');
  const successDiv    = document.getElementById('walkinSuccess');
  const sessionSel    = document.getElementById('wkSessionType');
  const outfitSel     = document.getElementById('wkNumOutfits');
  const submitBtn     = document.getElementById('walkinSubmitBtn');
  const submitText    = document.getElementById('walkinSubmitText');
  const errDiv        = document.getElementById('walkinErr');
  const newBtn        = document.getElementById('walkinNewBtn');
  const creatorName   = document.getElementById('walkinCreatorName');

  if (!form) return;

  // Fill creator name from session
  if (currentMember) creatorName.textContent = currentMember.name;

  // Update outfit options when session type changes
  sessionSel.addEventListener('change', () => {
    const opts = WALKIN_OUTFIT_LIMITS[sessionSel.value];
    if (!opts) { outfitSel.innerHTML = '<option value="1">1 outfit</option>'; return; }
    outfitSel.innerHTML = opts.map(n => `<option value="${n}">${n} outfit${n > 1 ? 's' : ''}</option>`).join('');
    outfitSel.value = String(opts[opts.length - 1]);
  });

  // Clear error styling on change
  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('err'));
    el.addEventListener('change', () => el.classList.remove('err'));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.style.display = 'none';

    // Gather values
    const firstName    = document.getElementById('wkFirstName').value.trim();
    const middleName   = document.getElementById('wkMiddleName').value.trim();
    const phone        = document.getElementById('wkPhone').value.trim();
    const email        = document.getElementById('wkEmail').value.trim();
    const sessionType  = sessionSel.value;
    const numOutfits   = outfitSel.value;
    const amount       = document.getElementById('wkAmount').value.trim();
    const shootDate    = document.getElementById('wkDate').value;
    const shootTime    = document.getElementById('wkTime').value;
    const instagram    = document.getElementById('wkInstagram').value.trim();

    // Validate required fields
    let hasError = false;
    const required = {
      wkFirstName: firstName, wkPhone: phone, wkEmail: email,
      wkAmount: amount, wkDate: shootDate, wkTime: shootTime,
    };
    Object.entries(required).forEach(([id, val]) => {
      if (!val) { document.getElementById(id).classList.add('err'); hasError = true; }
    });
    if (!sessionType) { sessionSel.classList.add('err'); hasError = true; }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('wkEmail').classList.add('err');
      hasError = true;
    }

    if (hasError) {
      errDiv.textContent = 'Please fill in all required fields.';
      errDiv.style.display = 'block';
      return;
    }

    const clientName  = middleName ? `${firstName} ${middleName}` : firstName;
    const bookingId   = genBookingId();
    const now         = Date.now();

    submitBtn.disabled  = true;
    submitText.textContent = 'Saving…';

    const booking = {
      id:           bookingId,
      bookingKind:  'studio',
      bookingSource: 'walkin',
      firstName,
      middleName,
      clientName,
      phone,
      email,
      sessionType,
      numOutfits,
      amountPaid:   parseFloat(amount) || 0,
      preferredDate: shootDate,
      preferredTime: shootTime,
      instagram:    instagram || '',
      status:       'confirmed',
      walkinBy:     currentMember ? currentMember.name : '—',
      walkinById:   currentMember ? currentMember.id : null,
      createdAt:    now,
    };

    await saveWalkinBooking(booking);

    // Show success
    form.style.display     = 'none';
    successDiv.style.display = 'block';
    document.getElementById('walkinSuccessId').textContent = bookingId;
    showToast(`Walk-in booking saved — ${clientName}`);

    submitBtn.disabled = false;
    submitText.textContent = 'Save Walk-in Booking';
  });

  // "New Walk-in" button resets the form
  newBtn.addEventListener('click', () => {
    form.reset();
    outfitSel.innerHTML = '<option value="1">1 outfit</option>';
    form.style.display     = 'block';
    successDiv.style.display = 'none';
    errDiv.style.display     = 'none';
    if (currentMember) creatorName.textContent = currentMember.name;
    document.getElementById('wkFirstName').focus();
  });
}

/* ════════════════════════════════════════════
   HOME BUTTON → SCHEDULE TAB
   ════════════════════════════════════════════ */
document.getElementById('homeBtn').addEventListener('click', () => switchTab('schedule'));

/* ════════════════════════════════════════════
   REFRESH BUTTON — manual server sync
   ════════════════════════════════════════════ */
document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  // Force fresh render of current tab
  await renderSchedule();
  await renderAllTasksBar();
  await renderMyTasks();
  await updateBadges();
  setTimeout(() => {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    showToast('Refreshed ✓');
  }, 500);
});

/* ════════════════════════════════════════════
   SHOOT COMPLETE MODAL (studio sessions only)
   ════════════════════════════════════════════ */
const shootCompleteModal    = document.getElementById('shootCompleteModal');
const shootCompleteBackdrop = document.getElementById('shootCompleteBackdrop');
const shootCompleteClose    = document.getElementById('shootCompleteClose');
const shootCompleteSubmit   = document.getElementById('shootCompleteSubmit');
const shootCompleteTitle    = document.getElementById('shootCompleteTitle');
const shootCompleteSubtitle = document.getElementById('shootCompleteSubtitle');

let activeShootId = null;

function openShootCompleteModal(schedId) {
  activeShootId = schedId;
  // Try to get title from the card
  const card = document.querySelector(`[data-sched-card="${schedId}"]`);
  const title = card ? card.querySelector('.sch-body__title')?.textContent : schedId;
  shootCompleteTitle.textContent    = 'Mark Shoot Done';
  shootCompleteSubtitle.textContent = title || schedId;
  document.getElementById('scSelection').value    = '';
  document.getElementById('scPictureCount').value = '';
  document.getElementById('scFileNames').value    = '';
  shootCompleteModal.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('scPictureCount').focus(), 100);
}

function closeShootCompleteModal() {
  shootCompleteModal.classList.remove('open');
  document.body.style.overflow = '';
  activeShootId = null;
}

shootCompleteClose.addEventListener('click', closeShootCompleteModal);
shootCompleteBackdrop.addEventListener('click', closeShootCompleteModal);

shootCompleteSubmit.addEventListener('click', async () => {
  if (!activeShootId) return;
  const selection    = document.getElementById('scSelection').value.trim();
  const pictureCount = parseInt(document.getElementById('scPictureCount').value, 10) || 0;
  const fileNames    = document.getElementById('scFileNames').value.trim();

  await dbUpdateScheduleEntry(activeShootId, {
    shootCompleted:    true,
    shootCompletedAt:  Date.now(),
    shootCompletedBy:  currentMember ? currentMember.name : 'Team',
    shootSelection:    selection    || null,
    shootPictureCount: pictureCount || null,
    shootFileNames:    fileNames    || null,
  });

  closeShootCompleteModal();
  showToast('Shoot marked complete ✓');
  renderSchedule();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && shootCompleteModal.classList.contains('open')) closeShootCompleteModal();
});

/* ════════════════════════════════════════════
   DAILY SIGN-IN / SIGN-OUT
   Resumption time: 9:00 AM on weekdays (Mon–Fri)
   ════════════════════════════════════════════ */

// Returns how late a sign-in is on a weekday vs 9am
// Returns null if on time or not a weekday
function calcLate(signInTs) {
  const d   = new Date(signInTs);
  const dow = d.getDay(); // 0=Sun,6=Sat
  if (dow === 0 || dow === 6) return null; // weekends: no tracking
  const resumption = new Date(d);
  resumption.setHours(9, 0, 0, 0);
  const diffMs = d - resumption;
  if (diffMs <= 0) return null; // on time or early
  const mins  = Math.floor(diffMs / 60000);
  const hrs   = Math.floor(mins / 60);
  const rmins = mins % 60;
  if (hrs > 0) return `${hrs}h ${rmins}m late`;
  return `${mins}m late`;
}

async function renderSignIn() {
  if (!currentMember) return;

  // Set today's date label
  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayFmt  = new Date(todayStr + 'T12:00:00').toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const dateEl    = document.getElementById('signinTodayDate');
  const statusEl  = document.getElementById('signinStatusArea');
  const histEl    = document.getElementById('signinHistoryList');
  if (dateEl) dateEl.textContent = todayFmt;

  // Check today's sign-in
  const todayRecord = await dbGetTodaySignIn(currentMember.id);

  if (statusEl) {
    if (todayRecord) {
      // Signed in — check if also signed out
      const lateStr   = todayRecord.ts ? calcLate(todayRecord.ts) : null;
      const signInTime = todayRecord.time || '—';

      if (todayRecord.signOutTime) {
        // Already signed out
        statusEl.innerHTML = `
          <div class="signin-confirmed">
            <div class="signin-confirmed__check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="signin-confirmed__label">Signed in &amp; out today</div>
            <div class="signin-confirmed__time">
              In: ${signInTime}${lateStr ? ` <span style="color:#f87171;font-weight:700">(${lateStr})</span>` : ''}
              &nbsp;·&nbsp; Out: ${todayRecord.signOutTime}
            </div>
            ${todayRecord.daySummary ? `<div style="font-size:0.75rem;color:var(--grey-2);font-style:italic;text-align:center;margin-top:4px;max-width:280px">"${todayRecord.daySummary}"</div>` : ''}
          </div>`;
      } else {
        // Signed in, not yet signed out
        statusEl.innerHTML = `
          <div class="signin-confirmed">
            <div class="signin-confirmed__check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="signin-confirmed__label">You have signed in</div>
            <div class="signin-confirmed__time">
              Checked in at ${signInTime}
              ${lateStr ? `<span class="late-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${lateStr}</span>` : '<span class="ontime-badge">On time ✓</span>'}
            </div>
          </div>
          <div class="signout-block">
            <div class="signout-block__label">Sign Out</div>
            <textarea class="signout-summary" id="daySummaryInput" placeholder="Write a brief summary of what you accomplished today…"></textarea>
            <button class="btn-signout" id="btnDoSignOut">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out for Today
            </button>
          </div>`;

        document.getElementById('btnDoSignOut').addEventListener('click', async () => {
          const btn     = document.getElementById('btnDoSignOut');
          const summary = document.getElementById('daySummaryInput').value.trim();
          if (!summary) {
            const ta = document.getElementById('daySummaryInput');
            ta.style.borderColor = 'var(--red)';
            ta.placeholder = 'Please write your day summary before signing out…';
            ta.focus();
            return;
          }
          btn.disabled    = true;
          btn.textContent = 'Signing out…';
          try {
            const result = await dbSignOutToday(currentMember, summary);
            if (result.notSignedIn) {
              showToast('You haven\'t signed in yet today.');
            } else if (result.alreadySignedOut) {
              showToast('Already signed out at ' + result.record.signOutTime);
            } else {
              showToast('Signed out at ' + result.record.signOutTime + ' ✓');
            }
          } catch (e) {
            showToast('Sign-out failed. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Sign Out for Today';
            return;
          }
          renderSignIn();
        });
      }
    } else {
      // No sign-in record for today
      const now = new Date();
      const dow = now.getDay(); // 0=Sun, 6=Sat
      const isWeekday = dow >= 1 && dow <= 5;
      const isPastNoon = now.getHours() >= 12;

      if (isWeekday && isPastNoon) {
        // Past 12pm on a workday with no sign-in → mark absent
        await dbMarkAbsent(currentMember);
        statusEl.innerHTML = `
          <div class="absent-status">
            <div class="absent-status__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div class="absent-status__label">Marked Absent</div>
            <div class="absent-status__sub">You did not sign in before 12:00 PM. You have been marked absent for today.</div>
          </div>`;
      } else {
        // Before noon — show sign-in button
        statusEl.innerHTML = `
          <button class="btn-signin" id="btnDoSignIn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Confirm Resumption
          </button>`;
        document.getElementById('btnDoSignIn').addEventListener('click', async () => {
          const btn = document.getElementById('btnDoSignIn');
          btn.disabled    = true;
          btn.textContent = 'Signing in…';
          try {
            const result  = await dbSignInToday(currentMember);
            const lateStr = result.record.ts ? calcLate(result.record.ts) : null;
            if (result.alreadySignedIn) {
              showToast('You have signed in');
            } else if (lateStr) {
              showToast(`Signed in at ${result.record.time} — ${lateStr}`);
            } else {
              showToast('Signed in at ' + result.record.time + ' ✓ On time!');
            }
          } catch (e) {
            showToast('Sign-in failed. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Confirm Resumption';
            return;
          }
          renderSignIn();
        });
      }
    }
  }

  // Render attendance history
  if (histEl) {
    const history = await dbGetMemberAttendance(currentMember.id, 14);
    if (!history.length) {
      histEl.innerHTML = '<div class="signin-empty-hist">No attendance records yet</div>';
    } else {
      histEl.innerHTML = history.map(r => {
        const d       = new Date(r.date + 'T12:00:00');
        const fmt     = d.toLocaleDateString('en-NG', { weekday:'short', month:'short', day:'numeric' });
        const isToday = r.date === todayStr;
        const lateStr = r.ts ? calcLate(r.ts) : null;
        const signInTime = r.time || '—';
        if (r.absent) {
          const absentDed = r.authorised ? 0 : (r.absentDeduction || 5000);
          return `
            <div class="signin-row signin-row--absent">
              <div class="signin-row__dot" style="background:var(--red)"></div>
              <div class="signin-row__info">
                <div class="signin-row__date">
                  ${fmt}${isToday ? ' <span style="font-size:0.68rem;color:var(--gold);font-weight:700">TODAY</span>' : ''}
                  <span style="font-size:0.68rem;font-weight:700;color:var(--red);margin-left:6px;text-transform:uppercase">ABSENT</span>
                  ${r.authorised ? '<span style="font-size:0.68rem;font-weight:700;color:var(--green);margin-left:6px;text-transform:uppercase">AUTHORISED</span>' : ''}
                </div>
                <div class="signin-row__times" style="color:var(--red);opacity:0.7">Did not sign in before 12:00 PM</div>
                ${absentDed ? `<div class="signin-row__summary" style="color:var(--red)">Deduction: ₦${absentDed.toLocaleString()}</div>` : ''}
              </div>
            </div>`;
        }
        const lateDed = r.lateDeduction || 0;
        return `
          <div class="signin-row">
            <div class="signin-row__dot" style="${isToday ? 'background:var(--gold)' : ''}"></div>
            <div class="signin-row__info">
              <div class="signin-row__date">
                ${fmt}${isToday ? ' <span style="font-size:0.68rem;color:var(--gold);font-weight:700">TODAY</span>' : ''}
                ${lateStr ? `<span class="signin-row__late">${lateStr}</span>` : ''}
              </div>
              <div class="signin-row__times">
                <span class="signin-row__time">In: ${signInTime}</span>
                ${r.signOutTime ? `<span class="signin-row__outtime">Out: ${r.signOutTime}</span>` : ''}
              </div>
              ${lateDed ? `<div class="signin-row__summary" style="color:var(--red)">Late deduction: ₦${lateDed.toLocaleString()}</div>` : ''}
              ${r.daySummary ? `<div class="signin-row__summary">"${r.daySummary}"</div>` : ''}
            </div>
          </div>`;
      }).join('');
    }
  }

  // Salary + deductions are now rendered by the Summary tab via renderSalaryCard/renderDeductionsCard.
  // Keep them as separate functions so they can be invoked from there.
}

async function renderSalaryCard() {
  const salEl = document.getElementById('salaryCard');
  if (salEl && currentMember) {
    const sal = await dbGetMonthlySalary(currentMember);
    if (sal.baseSalary > 0) {
      salEl.style.display = 'block';
      const monthName = new Date().toLocaleDateString('en-NG', { month: 'long' });
      const visKey  = 'nej_salary_visible_' + currentMember.id;
      const visible = localStorage.getItem(visKey) !== '0'; // default ON
      const fmt = v => visible ? `₦${v.toLocaleString()}` : '₦••••••';
      salEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--grey-3)">Expected Salary — ${monthName}</span>
          <button id="salaryToggleBtn" type="button" style="background:none;border:1px solid var(--border);border-radius:6px;color:var(--grey-3);font-size:0.7rem;padding:4px 10px;cursor:pointer;display:flex;align-items:center;gap:4px">
            ${visible
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Hide'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Show'}
          </button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.85rem;color:var(--grey-2)">Base salary</span>
          <strong style="color:var(--white)">${fmt(sal.baseSalary)}</strong>
        </div>
        ${sal.lateTotal ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.85rem;color:var(--grey-2)">Late deductions</span>
          <strong style="color:var(--red)">− ${fmt(sal.lateTotal)}</strong>
        </div>` : ''}
        ${sal.absentTotal ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.85rem;color:var(--grey-2)">Absent deductions</span>
          <strong style="color:var(--red)">− ${fmt(sal.absentTotal)}</strong>
        </div>` : ''}
        ${sal.bonusAmount ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.85rem;color:var(--grey-2)">Bonus (${sal.bonusPoints} pts)</span>
          <strong style="color:var(--green)">+ ${fmt(sal.bonusAmount)}</strong>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:6px;border-top:1px solid var(--border)">
          <span style="font-size:0.9rem;font-weight:600;color:var(--white)">Expected payout</span>
          <strong style="color:var(--gold);font-size:1.1rem">${fmt(sal.expected)}</strong>
        </div>`;
      document.getElementById('salaryToggleBtn')?.addEventListener('click', () => {
        localStorage.setItem(visKey, visible ? '0' : '1');
        renderMyTasks().catch(() => {});
      });
    } else {
      salEl.style.display = 'none';
    }
  }

}

async function renderDeductionsCard() {
  const dedEl = document.getElementById('deductionsSummary');
  if (!dedEl || !currentMember) return;
  const ded = await dbGetMemberDeductions(currentMember.id, 30);
  if (ded.total > 0) {
    dedEl.style.display = 'block';
    dedEl.innerHTML = `
      <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--grey-3);margin-bottom:8px">Deductions — Last 30 days</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.85rem;color:var(--grey-2)">Late deductions</span>
        <strong style="color:var(--white)">₦${ded.lateTotal.toLocaleString()}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:0.85rem;color:var(--grey-2)">Absent deductions</span>
        <strong style="color:var(--white)">₦${ded.absentTotal.toLocaleString()}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;margin-top:6px;border-top:1px solid var(--border)">
        <span style="font-size:0.9rem;font-weight:600;color:var(--white)">Total</span>
        <strong style="color:var(--red);font-size:1rem">₦${ded.total.toLocaleString()}</strong>
      </div>`;
  } else {
    dedEl.style.display = 'none';
  }
}
