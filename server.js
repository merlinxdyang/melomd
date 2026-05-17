/**
 * MeloMD — VPS Server
 * 用法：node server.js [port]
 * 访问：http://your-vps-ip:3000
 *
 * 功能：
 *   GET  /          → 返回 index.html
 *   POST /api/save  → 将 Markdown 内容保存到 MDFILES/ 文件夹
 *   GET  /api/files → 列出 MDFILES/ 里的文件（可选）
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = parseInt(process.argv[2]) || 3000;
const BASE_DIR    = __dirname;
const MDFILES_DIR = path.join(BASE_DIR, 'MDFILES');

// 确保 MDFILES 目录存在
if (!fs.existsSync(MDFILES_DIR)) {
  fs.mkdirSync(MDFILES_DIR, { recursive: true });
  console.log('Created MDFILES directory:', MDFILES_DIR);
}

/** 把标题转为安全文件名 */
function slugify(str) {
  return (str || 'untitled')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 60);
}

/** 读取请求 body（返回 Promise<string>） */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 5e6) req.destroy(); });
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

/** 发送 JSON 响应 */
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS（允许本地调试时跨域）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── GET / → serve index.html ────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/') {
    try {
      const html = fs.readFileSync(path.join(BASE_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(404); res.end('index.html not found');
    }
    return;
  }

  // ── POST /api/save → write to MDFILES/ ──────────────────────────────────────
  if (req.method === 'POST' && url === '/api/save') {
    try {
      const body  = await readBody(req);
      const { title, content, docId } = JSON.parse(body);

      const slug  = slugify(title);
      const ts    = new Date().toISOString()
                      .replace(/[:.]/g, '-')
                      .replace('T', '_')
                      .slice(0, 19);

      // Primary file: MDFILES/{slug}_{docId}.md  (overwrite → latest version)
      const primary  = path.join(MDFILES_DIR, `${slug}_${docId}.md`);
      fs.writeFileSync(primary, content || '');

      // Timestamped backup: MDFILES/backup/{slug}_{timestamp}.md
      const backupDir = path.join(MDFILES_DIR, 'backup');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const backup = path.join(backupDir, `${slug}_${ts}.md`);
      fs.writeFileSync(backup, content || '');

      console.log(`[save] ${path.basename(primary)}`);
      json(res, 200, { ok: true, file: path.basename(primary), backup: path.basename(backup) });
    } catch (e) {
      console.error('[save error]', e.message);
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // ── GET /api/files → list MDFILES (excludes backup/) ────────────────────────
  if (req.method === 'GET' && url === '/api/files') {
    try {
      const files = fs.readdirSync(MDFILES_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => {
          const stat = fs.statSync(path.join(MDFILES_DIR, f));
          return { name: f, size: stat.size, mtime: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.mtime.localeCompare(a.mtime));
      json(res, 200, { ok: true, files });
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\nMeloMD Server`);
  console.log(`────────────────────────────────────`);
  console.log(`访问地址 : http://localhost:${PORT}`);
  console.log(`MDFILES  : ${MDFILES_DIR}`);
  console.log(`────────────────────────────────────\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请使用: node server.js <其他端口>`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
