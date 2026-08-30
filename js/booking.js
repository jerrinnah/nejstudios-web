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

const EMAILJS_PUBLIC_KEY = "Qj3loUfclt8ABr-40"; // e.g. 'abc123XYZ'
const EMAILJS_SERVICE_ID = "service_3iv1y5a"; // e.g. 'service_xxxxxxx'
const EMAILJS_STUDIO_TEMPLATE = "template_xjeuqdf"; // e.g. 'template_studio'
const EMAILJS_CLIENT_TEMPLATE = "template_rp3mtae"; // e.g. 'template_client'

// ── Initialise EmailJS ──
emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

// ── DOM refs ──
const form = document.getElementById("studioBookingForm");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const successScreen = document.getElementById("successScreen");
const successId = document.getElementById("successId");
const picker = document.getElementById("sessionPicker");
const spError = document.getElementById("spError");
const sessionInput = document.getElementById("sessionTypeInput");
const numOutfitsEl = document.getElementById("numOutfits");

// ── Outfit limits per session type ──
const OUTFIT_LIMITS = {
  "Half Session":     [1],
  "Regular Session":  [1, 2],
  "Pregnancy Session":[1, 2],
  "Birthday Session": [1, 2, 3],
  "Family Session":   [1, 2, 3],
  "Outdoor Session":  [1, 2, 3, 4, 5, 6],
};

function updateOutfitOptions(sessionType) {
  const options = OUTFIT_LIMITS[sessionType];
  if (!options || !numOutfitsEl) return;
  numOutfitsEl.innerHTML = options
    .map(n => `<option value="${n}">${n} outfit${n > 1 ? "s" : ""}</option>`)
    .join("");
  numOutfitsEl.value = String(options[options.length - 1]);
}

// ── Session type dropdown ──
picker.addEventListener("change", () => {
  sessionInput.value = picker.value;
  if (picker.value) spError.classList.remove("show");
  updateOutfitOptions(picker.value);
});

// ── Rate card modal ──
const rateCardModal = document.getElementById("rateCardModal");
document.getElementById("rateCardBtn").addEventListener("click", () => {
  rateCardModal.style.display = "flex";
});
document.getElementById("rateCardClose").addEventListener("click", () => {
  rateCardModal.style.display = "none";
});
rateCardModal.addEventListener("click", (e) => {
  if (e.target === rateCardModal) rateCardModal.style.display = "none";
});

