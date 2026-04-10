/* ══════════════════════════════════════════════
   NEJstudios — Client Gallery Portal (client.js)
   Standalone page — no dependency on dashboard.js
   ══════════════════════════════════════════════ */

const STORAGE_KEY   = 'nej_bookings';
const GALLERY_KEY   = 'nej_gallery';
const APPROVALS_KEY = 'nej_approvals';

const EVENT_TYPE_LABELS = {
  'brand-film':'Brand Film','music-video':'Music Video','documentary':'Documentary',
  'corporate-event':'Corporate Event','other-production':'Production',
  'traditional-wedding':'Traditional Wedding','white-wedding':'White Wedding',
  'full-wedding':'Full Wedding','engagement':'Engagement Shoot',
};
const SESSION_EMOJI = { Birthday:'🎂', Family:'👨‍👩‍👧', Creative:'✨', Fashion:'👗', Product:'📦' };

/* ════════════════════════════════════════════
   STORAGE HELPERS (standalone copies)
   ════════════════════════════════════════════ */
function getBookings()     { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
function getGalleries()    { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '{}'); }
function getClientGallery(id) { return getGalleries()[id] || []; }
function getApprovals()    { return JSON.parse(localStorage.getItem(APPROVALS_KEY) || '{}'); }

function saveApproval(bookingId, imgId, value) {
  const all = getApprovals();
  if (!all[bookingId]) all[bookingId] = {};
  if (value === null) {
    delete all[bookingId][imgId];
  } else {
    all[bookingId][imgId] = value;
  }
  localStorage.setItem(APPROVALS_KEY, JSON.stringify(all));
}

/* ════════════════════════════════════════════
   DOWNLOAD HELPERS (standalone copies)
   ════════════════════════════════════════════ */
function downloadDataUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

