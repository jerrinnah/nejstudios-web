/* ══════════════════════════════════════════
   NEJstudios — Site Content Applier
   Reads from localStorage key 'nej_cms' and
   overrides the static HTML on page load.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const CMS_KEY = 'nej_cms';

  /* ── DEFAULTS (mirrors cms.js) ── */
  const DEFAULTS = {
    hero: {
      eyebrow: 'Studio · Weddings · Events — Lagos, Nigeria',
      line1: 'Where', line2: 'Light Meets', line3: 'Legacy.',
      sub: 'NEJstudios — a creative studio in Lagos built on craft, precision, and a deep love for visual storytelling.',
      cta1: 'Book a Session', cta2: 'View Our Work', bg: '',
    },
    settings: {
      stat1v: '500+', stat1l: 'Events Covered',
      stat2v: '8 yrs', stat2l: 'In Business',
      stat3v: '4K',   stat3l: 'Ultra HD Films',
      ticker: 'Studio Sessions, Weddings, Brand Films, Portraits, Music Videos, Drone Cinematography',
      footerCopy: '© 2026 NEJstudios. All rights reserved.',
      footerTag: 'Designed with craft in Lagos, Nigeria.',
    },
    about: {
      title: 'Crafted with', titleItalic: 'Purpose.',
      para1: 'NEJstudios was born out of a simple but powerful belief — that every moment worth living is worth preserving. What started as a one-person passion project in Lagos has grown into a full production house trusted by brands, families, and couples across Nigeria.',
      para2: "We obsess over light, emotion, and storytelling. Whether we're on a commercial set or capturing a bride's first glance at her groom, our standard never changes: excellence in every frame.",
      m1v: '500+', m1l: 'Events Covered',
      m2v: '200+', m2l: 'Weddings',
      m3v: '50+',  m3l: 'Brand Films',
    },
    contact: {
      phone: '+234 800 000 0000', email: 'hello@nejstudios.com', location: 'Lagos, Nigeria',
      instagram: '', youtube: '', facebook: '', tiktok: '',
    },
  };

  /* ── LOAD DATA ── */
  let cms = {};
  try { cms = JSON.parse(localStorage.getItem(CMS_KEY)) || {}; } catch { cms = {}; }

  function get(k) { return Object.assign({}, DEFAULTS[k] || {}, cms[k] || {}); }
  function getArr(k, def) { return (cms[k] != null) ? cms[k] : def; }

  /* ── UTILS ── */
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function q(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  /* ══════════════════════════════
     HERO
  ══════════════════════════════ */
  function applyHero() {
    const d = get('hero');

    // Only apply if cms has saved hero data
    if (!cms.hero && !cms.settings) return;

    const h = cms.hero;
    const s = cms.settings;

    if (h) {
      const eyebrow = q('.hero__eyebrow');
      if (eyebrow && h.eyebrow) eyebrow.textContent = h.eyebrow;

      const title = q('.hero__title');
      if (title && (h.line1 || h.line2 || h.line3)) {
        const l1 = h.line1 || DEFAULTS.hero.line1;
        const l2 = h.line2 || DEFAULTS.hero.line2;
        const l3 = h.line3 || DEFAULTS.hero.line3;
        title.innerHTML = `${esc(l1)}<br /><em>${esc(l2)}</em><br />${esc(l3)}`;
      }

      const sub = q('.hero__sub');
      if (sub && h.sub) {
        sub.textContent = h.sub;
      }

      const cta1 = q('.hero__actions .book-trigger');
      if (cta1 && h.cta1) cta1.textContent = h.cta1;

      const cta2 = q('.hero__actions .btn--ghost');
      if (cta2 && h.cta2) cta2.textContent = h.cta2;

      // Background image
      if (h.bg) {
        const heroBg = q('.hero__bg');
        if (heroBg) {
          heroBg.style.backgroundImage = `url('${h.bg}')`;
          heroBg.style.backgroundSize = 'cover';
          heroBg.style.backgroundPosition = 'center';
        }
      }
    }

    // Stat badges
    if (s) {
      const badges = qa('.hero__stats .stat-badge');
      const stats = [
        { v: s.stat1v, l: s.stat1l },
        { v: s.stat2v, l: s.stat2l },
        { v: s.stat3v, l: s.stat3l },
      ];
      badges.forEach((badge, i) => {
        if (!stats[i]) return;
        const strong = badge.querySelector('strong');
        const span = badge.querySelector('span');
        if (strong && stats[i].v) strong.textContent = stats[i].v;
        if (span && stats[i].l) span.textContent = stats[i].l;
      });
    }
  }

  /* ══════════════════════════════
     BRAND TICKER STRIP
  ══════════════════════════════ */
  function applyTicker() {
    if (!cms.settings || !cms.settings.ticker) return;
    const track = q('.brand-strip__track');
    if (!track) return;

    const items = cms.settings.ticker.split(',').map(s => s.trim()).filter(Boolean);
    if (!items.length) return;

    const doubled = [...items, ...items]; // seamless loop
    track.innerHTML = doubled.map((item, i) =>
      `<span>${esc(item)}</span>${i < doubled.length - 1 ? '<span class="brand-strip__dot">✦</span>' : ''}`
    ).join('');
  }

  /* ══════════════════════════════
     SERVICES
  ══════════════════════════════ */
  function applyServices() {
    if (!cms.services) return;
    const cards = qa('.services__grid--3 .service-card');
    cms.services.forEach((svc, i) => {
      const card = cards[i];
      if (!card) return;

      const numEl = card.querySelector('.service-card__number');
      const titleEl = card.querySelector('h3');
      const descEl = card.querySelector('p');

      if (numEl && svc.number) numEl.textContent = svc.number;
      if (titleEl && svc.title) titleEl.textContent = svc.title;
      if (descEl && svc.desc) descEl.textContent = svc.desc;

      // Featured toggle
      card.classList.toggle('service-card--featured', !!svc.highlight);
      card.classList.toggle('service-card--accent', !!svc.highlight);
    });
  }

  /* ══════════════════════════════
     ABOUT
  ══════════════════════════════ */
  function applyAbout() {
    if (!cms.about) return;
    const a = cms.about;

    const titleEl = q('.about__content .section-title');
    if (titleEl && (a.title || a.titleItalic)) {
      titleEl.innerHTML = `${esc(a.title || DEFAULTS.about.title)}<br /><em>${esc(a.titleItalic || DEFAULTS.about.titleItalic)}</em>`;
    }

    const paras = qa('.about__content > p');
    if (paras[0] && a.para1) paras[0].textContent = a.para1;
    if (paras[1] && a.para2) paras[1].textContent = a.para2;

    const milestones = qa('.about__milestones .milestone');
    const mData = [
      { v: a.m1v, l: a.m1l }, { v: a.m2v, l: a.m2l }, { v: a.m3v, l: a.m3l },
    ];
    milestones.forEach((m, i) => {
      if (!mData[i]) return;
      const strong = m.querySelector('strong');
      const span = m.querySelector('span');
      if (strong && mData[i].v) strong.textContent = mData[i].v;
      if (span && mData[i].l) span.textContent = mData[i].l;
    });
  }

  /* ══════════════════════════════
     STUDIO GALLERY
  ══════════════════════════════ */
  function applyStudioGallery() {
    if (!cms.studioGallery) return;
    const grid = q('#studioGrid');
    if (!grid) return;

    grid.innerHTML = cms.studioGallery.map(item => `
      <div class="masonry-item${item.tall ? ' masonry-item--tall' : ''}${item.wide ? ' masonry-item--wide' : ''}" data-category="${esc(item.cat || 'portrait')}">
        <img src="${esc(item.url)}" alt="${esc(item.label || '')}" loading="lazy" />
        <div class="masonry-item__overlay"><span>${esc(item.label || '')}</span></div>
      </div>
    `).join('');
  }

  /* ══════════════════════════════
     WEDDING GALLERY
  ══════════════════════════════ */
  function applyWeddingGallery() {
    const grid = q('#weddingGrid');
    if (!grid) return;

    const photos = cms.weddingPhotos;
    const videos = cms.weddingVideos;

    if (!photos && !videos) return;

    const photoItems = (photos || []).map(item => `
      <div class="wedding-item${item.tall ? ' wedding-item--tall' : ''}${item.wide ? ' wedding-item--wide' : ''}" data-category="${esc(item.cat || 'photo')}">
        <img src="${esc(item.url)}" alt="${esc(item.label || '')}" loading="lazy" />
        <div class="wedding-item__overlay"><span>${esc(item.label || '')}</span></div>
      </div>
    `);

    const videoItems = (videos || []).map(v => `
      <div class="wedding-item wedding-item--video" data-category="${esc(v.cat || 'film')}">
        <div class="video-thumb" data-video-id="${esc(v.id)}" data-source="youtube">
          <img src="https://img.youtube.com/vi/${esc(v.id)}/hqdefault.jpg" alt="${esc(v.label || '')}" />
          <div class="video-card__play">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
          </div>
        </div>
        <div class="wedding-item__video-info">
          <span>${esc(v.label || v.id)}</span>
          <div>
            <button class="btn btn--gold btn--sm play-btn" data-video-id="${esc(v.id)}" data-source="youtube">Play Film</button>
            <a href="https://youtube.com" target="_blank" class="btn btn--ghost btn--sm">YouTube ↗</a>
          </div>
        </div>
      </div>
    `);

    // Interleave: photo, photo, video, photo, photo, video...
    const merged = [];
    let vi = 0, pi = 0;
    while (pi < photoItems.length || vi < videoItems.length) {
      if (pi < photoItems.length) merged.push(photoItems[pi++]);
      if (pi < photoItems.length) merged.push(photoItems[pi++]);
      if (vi < videoItems.length) merged.push(videoItems[vi++]);
    }

    grid.innerHTML = merged.join('');
  }

  /* ══════════════════════════════
     PRODUCTION VIDEOS
  ══════════════════════════════ */
  const CAT_LABELS = { brand: 'Brand Film', music: 'Music Video', doc: 'Documentary', event: 'Event Film' };

  function applyProductionVideos() {
    if (!cms.productionVideos) return;
    const grid = q('#productionGrid');
    if (!grid) return;

    grid.innerHTML = cms.productionVideos.map(v => {
      const catLabel = CAT_LABELS[v.cat] || v.cat || 'Film';
      const thumb = v.featured
        ? `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`
        : `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
      return `
        <div class="video-card${v.featured ? ' video-card--featured' : ''}" data-category="${esc(v.cat || 'brand')}">
          <div class="video-thumb" data-video-id="${esc(v.id)}" data-source="youtube">
            <img src="${esc(thumb)}" alt="${esc(v.title || v.id)}" />
            <div class="video-card__play">
              <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>
            </div>
            <div class="video-card__badge">YouTube</div>
          </div>
          <div class="video-card__info">
            <span class="video-card__tag">${esc(catLabel)}</span>
            <h4>${esc(v.title || v.id)}</h4>
            ${v.desc ? `<p>${esc(v.desc)}</p>` : ''}
            <div class="video-card__actions">
              <button class="btn btn--gold btn--sm play-btn" data-video-id="${esc(v.id)}" data-source="youtube">${v.featured ? 'Play Now' : 'Play'}</button>
              <a href="https://youtube.com" target="_blank" class="btn btn--ghost btn--sm">${v.featured ? 'Watch on YouTube ↗' : 'YouTube ↗'}</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ══════════════════════════════
     PACKAGES
  ══════════════════════════════ */
  function buildPkgCard(t) {
    return `
      <div class="pkg-card${t.featured ? ' pkg-card--featured' : ''}">
        ${t.featured ? '<div class="pkg-card__badge">Most Popular</div>' : ''}
        <div class="pkg-card__header">
          <span class="pkg-card__eyebrow">${esc(t.desc || '')}</span>
          <h3>${esc(t.name)}</h3>
          <div class="pkg-card__price">From <strong>${esc(t.price)}</strong></div>
        </div>
        <ul class="pkg-card__features">
          ${(t.features || []).map(f => `<li>${esc(f)}</li>`).join('')}
        </ul>
        <button class="btn ${t.featured ? 'btn--gold' : 'btn--outline'} pkg-card__cta book-trigger"
          data-type="${t.name.toLowerCase().includes('bespoke') || t.name.toLowerCase().includes('luxury') || t.name.toLowerCase().includes('diamond') || t.name.toLowerCase().includes('cinematic') ? 'event' : 'studio'}">
          ${t.price.toLowerCase().includes('custom') || t.price === '' ? 'Get a Quote' : 'Book This Package'}
        </button>
      </div>
    `;
  }

  function applyPackages() {
    if (cms.packagesProduction) {
      const grid = q('#productionPkgs');
      if (grid) grid.innerHTML = cms.packagesProduction.map(buildPkgCard).join('');
    }
    if (cms.packagesWedding) {
      const grid = q('#weddingPkgs');
      if (grid) grid.innerHTML = cms.packagesWedding.map(buildPkgCard).join('');
    }
  }

  /* ══════════════════════════════
     TESTIMONIALS
  ══════════════════════════════ */
  function applyTestimonials() {
    if (!cms.testimonials || !cms.testimonials.length) return;
    const track = q('#testimonialTrack');
    if (!track) return;

    track.innerHTML = cms.testimonials.map(t => `
      <div class="testimonial-card">
        <div class="testimonial-card__stars">★★★★★</div>
        <blockquote>"${esc(t.quote)}"</blockquote>
        <div class="testimonial-card__author">
          <div>
            <strong>${esc(t.name)}</strong>
            <span>${esc(t.role || '')}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  /* ══════════════════════════════
     CONTACT & SOCIALS
  ══════════════════════════════ */
  function applyContact() {
    if (!cms.contact) return;
    const c = cms.contact;

    // Phone
    const phoneItem = q('.contact__item a[href^="tel:"]');
    if (phoneItem && c.phone) {
      phoneItem.href = 'tel:' + c.phone.replace(/\s/g, '');
      phoneItem.textContent = c.phone;
    }

    // Email
    const emailItem = q('.contact__item a[href^="mailto:"]');
    if (emailItem && c.email) {
      emailItem.href = 'mailto:' + c.email;
      emailItem.textContent = c.email;
    }

    // Location
    const locationItem = q('.contact__item span');
    if (locationItem && c.location) locationItem.textContent = c.location;

    // Social links
    const socials = qa('.contact__social .social-link');
    const links = [c.instagram, c.youtube, c.facebook, c.tiktok];
    socials.forEach((el, i) => {
      if (links[i]) el.href = links[i];
    });
  }

  /* ══════════════════════════════
     FOOTER
  ══════════════════════════════ */
  function applyFooter() {
    if (!cms.settings) return;
    const s = cms.settings;
    const spans = qa('.footer__bottom span');
    if (spans[0] && s.footerCopy) spans[0].textContent = s.footerCopy;
    if (spans[1] && s.footerTag) {
      // Preserve the dashboard link
      const dashLink = spans[1].querySelector('a');
      const dashHtml = dashLink ? ` &nbsp;·&nbsp; ${dashLink.outerHTML}` : '';
      spans[1].innerHTML = esc(s.footerTag) + dashHtml;
    }
  }

  /* ══════════════════════════════
     RUN ALL APPLIERS
  ══════════════════════════════ */
  function applyAll() {
    applyHero();
    applyTicker();
    applyServices();
    applyAbout();
    applyStudioGallery();
    applyWeddingGallery();
    applyProductionVideos();
    applyPackages();
    applyTestimonials();
    applyContact();
    applyFooter();
  }

  // Run on DOMContentLoaded (or immediately if already loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }

})();
