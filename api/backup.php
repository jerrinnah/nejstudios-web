<?php
/*
 * NEJstudios — Data Backup
 *
 * Zips api/data/*.json into api/backups/YYYY-MM-DD.zip
 * Keeps the last 30 daily backups.
 *
 * Usage:
 *   - Manual: browse to https://nejstudios.com/api/backup.php?token=<secret>
 *   - Scheduled: cPanel Cron Job (daily at 03:00)
 *       curl -s "https://nejstudios.com/api/backup.php?token=<secret>"
 *
 * Set BACKUP_TOKEN below to a private string so only you can trigger it.
 */

header('Content-Type: application/json');

define('BACKUP_TOKEN', 'change-me-to-something-secret');

$token = isset($_GET['token']) ? $_GET['token'] : '';
if ($token !== BACKUP_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized. Provide ?token=… matching the configured secret.']);
    exit;
}

$dataDir   = __DIR__ . '/data';
$backupDir = __DIR__ . '/backups';
if (!is_dir($backupDir)) { mkdir($backupDir, 0755, true); }

if (!is_dir($dataDir)) {
    echo json_encode(['error' => "Data directory missing: $dataDir"]);
    exit;
}

$date     = date('Y-m-d');
$zipPath  = $backupDir . '/' . $date . '.zip';

$zip = new ZipArchive();
if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    echo json_encode(['error' => "Could not create $zipPath"]);
    exit;
}

$files = glob($dataDir . '/*.json');
$added = 0;
foreach ($files as $f) {
    $zip->addFile($f, basename($f));
    $added++;
}
$zip->close();

// Retention — keep only the newest 30 zips
$zips = glob($backupDir . '/*.zip');
usort($zips, function($a, $b) { return filemtime($b) - filemtime($a); });
$removed = 0;
foreach (array_slice($zips, 30) as $old) {
    if (unlink($old)) $removed++;
}

echo json_encode([
    'ok'      => true,
    'file'    => basename($zipPath),
    'added'   => $added,
    'removed' => $removed,
    'size'    => filesize($zipPath),
    'ts'      => date('c'),
]);