// ── Generate a short readable booking ID ──
function genBookingId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "NEJ-";
  for (let i = 0; i < 6; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Build shareable link (short — fetches booking from server by ID) ──
function makeShareUrl(booking) {
  return `${location.origin}/booking-view?b=${booking.id}`;
}

// ── Format date ──
function fmtDate(ts) {
  return new Date(ts).toLocaleString("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

// ── Validate ──
function validate() {
  let ok = true;

  ["firstName", "phone", "email", "preferredDate", "preferredTime"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove("error");
    if (!el.value.trim()) {
      el.classList.add("error");
      ok = false;
    }
  });

  const emailEl = document.getElementById("email");
  if (emailEl.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
    emailEl.classList.add("error");
    ok = false;
  }

  if (!sessionInput.value) {
    spError.classList.add("show");
    ok = false;
  }

  return ok;
}

// ── Remove error on input ──
form.querySelectorAll("input, select").forEach((inp) => {
  inp.addEventListener("input", () => inp.classList.remove("error"));
  inp.addEventListener("change", () => inp.classList.remove("error"));
});

// ── Save booking to localStorage + server ──
async function saveBooking(booking) {
  const key = "nej_bookings";
  // First, fetch current server bookings so we don't overwrite others
  let existing = [];
  try {
    const r = await fetch('/api/sync.php?resource=bookings', { cache: 'no-store' });
    if (r.ok) existing = await r.json();
  } catch { /* fallback to localStorage */ }
  if (!Array.isArray(existing) || existing.length === 0) {
    existing = JSON.parse(localStorage.getItem(key) || "[]");
  }
  // Don't add duplicate IDs
  if (!existing.find(b => b.id === booking.id)) existing.unshift(booking);
  localStorage.setItem(key, JSON.stringify(existing));
  // Push to server
  try {
    await fetch('/api/sync.php?resource=bookings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(existing),
    });
  } catch { /* server unreachable — saved locally */ }
}

// ── Submit handler ──
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const firstName = document.getElementById("firstName").value.trim();
  const middleName = document.getElementById("middleName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const sessionType = sessionInput.value;
  const numOutfits = document.getElementById("numOutfits").value;
  const preferredDate = document.getElementById("preferredDate").value;
  const preferredTime = document.getElementById("preferredTime").value;
  const instagram = document.getElementById("instagram").value.trim();
  const clientName = middleName ? `${firstName} ${middleName}` : firstName;
  const bookingId = genBookingId();
  const now = Date.now();

  // Disable + show loading
  submitBtn.disabled = true;
  submitText.textContent = "Sending…";

  const booking = {
    id: bookingId,
    firstName,
    middleName,
    clientName,
    phone,
    email,
    sessionType,
    numOutfits,
    preferredDate,
    preferredTime,
    instagram: instagram || "",
    status: "pending",
    createdAt: now,
  };

  const params = {
    booking_id: bookingId,
    client_name: clientName,
    client_first_name: firstName,
    client_email: email,
    phone,
    session_type: sessionType,
    num_outfits: numOutfits,
    preferred_date: preferredDate,
    preferred_time: preferredTime,
    instagram: instagram || "—",
    submitted_at: fmtDate(now),
  };

  // Check if EmailJS is configured
  const emailjsReady = EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY";

  try {
    if (emailjsReady) {
      // Send both emails in parallel
      await Promise.all([
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_STUDIO_TEMPLATE, params),
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CLIENT_TEMPLATE, params),
      ]);
    }

    // Always save to localStorage regardless of email status
    saveBooking(booking);

    // Show payment step first
    form.style.display = "none";
    const paymentScreen = document.getElementById("paymentScreen");
    const paymentRef    = document.getElementById("paymentRef");
    if (paymentRef) paymentRef.textContent = bookingId;
    paymentScreen.style.display = "block";

    // "I Have Made the Transfer" button
    const transferDoneBtn = document.getElementById("transferDoneBtn");
    if (transferDoneBtn) {
      transferDoneBtn.addEventListener("click", () => {
        // Mark booking as transfer-submitted
        booking.transferSubmitted = true;
        booking.transferAt = Date.now();
        saveBooking(booking);
        paymentScreen.style.display = "none";
        successScreen.classList.add("show");
        successId.textContent = bookingId;
      }, { once: true });
    }

    // Inject share button if not already present
    if (!document.getElementById("studioShareBtn")) {
      const shareWrap = document.createElement("div");
      shareWrap.style.cssText =
        "margin-top:16px;display:flex;align-items:center;gap:10px;justify-content:center;flex-wrap:wrap";
      shareWrap.innerHTML = `
        <button id="studioShareBtn" style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--grey-2);font-size:.78rem;font-family:var(--sans);cursor:pointer;transition:.25s">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share Booking
        </button>
        <span id="studioShareCopied" style="display:none;font-size:.72rem;color:#3ecf8e">✓ Copied!</span>`;
      successScreen.appendChild(shareWrap);

      document
        .getElementById("studioShareBtn")
        .addEventListener("click", () => {
          const url = makeShareUrl({
            id: bookingId,
            firstName: document.getElementById("firstName").value,
            clientName: document.getElementById("firstName").value,
            sessionType,
            status: "pending",
            createdAt: now,
          });
          navigator.clipboard
            .writeText(url)
            .then(() => {
              const c = document.getElementById("studioShareCopied");
              if (c) {
                c.style.display = "inline";
                setTimeout(() => {
                  c.style.display = "none";
                }, 2500);
              }
            })
            .catch(() => prompt("Copy this booking link:", url));
        });
    }
  } catch (err) {
    console.error("EmailJS error:", err);
    // Still save locally + show payment step (email can be configured later)
    saveBooking(booking);
    form.style.display = "none";
    const paymentScreenErr = document.getElementById("paymentScreen");
    const paymentRefErr    = document.getElementById("paymentRef");
    if (paymentRefErr) paymentRefErr.textContent = bookingId;
    paymentScreenErr.style.display = "block";

    const transferDoneBtnErr = document.getElementById("transferDoneBtn");
    if (transferDoneBtnErr) {
      transferDoneBtnErr.addEventListener("click", () => {
        booking.transferSubmitted = true;
        booking.transferAt = Date.now();
        saveBooking(booking);
        paymentScreenErr.style.display = "none";
        successScreen.classList.add("show");
        successId.textContent = bookingId;
      }, { once: true });
    }
  }
});
