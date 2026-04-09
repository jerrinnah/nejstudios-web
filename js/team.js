/* ══════════════════════════════════════════════
   NEJstudios — Team Portal JS
   Auth: team member username+PIN
   Features: all tasks bar, my tasks, start/end, reports
   ══════════════════════════════════════════════ */

const TASKS_KEY    = 'nej_tasks';
const TEAM_KEY     = 'nej_team';
const SESSION_KEY  = 'nej_session';
const SCHEDULE_KEY = 'nej_schedule';

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
function getTasks()        { return JSON.parse(localStorage.getItem(TASKS_KEY)    || '[]'); }
function saveTasks(arr)    { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); }
function getSchedule()     { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]'); }

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
   FORMATTERS
   ════════════════════════════════════════════ */
function fmtDate(ts)  { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'medium' }); }
function fmtTime(ts)  { if (!ts) return ''; return new Date(ts).toLocaleTimeString('en-NG', { timeStyle:'short' }); }
function fmtShort(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('en-NG', { dateStyle:'short' }); }

/* ════════════════════════════════════════════
   SESSION / CURRENT MEMBER
   ════════════════════════════════════════════ */
let currentMember = null; // populated after login / session restore

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
  switchTab('schedule');
  updateBadges();
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
let activeTab = 'schedule';

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
function renderSchedule() {
  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const shots    = getSchedule().slice().sort((a, b) => a.date.localeCompare(b.date));

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
          </div>
          <div class="sch-body__title">${s.title}</div>
          <div class="sch-body__meta">
            ${s.time       ? `<span>🕐 ${s.time}</span>`       : ''}
            ${s.clientName ? `<span>👤 ${s.clientName}</span>` : ''}
            ${s.location   ? `<span>📍 ${s.location}</span>`   : ''}
          </div>
          ${s.notes ? `<div class="sch-body__notes">${s.notes}</div>` : ''}
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

function renderAllTasksBar() {
  let tasks = getTasks();
  if (barFilter !== 'all') tasks = tasks.filter(t => t.status === barFilter);

  const bar       = document.getElementById('allTasksBar');
  const countEl   = document.getElementById('allTasksCount');
  const allTasks  = getTasks();

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
function renderMyTasks() {
  if (!currentMember) return;
  const myTasks = getTasks().filter(t => t.assignedTo === currentMember.id);
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

function startTask(id) {
  const tasks = getTasks();
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (tasks[idx].status !== 'pending') return;
  tasks[idx].status    = 'in-progress';
  tasks[idx].startedAt = Date.now();
  saveTasks(tasks);
  renderMyTasks();
  renderAllTasksBar();
  updateBadges();
  showToast('Task started — good luck!');
}

function completeTask(id) {
  const tasks = getTasks();
  const idx   = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  if (tasks[idx].status !== 'in-progress') return;
  tasks[idx].status      = 'completed';
  tasks[idx].completedAt = Date.now();
  saveTasks(tasks);
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

function openReportModal(taskId) {
  const task = getTasks().find(t => t.id === taskId);
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

submitReportBtn.addEventListener('click', () => {
  const content = reportTextarea.value.trim();
  if (!content) { reportTextarea.focus(); return; }
  if (!currentMember || !activeReportTaskId) return;

  const tasks = getTasks();
  const idx   = tasks.findIndex(t => t.id === activeReportTaskId);
  if (idx === -1) return;

  if (!tasks[idx].reports) tasks[idx].reports = [];
  tasks[idx].reports.push({
    memberId:   currentMember.id,
    memberName: currentMember.name,
    content,
    createdAt:  Date.now(),
  });

  saveTasks(tasks);
  reportTextarea.value = '';
  renderPastReports(tasks[idx]);
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
function updateBadges() {
  const allTasks = getTasks();

  // Schedule badge: count today's shots
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = getSchedule().filter(s => s.date === todayStr).length;
  const schBadge = document.getElementById('scheduleBadge');
  schBadge.textContent = todayCount;
  schBadge.classList.toggle('hidden', todayCount === 0);

  // All tasks badge: count pending
  const pendingCount = allTasks.filter(t => t.status === 'pending').length;
  const allBadge = document.getElementById('allTasksBadge');
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
   CROSS-TAB SYNC
   ════════════════════════════════════════════ */
window.addEventListener('storage', e => {
  if (!currentMember) return;
  if (e.key === TASKS_KEY) {
    renderAllTasksBar();
    renderMyTasks();
    updateBadges();
  }
  if (e.key === TEAM_KEY) {
    // If current member was removed by admin, force logout
    const team   = getTeam();
    const exists = team.find(m => m.id === currentMember.id);
    if (!exists) { doLogout(); }
  }
});
