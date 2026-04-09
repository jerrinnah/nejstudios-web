/* ══════════════════════════════════════════════
   NEJstudios — Studio Booking JS
   Powered by EmailJS · https://emailjs.com
   ══════════════════════════════════════════════

   SETUP (do this once):
   ─────────────────────
   1. Create a free account at https://www.emailjs.com
   2. Add an Email Service (Gmail recommended) → copy Service ID
   3. Create Template: "Studio Booking — Studio Copy"
      Subject: New Studio Booking — {{session_type}} | {{client_name}}
      Body (paste into EmailJS template):
      ─────────────────────────────────────────────
      New studio session booking received.

      Booking ID:   {{booking_id}}
      Name:         {{client_name}}
      Phone:        {{phone}}
      Email:        {{client_email}}
      Session Type: {{session_type}}
      Submitted:    {{submitted_at}}
      ─────────────────────────────────────────────
      Set "To Email" to YOUR studio email address.

   4. Create Template: "Studio Booking — Client Confirmation"
      Subject: Your NEJstudios Booking is Confirmed 🎉
      Body:
      ─────────────────────────────────────────────
      Hi {{client_first_name}},

      Thank you for booking a studio session with NEJstudios!

      Here are your booking details:
      ────────────────────────────
      Booking ID:   {{booking_id}}
      Session Type: {{session_type}}
      ────────────────────────────

      Our team will reach out within 24 hours to confirm
      your exact date and time.

      See you in the studio!

      — The NEJstudios Team
      Lagos, Nigeria
      hello@nejstudios.com
      ─────────────────────────────────────────────
      Set "To Email" to {{client_email}}

   5. Go to Account → API Keys → copy your Public Key
   6. Fill in the four constants below
   ════════════════════════════════════════════════ */

const EMAILJS_PUBLIC_KEY       = 'YOUR_PUBLIC_KEY';          // e.g. 'abc123XYZ'
const EMAILJS_SERVICE_ID       = 'YOUR_SERVICE_ID';          // e.g. 'service_xxxxxxx'
const EMAILJS_STUDIO_TEMPLATE  = 'YOUR_STUDIO_TEMPLATE_ID';  // e.g. 'template_studio'
const EMAILJS_CLIENT_TEMPLATE  = 'YOUR_CLIENT_TEMPLATE_ID';  // e.g. 'template_client'

// ── Initialise EmailJS ──
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ── DOM refs ──
const form          = document.getElementById('studioBookingForm');
const submitBtn     = document.getElementById('submitBtn');
const submitText    = document.getElementById('submitText');
const successScreen = document.getElementById('successScreen');
const successId     = document.getElementById('successId');
const picker        = document.getElementById('sessionPicker');
const spError       = document.getElementById('spError');
const sessionInput  = document.getElementById('sessionTypeInput');

// ── Session type picker ──
picker.querySelectorAll('.sp-card').forEach((card) => {
  card.addEventListener('click', () => {
    picker.querySelectorAll('.sp-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    sessionInput.value = card.dataset.type;
    spError.classList.remove('show');
  });
});

// ── Generate a short readable booking ID ──
function genBookingId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'NEJ-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Format date ──
function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-NG', {
    dateStyle: 'long', timeStyle: 'short'
  });
}

// ── Validate ──
function validate() {
  let ok = true;

  ['firstName', 'phone', 'email'].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove('error');
    if (!el.value.trim()) { el.classList.add('error'); ok = false; }
  });

  const emailEl = document.getElementById('email');
  if (emailEl.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
    emailEl.classList.add('error');
    ok = false;
  }

  if (!sessionInput.value) {
    spError.classList.add('show');
    ok = false;
  }

  return ok;
}

// ── Remove error on input ──
form.querySelectorAll('input').forEach((inp) => {
  inp.addEventListener('input', () => inp.classList.remove('error'));
});

// ── Save booking to localStorage ──
function saveBooking(booking) {
  const key = 'nej_bookings';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.unshift(booking);
  localStorage.setItem(key, JSON.stringify(existing));
}

// ── Submit handler ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const firstName   = document.getElementById('firstName').value.trim();
  const middleName  = document.getElementById('middleName').value.trim();
  const phone       = document.getElementById('phone').value.trim();
  const email       = document.getElementById('email').value.trim();
  const sessionType = sessionInput.value;
  const clientName  = middleName ? `${firstName} ${middleName}` : firstName;
  const bookingId   = genBookingId();
  const now         = Date.now();

  // Disable + show loading
  submitBtn.disabled = true;
  submitText.textContent = 'Sending…';

  const booking = {
    id: bookingId,
    firstName, middleName, clientName,
    phone, email,
    sessionType,
    status: 'pending',
    createdAt: now,
  };

  const params = {
    booking_id:        bookingId,
    client_name:       clientName,
    client_first_name: firstName,
    client_email:      email,
    phone,
    session_type:      sessionType,
    submitted_at:      fmtDate(now),
  };

  // Check if EmailJS is configured
  const emailjsReady = EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';

  try {
    if (emailjsReady) {
      // Send both emails in parallel
      await Promise.all([
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_STUDIO_TEMPLATE,  params),
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CLIENT_TEMPLATE, params),
      ]);
    }

    // Always save to localStorage regardless of email status
    saveBooking(booking);

    // Show success
    form.style.display = 'none';
    successScreen.classList.add('show');
    successId.textContent = bookingId;

  } catch (err) {
    console.error('EmailJS error:', err);
    // Still save locally + show success (email can be configured later)
    saveBooking(booking);
    form.style.display = 'none';
    successScreen.classList.add('show');
    successId.textContent = bookingId;

    if (!emailjsReady) {
      const notice = document.createElement('p');
      notice.style.cssText = 'color:var(--grey-3);font-size:.75rem;margin-top:12px;';
      notice.textContent = '(Email notifications not yet configured — booking saved locally.)';
      successScreen.querySelector('h3').after(notice);
    }
  }
});
