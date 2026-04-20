<?php
/*
 * NEJstudios — Gallery Auth API
 *
 * POST { token, password? }
 *   → { ok: true, delivery: {...} }   (delivery object WITHOUT password field)
 *   → { ok: false, error: "..." }
 *   → { ok: false, error: "...", locked: true }    (rate-limited)
 *   → { ok: false, error: "...", expired: true }   (expired gallery)
 *
 * POST ?action=log-download  { token, fileId, fileName }
 *   → { ok: true }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) { mkdir($dataDir, 0755, true); }

$action = isset($_GET['action']) ? $_GET['action'] : '';

/* ════════════════════════════════════════════
   ROUTE: log-download
   ════════════════════════════════════════════ */
if ($action === 'log-download') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || empty($body['token'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Missing token']);
        exit;
    }

    $logFile = $dataDir . '/download_logs.json';
    $logs = [];
    if (file_exists($logFile)) {
        $raw = file_get_contents($logFile);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $logs = $decoded;
    }

    $logs[] = [
        'token'     => (string)($body['token']   ?? ''),
        'fileId'    => (string)($body['fileId']   ?? ''),
        'fileName'  => (string)($body['fileName'] ?? ''),
        'ip'        => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '',
        'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'timestamp' => date('c'),
    ];

    $tmp = $logFile . '.tmp.' . getmypid();
    if (file_put_contents($tmp, json_encode($logs, JSON_PRETTY_PRINT), LOCK_EX) !== false) {
        rename($tmp, $logFile);
    }

    echo json_encode(['ok' => true]);
    exit;
}

/* ════════════════════════════════════════════
   ROUTE: authenticate
   ════════════════════════════════════════════ */

$body = json_decode(file_get_contents('php://input'), true);
if (!$body || empty($body['token'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing token']);
    exit;
}

$token = preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$body['token']);
if (!$token) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid token']);
    exit;
}

// Load gallery links
$linksFile = $dataDir . '/gallery_links.json';
$deliveries = [];
if (file_exists($linksFile)) {
    $raw = file_get_contents($linksFile);
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $deliveries = $decoded;
}

// Find delivery by token
$delivery = null;
$deliveryIdx = null;
foreach ($deliveries as $idx => $d) {
    if (isset($d['token']) && $d['token'] === $token) {
        $delivery = $d;
        $deliveryIdx = $idx;
        break;
    }
}

if (!$delivery) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Gallery not found']);
    exit;
}

// Server-side expiry check
if (!empty($delivery['expires_at'])) {
    $today    = date('Y-m-d');
    $expiresAt = $delivery['expires_at'];
    if ($expiresAt < $today) {
        echo json_encode(['ok' => false, 'error' => 'This gallery has expired.', 'expired' => true]);
        exit;
    }
}

// No password required — return delivery without password field
if (empty($delivery['password'])) {
    $safe = $delivery;
    unset($safe['password']);
    echo json_encode(['ok' => true, 'delivery' => $safe]);
    exit;
}

// Password required — check submitted password
$submittedPassword = isset($body['password']) ? (string)$body['password'] : null;

if ($submittedPassword === null || $submittedPassword === '') {
    // Client is asking "does this need a password?" — return a prompt signal
    echo json_encode(['ok' => false, 'error' => 'Password required', 'password_required' => true]);
    exit;
}

// ── Rate limiting ──────────────────────────────────────────────────────────
$rateLimitDir  = $dataDir . '/rate_limits';
if (!is_dir($rateLimitDir)) { mkdir($rateLimitDir, 0755, true); }

$safeToken     = preg_replace('/[^a-zA-Z0-9_\-]/', '', $token);
$rateFile      = $rateLimitDir . '/rl_' . $safeToken . '.json';
$rateData      = ['attempts' => 0, 'locked_until' => null];

if (file_exists($rateFile)) {
    $rd = json_decode(file_get_contents($rateFile), true);
    if (is_array($rd)) $rateData = $rd;
}

// Check if currently locked
if (!empty($rateData['locked_until'])) {
    $lockedUntil = strtotime($rateData['locked_until']);
    if (time() < $lockedUntil) {
        echo json_encode(['ok' => false, 'error' => 'Too many attempts. Try again in 15 minutes.', 'locked' => true]);
        exit;
    } else {
        // Lock expired — reset
        $rateData = ['attempts' => 0, 'locked_until' => null];
    }
}

// ── Verify password ────────────────────────────────────────────────────────
$storedPassword = $delivery['password'];
$passwordMatches = false;
$needsRehash    = false;

// Check if stored password is already a bcrypt hash
if (strlen($storedPassword) >= 60 && $storedPassword[0] === '$') {
    // Already hashed — use password_verify
    if (password_verify($submittedPassword, $storedPassword)) {
        $passwordMatches = true;
        // Re-hash if bcrypt cost needs updating
        if (password_needs_rehash($storedPassword, PASSWORD_BCRYPT)) {
            $needsRehash = true;
        }
    }
} else {
    // Plaintext — compare directly
    if ($submittedPassword === $storedPassword) {
        $passwordMatches = true;
        $needsRehash     = true; // upgrade to hash
    }
}

if (!$passwordMatches) {
    // Increment failed attempts
    $rateData['attempts'] = ($rateData['attempts'] ?? 0) + 1;
    if ($rateData['attempts'] >= 5) {
        $rateData['locked_until'] = date('c', time() + 15 * 60);
    }
    file_put_contents($rateFile, json_encode($rateData), LOCK_EX);

    echo json_encode(['ok' => false, 'error' => 'Invalid password']);
    exit;
}

// ── Success ────────────────────────────────────────────────────────────────

// Reset rate limit on success
if (file_exists($rateFile)) { unlink($rateFile); }

// Upgrade plaintext → bcrypt hash if needed
if ($needsRehash && $deliveryIdx !== null) {
    $newHash = password_hash($submittedPassword, PASSWORD_BCRYPT);
    $deliveries[$deliveryIdx]['password'] = $newHash;
    $tmp = $linksFile . '.tmp.' . getmypid();
    if (file_put_contents($tmp, json_encode($deliveries, JSON_PRETTY_PRINT), LOCK_EX) !== false) {
        rename($tmp, $linksFile);
    }
}

// Return delivery without password field
$safe = $deliveries[$deliveryIdx] ?? $delivery;
unset($safe['password']);
echo json_encode(['ok' => true, 'delivery' => $safe]);
