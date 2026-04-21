<?php
/* ──────────────────────────────────────────────
   NEJstudios — OneSignal Push Notification Proxy
   POST body (member):  { memberId, title, message }
   POST body (admin):   { target: 'admin', title, message }
   POST body (legacy):  { external_id, title, message }
   ────────────────────────────────────────────── */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$APP_ID       = '7a5f454d-ffd0-4c33-8d87-d165a134bfe4';
$REST_API_KEY = 'os_v2_app_pjpuktp72bgdhdmh2fs2cnf74sheav6umwfenk4kb2rwn6ogemi7hwle2q4m3sjm6rtdmus4bdzrlgbv46jxvxu2cspolbqcrrk53ai';
$ADMIN_ID     = 'admin';

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || empty($data['message'])) {
  echo json_encode(['error' => 'Missing message']); exit;
}

// Resolve recipient
if (!empty($data['target']) && $data['target'] === 'admin') {
  $externalId = $ADMIN_ID;
} elseif (!empty($data['memberId'])) {
  $externalId = $data['memberId'];
} elseif (!empty($data['external_id'])) {
  $externalId = $data['external_id'];
} else {
  echo json_encode(['error' => 'Missing recipient (memberId, target, or external_id)']); exit;
}

$payload = [
  'app_id'          => $APP_ID,
  'include_aliases' => ['external_id' => [$externalId]],
  'target_channel'  => 'push',
  'headings'        => ['en' => $data['title']   ?? 'NEJstudios'],
  'contents'        => ['en' => $data['message']],
  'url'             => $data['url'] ?? '',
];

$ch = curl_init('https://onesignal.com/api/v1/notifications');
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER     => [
    'Content-Type: application/json; charset=utf-8',
    'Authorization: Basic ' . $REST_API_KEY,
  ],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload),
  CURLOPT_TIMEOUT        => 10,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
