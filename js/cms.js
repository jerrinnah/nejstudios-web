/* ══════════════════════════════════════════
   NEJstudios — CMS Logic  (js/cms.js)
   ══════════════════════════════════════════ */

const CMS_PIN = 'nej2026';
const CMS_KEY = 'nej_cms';

/* ── DEFAULT CONTENT ── */
const DEFAULTS = {
  hero: {
    eyebrow: 'Studio · Weddings · Events — Lagos, Nigeria',
    line1: 'Where',
    line2: 'Light Meets',
    line3: 'Legacy.',
    sub: 'NEJstudios — a creative studio in Lagos built on craft, precision, and a deep love for visual storytelling.',
    cta1: 'Book a Session',
    cta2: 'View Our Work',
    bg: '',
  },
  services: [
    { number: '01', title: 'Studio Sessions', desc: 'Portraits, product shoots, and creative concepts in a fully equipped studio environment.', highlight: false },
    { number: '02', title: 'Weddings', desc: 'Full wedding coverage — white weddings, traditional ceremonies, and pre-wedding shoots.', highlight: true },
    { number: '03', title: 'Event Production', desc: 'Corporate events, brand activations, concerts, and documentary cinematography.', highlight: false },
  ],
  about: {
    title: 'Crafted with',
    titleItalic: 'Purpose.',
    para1: 'Founded in Lagos, NEJstudios was born from a passion to preserve life\'s most meaningful moments through the art of photography and film. Every frame we capture is a deliberate act of storytelling.',
    para2: 'From intimate studio sessions to grand weddings and high-production brand films, we bring the same level of care, technical excellence, and creative vision to every project.',
    m1v: '500+', m1l: 'Events Covered',
    m2v: '200+', m2l: 'Weddings',
    m3v: '50+',  m3l: 'Brand Films',
  },
  studioGallery: [
    { url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80', label: 'Studio Portrait', cat: 'portrait', tall: false },
    { url: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80', label: 'Commercial Shoot', cat: 'commercial', tall: true },
  ],
  weddingPhotos: [
    { url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80', label: 'Ada & Chidi — 2024', cat: 'white photo', tall: false, wide: false },
    { url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80', label: 'Bride Prep', cat: 'white photo', tall: true, wide: false },
  ],
  weddingVideos: [
    { id: 'dQw4w9WgXcQ', label: 'Chioma & Emeka — Highlight', cat: 'film white' },
  ],
  productionVideos: [
    { id: 'dQw4w9WgXcQ', title: 'The Vision Campaign', desc: 'A cinematic brand story', cat: 'brand', featured: true },
  ],
  packagesProduction: [
    { name: 'Essential', price: '₦150,000', desc: 'Perfect for emerging brands', featured: false, features: ['Half-day shoot (4hrs)', '2-min promo film', 'Colour grading', 'Digital delivery'] },
    { name: 'Premium', price: '₦350,000', desc: 'Our most loved package', featured: true, features: ['Full-day shoot (8hrs)', '5-min brand film', 'Drone footage', 'Colour grading', 'BTS photos', 'Raw + edited files'] },
    { name: 'Cinematic', price: '₦700,000+', desc: 'Full feature production', featured: false, features: ['Multi-day shoot', 'Director & full crew', 'Custom score / music', 'Colour grading & VFX', 'Festival-quality master', 'Dedicated post-production'] },
  ],
  packagesWedding: [
    { name: 'Silver', price: '₦200,000', desc: 'Essential wedding coverage', featured: false, features: ['6-hour coverage', '300+ edited photos', 'Online gallery', 'Digital download'] },
    { name: 'Gold', price: '₦450,000', desc: 'Our most popular choice', featured: true, features: ['Full day coverage', '500+ edited photos', '5-min wedding film', 'Drone shots', 'Online gallery', 'USB + prints'] },
    { name: 'Diamond', price: '₦850,000+', desc: 'The complete experience', featured: false, features: ['2-day coverage', 'Unlimited photos', 'Cinematic feature film', 'Drone & aerial shots', 'Engagement session', 'Premium album + prints', 'Dedicated editor'] },
  ],
  testimonials: [
    { quote: "NEJstudios didn't just film our wedding — they preserved a memory that will last generations. Every detail was perfect.", name: 'Ada Okonkwo', role: 'Wedding Client, 2024' },
    { quote: "The team's eye for light and composition transformed our brand campaign completely. Highly professional.", name: 'Tunde Bello', role: 'Brand Film Client' },
    { quote: "From the studio setup to the final edits, everything was world-class. Our portraits are breathtaking.", name: 'Chisom Eze', role: 'Studio Session Client' },
  ],
  contact: {
    phone: '+234 800 000 0000',
    email: 'hello@nejstudios.com',
    location: 'Lagos, Nigeria',
    instagram: '',
    youtube: '',
    facebook: '',
    tiktok: '',
  },
  settings: {
    stat1v: '500+', stat1l: 'Events Covered',
    stat2v: '8 yrs', stat2l: 'In Business',
    stat3v: '4K',   stat3l: 'Ultra HD Films',
    ticker: 'Studio Sessions, Weddings, Brand Films, Portraits, Music Videos, Drone Cinematography',
    footerCopy: '© 2026 NEJstudios. All rights reserved.',
    footerTag: 'Designed with craft in Lagos, Nigeria.',
  },
};

/* ── STATE ── */
let cmsData = {};

/* ── UTILS ── */
function load() {
  try { cmsData = JSON.parse(localStorage.getItem(CMS_KEY)) || {}; } catch { cmsData = {}; }
}
function save() {
  localStorage.setItem(CMS_KEY, JSON.stringify(cmsData));
}
function get(section) {
  return Object.assign({}, DEFAULTS[section], cmsData[section]);
}
function getArr(section) {
  return (cmsData[section] != null) ? cmsData[section] : JSON.parse(JSON.stringify(DEFAULTS[section]));
}
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v || '';
}
function checked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}
function setChecked(id, v) {
  const el = document.getElementById(id);
  if (el) el.checked = !!v;
}

function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderLeftColor = type === 'ok' ? 'var(--gold)' : 'var(--red)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function showSaved() {
  const el = document.getElementById('savedIndicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

/* ── AUTH ── */
function isAuthed() {
  return sessionStorage.getItem('cms_auth') === '1';
}
function showCMS() {
  document.getElementById('loginGate').classList.add('hidden');
  document.getElementById('cmsShell').style.display = 'flex';
  load();
  initCMS();
}

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const pin = document.getElementById('pinInput').value;
  const err = document.getElementById('loginErr');
  if (pin === CMS_PIN) {
    sessionStorage.setItem('cms_auth', '1');
    err.textContent = '';
    showCMS();
  } else {
    err.textContent = 'Incorrect PIN. Try again.';
    document.getElementById('pinInput').value = '';
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('cms_auth');
  location.reload();
});

if (isAuthed()) showCMS();

/* ── TABS ── */
const TAB_TITLES = {
  'hero': 'Hero Section',
  'services': 'Services',
  'about': 'About',
  'studio-gallery': 'Studio Gallery',
  'wedding-gallery': 'Wedding Gallery',
  'production-videos': 'Production Videos',
  'packages-production': 'Production Packages',
  'packages-wedding': 'Wedding Packages',
  'testimonials': 'Testimonials',
  'contact': 'Contact & Socials',
  'settings': 'Site Settings',
};

function switchTab(tabId) {
  document.querySelectorAll('.sb-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(el => el.classList.toggle('active', el.id === 'tab-' + tabId));
  document.getElementById('topBarTitle').textContent = TAB_TITLES[tabId] || tabId;
}

/* ── INIT ── */
function initCMS() {
  // Tab clicks
  document.querySelectorAll('.sb-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Save buttons
  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => saveSection(btn.dataset.save));
  });

  // Reset links
  document.querySelectorAll('[data-reset]').forEach(link => {
    link.addEventListener('click', () => resetSection(link.dataset.reset));
  });

  populateAll();
}

/* ── POPULATE ALL FIELDS ── */
function populateAll() {
  populateHero();
  populateServices();
  populateAbout();
  populateStudioGallery();
  populateWeddingGallery();
  populateProductionVideos();
  populatePackages('packagesProduction', 'prodPkgGrid');
  populatePackages('packagesWedding', 'weddingPkgGrid');
  populateTestimonials();
  populateContact();
  populateSettings();
}

/* ── HERO ── */
function populateHero() {
  const d = get('hero');
  setVal('hero-eyebrow', d.eyebrow);
  setVal('hero-line1', d.line1);
  setVal('hero-line2', d.line2);
  setVal('hero-line3', d.line3);
  setVal('hero-sub', d.sub);
  setVal('hero-cta1', d.cta1);
  setVal('hero-cta2', d.cta2);
  setVal('hero-bg', d.bg);
  updateHeroPreview();
  updateBgPreview();

  // Live preview on input
  ['hero-eyebrow','hero-line1','hero-line2','hero-line3','hero-sub'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateHeroPreview);
  });
  document.getElementById('hero-bg')?.addEventListener('input', updateBgPreview);
}

