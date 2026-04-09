/* ══════════════════════════════════════════════
   NEJstudios — Main JS
   ══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── NAV: scroll shadow ── */
  const nav = document.getElementById('nav');
  const backToTop = document.getElementById('backToTop');
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
    backToTop.classList.toggle('visible', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── MOBILE MENU ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  hamburger.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  window.closeMobile = function () {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ── REVEAL ON SCROLL ── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const delay = e.target.dataset.delay ? parseInt(e.target.dataset.delay) : 0;
          setTimeout(() => e.target.classList.add('visible'), delay);
          revealObserver.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  /* ══════════════════════════════════════════════
     BOOKING CHOOSER
  ══════════════════════════════════════════════ */
  const chooser = document.getElementById('bookingChooser');
  const chooserBackdrop = document.getElementById('chooserBackdrop');
  const chooserClose = document.getElementById('chooserClose');

  // Map type → routing
  // studio → dedicated booking.html
  // wedding / event → inline booking form with pre-fill
  const TYPE_MAP = {
    studio:  { redirect: 'booking', value: null,              label: 'Studio Session'  },
    wedding: { redirect: null,           value: 'full-wedding',    label: 'Wedding'          },
    event:   { redirect: null,           value: 'corporate-event', label: 'Event Production' },
  };

  function openChooser() {
    chooser.classList.add('open');
    document.body.style.overflow = 'hidden';
    chooserClose.focus();
  }

  function closeChooser() {
    chooser.classList.remove('open');
    document.body.style.overflow = '';
  }

  function selectBookingType(type) {
    closeChooser();
    const map = TYPE_MAP[type] || TYPE_MAP.studio;

    // Studio sessions → dedicated simple booking page
    if (map.redirect) {
      window.location.href = map.redirect;
      return;
    }

    // Wedding / Event → inline form with pre-fill
    const eventTypeSelect = document.getElementById('eventType');
    if (eventTypeSelect) eventTypeSelect.value = map.value;

    const formLabel = document.querySelector('.booking-form-section .section-label');
    if (formLabel) formLabel.textContent = `Booking — ${map.label}`;

    const formSection = document.getElementById('booking-form');
    if (formSection) {
      const top = formSection.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    }

    if (eventTypeSelect) {
      eventTypeSelect.style.borderColor = 'var(--gold)';
      eventTypeSelect.style.boxShadow = '0 0 0 3px var(--gold-glow)';
      setTimeout(() => {
        eventTypeSelect.style.borderColor = '';
        eventTypeSelect.style.boxShadow = '';
      }, 2000);
    }
  }

  // All "Book" trigger buttons
  document.querySelectorAll('.book-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const type = btn.dataset.type; // may be undefined for generic triggers
      if (type) {
        // Service card or gallery CTA with a known type — skip chooser, go direct
        selectBookingType(type);
      } else {
        openChooser();
      }
    });
  });

  // Chooser card selections
  chooser.querySelectorAll('.chooser-card').forEach((card) => {
    card.addEventListener('click', () => selectBookingType(card.dataset.type));
  });

  chooserClose.addEventListener('click', closeChooser);
  chooserBackdrop.addEventListener('click', closeChooser);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (chooser.classList.contains('open')) closeChooser();
      else closeVideo();
    }
  });

  /* ── GALLERY FILTER TABS (generic) ── */
  function initFilterTabs(tabsId, gridId, itemSelector) {
    const tabs = document.getElementById(tabsId);
    const grid = document.getElementById(gridId);
    if (!tabs || !grid) return;

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;

      tabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      grid.querySelectorAll(itemSelector).forEach((item) => {
        const cat = item.dataset.category || '';
        const show = filter === 'all' || cat.split(' ').includes(filter);
        item.classList.toggle('hidden', !show);
      });
    });
  }

  initFilterTabs('studioTabs', 'studioGrid', '.masonry-item');
  initFilterTabs('productionTabs', 'productionGrid', '.video-card');
  initFilterTabs('weddingTabs', 'weddingGrid', '.wedding-item');

  /* ── STUDIO LOAD MORE ── */
  const loadMoreBtn = document.getElementById('loadMoreStudio');
  if (loadMoreBtn) {
    const extraItems = [
      { cat: 'bts',       label: 'Lighting Setup',  img: 'https://images.unsplash.com/photo-1574717024453-354056aafa98?w=600&q=80', tall: false },
      { cat: 'portrait',  label: 'Studio Portrait', img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80', tall: true  },
      { cat: 'commercial',label: 'Ad Campaign',     img: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=600&q=80', tall: false },
      { cat: 'event',     label: 'Product Launch',  img: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&q=80', tall: false },
    ];
    let loaded = false;

    loadMoreBtn.addEventListener('click', () => {
      if (loaded) { loadMoreBtn.style.display = 'none'; return; }
      loaded = true;
      const grid = document.getElementById('studioGrid');
      extraItems.forEach(({ cat, label, img, tall }) => {
        const div = document.createElement('div');
        div.className = 'masonry-item' + (tall ? ' masonry-item--tall' : '');
        div.dataset.category = cat;
        div.innerHTML = `<img src="${img}" alt="${label}" loading="lazy" /><div class="masonry-item__overlay"><span>${label}</span></div>`;
        div.addEventListener('click', () => openLightbox(img, label));
        grid.appendChild(div);
      });
      loadMoreBtn.textContent = 'No More Items';
      loadMoreBtn.disabled = true;
    });
  }

  /* ── IMAGE LIGHTBOX ── */
  function openLightbox(src, caption) {
    const modal = document.getElementById('videoModal');
    const embed = document.getElementById('modalEmbed');
    embed.innerHTML = `<img src="${src}" alt="${caption}" style="width:100%;display:block;max-height:90vh;object-fit:contain;" />`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  document.querySelectorAll('.masonry-item').forEach((item) => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const label = item.querySelector('.masonry-item__overlay span')?.textContent || '';
      if (img) openLightbox(img.src, label);
    });
  });

  document.querySelectorAll('.wedding-item:not(.wedding-item--video)').forEach((item) => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const label = item.querySelector('.wedding-item__overlay span')?.textContent || '';
      if (img) openLightbox(img.src, label);
    });
  });

  /* ── VIDEO MODAL ── */
  const videoModal = document.getElementById('videoModal');
  const modalEmbed = document.getElementById('modalEmbed');
  const modalClose = document.getElementById('modalClose');
  const modalBackdrop = document.getElementById('modalBackdrop');

  function openVideo(videoId, source) {
    let embedHTML = '';
    if (source === 'youtube') {
      embedHTML = `<iframe
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1"
        allow="autoplay; encrypted-media; fullscreen"
        allowfullscreen
        title="NEJstudios video"
      ></iframe>`;
    } else {
      embedHTML = `<video src="${videoId}" controls autoplay style="width:100%;height:100%;display:block;"></video>`;
    }
    modalEmbed.innerHTML = embedHTML;
    videoModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeVideo() {
    videoModal.classList.remove('open');
    modalEmbed.innerHTML = '';
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.play-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openVideo(btn.dataset.videoId, btn.dataset.source || 'youtube');
    });
  });

  document.querySelectorAll('.video-thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      openVideo(thumb.dataset.videoId, thumb.dataset.source || 'youtube');
    });
  });

  modalClose.addEventListener('click', closeVideo);
  modalBackdrop.addEventListener('click', closeVideo);

  /* ── PACKAGE TABS ── */
  const pkgTabs = document.querySelectorAll('.pkg-tab');
  const productionPkgs = document.getElementById('productionPkgs');
  const weddingPkgs = document.getElementById('weddingPkgs');

  pkgTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      pkgTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const pkg = tab.dataset.pkg;
      if (productionPkgs) productionPkgs.style.display = pkg === 'production' ? '' : 'none';
      if (weddingPkgs) weddingPkgs.style.display = pkg === 'wedding' ? '' : 'none';
    });
  });

  /* ── TESTIMONIALS SLIDER ── */
  const track = document.getElementById('testimonialTrack');
  const dotsContainer = document.getElementById('testimonialDots');
  const prevBtn = document.getElementById('prevTestimonial');
  const nextBtn = document.getElementById('nextTestimonial');

  if (track) {
    const cards = track.querySelectorAll('.testimonial-card');
    let current = 0;
    let perView = getPerView();
    let total = Math.ceil(cards.length / perView);
    let autoTimer;

    function getPerView() {
      if (window.innerWidth < 768) return 1;
      if (window.innerWidth < 1024) return 2;
      return 3;
    }

    function buildDots() {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('button');
        dot.className = 'testimonials__dot' + (i === current ? ' active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
      }
    }

    function goTo(idx) {
      current = (idx + total) % total;
      const cardWidth = track.parentElement.offsetWidth;
      track.style.transform = `translateX(-${current * cardWidth}px)`;
      dotsContainer.querySelectorAll('.testimonials__dot').forEach((d, i) =>
        d.classList.toggle('active', i === current)
      );
    }

    function startAuto() { autoTimer = setInterval(() => goTo(current + 1), 5000); }
    function stopAuto() { clearInterval(autoTimer); }

    prevBtn.addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });
    nextBtn.addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });

    window.addEventListener('resize', () => {
      const newPer = getPerView();
      if (newPer !== perView) {
        perView = newPer;
        total = Math.ceil(cards.length / perView);
        current = 0;
        buildDots();
        goTo(0);
      }
    });

    buildDots();
    goTo(0);
    startAuto();

    track.parentElement.addEventListener('mouseenter', stopAuto);
    track.parentElement.addEventListener('mouseleave', startAuto);

    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) { stopAuto(); goTo(dx < 0 ? current + 1 : current - 1); startAuto(); }
    });
  }

  /* ── EVENT BOOKING — EmailJS config ── */
  /* Mirror these from booking.js if you want event emails too */
  const EVT_EMAILJS_PUBLIC_KEY      = 'YOUR_PUBLIC_KEY';
  const EVT_EMAILJS_SERVICE_ID      = 'YOUR_SERVICE_ID';
  const EVT_EMAILJS_STUDIO_TEMPLATE = 'YOUR_EVENT_STUDIO_TEMPLATE_ID';
  const EVT_EMAILJS_CLIENT_TEMPLATE = 'YOUR_EVENT_CLIENT_TEMPLATE_ID';

  /* ── BOOKING FORM (Event / Wedding) ── */
  const bookingForm = document.getElementById('bookingForm');
  const formSuccess = document.getElementById('formSuccess');

  /* Shared event booking ID so share link can reference it */
  let _lastEventBookingId = null;
  let _lastEventBooking   = null;

  function genBookingId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'NEJ-';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  function saveEventBooking(data) {
    const key = 'nej_bookings';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(data);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  function makeShareUrl(booking) {
    const share = {
      id:       booking.id,
      name:     booking.clientName,
      kind:     booking.bookingKind,
      type:     booking.eventType || booking.sessionType || '',
      date:     booking.eventDate || '',
      location: booking.location  || '',
      status:   booking.status,
      ts:       booking.createdAt,
    };
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(share)));
      return `${location.origin}/booking-view?b=${encoded}`;
    } catch { return ''; }
  }

  /* Global so the inline onclick can reach it */
  window.copyEventShareLink = function () {
    if (!_lastEventBooking) return;
    const url = makeShareUrl(_lastEventBooking);
    navigator.clipboard.writeText(url).then(() => {
      const copied = document.getElementById('eventShareCopied');
      if (copied) { copied.style.display = 'inline'; setTimeout(() => { copied.style.display = 'none'; }, 2500); }
    }).catch(() => { prompt('Copy this link:', url); });
  };

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const required = bookingForm.querySelectorAll('[required]');
      let valid = true;
      required.forEach((field) => {
        field.style.borderColor = '';
        field.style.boxShadow   = '';
        if (!field.value.trim() || (field.type === 'checkbox' && !field.checked)) {
          field.style.borderColor = '#e05555';
          if (valid) field.focus();
          valid = false;
        }
      });
      if (!valid) return;

      const submitBtn = bookingForm.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.querySelector('.btn-text').textContent = 'Sending…';

      const fv    = (id) => (document.getElementById(id) || {}).value || '';
      const firstName  = fv('firstName');
      const lastName   = fv('lastName');
      const clientName = [firstName, lastName].filter(Boolean).join(' ');
      const bookingId  = genBookingId();
      const now        = Date.now();

      const booking = {
        id:          bookingId,
        bookingKind: 'event',
        firstName, lastName, clientName,
        phone:       fv('phone'),
        email:       fv('email'),
        eventType:   fv('eventType'),
        package:     fv('package'),
        eventDate:   fv('eventDate'),
        location:    fv('eventLocation'),
        budget:      fv('budget'),
        deliverables:fv('message'),
        status:      'pending',
        createdAt:   now,
      };

      saveEventBooking(booking);
      _lastEventBookingId = bookingId;
      _lastEventBooking   = booking;

      /* ── Send emails if EmailJS is configured ── */
      const emailReady = EVT_EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';
      if (emailReady && typeof emailjs !== 'undefined') {
        try {
          emailjs.init({ publicKey: EVT_EMAILJS_PUBLIC_KEY });
          const params = {
            booking_id:        bookingId,
            client_name:       clientName,
            client_first_name: firstName,
            client_email:      booking.email,
            phone:             booking.phone,
            event_type:        booking.eventType,
            event_date:        booking.eventDate,
            location:          booking.location,
            package:           booking.package,
            submitted_at:      new Date(now).toLocaleString('en-NG'),
          };
          await Promise.allSettled([
            emailjs.send(EVT_EMAILJS_SERVICE_ID, EVT_EMAILJS_STUDIO_TEMPLATE, params),
            emailjs.send(EVT_EMAILJS_SERVICE_ID, EVT_EMAILJS_CLIENT_TEMPLATE, params),
          ]);
        } catch (err) { console.warn('Event EmailJS error:', err); }
      }

      setTimeout(() => {
        bookingForm.style.display = 'none';
        formSuccess.style.display = 'block';

        /* Populate booking ID + share button */
        const idEl  = document.getElementById('eventSuccessId');
        const share = document.getElementById('eventShareBtn');
        if (idEl)  idEl.textContent = `Booking reference: ${bookingId}`;
        if (share) share.style.display = 'inline-flex';

        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1000);
    });

    bookingForm.addEventListener('input', (e) => {
      if (e.target.style.borderColor) {
        e.target.style.borderColor = '';
        e.target.style.boxShadow   = '';
      }
    });
  }

  /* ── BACK TO TOP ── */
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ── SMOOTH SCROLL for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ── ACTIVE NAV LINK ── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__links a');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${e.target.id}`);
          });
        }
      });
    },
    { threshold: 0.3, rootMargin: '-80px 0px -60% 0px' }
  );
  sections.forEach((s) => sectionObserver.observe(s));

})();
