<?php
/**
 * Class Check-in API — appends rows to data/checkins.csv
 *
 * Expected JSON body:
 * { "studentId", "email", "idToken", "sessionToken", "latitude", "longitude", "accuracy", "apiKey" }
 */

header('Content-Type: application/json; charset=utf-8');

// ── Configuration (keep in sync with js/config.js) ──
define('API_KEY', 'change-this-api-key');
define('GOOGLE_CLIENT_ID', 'YOUR_CLIENT_ID.apps.googleusercontent.com');
define('ALLOWED_EMAIL_DOMAINS', ['gmail.com']); // empty array = allow any verified Google email
define('CSV_FILE', dirname(__DIR__) . '/data/checkins.csv');
define('CLASSROOM_LAT', 13.7563);
define('CLASSROOM_LNG', 100.5018);
define('RADIUS_METERS', 100);

// ── CORS (adjust origin for production) ──
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Parse input ──
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}

// ── Validate API key ──
if (($data['apiKey'] ?? '') !== API_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// ── Validate fields ──
$studentId    = trim($data['studentId'] ?? '');
$sessionToken = trim($data['sessionToken'] ?? '');
$idToken      = trim($data['idToken'] ?? '');
$latitude     = $data['latitude'] ?? null;
$longitude    = $data['longitude'] ?? null;
$accuracy     = $data['accuracy'] ?? null;

if ($studentId === '' || $sessionToken === '' || $idToken === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Student ID, Gmail sign-in, and session token are required']);
    exit;
}

$googleUser = verifyGoogleIdToken($idToken);
if (!$googleUser) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid or expired Google sign-in. Please sign in again.']);
    exit;
}

$email = strtolower(trim($googleUser['email'] ?? ''));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid Gmail address is required']);
    exit;
}

if (!isAllowedEmailDomain($email)) {
    http_response_code(403);
    echo json_encode(['error' => 'Please sign in with an allowed Gmail account']);
    exit;
}

if (!is_numeric($latitude) || !is_numeric($longitude)) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid coordinates are required']);
    exit;
}

// Sanitize student ID (alphanumeric only)
if (!preg_match('/^[a-zA-Z0-9\-_]{1,32}$/', $studentId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid Student ID format']);
    exit;
}

// ── Server-side geolocation check (defence in depth) ──
$distance = haversineDistance(
    (float) $latitude,
    (float) $longitude,
    CLASSROOM_LAT,
    CLASSROOM_LNG
);

if ($distance > RADIUS_METERS) {
    http_response_code(403);
    echo json_encode([
        'error' => 'You are not in the classroom',
        'distance' => round($distance),
    ]);
    exit;
}

// ── Prevent duplicate check-in (same email + session) ──
if (isDuplicate($email, $sessionToken)) {
    http_response_code(409);
    echo json_encode(['error' => 'You have already checked in for this session']);
    exit;
}

// ── Append to CSV ──
$timestamp = gmdate('Y-m-d H:i:s') . ' UTC';
$row = [
    $timestamp,
    $studentId,
    $email,
    $sessionToken,
    $latitude,
    $longitude,
    round($distance, 1),
    $accuracy !== null ? round((float) $accuracy, 1) : '',
    $_SERVER['REMOTE_ADDR'] ?? '',
];

if (!appendCsvRow($row)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save check-in. Check file permissions.']);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Check-in successful!',
    'timestamp' => $timestamp,
]);

// ── Helpers ──

function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $R = 6371000;
    $toRad = fn($deg) => deg2rad($deg);

    $dLat = $toRad($lat2 - $lat1);
    $dLon = $toRad($lon2 - $lon1);

    $a = sin($dLat / 2) ** 2
        + cos($toRad($lat1)) * cos($toRad($lat2)) * sin($dLon / 2) ** 2;

    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function isDuplicate(string $email, string $sessionToken): bool
{
    if (!file_exists(CSV_FILE)) {
        return false;
    }

    $handle = fopen(CSV_FILE, 'r');
    if (!$handle) {
        return false;
    }

    // Skip header
    fgetcsv($handle);

    while (($line = fgetcsv($handle)) !== false) {
        $rowEmail = strtolower($line[2] ?? $line[1] ?? '');
        $rowSession = $line[3] ?? $line[2] ?? '';
        if ($rowEmail === strtolower($email) && $rowSession === $sessionToken) {
            fclose($handle);
            return true;
        }
    }

    fclose($handle);
    return false;
}

function appendCsvRow(array $row): bool
{
    $dir = dirname(CSV_FILE);
    if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
        return false;
    }

    $isNew = !file_exists(CSV_FILE);

    $handle = fopen(CSV_FILE, 'a');
    if (!$handle) {
        return false;
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return false;
    }

    if ($isNew) {
        fputcsv($handle, [
            'timestamp',
            'student_id',
            'email',
            'session_token',
            'latitude',
            'longitude',
            'distance_m',
            'accuracy_m',
            'ip_address',
        ]);
    }

    $result = fputcsv($handle, $row);
    flock($handle, LOCK_UN);
    fclose($handle);

    return $result !== false;
}

function verifyGoogleIdToken(string $idToken): ?array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
    $context = stream_context_create(['http' => ['timeout' => 10]]);
    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        return null;
    }

    $payload = json_decode($response, true);
    if (!is_array($payload) || isset($payload['error_description'])) {
        return null;
    }

    if (($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) {
        return null;
    }

    if (($payload['email_verified'] ?? '') !== 'true') {
        return null;
    }

    return $payload;
}

function isAllowedEmailDomain(string $email): bool
{
    $domains = ALLOWED_EMAIL_DOMAINS;
    if (!$domains) {
        return true;
    }

    $domain = strtolower(substr(strrchr($email, '@'), 1) ?: '');
    return in_array($domain, $domains, true);
}
