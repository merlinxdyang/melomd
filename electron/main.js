const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { fileURLToPath } = require('url');

const appRoot = path.resolve(__dirname, '..');
const writableMarkdownPaths = new Set();
const appIconPath = path.join(appRoot, 'assets', 'brand', 'melomd-dock-icon.png');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'MeloMD',
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const template = [
    {
      label: 'MeloMD',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function safeExportName(name) {
  return (name || 'document')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'document';
}

function ensureMarkdownExtension(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  return ext === '.md' ? filePath : `${filePath}.md`;
}

function markdownNameFromPath(filePath) {
  return path.basename(filePath || 'untitled.md').replace(/\.md$/i, '') || 'untitled';
}

function resolveAssetRef(ref) {
  const raw = String(ref || '').trim();
  if (!raw) throw new Error('Missing asset path');

  let candidate;
  if (/^file:\/\//i.test(raw)) {
    candidate = fileURLToPath(raw);
  } else if (/^[a-z]+:\/\//i.test(raw)) {
    throw new Error('Only local app assets can be read');
  } else {
    candidate = path.isAbsolute(raw) ? raw : path.join(appRoot, raw);
  }

  const resolved = path.resolve(candidate);
  const relative = path.relative(appRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Asset path is outside the app directory');
  }
  return resolved;
}

function mimeForAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.css') return 'text/css';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.ttf') return 'font/ttf';
  if (ext === '.otf') return 'font/otf';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

ipcMain.handle('litemd:read-asset-text', async (event, ref) => {
  const filePath = resolveAssetRef(ref);
  return fs.readFile(filePath, 'utf8');
});

ipcMain.handle('litemd:read-asset-data-url', async (event, ref) => {
  const filePath = resolveAssetRef(ref);
  const buffer = await fs.readFile(filePath);
  return `data:${mimeForAsset(filePath)};base64,${buffer.toString('base64')}`;
});

ipcMain.handle('litemd:create-markdown-file', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error('No active window');
  }

  const defaultName = `${safeExportName(options.title || 'untitled')}.md`;
  const defaultPath = path.join(app.getPath('documents'), defaultName);
  const result = await dialog.showSaveDialog(win, {
    title: '新建 Markdown 文件',
    defaultPath,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const filePath = path.resolve(ensureMarkdownExtension(result.filePath));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(options.content || ''), 'utf8');
  writableMarkdownPaths.add(filePath);
  return {
    canceled: false,
    filePath,
    fileName: path.basename(filePath),
    title: markdownNameFromPath(filePath)
  };
});

ipcMain.handle('litemd:write-markdown-file', async (event, options = {}) => {
  const rawPath = String(options.filePath || '');
  if (!rawPath) {
    throw new Error('Missing file path');
  }
  const filePath = path.resolve(ensureMarkdownExtension(rawPath));
  if (!writableMarkdownPaths.has(filePath)) {
    throw new Error('This Markdown file was not created in this session');
  }
  await fs.writeFile(filePath, String(options.content || ''), 'utf8');
  return {
    ok: true,
    filePath,
    fileName: path.basename(filePath),
    title: markdownNameFromPath(filePath)
  };
});

ipcMain.handle('litemd:export-pdf', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error('No active window');
  }

  const defaultPath = path.join(app.getPath('documents'), `${safeExportName(options.title)}.pdf`);
  const result = await dialog.showSaveDialog(win, {
    title: '导出 PDF',
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  let printWindow = null;
  try {
    const sourceWebContents = options.html
      ? await (async () => {
        printWindow = new BrowserWindow({
          show: false,
          width: 900,
          height: 1200,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        });
        await printWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(String(options.html || ''))}`, {
          baseURLForDataURL: `file://${path.join(__dirname, '..')}/`
        });
        await printWindow.webContents.executeJavaScript(`
          (async () => {
            if (document.fonts && document.fonts.ready) {
              await document.fonts.ready.catch(() => {});
            }
            await Promise.all(Array.from(document.images || []).map(img => {
              if (img.complete) return true;
              return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
              });
            }));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return true;
          })();
        `);
        return printWindow.webContents;
      })()
      : win.webContents;

    const pdf = await sourceWebContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'A4',
      preferCSSPageSize: true,
      margins: {
        marginType: 'custom',
        top: 0.5,
        bottom: 0.5,
        left: 0.55,
        right: 0.55
      }
    });
    await fs.writeFile(result.filePath, pdf);
  } finally {
    if (printWindow) {
      printWindow.close();
    }
  }
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(appIconPath);
  }
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
