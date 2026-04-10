/* ══════════════════════════════════════════════════════════════════════
   db.js — Supabase client + shared data helpers
   Shared by dashboard.js and team.js

   ── Setup: run this SQL in your Supabase project → SQL Editor ────────

   CREATE TABLE schedule (
     id           TEXT PRIMARY KEY,
     title        TEXT NOT NULL,
     date         DATE NOT NULL,
     time         TEXT,
     type         TEXT NOT NULL DEFAULT 'studio',
     client_name  TEXT,
     location     TEXT,
     notes        TEXT,
     deliverables TEXT,
     checklist    JSONB NOT NULL DEFAULT '[]',
     created_at   BIGINT
   );
   -- To add columns to an existing table:
   -- ALTER TABLE schedule ADD COLUMN deliverables TEXT;
   -- ALTER TABLE schedule ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]';
   ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "public_all" ON schedule FOR ALL USING (true) WITH CHECK (true);

   CREATE TABLE tasks (
     id            TEXT PRIMARY KEY,
     title         TEXT NOT NULL,
     description   TEXT,
     assigned_to   TEXT,
     assigned_name TEXT,
     priority      TEXT NOT NULL DEFAULT 'medium',
     status        TEXT NOT NULL DEFAULT 'pending',
     created_at    BIGINT,
     started_at    BIGINT,
     completed_at  BIGINT,
     reports       JSONB NOT NULL DEFAULT '[]'::JSONB
   );
   ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "public_all" ON tasks FOR ALL USING (true) WITH CHECK (true);

   CREATE TABLE gallery_deliveries (
     id             TEXT PRIMARY KEY,
     booking_id     TEXT,
     client_name    TEXT,
     token          TEXT UNIQUE NOT NULL,
     password       TEXT,
     files          JSONB NOT NULL DEFAULT '[]',
     expires_at     DATE,
     download_count INT NOT NULL DEFAULT 0,
     created_at     BIGINT
   );
   ALTER TABLE gallery_deliveries ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "public_all" ON gallery_deliveries FOR ALL USING (true) WITH CHECK (true);

   ─────────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = "https://jqteodgwyxmpudqaoqsu.supabase.co"; // ← paste from Supabase → Settings → API
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxdGVvZGd3eXhtcHVkcWFvcXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTY3NTQsImV4cCI6MjA5MTMzMjc1NH0.iulXNENNNMDGeeLa2qOMbhI4d6WpM6HNWr81GgylKwE"; // ← paste anon/public key

const _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ════════════════════════════════════════════
   ROW ↔ JS OBJECT MAPPERS
   ════════════════════════════════════════════ */

function _schedFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    time: r.time || null,
    type: r.type || "studio",
    clientName: r.client_name || null,
    location: r.location || null,
    notes: r.notes || null,
    deliverables: r.deliverables || null,
    checklist: r.checklist || [],
    createdAt: r.created_at || null,
  };
}

function _schedToRow(s) {
  return {
    id: s.id,
    title: s.title,
    date: s.date,
    time: s.time || null,
    type: s.type || "studio",
    client_name: s.clientName || null,
    location: s.location || null,
    notes: s.notes || null,
    deliverables: s.deliverables || null,
    checklist: s.checklist || [],
    created_at: s.createdAt || null,
  };
}

function _taskFromRow(r) {
  return {
    id: r.id,
    title: r.title,
    desc: r.description || null,
    assignedTo: r.assigned_to || null,
    assignedName: r.assigned_name || null,
    priority: r.priority || "medium",
    status: r.status || "pending",
    createdAt: r.created_at || null,
    startedAt: r.started_at || null,
    completedAt: r.completed_at || null,
    reports: r.reports || [],
  };
}

function _taskToRow(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.desc || null,
    assigned_to: t.assignedTo || null,
    assigned_name: t.assignedName || null,
    priority: t.priority || "medium",
    status: t.status || "pending",
    created_at: t.createdAt || null,
    started_at: t.startedAt || null,
    completed_at: t.completedAt || null,
    reports: t.reports || [],
  };
}

/* ════════════════════════════════════════════
   SCHEDULE
   ════════════════════════════════════════════ */