async function downloadAsZip(imgs, zipName) {
  if (!window.JSZip) { showToast('ZIP library not loaded yet, try again.'); return; }
  const zip = new JSZip();
  imgs.forEach(img => {
    const ext  = img.name.includes('.') ? '' : '.jpg';
    const name = img.name + ext;
    const b64  = img.url.split(',')[1];
    zip.file(name, b64, { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = zipName + '.zip'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════ */
const toastEl = document.getElementById('clientToast');
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

/* ════════════════════════════════════════════
   LIGHTBOX STATE
   ════════════════════════════════════════════ */
let _lbBookingId = null;
let _lbImgs      = [];
let _lbIdx       = 0;

const lightbox   = document.getElementById('clientLightbox');
const clbImg     = document.getElementById('clbImg');
const clbFilename = document.getElementById('clbFilename');
const clbCounter  = document.getElementById('clbCounter');
const clbClose    = document.getElementById('clbClose');
const clbPrev     = document.getElementById('clbPrev');
const clbNext     = document.getElementById('clbNext');
const clbDownload = document.getElementById('clbDownload');
const clbKeep     = document.getElementById('clbKeep');
const clbRemove   = document.getElementById('clbRemove');

function openLightbox(bookingId, imgs, idx) {
  _lbBookingId = bookingId;
  _lbImgs      = imgs;
  _lbIdx       = idx;
  renderLightboxFrame();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLightboxFrame() {
  const img = _lbImgs[_lbIdx];
  if (!img) return;
  clbImg.src = img.url;
  clbImg.alt = img.name;
  clbFilename.textContent = img.name;
  clbCounter.textContent  = `${_lbIdx + 1} / ${_lbImgs.length}`;

  // Approval buttons state
  const approvals = (getApprovals()[_lbBookingId]) || {};
  const status    = approvals[img.id];
  clbKeep.classList.toggle('active',   status === 'keep');
  clbRemove.classList.toggle('active', status === 'remove');

  // Arrow visibility
  clbPrev.style.visibility = _lbIdx > 0 ? 'visible' : 'hidden';
  clbNext.style.visibility = _lbIdx < _lbImgs.length - 1 ? 'visible' : 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  clbImg.src = '';
  document.body.style.overflow = '';
  // Refresh grid to show updated badges after potential approval changes
  renderGrid(_lbBookingId, _lbImgs);
}

clbClose.addEventListener('click', closeLightbox);
clbPrev.addEventListener('click', () => { if (_lbIdx > 0) { _lbIdx--; renderLightboxFrame(); } });
clbNext.addEventListener('click', () => { if (_lbIdx < _lbImgs.length - 1) { _lbIdx++; renderLightboxFrame(); } });
clbDownload.addEventListener('click', () => {
  const img = _lbImgs[_lbIdx];
  if (img) downloadDataUrl(img.url, img.name);
});

// Lightbox approval buttons
function handleLbApproval(choice) {
  const img = _lbImgs[_lbIdx];
  if (!img) return;
  const approvals = (getApprovals()[_lbBookingId]) || {};
  const current   = approvals[img.id];
  // Toggle off if same choice
  const newVal = current === choice ? null : choice;
  saveApproval(_lbBookingId, img.id, newVal);
  renderLightboxFrame();
  showToast(newVal ? `Marked as ${newVal}` : 'Selection cleared');
}

clbKeep.addEventListener('click',   () => handleLbApproval('keep'));
clbRemove.addEventListener('click', () => handleLbApproval('remove'));

// Click outside image closes lightbox
lightbox.addEventListener('click', e => {
  if (e.target === lightbox || e.target.classList.contains('client-lightbox__body')) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     { closeLightbox(); return; }
  if (e.key === 'ArrowLeft')  { if (_lbIdx > 0) { _lbIdx--; renderLightboxFrame(); } return; }
  if (e.key === 'ArrowRight') { if (_lbIdx < _lbImgs.length - 1) { _lbIdx++; renderLightboxFrame(); } return; }
});

/* ════════════════════════════════════════════
   GALLERY GRID
   ════════════════════════════════════════════ */
function renderGrid(bookingId, imgs) {
  const container = document.getElementById('clientGalleryGrid');
  if (!container) return;
  const approvals = (getApprovals()[bookingId]) || {};

  if (!imgs.length) {
    container.innerHTML = '<p style="color:var(--grey-4);font-size:0.85rem;grid-column:1/-1;text-align:center;padding:24px 0">No photos have been uploaded yet.</p>';
    return;
  }

  container.innerHTML = imgs.map((img, idx) => {
    const approval = approvals[img.id];
    const badgeClass = approval === 'keep' ? 'client-thumb__badge--keep'
                     : approval === 'remove' ? 'client-thumb__badge--remove'
                     : 'client-thumb__badge--none';
    const badgeChar = approval === 'keep' ? '✓' : approval === 'remove' ? '✕' : '';
    return `
      <div class="client-thumb" data-id="${img.id}" data-idx="${idx}">
        <img src="${img.url}" alt="${img.name}" loading="lazy">
        <div class="client-thumb__badge ${badgeClass}">${badgeChar}</div>
        <div class="client-thumb__overlay">
          <div class="client-thumb__actions">
            <button class="client-thumb__btn client-thumb__btn--keep${approval === 'keep' ? ' active' : ''}" data-action="keep" data-id="${img.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              Keep
            </button>
            <button class="client-thumb__btn client-thumb__btn--remove${approval === 'remove' ? ' active' : ''}" data-action="remove" data-id="${img.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Remove
            </button>
            <button class="client-thumb__btn client-thumb__btn--dl" data-action="dl" data-id="${img.id}" title="Download">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Wire action buttons
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const imgId   = btn.dataset.id;
      const action  = btn.dataset.action;
      const img     = imgs.find(i => i.id === imgId);
      if (!img) return;

      if (action === 'dl') {
        downloadDataUrl(img.url, img.name);
        return;
      }

      // keep / remove — toggle
      const approvals = (getApprovals()[bookingId]) || {};
      const current   = approvals[imgId];
      const newVal    = current === action ? null : action;
      saveApproval(bookingId, imgId, newVal);
      showToast(newVal ? `Marked as ${newVal}` : 'Selection cleared');
      renderGrid(bookingId, imgs); // re-render to reflect changes
    });
  });

  // Wire thumbnail click → lightbox (only on non-button areas)
  container.querySelectorAll('.client-thumb').forEach(thumb => {
    thumb.addEventListener('click', e => {
      if (e.target.closest('[data-action]')) return;
      const idx = parseInt(thumb.dataset.idx, 10);
      openLightbox(bookingId, imgs, idx);
    });
  });
}

/* ════════════════════════════════════════════
   MAIN INIT
   ════════════════════════════════════════════ */
function init() {
  const params    = new URLSearchParams(window.location.search);
  const bookingId = params.get('id');
  const main      = document.getElementById('clientMain');

  if (!bookingId) {
    main.innerHTML = notFoundHtml('No booking ID provided.');
    return;
  }

  const booking = getBookings().find(b => b.id === bookingId);
  if (!booking) {
    main.innerHTML = notFoundHtml(`We couldn't find a booking with ID <strong>${bookingId}</strong>.`);
    return;
  }

  const imgs = getClientGallery(bookingId);
  const isEvent = booking.bookingKind === 'event';
  const sessionLabel = isEvent
    ? (EVENT_TYPE_LABELS[booking.eventType] || booking.eventType || '—')
    : `${SESSION_EMOJI[booking.sessionType] || '📸'} ${booking.sessionType || '—'}`;

  document.title = `${booking.clientName} — NEJstudios Gallery`;

  main.innerHTML = `
    <div class="client-info-card">
      <div class="client-info-card__name">${booking.clientName}</div>
      <div class="client-info-card__meta">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M20.188 10.934a8 8 0 10-8.375 8.375"/></svg>
          ${isEvent ? 'Event' : 'Studio Session'}: ${sessionLabel}
        </span>
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Booking ID: ${booking.id}
        </span>
      </div>
    </div>

    <div class="client-notice">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Review your photos and mark your favourites. Your selections are saved automatically.
    </div>

    <div class="client-gallery-toolbar">
      <div class="client-gallery-title">
        Gallery
        <span id="galleryPhotoCount">${imgs.length} photo${imgs.length !== 1 ? 's' : ''}</span>
      </div>
      ${imgs.length > 0 ? `
        <button class="btn-dl-all" id="btnDlAll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download All
        </button>` : ''}
    </div>

    <div class="client-gallery-grid" id="clientGalleryGrid"></div>
  `;

  renderGrid(bookingId, imgs);

  // Download All
  const btnDlAll = document.getElementById('btnDlAll');
  if (btnDlAll) {
    btnDlAll.addEventListener('click', async () => {
      if (!imgs.length) return;
      if (imgs.length === 1) { downloadDataUrl(imgs[0].url, imgs[0].name); return; }
      showToast(`Preparing ZIP (${imgs.length} files)…`);
      await downloadAsZip(imgs, `${booking.clientName}-gallery`);
    });
  }
}

function notFoundHtml(msg) {
  return `
    <div class="client-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2>Gallery link not found</h2>
      <p>${msg}<br>Please contact NEJstudios for your gallery link.</p>
    </div>`;
}

init();
