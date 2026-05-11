<?php
/*
 * NEJstudios — Server Sync API
 * Stores bookings, schedule, and tasks as JSON files on the server.
 * This lets all devices (admin, team, clients) share the same data.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Allowed resources
$allowed  = ['bookings', 'schedule', 'tasks', 'notifications', 'gallery', 'gallery_links', 'approvals', 'attendance', 'site_content', 'sign_out_briefs', 'team_members', 'confirmations'];
$resource = isset($_GET['resource']) ? preg_replace('/[^a-z_]/', '', $_GET['resource']) : '';

if (!in_array($resource, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid resource']);
    exit;
}

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) { mkdir($dataDir, 0755, true); }

$file = $dataDir . '/' . $resource . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // notifications, gallery, approvals, attendance use an object {}, all others use an array []
    $default = in_array($resource, ['notifications', 'gallery', 'approvals', 'attendance', 'site_content']) ? '{}' : '[]';

    if (!file_exists($file)) {
        echo $default;
    } elseif ($resource === 'gallery_links') {
        // Strip expired gallery links before returning to clients
        $raw  = file_get_contents($file);
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            echo $raw;
        } else {
            $today   = date('Y-m-d');
            $active  = array_values(array_filter($data, function($d) use ($today) {
                // Keep entries with no expiry or expiry >= today
                return empty($d['expires_at']) || $d['expires_at'] >= $today;
            }));
            echo json_encode($active);
        }
    } else {
        echo file_get_contents($file);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $op   = isset($_GET['op']) ? preg_replace('/[^a-z]/', '', $_GET['op']) : '';

    /*
     * MERGE MODE — atomic upsert + soft-delete for array resources.
     * Request body:
     *   { "upserts": [ {id: ..., ...}, ... ], "deletes": [ "id1", ... ] }
     * - Loads current file with LOCK_EX.
     * - For each upsert: replaces entry with matching .id, or appends.
     * - For each delete: marks entry with { deletedAt: <timestamp> } (tombstone).
     * - Writes atomically. Returns the merged array so the client can sync.
     */
    if ($op === 'merge') {
        $arrayResources = ['bookings', 'schedule', 'tasks', 'gallery_links', 'sign_out_briefs'];
        if (!in_array($resource, $arrayResources)) {
            http_response_code(400);
            echo json_encode(['error' => 'Merge not supported for this resource']);
            exit;
        }
        $payload = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }
        $upserts = isset($payload['upserts']) && is_array($payload['upserts']) ? $payload['upserts'] : [];
        $deletes = isset($payload['deletes']) && is_array($payload['deletes']) ? $payload['deletes'] : [];

        // Open file with exclusive lock (creates if missing)
        $fp = fopen($file, 'c+');
        if (!$fp) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not open data file']);
            exit;
        }
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            http_response_code(500);
            echo json_encode(['error' => 'Could not lock data file']);
            exit;
        }
        $raw = stream_get_contents($fp);
        $current = $raw ? json_decode($raw, true) : [];
        if (!is_array($current)) $current = [];

        // Index by id
        $byId = [];
        foreach ($current as $item) {
            if (isset($item['id'])) $byId[$item['id']] = $item;
        }

        // Apply upserts
        foreach ($upserts as $item) {
            if (!is_array($item) || !isset($item['id'])) continue;
            $byId[$item['id']] = $item;
        }

        // Apply deletes as tombstones (keep with deletedAt so other devices pick it up)
        $now = round(microtime(true) * 1000);
        foreach ($deletes as $id) {
            if (!is_string($id)) continue;
            if (isset($byId[$id])) {
                $byId[$id]['deletedAt'] = $now;
            } else {
                $byId[$id] = ['id' => $id, 'deletedAt' => $now];
            }
        }

        $merged = array_values($byId);
        $out = json_encode($merged);

        // Atomic write via truncate + rewrite (we already hold the lock)
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $out);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        echo $out;
        exit;
    }

    // Legacy bulk write — DEFENSIVE: refuse to wipe a non-empty array resource with an empty array
    json_decode($body);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }
    $arrayResources = ['bookings', 'schedule', 'tasks', 'gallery_links', 'sign_out_briefs'];
    if (in_array($resource, $arrayResources)) {
        $parsed = json_decode($body, true);
        if (is_array($parsed) && count($parsed) === 0 && file_exists($file)) {
            $existing = json_decode(file_get_contents($file), true);
            if (is_array($existing) && count($existing) > 0) {
                http_response_code(409);
                echo json_encode(['error' => 'Refusing to overwrite non-empty data with empty array. Use op=merge with deletes.']);
                exit;
            }
        }
    }

    // Write atomically
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $body, LOCK_EX) !== false) {
        rename($tmp, $file);
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Could not write data']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
