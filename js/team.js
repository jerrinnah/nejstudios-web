/* ══════════════════════════════════════════════
   NEJstudios — Team Portal JS
   Auth: team member username+PIN
   Features: all tasks bar, my tasks, start/end, reports
   ══════════════════════════════════════════════ */

const TASKS_KEY   = 'nej_tasks';
const TEAM_KEY    = 'nej_team';
const SESSION_KEY = 'nej_session';

/* ════════════════════════════════════════════
   TEAM CONFIG  ← add / edit team members here
   These work on ALL devices without needing localStorage.
   Format: { id, name, username, pin }
   ════════════════════════════════════════════ */
const TEAM_CONFIG = [
  // { id: 'TM-001', name: 'Kemi Adeyemi',  username: 'kemi',  pin: '1234' },
  // { id: 'TM-002', name: 'Tunde Bello',   username: 'tunde', pin: '5678' },
];

/* ════════════════════════════════════════════
   STORAGE HELPERS
   ════════════════════════════════════════════ */
function getTasks()     { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); }
function saveTasks(arr) { localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); }

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
  renderAllTasksBar();
  renderMyTasks();
  updateBadges();
}

function tryLogin() {
  const username = usernameInput.value.trim().toLowerCase();
  const pin      = pinInput.value.trim();
  if (!username || !pin) { loginErr.textContent = 'Enter your username and PIN.'; return; }

  const team   = getTeam();
  const member = team.find(m => m.username.toLowerCase() === username && m.pin === pin);

  if (member) {
    loginErr.textContent = '';
    setSession({ role:'team', username:member.username, memberId:member.id, name:member.name, loginAt:Date.now() });
    showPortal(member);
  } else {
    loginErr.textContent = 'Username or PIN not found. Try again.';
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

// On page load: check existing session
const sess = getSession();
if (sess && sess.role === 'team') {
  const team   = getTeam();
  const member = team.find(m => m.id === sess.memberId);
  if (member) {
    showPortal(member);
  } else {
    // Member removed — clear session
    setSession(null);
  }
} else if (sess && sess.role === 'admin') {
  window.location.href = 'dashboard.html';
}

/* ════════════════════════════════════════════
   TAB SWITCHING
   ════════════════════════════════════════════ */
let activeTab = 'all-tasks';

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll('.t-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.t-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.mobile-bottom-nav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
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