function updateHeroPreview() {
  const eyebrow = val('hero-eyebrow') || DEFAULTS.hero.eyebrow;
  const l1 = val('hero-line1') || DEFAULTS.hero.line1;
  const l2 = val('hero-line2') || DEFAULTS.hero.line2;
  const l3 = val('hero-line3') || DEFAULTS.hero.line3;
  const sub = val('hero-sub') || DEFAULTS.hero.sub;
  const ey = document.getElementById('hp-eyebrow');
  const ti = document.getElementById('hp-title');
  const su = document.getElementById('hp-sub');
  if (ey) ey.textContent = eyebrow;
  if (ti) ti.innerHTML = `${escHtml(l1)} <em>${escHtml(l2)}</em> ${escHtml(l3)}`;
  if (su) su.textContent = sub;
}

function updateBgPreview() {
  const url = val('hero-bg');
  const img = document.getElementById('hero-bg-preview');
  if (!img) return;
  if (url) { img.src = url; img.classList.add('show'); } else { img.classList.remove('show'); }
}

/* ── SERVICES ── */
function populateServices() {
  const services = getArr('services');
  const container = document.getElementById('servicesEditor');
  if (!container) return;
  container.innerHTML = services.map((s, i) => `
    <div class="cms-card" data-svc="${i}">
      <div class="cms-card__title">Service ${i + 1} — ${escHtml(s.title)}</div>
      <div class="form-row">
        <div class="fg">
          <label class="lbl">Number Badge</label>
          <input type="text" id="svc-num-${i}" value="${escAttr(s.number)}" placeholder="01" />
        </div>
        <div class="fg">
          <label class="lbl">Title</label>
          <input type="text" id="svc-title-${i}" value="${escAttr(s.title)}" placeholder="Service Name" />
        </div>
      </div>
      <div class="fg">
        <label class="lbl">Description</label>
        <textarea id="svc-desc-${i}" rows="2">${escHtml(s.desc)}</textarea>
      </div>
      <div class="toggle-row">
        <label class="toggle"><input type="checkbox" id="svc-hl-${i}" ${s.highlight ? 'checked' : ''} /><span class="toggle-slider"></span></label>
        <span class="toggle-label">Featured / Highlight card (gold accent)</span>
      </div>
    </div>
  `).join('');
}