async function dbGetSchedule() {
  const { data, error } = await _db.from("schedule").select("*").order("date");
  if (error) {
    console.error("dbGetSchedule:", error.message);
    return [];
  }
  return (data || []).map(_schedFromRow);
}

async function dbAddScheduleEntry(entry) {
  const { error } = await _db.from("schedule").insert(_schedToRow(entry));
  if (error) console.error("dbAddScheduleEntry:", error.message);
}

async function dbDeleteScheduleEntry(id) {
  const { error } = await _db.from("schedule").delete().eq("id", id);
  if (error) console.error("dbDeleteScheduleEntry:", error.message);
}

/* ════════════════════════════════════════════
   TASKS
   ════════════════════════════════════════════ */

async function dbGetTasks() {
  const { data, error } = await _db
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("dbGetTasks:", error.message);
    return [];
  }
  return (data || []).map(_taskFromRow);
}

async function dbGetTask(id) {
  const { data, error } = await _db
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    console.error("dbGetTask:", error.message);
    return null;
  }
  return data ? _taskFromRow(data) : null;
}

async function dbAddTask(task) {
  const { error } = await _db.from("tasks").insert(_taskToRow(task));
  if (error) console.error("dbAddTask:", error.message);
}

async function dbUpdateTask(id, updates) {
  // updates should be in DB column format (snake_case)
  const { error } = await _db.from("tasks").update(updates).eq("id", id);
  if (error) console.error("dbUpdateTask:", error.message);
}

async function dbDeleteTask(id) {
  const { error } = await _db.from("tasks").delete().eq("id", id);
  if (error) console.error("dbDeleteTask:", error.message);
}

async function dbUnassignMemberTasks(memberId) {
  const { error } = await _db
    .from("tasks")
    .update({ assigned_to: null, assigned_name: null })
    .eq("assigned_to", memberId);
  if (error) console.error("dbUnassignMemberTasks:", error.message);
}

/* ════════════════════════════════════════════
   REAL-TIME SUBSCRIPTIONS
   ════════════════════════════════════════════ */

// Call this to react to schedule or task changes from any device.
// onScheduleChange and onTaskChange are callbacks that receive no arguments
// (caller should re-fetch the data themselves).
function dbSubscribeSchedule(onChange) {
  return _db
    .channel("schedule-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "schedule" },
      onChange
    )
    .subscribe();
}

function dbSubscribeTasks(onChange) {
  return _db
    .channel("tasks-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      onChange
    )
    .subscribe();
}

/* ════════════════════════════════════════════
   CHECKLIST
   ════════════════════════════════════════════ */

async function dbUpdateScheduleChecklist(id, checklist) {
  const { error } = await _db.from('schedule').update({ checklist }).eq('id', id);
  if (error) console.error('dbUpdateScheduleChecklist:', error.message);
}

/* ════════════════════════════════════════════
   GALLERY DELIVERIES
   ════════════════════════════════════════════ */

async function dbCreateGalleryDelivery(delivery) {
  const { error } = await _db.from('gallery_deliveries').insert(delivery);
  if (error) console.error('dbCreateGalleryDelivery:', error.message);
}

async function dbGetGalleryDelivery(token) {
  const { data, error } = await _db
    .from('gallery_deliveries')
    .select('*')
    .eq('token', token)
    .single();
  if (error) { console.error('dbGetGalleryDelivery:', error.message); return null; }
  return data || null;
}

async function dbGetAllGalleryDeliveries() {
  const { data, error } = await _db
    .from('gallery_deliveries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('dbGetAllGalleryDeliveries:', error.message); return []; }
  return data || [];
}

async function dbIncrementDownload(id) {
  const { data: row } = await _db.from('gallery_deliveries').select('download_count').eq('id', id).single();
  if (row) {
    const { error } = await _db.from('gallery_deliveries')
      .update({ download_count: (row.download_count || 0) + 1 })
      .eq('id', id);
    if (error) console.error('dbIncrementDownload:', error.message);
  }
}

async function dbDeleteGalleryDelivery(id) {
  const { error } = await _db.from('gallery_deliveries').delete().eq('id', id);
  if (error) console.error('dbDeleteGalleryDelivery:', error.message);
}
