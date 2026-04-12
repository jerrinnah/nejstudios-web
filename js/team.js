/* ══════════════════════════════════════════════
   NEJstudios — Team Portal JS
   Auth: team member username+PIN
   Features: all tasks bar, my tasks, start/end, reports
   ══════════════════════════════════════════════ */

const TEAM_KEY     = 'nej_team';
const SESSION_KEY  = 'nej_session';
const STORAGE_KEY  = 'nej_bookings';

function getBookings() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }

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

// Merges hardcoded TEAM_CONFIG with any members added via the admin UI (localStorage).
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

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setSession(obj) {
  obj ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj))
      : sessionStorage.removeItem(SESSION_KEY);
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
let activeTab     = 'bookings';

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

function showPortal(member) {
  currentMember = member;
  loginGate.classList.add('hidden');
  teamShell.style.display = 'flex';
  mobileNav.style.display = 'flex';
  document.getElementById('userBadgeName').textContent = member.name;
  switchTab('bookings');
  updateBadges();
  requestNotifPermission();
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

// On page load: check existing session
const sess = getSession();
if (sess && sess.role === 'team') {
  const team   = getTeam();
  const member = team.find(m => m.id === sess.memberId);
  if (member) {
    showPortal(member);
  } else if (sess.name && sess.memberId) {
    // Member not in this device's team list but session is valid — trust it
    showPortal({ id: sess.memberId, name: sess.name, username: sess.username || '' });
  } else {
    setSession(null);
  }
} else if (sess && sess.role === 'admin') {
  window.location.href = 'dashboard';
}

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
  if (name === 'bookings')  renderTeamBookings();
  if (name === 'all-tasks') renderAllTasksBar();
  if (name === 'my-tasks')  renderMyTasks();
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
            ${s.clientName ? `<span>👤 ${s.clientName}</span>` : ''}
            ${s.location   ? `<span>📍 ${s.location}</span>`   : ''}
          </div>
          ${s.notes ? `<div class="sch-body__notes">${s.notes}</div>` : ''}
          ${s.deliverables ? `<div class="sch-body__notes" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px"><span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);display:block;margin-bottom:2px">Deliverables</span>${s.deliverables}</div>` : ''}
          <button class="sch-checklist-toggle" data-toggle-id="${s.id}" style="margin-top:12px;width:100%;padding:7px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.72rem;font-weight:600;color:var(--grey-3);display:flex;align-items:center;justify-content:space-between;transition:var(--trans)">
            <span>Checklist ${doneCount > 0 ? `(${doneCount}/${totalCount})` : ''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          ${checklistHtml}
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
}

/* ════════════════════════════════════════════
   TEAM BOOKINGS VIEW — reads from Supabase so
   all team devices see the same confirmed shoots
   ════════════════════════════════════════════ */
async function renderTeamBookings() {
  const grid = document.getElementById('teamBookingsGrid');
  if (!grid) return;

  grid.innerHTML = `<div class="sch-empty" style="opacity:0.5"><p style="color:var(--grey-3);font-size:0.85rem">Loading…</p></div>`;

  const todayStr = new Date().toISOString().slice(0, 10);
  const shots    = (await dbGetSchedule()).slice().sort((a, b) => a.date.localeCompare(b.date));

  // Update badge — count upcoming entries
  const badge    = document.getElementById('bookingsBadge');
  const upcoming = shots.filter(s => s.date >= todayStr).length;
  if (badge) {
    badge.textContent = upcoming;
    badge.classList.toggle('hidden', upcoming === 0);
  }

  if (shots.length === 0) {
    grid.innerHTML = `<div class="sch-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <h3>No upcoming bookings yet</h3>
      <p>Confirmed shoots and events will appear here once admin confirms a booking.</p>
    </div>`;
    return;
  }

  const typeLabel = { studio:'Studio', wedding:'Wedding', event:'Event', production:'Production', meeting:'Meeting' };

  function buildBookingCard(s, isPast) {
    const d       = new Date(s.date + 'T00:00:00');
    const day     = d.getDate();
    const month   = d.toLocaleString('en-NG', { month:'short' }).toUpperCase();
    const isToday = s.date === todayStr;
    const cls     = isToday ? 'sch-card--today' : (isPast ? 'sch-card--past' : '');
    const lbl     = typeLabel[s.type] || s.type;

    const savedItems    = s.checklist && s.checklist.length > 0 ? s.checklist : null;
    const templateItems = CHECKLIST_TEMPLATES[s.type] || CHECKLIST_TEMPLATES['studio'];
    const rawItems      = savedItems || templateItems.map(text => ({ text, checked: false }));
    const items         = rawItems.map(item => typeof item === 'string' ? { text: item, checked: false } : item);

    const doneCount  = items.filter(it => it.checked).length;
    const totalCount = items.length;
    const allDone    = doneCount === totalCount && totalCount > 0;
    const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const checklistHtml = `
      <div class="sch-checklist" id="checklist-${s.id}" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold)">Equipment &amp; Gear</span>
          ${allDone ? `<span style="font-size:0.7rem;font-weight:700;color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:99px">All packed ✓</span>` : `<span style="font-size:0.72rem;color:var(--grey-3)">${doneCount}/${totalCount}</span>`}
        </div>
        <div style="height:4px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:12px">
          <div style="height:100%;width:${pct}%;background:${allDone ? 'var(--green)' : 'var(--gold)'};border-radius:99px;transition:width 0.3s"></div>
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
            ${isPast  ? '<span style="font-size:0.62rem;color:var(--grey-4);font-weight:600;text-transform:uppercase;letter-spacing:.1em">Past</span>' : ''}
          </div>
          <div class="sch-body__title">${s.title}</div>
          <div class="sch-body__meta">
            ${s.time       ? `<span>🕐 ${s.time}</span>`       : ''}
            ${s.clientName ? `<span>👤 ${s.clientName}</span>` : ''}
            ${s.location   ? `<span>📍 ${s.location}</span>`   : ''}
          </div>
          ${s.notes       ? `<div class="sch-body__notes">${s.notes}</div>` : ''}
          ${s.deliverables ? `<div class="sch-body__notes" style="margin-top:6px;border-top:1px solid var(--border);padding-top:6px"><span style="font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gold);display:block;margin-bottom:2px">Deliverables</span>${s.deliverables}</div>` : ''}
          <button class="sch-checklist-toggle" data-toggle-id="${s.id}" style="margin-top:12px;width:100%;padding:7px 12px;background:var(--bg-3);border:1px solid var(--border);border-radius:6px;font-size:0.72rem;font-weight:600;color:var(--grey-3);display:flex;align-items:center;justify-content:space-between;transition:var(--trans)">
            <span>Equipment &amp; Gear ${doneCount > 0 ? `(${doneCount}/${totalCount})` : ''}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          ${checklistHtml}
        </div>
      </div>`;
  }

  const upcomingShots = shots.filter(s => s.date >= todayStr);
  const pastShots     = shots.filter(s => s.date < todayStr).slice(-3).reverse();

  let html = '';
  if (upcomingShots.length > 0) {
    html += upcomingShots.map(s => buildBookingCard(s, false)).join('');
  } else {
    html += `<div class="sch-empty" style="padding:32px 0"><p style="color:var(--grey-3);font-size:0.85rem">No upcoming shoots scheduled.</p></div>`;
  }
  if (pastShots.length > 0) {
    html += `<div class="sch-section-label">Recent Past</div>`;
    html += pastShots.map(s => buildBookingCard(s, true)).join('');
  }

  grid.innerHTML = html;

  // Checklist toggle
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

  // Checklist checkboxes — persist to Supabase
  grid.querySelectorAll('.sch-checklist-items input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', async () => {
      const schedId  = cb.dataset.schedId;
      const itemIdx  = parseInt(cb.dataset.itemIdx, 10);
      const schedObj = shots.find(s => s.id === schedId);
      if (!schedObj) return;

      const templateItems = CHECKLIST_TEMPLATES[schedObj.type] || CHECKLIST_TEMPLATES['studio'];
      const rawItems      = schedObj.checklist && schedObj.checklist.length > 0
        ? schedObj.checklist
        : templateItems.map(text => ({ text, checked: false }));
      const items = rawItems.map(item => typeof item === 'string' ? { text: item, checked: false } : { ...item });
      items[itemIdx].checked = cb.checked;

      await dbUpdateScheduleChecklist(schedId, items);
      schedObj.checklist = items;

      const container = cb.closest('.sch-checklist');
      const allItems  = Array.from(container.querySelectorAll('input[type=checkbox]'));
      const done      = allItems.filter(c => c.checked).length;
      const total     = allItems.length;
      const pct2      = total > 0 ? Math.round((done / total) * 100) : 0;
      const allDone2  = done === total && total > 0;
      const bar       = container.querySelector('div[style*="height:4px"] > div');
      if (bar) { bar.style.width = pct2 + '%'; bar.style.background = allDone2 ? 'var(--green)' : 'var(--gold)'; }
      const headerSpan = container.querySelector('div:first-child > span:last-child');
      if (headerSpan) {
        if (allDone2) { headerSpan.textContent = 'All packed ✓'; headerSpan.style.cssText = 'font-size:0.7rem;font-weight:700;color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:99px'; }
        else          { headerSpan.textContent = `${done}/${total}`; headerSpan.style.cssText = 'font-size:0.72rem;color:var(--grey-3)'; }
      }
      const card   = container.closest('[data-sched-card]');
      const toggle = card ? card.querySelector('.sch-checklist-toggle span') : null;
      if (toggle) toggle.textContent = `Equipment & Gear (${done}/${total})`;
      cb.closest('label').style.color          = cb.checked ? 'var(--grey-4)' : 'var(--grey-1)';
      cb.closest('label').style.textDecoration = cb.checked ? 'line-through' : '';
    });
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
  const myTasks = (await dbGetTasks()).filter(t => t.assignedTo === currentMember.id);
  const grid    = document.getElementById('myTasksGrid');

  if (myTasks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <h3>No tasks assigned yet</h3>
        <p>Your admin will assign tasks to you. Check back soon.</p>
      </div>`;
    return;
  }

  // Sort: in-progress first, then pending, then completed
  const order = { 'in-progress': 0, pending: 1, completed: 2 };
  myTasks.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  grid.innerHTML = myTasks.map(t => buildMyTaskCard(t)).join('');

  // Attach action listeners
  grid.querySelectorAll('[data-my-action]').forEach(btn => {
    btn.addEventListener('click', () => handleMyTaskAction(btn.dataset.id, btn.dataset.myAction));
  });
}

function buildMyTaskCard(t) {
  const prClass     = t.priority || 'medium';
  const reportCount = t.reports ? t.reports.length : 0;
  const lastReport  = reportCount > 0 ? t.reports[reportCount - 1] : null;

  const canStart    = t.status === 'pending';
  const canComplete = t.status === 'in-progress';
  const isCompleted = t.status === 'completed';

  const statusLabel = t.status === 'in-progress' ? 'In Progress'
    : t.status.charAt(0).toUpperCase() + t.status.slice(1);

  return `
    <div class="my-task-card my-task-card--${t.status}">
      <div class="my-task-card__top">
        <div class="my-task-card__badges">
          <span class="priority-badge priority-badge--${prClass}">${t.priority || 'medium'}</span>
          <span class="status-badge status-badge--${t.status}">${statusLabel}</span>
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

async function completeTask(id) {
  const task = await dbGetTask(id);
  if (!task || task.status !== 'in-progress') return;
  await dbUpdateTask(id, { status: 'completed', completed_at: Date.now() });
  renderMyTasks();
  renderAllTasksBar();
  updateBadges();
  showToast('Task completed!');
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
  const todayStr = new Date().toISOString().slice(0, 10);

  // Bookings badge: count upcoming schedule entries from Supabase
  const upcomingCount  = schedule.filter(s => s.date >= todayStr).length;
  const bookingsBadge  = document.getElementById('bookingsBadge');
  if (bookingsBadge) {
    bookingsBadge.textContent = upcomingCount;
    bookingsBadge.classList.toggle('hidden', upcomingCount === 0);
  }

  // All tasks badge: count pending
  const pendingCount = allTasks.filter(t => t.status === 'pending').length;
  const allBadge     = document.getElementById('allTasksBadge');
  if (allBadge) {
    allBadge.textContent = pendingCount;
    allBadge.classList.toggle('hidden', pendingCount === 0);
  }

  // My tasks badge: count my active tasks
  if (currentMember) {
    const myActive = allTasks.filter(t => t.assignedTo === currentMember.id && t.status !== 'completed').length;
    const myBadge  = document.getElementById('myTasksBadge');
    if (myBadge) {
      myBadge.textContent = myActive;
      myBadge.classList.toggle('hidden', myActive === 0);
    }
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
  if (activeTab === 'bookings') renderTeamBookings();
  updateBadges();
});