/* ── ABOUT ── */
function populateAbout() {
  const d = get('about');
  setVal('about-title', d.title);
  setVal('about-titleItalic', d.titleItalic);
  setVal('about-para1', d.para1);
  setVal('about-para2', d.para2);
  setVal('about-m1v', d.m1v); setVal('about-m1l', d.m1l);
  setVal('about-m2v', d.m2v); setVal('about-m2l', d.m2l);
  setVal('about-m3v', d.m3v); setVal('about-m3l', d.m3l);
}

/* ── STUDIO GALLERY ── */
function populateStudioGallery() {
  renderImageList('studioGallery', 'studioGalleryList');
  setupAddForm('addStudioImg', 'addStudioForm', 'sg-add-btn', 'sg-cancel-btn', async () => {
    const url = await resolveImageUrl('sg-file', 'sg-url');
    if (!url) return toast('Please upload an image or paste a URL', 'err');
    const item = { url, label: val('sg-label'), cat: val('sg-cat'), tall: checked('sg-tall') };
    try {
      const arr = getArr('studioGallery');
      arr.push(item);
      cmsData.studioGallery = arr;
      save();
    } catch (e) { return toast('Storage full — use an image URL instead of uploading.', 'err'); }
    renderImageList('studioGallery', 'studioGalleryList');
    clearForm(['sg-url','sg-label']);
    const fi = document.getElementById('sg-file'); if (fi) fi.value = '';
    setChecked('sg-tall', false);
    toast('Photo added');
  });
}

