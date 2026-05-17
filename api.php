<?php
declare(strict_types=1);

// MeloMD API (PHP + SQLite)
// Endpoints (query param action):
// - POST /api.php?action=register
// - POST /api.php?action=login
// - POST /api.php?action=logout
// - GET  /api.php?action=me
// - GET  /api.php?action=docs
// - POST /api.php?action=save
// - POST /api.php?action=delete

const RETENTION_DAYS = 30;
const MAX_BODY_BYTES = 5_000_000;
const MAX_CONTENT_BYTES = 5_000_000;
const MAX_TITLE_LENGTH = 120;
const MAX_USERNAME_LENGTH = 32;
const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

date_default_timezone_set('UTC');
configureSession();
ensureStorageDir();
$db = openDb();
initSchema($db);
cleanupExpired($db);

try {
    $action = (string)($_GET['action'] ?? '');
    if ($action === '') {
        fail(400, 'Missing action');
    }

    switch ($action) {
        case 'register':
            mustMethod('POST');
            $payload = readJsonBody();
            $result = registerUser($db, $payload);
            ok($result);
            break;

        case 'login':
            mustMethod('POST');
            $payload = readJsonBody();
            $result = loginUser($db, $payload);
            ok($result);
            break;

        case 'logout':
            mustMethod('POST');
            logoutUser();
            ok(['logout' => true]);
            break;

        case 'me':
            mustMethod('GET');
            $user = requireUser($db);
            ok(['user' => ['id' => (int)$user['id'], 'username' => (string)$user['username']]]);
            break;

        case 'docs':
            mustMethod('GET');
            $user = requireUser($db);
            ok(['docs' => listDocs($db, (int)$user['id'])]);
            break;

        case 'save':
            mustMethod('POST');
            $user = requireUser($db);
            $payload = readJsonBody();
            ok(['doc' => saveDoc($db, (int)$user['id'], $payload)]);
            break;

        case 'delete':
            mustMethod('POST');
            $user = requireUser($db);
            $payload = readJsonBody();
            deleteDoc($db, (int)$user['id'], $payload);
            ok(['deleted' => true]);
            break;

        default:
            fail(404, 'Unknown action');
    }
} catch (Throwable $e) {
    $code = (int)$e->getCode();
    if ($code < 400 || $code > 599) {
        $code = 500;
    }
    fail($code, $e->getMessage());
}

function configureSession(): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_name('LITEMDSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function ensureStorageDir(): void
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
}

function openDb(): PDO
{
    $path = __DIR__ . '/data/litemd.sqlite';
    $db = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA journal_mode = WAL;');
    $db->exec('PRAGMA synchronous = NORMAL;');
    $db->exec('PRAGMA foreign_keys = ON;');
    return $db;
}

function initSchema(PDO $db): void
{
    $db->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )'
    );

    $db->exec(
        'CREATE TABLE IF NOT EXISTS docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            doc_uid TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            UNIQUE(user_id, doc_uid),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )'
    );

    $db->exec('CREATE INDEX IF NOT EXISTS idx_docs_user_updated ON docs(user_id, updated_at DESC)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_docs_expires ON docs(expires_at)');
}

function cleanupExpired(PDO $db): void
{
    $stmt = $db->prepare('DELETE FROM docs WHERE expires_at < :now');
    $stmt->execute([':now' => time()]);
}

function mustMethod(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        throw new RuntimeException('Method not allowed', 405);
    }
}

function readJsonBody(): array
{
    $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > MAX_BODY_BYTES) {
        throw new RuntimeException('Request too large', 413);
    }

    $raw = file_get_contents('php://input');
    if ($raw === false) {
        throw new RuntimeException('Failed to read request body', 400);
    }
    if (strlen($raw) > MAX_BODY_BYTES) {
        throw new RuntimeException('Request too large', 413);
    }
    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON body', 400);
    }
    return $decoded;
}

