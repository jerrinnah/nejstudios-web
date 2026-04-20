/* ══════════════════════════════════════════════
   NEJstudios — client.js
   Client-facing approval portal for gallery.html → client.html
   Reads delivery via dbGetGalleryDelivery(token) from db.js
   Syncs approvals with /api/sync.php?resource=approvals
   ══════════════════════════════════════════════ */

(async function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────── */
  const mainEl   = document.getElementById('clientMain');
  const lightbox = document.getElementById('clientLightbox');
  const clbImg   = document.getElementById('clbImg');
  const clbFname = document.getElementById('clbFilename');
  const clbCtr   = document.getElementById('clbCounter');
  const clbClose = document.getElementById('clbClose');
  const clbPrev  = document.getElementById('clbPrev');
  const clbNext  = document.getElementById('clbNext');
  const clbKeep  = document.getElementById('clbKeep');
  const clbRemov = document.getElementById('clbRemove');
  const clbDl    = document.getElementById('clbDownload');
  const toastEl  = document.getElementById('clientToast');

  /* ── State ────────────────────────────────── */
  let delivery    = null;
  let approvals   = {};   // { imgId: 'keep'|'remove'|null }
  let _lbIdx      = 0;
  let _lbFiles    = [];
  let _submitted  = false;

  /* ── Helpers ──────────────────────────────── */
  function showToast(msg, ms = 2800) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function showError(title, msg) {
    mainEl.innerHTML = `
      <div class="client-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h2>${title}</h2>
        <p>${msg}</p>
      </div>`;
  }

  /* ── Approvals — server sync ─────────────── */
  async function loadApprovals(deliveryId) {
    try {
      const r = await fetch('/api/sync.php?resource=approvals', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const all = await r.json();
      return (all && all[deliveryId]) ? all[deliveryId] : {};
    } catch {
      // Fall back to localStorage
      try {
        const all = JSON.parse(localStorage.getItem('nej_approvals') || '{}');
        return all[deliveryId] || {};
      } catch { return {}; }
    }
  }

  async function saveApprovals(deliveryId, approvalsMap) {
    // localStorage first
    let all = {};
    try { all = JSON.parse(localStorage.getItem('nej_approvals') || '{}'); } catch {}
    all[deliveryId] = approvalsMap;
    localStorage.setItem('nej_approvals', JSON.stringify(all));
    // Then server
    try {
      await fetch('/api/sync.php?resource=approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all),
      });
    } catch { /* server unreachable — localStorage copy will sync later */ }
  }

  /* ── Summary bar ─────────────────────────── */
  function updateSummary() {
    const files   = delivery.files || [];
    const kept    = files.filter(f => approvals[f.id] === 'keep').length;
    const removed = files.filter(f => approvals[f.id] === 'remove').length;
    const total   = files.length;
    const reviewed = kept + removed;

    // Legacy references (keep for backward compat)
    const bar     = document.getElementById('clientSummaryBar');
    const countEl = document.getElementById('clientApprCount');
    if (bar)     bar.textContent     = `${kept} of ${total} selected · ${removed} removed`;
    if (countEl) countEl.textContent = `${reviewed} / ${total} reviewed`;

    // New progress bar
    const pct       = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    const fillEl    = document.getElementById('progressFill');
    const labelEl   = document.getElementById('progressLabel');
    const statsKept = document.getElementById('statsKept');
    const statsRemv = document.getElementById('statsRemoved');
    const statsPend = document.getElementById('statsPending');
    if (fillEl)    fillEl.style.width   = pct + '%';
    if (labelEl)   labelEl.textContent  = `${reviewed} of ${total} reviewed (${pct}%)`;
    if (statsKept) statsKept.textContent = `${kept} kept`;
    if (statsRemv) statsRemv.textContent = `${removed} removed`;
    if (statsPend) statsPend.textContent = `${total - reviewed} pending`;

    // Sticky bar
    const stickyBar  = document.getElementById('stickyBar');
    const stickyCount = document.getElementById('stickyBarCount');
    if (stickyBar)  stickyBar.style.display  = '';
    if (stickyCount) stickyCount.textContent = `${kept} of ${total}`;

    // Filter tab counts
    const tabAll  = document.getElementById('tabCountAll');
    const tabSel  = document.getElementById('tabCountSelected');
    const tabRem  = document.getElementById('tabCountRemoved');
    if (tabAll)  tabAll.textContent  = total;
    if (tabSel)  tabSel.textContent  = kept;
    if (tabRem)  tabRem.textContent  = removed;
  }

  /* ── Active filter ──────────────────────── */
  let _activeFilter = 'all'; // 'all' | 'selected' | 'removed'

  /* ── Grid thumbnail rendering ─────────────── */
  function thumbBadgeHtml(imgId) {
    const st = approvals[imgId];
    if (st === 'keep')   return `<div class="client-thumb__badge client-thumb__badge--keep">✓</div>`;
    if (st === 'remove') return `<div class="client-thumb__badge client-thumb__badge--remove">✕</div>`;
    return `<div class="client-thumb__badge client-thumb__badge--none"></div>`;
  }

  function renderGrid() {
    const allFiles = delivery.files || [];
    const grid     = document.getElementById('clientGrid');
    if (!grid) return;

    // Apply filter
    const files = allFiles.filter(f => {
      const st = approvals[f.id];
      if (_activeFilter === 'selected') return st === 'keep';
      if (_activeFilter === 'removed')  return st === 'remove';
      return true;
    });

    if (files.length === 0 && _activeFilter !== 'all') {
      const label = _activeFilter === 'selected' ? 'kept' : 'removed';
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 16px;color:var(--grey-3);font-size:0.88rem;">No ${label} photos yet.</div>`;
      return;
    }

    grid.innerHTML = files.map((f, idx) => {
      const st = approvals[f.id];
      const stateClass = st === 'keep' ? ' is-kept' : st === 'remove' ? ' is-removed' : '';
      return `
      <div class="client-thumb${stateClass}" data-idx="${allFiles.indexOf(f)}" data-id="${f.id}">
        <img src="${f.url}" alt="${f.label || 'Photo ' + (idx + 1)}" loading="lazy" />
        ${thumbBadgeHtml(f.id)}
        <div class="client-thumb__overlay">
          <div class="client-thumb__actions">
            <button class="client-thumb__btn client-thumb__btn--keep${approvals[f.id] === 'keep' ? ' active' : ''}"
              data-action="keep" data-id="${f.id}" title="Keep this photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Keep
            </button>
            <button class="client-thumb__btn client-thumb__btn--remove${approvals[f.id] === 'remove' ? ' active' : ''}"
              data-action="remove" data-id="${f.id}" title="Remove this photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Remove
            </button>
            <button class="client-thumb__btn client-thumb__btn--dl"
              data-action="download" data-url="${f.url}" data-label="${f.label || 'photo'}" title="Download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Thumb click → lightbox
    grid.querySelectorAll('.client-thumb').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-action]')) return;
        openLightbox(parseInt(el.dataset.idx, 10));
      });
    });

    // Action buttons
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'download') {
          triggerDownload(btn.dataset.url, btn.dataset.label);
          dbIncrementDownload(delivery.id);
          return;
        }
        const imgId = btn.dataset.id;
        setApproval(imgId, action);
      });
    });
  }

  /* ── Approval mutation ───────────────────── */
  async function setApproval(imgId, action) {
    // Toggle off if same state clicked again
    approvals[imgId] = approvals[imgId] === action ? null : action;
    if (approvals[imgId] === null) delete approvals[imgId];

    await saveApprovals(delivery.id, approvals);
    renderGrid();
    updateSummary();
    // Update lightbox buttons if open
    if (lightbox.classList.contains('open')) {
      syncLightboxApprovalBtns();
    }
  }

  /* ── Download helper ─────────────────────── */
  function triggerDownload(url, label) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = label || 'photo';
    a.target   = '_blank';
    a.rel      = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ── Download All (ZIP) ──────────────────── */
  async function downloadAll() {
    const files = delivery.files || [];
    if (!files.length) return;

    showToast('Preparing download…');

    if (typeof JSZip !== 'undefined') {
      try {
        const zip = new JSZip();
        const folder = zip.folder(delivery.client_name || 'NEJstudios Gallery');
        const fetches = files.map(async (f, i) => {
          try {
            const res  = await fetch(f.url);
            const blob = await res.blob();
            const ext  = f.url.split('.').pop().split('?')[0] || 'jpg';
            folder.file((f.label || 'photo_' + (i + 1)) + '.' + ext, blob);
          } catch { /* skip unreachable file */ }
        });
        await Promise.all(fetches);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = (delivery.client_name || 'gallery') + '.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        dbIncrementDownload(delivery.id);
        showToast('Download started!');
        return;
      } catch { /* fall through to individual downloads */ }
    }

    // Fallback: trigger individual downloads sequentially
    for (const f of files) {
      triggerDownload(f.url, f.label);
      dbIncrementDownload(delivery.id);
      await new Promise(r => setTimeout(r, 300));
    }
    showToast('Files downloading…');
  }

  /* ── Lightbox ────────────────────────────── */
  function openLightbox(idx) {
    _lbFiles = delivery.files || [];
    _lbIdx   = idx;
    renderLightbox();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function renderLightbox() {
    const f = _lbFiles[_lbIdx];
    if (!f) return;
    clbImg.src         = f.url;
    clbImg.alt         = f.label || 'Photo ' + (_lbIdx + 1);
    clbFname.textContent = f.label || 'Photo ' + (_lbIdx + 1);
    clbCtr.textContent = `${_lbIdx + 1} / ${_lbFiles.length}`;
    clbPrev.style.display = _lbIdx > 0 ? '' : 'none';
    clbNext.style.display = _lbIdx < _lbFiles.length - 1 ? '' : 'none';
    syncLightboxApprovalBtns();
  }

  function syncLightboxApprovalBtns() {
    const f  = _lbFiles[_lbIdx];
    if (!f) return;
    const st = approvals[f.id];
    clbKeep.classList.toggle('active',  st === 'keep');
    clbRemov.classList.toggle('active', st === 'remove');
  }

  clbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  clbPrev.addEventListener('click', () => { if (_lbIdx > 0) { _lbIdx--; renderLightbox(); } });
  clbNext.addEventListener('click', () => { if (_lbIdx < _lbFiles.length - 1) { _lbIdx++; renderLightbox(); } });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')       closeLightbox();
    if (e.key === 'ArrowLeft')  { if (_lbIdx > 0) { _lbIdx--; renderLightbox(); } }
    if (e.key === 'ArrowRight') { if (_lbIdx < _lbFiles.length - 1) { _lbIdx++; renderLightbox(); } }
  });

  clbKeep.addEventListener('click', async () => {
    const f = _lbFiles[_lbIdx];
    if (!f) return;
    await setApproval(f.id, 'keep');
    renderLightbox();
  });

  clbRemov.addEventListener('click', async () => {
    const f = _lbFiles[_lbIdx];
    if (!f) return;
    await setApproval(f.id, 'remove');
    renderLightbox();
  });

  clbDl.addEventListener('click', () => {
    const f = _lbFiles[_lbIdx];
    if (!f) return;
    triggerDownload(f.url, f.label);
    dbIncrementDownload(delivery.id);
  });

  /* ── Submit feedback ─────────────────────── */
  async function submitFeedback() {
    if (_submitted) return;
    _submitted = true;

    // Mark submission in server approvals
    const all = {};
    try {
      const r = await fetch('/api/sync.php?resource=approvals', { cache: 'no-store' });
      if (r.ok) Object.assign(all, await r.json());
    } catch {}
    all[delivery.id] = { ...approvals, _submitted: true, _submittedAt: new Date().toISOString() };
    localStorage.setItem('nej_approvals', JSON.stringify(all));
    try {
      await fetch('/api/sync.php?resource=approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all),
      });
    } catch {}

    // Show confirmation UI — sticky bar
    const submitBtn = document.getElementById('clientSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.innerHTML   = '✓ Feedback Sent';
      submitBtn.style.background = 'var(--green)';
    }

    // Show confirmation screen in main content area
    const files  = delivery.files || [];
    const kept   = files.filter(f => approvals[f.id] === 'keep').length;
    const removed = files.filter(f => approvals[f.id] === 'remove').length;
    mainEl.innerHTML = `
      <div class="confirm-screen">
        <div class="confirm-screen__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2>Thank you!</h2>
        <p>Your selections have been sent to NEJstudios.<br/>
           <strong style="color:var(--white)">${kept} photo${kept !== 1 ? 's' : ''} kept · ${removed} removed</strong><br/>
           <br/>The studio will review your feedback and get back to you soon.</p>
      </div>`;

    showToast('Your feedback has been sent to the studio!', 4000);
  }

  /* ── Password gate ───────────────────────── */
  function showPasswordGate(onSuccess) {
    mainEl.innerHTML = `
      <div style="max-width:440px;margin:60px auto 0;">
        <div style="background:var(--bg-2);border:1px solid var(--border);border-top:3px solid var(--gold);
                    border-radius:16px;padding:44px 40px;text-align:center;">
          <div style="font-family:var(--serif);font-size:1.8rem;color:var(--white);margin-bottom:4px;">
            <span style="color:var(--gold)">NEJ</span>studios
          </div>
          <div style="font-size:0.72rem;color:var(--grey-3);letter-spacing:0.08em;margin-bottom:28px;">Client Gallery Portal</div>
          <div style="font-family:var(--serif);font-size:1.2rem;color:var(--white);margin-bottom:6px;">Password Required</div>
          <p style="font-size:0.82rem;color:var(--grey-3);margin-bottom:24px;line-height:1.6;">This gallery is protected. Enter the password to access your photos.</p>
          <input type="password" id="cpwInput" placeholder="Enter password"
            style="width:100%;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;
                   padding:14px 18px;color:var(--white);font-size:0.95rem;font-family:var(--sans);
                   outline:none;text-align:center;letter-spacing:0.1em;margin-bottom:10px;
                   transition:border-color 0.2s;box-sizing:border-box;"
            autocomplete="off" />
          <div id="cpwErr" style="font-size:0.8rem;color:var(--red);min-height:20px;margin-bottom:10px;"></div>
          <button id="cpwBtn"
            style="width:100%;padding:14px;background:var(--gold);color:#000;font-weight:700;
                   font-size:0.85rem;letter-spacing:0.08em;text-transform:uppercase;border-radius:8px;
                   cursor:pointer;border:none;font-family:var(--sans);min-height:44px;
                   transition:background 0.2s;">
            Unlock Gallery
          </button>
        </div>
      </div>`;

    const input  = document.getElementById('cpwInput');
    const errEl  = document.getElementById('cpwErr');
    const btn    = document.getElementById('cpwBtn');

    function tryUnlock() {
      if (input.value === delivery.password) {
        onSuccess();
      } else {
        errEl.textContent = 'Incorrect password. Try again.';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
    input.focus();
  }

  /* ── Render full portal ──────────────────── */
  function renderPortal() {
    const files     = delivery.files || [];
    const fileCount = files.length;

    const expiryHtml = delivery.expires_at
      ? `<div class="expiry-notice">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
           </svg>
           This gallery expires on ${new Date(delivery.expires_at + 'T12:00:00').toLocaleDateString('en-NG', { dateStyle: 'long' })}.
         </div>`
      : '';

    mainEl.innerHTML = `
      <!-- Hero greeting -->
      <div class="client-hero">
        <div class="client-hero__title">Photo Selection — ${delivery.client_name}</div>
        <div class="client-hero__sub">Mark photos you'd like to keep. Your feedback goes directly to the studio.</div>
        <div class="client-hero__meta">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            ${fileCount} photo${fileCount !== 1 ? 's' : ''}
          </span>
          <span id="clientApprCount">0 / ${fileCount} reviewed</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="progress-bar-wrap">
        <div class="progress-bar-label">
          <span class="progress-bar-label__text" id="progressLabel">0 of ${fileCount} reviewed (0%)</span>
          <span class="progress-bar-label__count">Selection Progress</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" id="progressFill" style="width:0%"></div>
        </div>
        <div class="progress-stats">
          <span class="stat-badge stat-badge--kept"    id="statsKept">0 kept</span>
          <span class="stat-badge stat-badge--removed" id="statsRemoved">0 removed</span>
          <span class="stat-badge stat-badge--pending" id="statsPending">${fileCount} pending</span>
        </div>
      </div>

      <!-- Notice -->
      <div class="client-notice">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Mark each photo as <strong style="color:var(--green);margin:0 3px;">Keep</strong> or
        <strong style="color:var(--red);margin:0 3px;">Remove</strong>, then hit
        <strong style="color:var(--gold);margin:0 3px;">Send Feedback</strong> when you're done.
        Click any photo to open it in full size.
      </div>

      ${expiryHtml}

      <!-- Gallery toolbar -->
      <div class="gallery-toolbar">
        <div class="gallery-toolbar__label">
          Your Gallery <span id="clientSummaryBar">0 of ${fileCount} selected</span>
        </div>
        <button class="btn-dl-all" id="clientDlAll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download All
        </button>
      </div>

      <!-- Filter tabs -->
      <div class="filter-tabs">
        <button class="filter-tab active" data-filter="all">
          All <span class="tab-count" id="tabCountAll">${fileCount}</span>
        </button>
        <button class="filter-tab" data-filter="selected">
          Selected <span class="tab-count" id="tabCountSelected">0</span>
        </button>
        <button class="filter-tab" data-filter="removed">
          Removed <span class="tab-count" id="tabCountRemoved">0</span>
        </button>
      </div>

      <!-- Grid -->
      <div class="client-gallery-grid" id="clientGrid">
        ${fileCount === 0 ? `<div class="client-empty" style="grid-column:1/-1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <h2>No Photos Yet</h2>
          <p>No photos have been added to this gallery. Check back soon.</p>
        </div>` : ''}
      </div>`;

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _activeFilter = tab.dataset.filter;
        renderGrid();
      });
    });

    // Wire up buttons
    document.getElementById('clientDlAll').addEventListener('click', downloadAll);

    // Sticky bar submit
    const submitBtn = document.getElementById('clientSubmitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submitFeedback);

    // Render the grid
    renderGrid();
    updateSummary();
  }

  /* ── Boot sequence ───────────────────────── */
  const params = new URLSearchParams(location.search);
  const token  = params.get('t');

  // Show loading spinner
  mainEl.innerHTML = `
    <div style="text-align:center;padding:80px 24px;color:var(--grey-3);">
      <div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--gold);
                  border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div>
      <p>Loading your gallery…</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg);}}</style>`;

  if (!token) {
    showError('No Gallery Token', 'No gallery token was provided in the URL. Please use the link sent to you by NEJstudios.');
    return;
  }

  // Fetch delivery
  let del;
  try {
    del = await dbGetGalleryDelivery(token);
  } catch {
    showError('Connection Error', 'Could not connect to the gallery server. Please try again later.');
    return;
  }

  if (!del) {
    showError('Link Not Found', 'This gallery link is invalid or has been removed. Please contact NEJstudios for assistance.');
    return;
  }

  // Check expiry
  const today = new Date().toISOString().slice(0, 10);
  if (del.expires_at && del.expires_at < today) {
    showError('Gallery Expired', `This gallery link expired on ${del.expires_at}. Please contact NEJstudios to request a new link.`);
    return;
  }

  delivery = del;

  // Load existing approvals from server
  approvals = await loadApprovals(delivery.id);

  // Check if already submitted
  if (approvals._submitted) {
    _submitted = true;
  }

  // Password gate if needed
  if (delivery.password) {
    showPasswordGate(() => renderPortal());
  } else {
    renderPortal();
  }

})();