/* ── WEDDING GALLERY ── */
function populateWeddingGallery() {
  renderImageList('weddingPhotos', 'weddingPhotoList');
  renderVideoList('weddingVideos', 'weddingVideoList');

  setupAddForm('addWeddingPhoto', 'addWeddingPhotoForm', 'wp-add-btn', 'wp-cancel-btn', async () => {
    const url = await resolveImageUrl('wp-file', 'wp-url');
    if (!url) return toast('Please upload an image or paste a URL', 'err');
    const item = { url, label: val('wp-label'), cat: val('wp-cat'), tall: checked('wp-tall'), wide: checked('wp-wide') };
    try {
      const arr = getArr('weddingPhotos');
      arr.push(item);
      cmsData.weddingPhotos = arr;
      save();
    } catch (e) { return toast('Storage full — use an image URL instead of uploading.', 'err'); }
    renderImageList('weddingPhotos', 'weddingPhotoList');
    clearForm(['wp-url','wp-label']);
    const fi = document.getElementById('wp-file'); if (fi) fi.value = '';
    setChecked('wp-tall', false); setChecked('wp-wide', false);
    toast('Photo added');
  });

  setupAddForm('addWeddingVideo', 'addWeddingVideoForm', 'wv-add-btn', 'wv-cancel-btn', () => {
    const item = { id: val('wv-id'), label: val('wv-label'), cat: val('wv-cat') };
    if (!item.id) return toast('YouTube Video ID required', 'err');
    const arr = getArr('weddingVideos');
    arr.push(item);
    cmsData.weddingVideos = arr;
    save();
    renderVideoList('weddingVideos', 'weddingVideoList');
    clearForm(['wv-id','wv-label']);
    toast('Film added');
  });
}

/* ── PRODUCTION VIDEOS ── */
function populateProductionVideos() {
  renderProductionVideoList();

  setupAddForm('addProductionVideo', 'addProductionVideoForm', 'pv-add-btn', 'pv-cancel-btn', () => {
    const item = { id: val('pv-id'), title: val('pv-title'), desc: val('pv-desc'), cat: val('pv-cat'), featured: checked('pv-featured') };
    if (!item.id) return toast('YouTube Video ID required', 'err');
    const arr = getArr('productionVideos');
    arr.push(item);
    cmsData.productionVideos = arr;
    save();
    renderProductionVideoList();
    clearForm(['pv-id','pv-title','pv-desc']);
    setChecked('pv-featured', false);
    toast('Video added');
  });
}

/* ── PACKAGES ── */
function populatePackages(key, gridId) {
  const tiers = getArr(key);
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = tiers.map((t, i) => `
    <div class="pkg-edit-card ${t.featured ? 'featured-card' : ''}" data-pkg="${i}">
      <div class="pkg-edit-card__header">${escHtml(t.name)}</div>
      <div class="fg">
        <label class="lbl">Tier Name</label>
        <input type="text" id="${key}-name-${i}" value="${escAttr(t.name)}" />
      </div>
      <div class="fg">
        <label class="lbl">Price</label>
        <input type="text" id="${key}-price-${i}" value="${escAttr(t.price)}" placeholder="₦150,000" />
      </div>
      <div class="fg">
        <label class="lbl">Tagline</label>
        <input type="text" id="${key}-desc-${i}" value="${escAttr(t.desc)}" />
      </div>
      <div class="toggle-row" style="margin-bottom:8px">
        <label class="toggle"><input type="checkbox" id="${key}-feat-${i}" ${t.featured ? 'checked' : ''} /><span class="toggle-slider"></span></label>
        <span class="toggle-label">Featured tier</span>
      </div>
      <div class="lbl" style="margin-bottom:6px">Features</div>
      <div class="features-list" id="${key}-fl-${i}">
        ${t.features.map((f, fi) => featureRow(key, i, fi, f)).join('')}
      </div>
      <span class="add-feature" data-pkg-key="${key}" data-pkg-idx="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add feature
      </span>
    </div>
  `).join('');

  // Add feature listeners
  grid.querySelectorAll('.add-feature').forEach(el => {
    el.addEventListener('click', () => {
      const k = el.dataset.pkgKey;
      const idx = parseInt(el.dataset.pkgIdx);
      const fl = document.getElementById(`${k}-fl-${idx}`);
      const fi = fl.children.length;
      const row = document.createElement('div');
      row.className = 'feature-item';
      row.innerHTML = featureRow(k, idx, fi, '');
      fl.appendChild(row);
      row.querySelector('input').focus();
    });
  });

  // Delete feature listeners (delegated)
  grid.addEventListener('click', e => {
    const btn = e.target.closest('[data-del-feature]');
    if (btn) btn.closest('.feature-item').remove();
  });
}