function registerUser(PDO $db, array $payload): array
{
    $username = normalizeUsername((string)($payload['username'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        throw new RuntimeException('密码至少 6 位', 400);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $now = time();

    try {
        $stmt = $db->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (:u, :p, :t)');
        $stmt->execute([':u' => $username, ':p' => $hash, ':t' => $now]);
    } catch (Throwable $e) {
        throw new RuntimeException('用户名已存在', 409);
    }

    $id = (int)$db->lastInsertId();
    $_SESSION['uid'] = $id;
    $_SESSION['username'] = $username;
    return [
        'user' => ['id' => $id, 'username' => $username],
        'retentionDays' => RETENTION_DAYS,
    ];
}

function loginUser(PDO $db, array $payload): array
{
    $username = normalizeUsername((string)($payload['username'] ?? ''));
    $password = (string)($payload['password'] ?? '');

    $stmt = $db->prepare('SELECT id, username, password_hash FROM users WHERE username = :u LIMIT 1');
    $stmt->execute([':u' => $username]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        throw new RuntimeException('用户名或密码错误', 401);
    }

    $_SESSION['uid'] = (int)$user['id'];
    $_SESSION['username'] = (string)$user['username'];
    return [
        'user' => ['id' => (int)$user['id'], 'username' => (string)$user['username']],
        'retentionDays' => RETENTION_DAYS,
    ];
}

function logoutUser(): void
{
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

function requireUser(PDO $db): array
{
    $uid = (int)($_SESSION['uid'] ?? 0);
    if ($uid <= 0) {
        throw new RuntimeException('未登录', 401);
    }
    $stmt = $db->prepare('SELECT id, username FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $uid]);
    $user = $stmt->fetch();
    if (!$user) {
        throw new RuntimeException('用户不存在', 401);
    }
    return $user;
}

function listDocs(PDO $db, int $userId): array
{
    $stmt = $db->prepare('
        SELECT doc_uid, title, content, created_at, updated_at, expires_at
        FROM docs
        WHERE user_id = :uid
        ORDER BY updated_at DESC
    ');
    $stmt->execute([':uid' => $userId]);
    $rows = $stmt->fetchAll();

    $docs = [];
    foreach ($rows as $row) {
        $docs[] = [
            'id' => (string)$row['doc_uid'],
            'title' => (string)$row['title'],
            'content' => (string)$row['content'],
            'createdAt' => ((int)$row['created_at']) * 1000,
            'updatedAt' => ((int)$row['updated_at']) * 1000,
            'expiresAt' => ((int)$row['expires_at']) * 1000,
        ];
    }
    return $docs;
}

function saveDoc(PDO $db, int $userId, array $payload): array
{
    $docUid = normalizeDocId((string)($payload['docId'] ?? ''));
    $titleRaw = trim((string)($payload['title'] ?? ''));
    $title = safeTruncate($titleRaw !== '' ? $titleRaw : '无标题', MAX_TITLE_LENGTH);
    $content = (string)($payload['content'] ?? '');
    if (strlen($content) > MAX_CONTENT_BYTES) {
        throw new RuntimeException('文档内容过大（最大 5MB）', 413);
    }

    $now = time();
    $expiresAt = $now + RETENTION_DAYS * 86400;

    $stmt = $db->prepare(
        'INSERT INTO docs (user_id, doc_uid, title, content, created_at, updated_at, expires_at)
         VALUES (:uid, :doc_uid, :title, :content, :now, :now, :expires)
         ON CONFLICT(user_id, doc_uid) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           updated_at = excluded.updated_at,
           expires_at = excluded.expires_at'
    );
    $stmt->execute([
        ':uid' => $userId,
        ':doc_uid' => $docUid,
        ':title' => $title,
        ':content' => $content,
        ':now' => $now,
        ':expires' => $expiresAt,
    ]);

    return [
        'id' => $docUid,
        'updatedAt' => $now * 1000,
        'expiresAt' => $expiresAt * 1000,
        'retentionDays' => RETENTION_DAYS,
    ];
}

function deleteDoc(PDO $db, int $userId, array $payload): void
{
    $docUid = normalizeDocId((string)($payload['docId'] ?? ''));
    $stmt = $db->prepare('DELETE FROM docs WHERE user_id = :uid AND doc_uid = :doc_uid');
    $stmt->execute([':uid' => $userId, ':doc_uid' => $docUid]);
}

function normalizeUsername(string $username): string
{
    $username = trim($username);
    $len = strlen($username);
    if ($len < MIN_USERNAME_LENGTH || $len > MAX_USERNAME_LENGTH) {
        throw new RuntimeException('用户名长度需为 3-32 位', 400);
    }
    if (!preg_match('/^[A-Za-z0-9_-]+$/', $username)) {
        throw new RuntimeException('用户名仅支持字母、数字、下划线和短横线', 400);
    }
    return $username;
}

function normalizeDocId(string $docId): string
{
    if ($docId === '') {
        throw new RuntimeException('Missing docId', 400);
    }
    if (!preg_match('/^[A-Za-z0-9_-]{6,96}$/', $docId)) {
        throw new RuntimeException('Invalid docId', 400);
    }
    return $docId;
}

function safeTruncate(string $text, int $maxLen): string
{
    if (function_exists('mb_substr')) {
        return (string)mb_substr($text, 0, $maxLen);
    }
    return substr($text, 0, $maxLen);
}

function ok(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