function featureRow(key, pkgIdx, featIdx, value) {
  return `
    <div class="feature-item">
      <input type="text" id="${key}-f-${pkgIdx}-${featIdx}" value="${escAttr(value)}" placeholder="Feature…" />
      <button data-del-feature title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

/* ── TESTIMONIALS ── */
function populateTestimonials() {
  renderTestimonials();
  setupAddForm('addTestiBtn', 'addTestiForm', 'testi-add-btn', 'testi-cancel-btn', () => {
    const item = { quote: val('testi-quote'), name: val('testi-name'), role: val('testi-role') };
    if (!item.quote || !item.name) return toast('Quote and name required', 'err');
    const arr = getArr('testimonials');
    arr.push(item);
    cmsData.testimonials = arr;
    save();
    renderTestimonials();
    clearForm(['testi-quote','testi-name','testi-role']);
    toast('Testimonial added');
  });
}

/* ── CONTACT ── */
function populateContact() {
  const d = get('contact');
  setVal('contact-phone', d.phone);
  setVal('contact-email', d.email);
  setVal('contact-location', d.location);
  setVal('social-instagram', d.instagram);
  setVal('social-youtube', d.youtube);
  setVal('social-facebook', d.facebook);
  setVal('social-tiktok', d.tiktok);
}

/* ── SETTINGS ── */
function populateSettings() {
  const d = get('settings');
  setVal('stat1v', d.stat1v); setVal('stat1l', d.stat1l);
  setVal('stat2v', d.stat2v); setVal('stat2l', d.stat2l);
  setVal('stat3v', d.stat3v); setVal('stat3l', d.stat3l);
  setVal('ticker-items', d.ticker);
  setVal('footer-copy', d.footerCopy);
  setVal('footer-tag', d.footerTag);
}

/* ── RENDER HELPERS ── */
function renderImageList(key, listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const items = getArr(key);
  if (!items.length) { list.innerHTML = '<p style="font-size:.8rem;color:var(--grey-4);padding:8px 0">No photos yet.</p>'; return; }
  list.innerHTML = items.map((item, i) => `
    <div class="list-item" data-idx="${i}">
      <img class="list-item__thumb" src="${escAttr(item.url)}" alt="" onerror="this.style.background='var(--bg-4)';this.src=''" />
      <div class="list-item__body">
        <div class="list-item__label">${escHtml(item.label || 'Untitled')}</div>
        <div class="list-item__meta">${escHtml(item.cat || '')}${item.tall ? ' · tall' : ''}${item.wide ? ' · wide' : ''}</div>
      </div>
      <div class="list-item__actions">
        <button class="btn-danger-sm" data-del-img="${key}" data-idx="${i}">Remove</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-del-img]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getArr(key);
      arr.splice(parseInt(btn.dataset.idx), 1);
      cmsData[key] = arr;
      save();
      renderImageList(key, listId);
      toast('Photo removed');
    });
  });
}

function renderVideoList(key, listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const items = getArr(key);
  if (!items.length) { list.innerHTML = '<p style="font-size:.8rem;color:var(--grey-4);padding:8px 0">No videos yet.</p>'; return; }
  list.innerHTML = items.map((item, i) => `
    <div class="list-item" data-idx="${i}">
      <div class="list-item__yt">
        <img src="https://img.youtube.com/vi/${escAttr(item.id)}/mqdefault.jpg" alt="" />
      </div>
      <div class="list-item__body">
        <div class="list-item__label">${escHtml(item.label || item.id)}</div>
        <div class="list-item__meta">${escHtml(item.cat || '')} · ID: ${escHtml(item.id)}</div>
      </div>
      <div class="list-item__actions">
        <button class="btn-danger-sm" data-del-vid="${key}" data-idx="${i}">Remove</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-del-vid]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getArr(key);
      arr.splice(parseInt(btn.dataset.idx), 1);
      cmsData[key] = arr;
      save();
      renderVideoList(key, listId);
      toast('Video removed');
    });
  });
}

function renderProductionVideoList() {
  const list = document.getElementById('productionVideoList');
  if (!list) return;
  const items = getArr('productionVideos');
  if (!items.length) { list.innerHTML = '<p style="font-size:.8rem;color:var(--grey-4);padding:8px 0">No videos yet.</p>'; return; }
  list.innerHTML = items.map((item, i) => `
    <div class="list-item" data-idx="${i}">
      <div class="list-item__yt">
        <img src="https://img.youtube.com/vi/${escAttr(item.id)}/mqdefault.jpg" alt="" />
      </div>
      <div class="list-item__body">
        <div class="list-item__label">${escHtml(item.title || item.id)}${item.featured ? ' <span style="color:var(--gold);font-size:.68rem">[featured]</span>' : ''}</div>
        <div class="list-item__meta">${escHtml(item.cat || '')} · ${escHtml(item.desc || '')}</div>
      </div>
      <div class="list-item__actions">
        <button class="btn-danger-sm" data-del-pv data-idx="${i}">Remove</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-del-pv]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getArr('productionVideos');
      arr.splice(parseInt(btn.dataset.idx), 1);
      cmsData.productionVideos = arr;
      save();
      renderProductionVideoList();
      toast('Video removed');
    });
  });
}

function renderTestimonials() {
  const list = document.getElementById('testiList');
  if (!list) return;
  const items = getArr('testimonials');
  if (!items.length) { list.innerHTML = '<p style="font-size:.8rem;color:var(--grey-4);padding:8px 0">No testimonials yet.</p>'; return; }
  list.innerHTML = items.map((t, i) => `
    <div class="testi-item" data-idx="${i}">
      <div class="testi-item__quote">"${escHtml(t.quote)}"</div>
      <div class="testi-item__meta">
        <span>${escHtml(t.name)} — ${escHtml(t.role)}</span>
        <div class="testi-item__actions">
          <button class="btn-danger-sm" data-del-testi data-idx="${i}">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-del-testi]').forEach(btn => {
    btn.addEventListener('click', () => {
      const arr = getArr('testimonials');
      arr.splice(parseInt(btn.dataset.idx), 1);
      cmsData.testimonials = arr;
      save();
      renderTestimonials();
      toast('Testimonial removed');
    });
  });
}

/* ── ADD FORM HELPER ── */
function setupAddForm(addBtnId, formId, confirmBtnId, cancelBtnId, onConfirm) {
  const addBtn = document.getElementById(addBtnId);
  const form = document.getElementById(formId);
  const confirmBtn = document.getElementById(confirmBtnId);
  const cancelBtn = document.getElementById(cancelBtnId);
  if (!addBtn || !form) return;

  addBtn.addEventListener('click', () => form.classList.toggle('open'));
  cancelBtn?.addEventListener('click', () => form.classList.remove('open'));
  confirmBtn?.addEventListener('click', () => {
    onConfirm();
    form.classList.remove('open');
  });
}

function clearForm(ids) {
  ids.forEach(id => setVal(id, ''));
}

/* ── SAVE SECTIONS ── */
function saveSection(key) {
  switch (key) {
    case 'hero': {
      cmsData.hero = {
        eyebrow: val('hero-eyebrow'),
        line1: val('hero-line1'),
        line2: val('hero-line2'),
        line3: val('hero-line3'),
        sub: val('hero-sub'),
        cta1: val('hero-cta1'),
        cta2: val('hero-cta2'),
        bg: val('hero-bg'),
      };
      break;
    }
    case 'services': {
      const defaults = DEFAULTS.services;
      cmsData.services = defaults.map((_, i) => ({
        number: val(`svc-num-${i}`) || defaults[i].number,
        title: val(`svc-title-${i}`) || defaults[i].title,
        desc: document.getElementById(`svc-desc-${i}`)?.value.trim() || defaults[i].desc,
        highlight: checked(`svc-hl-${i}`),
      }));
      break;
    }
    case 'about': {
      cmsData.about = {
        title: val('about-title'),
        titleItalic: val('about-titleItalic'),
        para1: document.getElementById('about-para1')?.value.trim() || '',
        para2: document.getElementById('about-para2')?.value.trim() || '',
        m1v: val('about-m1v'), m1l: val('about-m1l'),
        m2v: val('about-m2v'), m2l: val('about-m2l'),
        m3v: val('about-m3v'), m3l: val('about-m3l'),
      };
      break;
    }
    case 'studioGallery':
      // Already saved incrementally on add/delete; just confirm
      break;
    case 'weddingGallery':
      break;
    case 'productionVideos':
      break;
    case 'packagesProduction':
      cmsData.packagesProduction = readPackages('packagesProduction');
      break;
    case 'packagesWedding':
      cmsData.packagesWedding = readPackages('packagesWedding');
      break;
    case 'testimonials':
      break;
    case 'contact': {
      cmsData.contact = {
        phone: val('contact-phone'),
        email: val('contact-email'),
        location: val('contact-location'),
        instagram: val('social-instagram'),
        youtube: val('social-youtube'),
        facebook: val('social-facebook'),
        tiktok: val('social-tiktok'),
      };
      break;
    }
    case 'settings': {
      cmsData.settings = {
        stat1v: val('stat1v'), stat1l: val('stat1l'),
        stat2v: val('stat2v'), stat2l: val('stat2l'),
        stat3v: val('stat3v'), stat3l: val('stat3l'),
        ticker: document.getElementById('ticker-items')?.value.trim() || '',
        footerCopy: val('footer-copy'),
        footerTag: val('footer-tag'),
      };
      break;
    }
  }
  save();
  showSaved();
  toast('Changes saved — refresh the site to see them.');
}

function readPackages(key) {
  const defaults = DEFAULTS[key];
  return defaults.map((_, i) => {
    const fl = document.getElementById(`${key}-fl-${i}`);
    const features = fl ? Array.from(fl.querySelectorAll('input[type=text]'))
      .map(inp => inp.value.trim()).filter(Boolean) : [];
    return {
      name: val(`${key}-name-${i}`) || defaults[i].name,
      price: val(`${key}-price-${i}`) || defaults[i].price,
      desc: val(`${key}-desc-${i}`) || defaults[i].desc,
      featured: checked(`${key}-feat-${i}`),
      features,
    };
  });
}

/* ── RESET SECTIONS ── */
function resetSection(key) {
  if (!confirm('Reset this section to defaults? Saved content will be lost.')) return;
  const map = {
    hero: 'hero', services: 'services', about: 'about',
    studioGallery: 'studioGallery', weddingGallery: ['weddingPhotos','weddingVideos'],
    productionVideos: 'productionVideos',
    packagesProduction: 'packagesProduction', packagesWedding: 'packagesWedding',
    testimonials: 'testimonials', contact: 'contact', settings: 'settings',
  };
  const keys = Array.isArray(map[key]) ? map[key] : [map[key]];
  keys.forEach(k => delete cmsData[k]);
  save();
  populateAll();
  toast('Section reset to defaults.');
}

/* ── FILE UPLOAD HELPER ── */
/**
 * readFileAsDataURL(fileInputId) → Promise<string|null>
 * Converts a selected image file to a base64 data URL.
 * Returns null if no file is selected.
 */
function readFileAsDataURL(fileInputId) {
  return new Promise((resolve) => {
    const input = document.getElementById(fileInputId);
    if (!input || !input.files || !input.files[0]) { resolve(null); return; }
    const file = input.files[0];
    if (!file.type.startsWith('image/')) { toast('Please select an image file (JPG, PNG, WEBP)', 'err'); resolve(null); return; }
    if (file.size > 3 * 1024 * 1024) {
      toast('Image is larger than 3 MB — please use a URL instead for large files.', 'err');
      resolve(null); return;
    }
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => { toast('Could not read file.', 'err'); resolve(null); };
    reader.readAsDataURL(file);
  });
}

/**
 * resolveImageUrl(fileInputId, urlInputId) → Promise<string>
 * Prefers an uploaded file; falls back to the typed URL.
 */
async function resolveImageUrl(fileInputId, urlInputId) {
  const fromFile = await readFileAsDataURL(fileInputId);
  if (fromFile) return fromFile;
  return val(urlInputId);
}

/* ── XSS HELPERS ── */
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
