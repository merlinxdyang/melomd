const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { fileURLToPath } = require('url');

const consoleMessages = [];

const appRoot = path.resolve(__dirname, '..');

function resolveAssetRef(ref) {
  const raw = String(ref || '').trim();
  let candidate;
  if (/^file:\/\//i.test(raw)) candidate = fileURLToPath(raw);
  else if (/^[a-z]+:\/\//i.test(raw)) throw new Error('Only local app assets can be read');
  else candidate = path.isAbsolute(raw) ? raw : path.join(appRoot, raw);
  const resolved = path.resolve(candidate);
  const relative = path.relative(appRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset path is outside app root');
  return resolved;
}

function mimeForAsset(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.ttf') return 'font/ttf';
  if (ext === '.css') return 'text/css';
  return 'application/octet-stream';
}

async function run() {
  await app.whenReady();

  ipcMain.handle('litemd:read-asset-text', async (event, ref) => fs.readFile(resolveAssetRef(ref), 'utf8'));
  ipcMain.handle('litemd:read-asset-data-url', async (event, ref) => {
    const filePath = resolveAssetRef(ref);
    const buffer = await fs.readFile(filePath);
    return `data:${mimeForAsset(filePath)};base64,${buffer.toString('base64')}`;
  });

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('console-message', event => {
    consoleMessages.push({ level: event.level, message: event.message });
  });

  await win.loadFile(path.join(__dirname, '..', 'index.html'));

  await new Promise(resolve => setTimeout(resolve, 500));
  const runtimeReady = await win.webContents.executeJavaScript('!!window.LiteMDRuntime');
  if (!runtimeReady) {
    throw new Error(`LiteMDRuntime was not initialized; console=${JSON.stringify(consoleMessages.slice(0, 10))}`);
  }

  const markdown = `# Math Smoke

Inline \\(E=mc^2\\)

[
Recall_{delete} = \\frac{TP_{delete}}{TP_{delete}+FN_{delete}}
]

\\[
\\int_0^1 x^2 dx
\\]

\`\`\`latex
[f(x)=
\\begin{cases}
\\dfrac{\\sin x}{x}, & x \\neq 0, \\\\
1, & x = 0
\\end{cases}]
\`\`\`

![tiny](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFElEQVR42mP8z8AARLJgWIi8CwB4YgIRN+AGJwAAAABJRU5ErkJggg==)

| A | B |
|---|---|
| 1 | 2 |

- [ ] task

Subscript H~2~O and superscript mc^2^ plus ==highlight==.

Footnote sentence.[^note1]

Another footnote.[^longnote]

[^note1]: 这是第一个脚注。
[^longnote]: 这是一个较长的脚注，包含 **bold** 和 \`inline code\`。`;

  const ganttMarkdown = `${markdown}

\`\`\`latex
\\begin{forest}
for tree={
    align=center,
    s sep=9mm,
    l sep=10mm
}
[CP
    [DP$_i$[Which book]]
    [C$'$
        [C[did]]
        [TP
            [DP[John]]
            [T$'$
                [T[$t$]]
                [VP
                    [V[read]]
                    [DP[$t_i$]]
                ]
            ]
        ]
    ]
]
\\end{forest}
\`\`\`

\`\`\`mermaid
gantt
    title MeloMD Development Plan
    dateFormat  YYYY-MM-DD
    section Core
    Markdown editing      :done,   a1, 2026-05-01, 7d
    Preview rendering     :active, a2, 2026-05-08, 10d
    Export feature        :        a3, 2026-05-18, 8d
    section Polish
    Toolbar icons         :        b1, 2026-05-20, 5d
    Dark mode             :        b2, 2026-05-25, 4d
\`\`\``;

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      if (!window.marked || !window.katex || !window.docx || !window.JSZip || !window.html2canvas || !window.jspdf || !window.CodeMirror) {
        throw new Error('Required browser globals are missing');
      }
      window.LiteMDRuntime.setMarkdown(${JSON.stringify(ganttMarkdown)});
      await new Promise(resolve => setTimeout(resolve, 800));
      const katexCount = document.querySelectorAll('#preview .katex').length;
      if (katexCount < 4) {
        throw new Error('Expected at least four KaTeX render nodes, got ' + katexCount);
      }
      const dualLatexCount = document.querySelectorAll('#preview .latex-dual-block .latex-rendered').length;
      if (dualLatexCount < 1) {
        throw new Error('Expected latex code block to render both formula preview and source code');
      }
      const source = document.querySelector('#preview .latex-source');
      const toggle = document.querySelector('#preview .latex-source-toggle');
      if (!source || !toggle || !source.hidden) {
        throw new Error('Expected LaTeX source to be hidden by default');
      }
      const forestRender = document.querySelector('#preview .forest-render');
      if (!forestRender || !forestRender.textContent.includes('Which book') || !forestRender.textContent.includes('John')) {
        throw new Error('Expected forest LaTeX block to render as a syntax tree');
      }
      if (forestRender.textContent.includes('\\\\begin{forest}')) {
        throw new Error('Forest rendered view should not show raw LaTeX source');
      }
      toggle.click();
      if (source.hidden || toggle.getAttribute('aria-expanded') !== 'true') {
        throw new Error('Expected LaTeX source toggle to show source');
      }
      toggle.click();
      if (!source.hidden || toggle.getAttribute('aria-expanded') !== 'false') {
        throw new Error('Expected LaTeX source toggle to hide source again');
      }
      const docxChildCount = await window.LiteMDRuntime.getDocxChildCount();
      if (docxChildCount < 4) {
        throw new Error('DOCX conversion produced too few nodes');
      }
      const exportedBlob = await window.LiteMDRuntime.buildDocxBlob();
      if (!exportedBlob || exportedBlob.size < 1000) {
        throw new Error('DOCX browser export produced an unexpectedly small blob');
      }
      const zip = await window.JSZip.loadAsync(await exportedBlob.arrayBuffer());
      const documentXml = await zip.file('word/document.xml').async('string');
      const docPrIds = Array.from(documentXml.matchAll(/<wp:docPr\\b[^>]*\\bid="([^"]+)"/g), match => match[1]);
      const unnamedDocPr = Array.from(documentXml.matchAll(/<wp:docPr\\b([^>]*)/g))
        .filter(match => !/\\bname="[^"]+"/.test(match[1]));
      const unnamedPic = Array.from(documentXml.matchAll(/<pic:cNvPr\\b([^>]*)/g))
        .filter(match => !/\\bname="[^"]+"/.test(match[1]));
      if (docPrIds.length && new Set(docPrIds).size !== docPrIds.length) {
        throw new Error('DOCX image docPr ids are not unique: ' + docPrIds.join(','));
      }
      if (unnamedDocPr.length || unnamedPic.length) {
        throw new Error('DOCX image properties must include non-empty names');
      }
      if (documentXml.includes('\\\\begin{cases}')) {
        throw new Error('DOCX export leaked hidden LaTeX source for a rendered formula block');
      }
      const directPdfButton = Array.from(document.querySelectorAll('#export-menu button'))
        .find(button => button.textContent.includes('PDF 直接导出'));
      const printPdfButton = Array.from(document.querySelectorAll('#export-menu button'))
        .find(button => button.textContent.includes('PDF 打印'));
      if (!directPdfButton || !printPdfButton) {
        throw new Error('Expected separate direct PDF and print PDF menu actions');
      }
      document.getElementById('btn-export').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const exportMenu = document.getElementById('export-menu');
      const exportMenuRect = exportMenu.getBoundingClientRect();
      if (!exportMenu.classList.contains('open')) {
        throw new Error('Export menu did not open');
      }
      if (exportMenu.parentElement !== document.body) {
        throw new Error('Export menu should be portaled to body so toolbar overflow cannot clip it');
      }
      if (exportMenuRect.width < 180 || exportMenuRect.height < 120) {
        throw new Error('Export menu is not visibly laid out on top: ' + JSON.stringify({
          width: exportMenuRect.width,
          height: exportMenuRect.height,
        }));
      }
      if (exportMenuRect.left < 0 || exportMenuRect.top < 0 || exportMenuRect.right > window.innerWidth || exportMenuRect.bottom > window.innerHeight) {
        throw new Error('Export menu is positioned outside the viewport');
      }
      document.body.click();
      const editButtons = ['btn-undo', 'btn-redo', 'btn-cut', 'btn-copy', 'btn-paste', 'btn-select-all', 'btn-find', 'btn-replace']
        .map(id => document.getElementById(id));
      if (editButtons.some(button => !button)) {
        throw new Error('Expected edit actions to be exposed as toolbar buttons');
      }
      if (document.getElementById('btn-edit-menu') || document.getElementById('edit-menu')) {
        throw new Error('Edit dropdown should not remain after moving edit actions to toolbar buttons');
      }
      const toolbarTools = document.querySelector('#toolbar .toolbar-tools');
      if (!toolbarTools || document.querySelectorAll('#toolbar .toolbar-tools .tool-row').length !== 2) {
        throw new Error('Expected editing toolbar to be arranged as two tool rows');
      }
      const editRowTop = Math.round(document.querySelector('#toolbar .edit-actions').getBoundingClientRect().top);
      const formatRowTop = Math.round(document.querySelector('#toolbar .format-actions').getBoundingClientRect().top);
      if (formatRowTop <= editRowTop) {
        throw new Error('Expected yellow/red formatting tools to occupy the second toolbar row');
      }
      const toolbarNodes = Array.from(document.querySelectorAll('#toolbar button, #toolbar input'));
      const firstEditIndex = toolbarNodes.indexOf(document.getElementById('btn-undo'));
      const boldIndex = toolbarNodes.indexOf(document.getElementById('btn-bold'));
      if (firstEditIndex === -1 || boldIndex === -1 || firstEditIndex > boldIndex) {
        throw new Error('Edit toolbar buttons must appear before formatting buttons');
      }
      const toolbarRect = document.getElementById('toolbar').getBoundingClientRect();
      const toolbarOverflow = document.getElementById('toolbar').scrollWidth > Math.ceil(toolbarRect.width) + 2;
      const tooSmallButton = Array.from(document.querySelectorAll('#toolbar > .tb-group > button, #toolbar > .tb-group > .dropdown > button'))
        .filter(button => button.offsetParent !== null)
        .find(button => {
          const rect = button.getBoundingClientRect();
          return rect.width < 30 || rect.height < 30;
        });
      if (toolbarRect.height > 108) {
        throw new Error('Toolbar became too tall after UI restyle: ' + toolbarRect.height);
      }
      if (toolbarOverflow) {
        throw new Error('Toolbar overflows horizontally at desktop width');
      }
      if (tooSmallButton) {
        throw new Error('Toolbar button target is too small: ' + tooSmallButton.id);
      }
      const brokenToolbarIcon = Array.from(document.querySelectorAll('#toolbar img.toolbar-icon'))
        .find(img => !img.complete || img.naturalWidth < 16 || img.naturalHeight < 16);
      if (brokenToolbarIcon) {
        throw new Error('Toolbar icon failed to load: ' + brokenToolbarIcon.getAttribute('src'));
      }
      document.getElementById('btn-mode').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!document.body.classList.contains('wysiwyg-mode') || getComputedStyle(document.getElementById('wysiwyg-pane')).display === 'none') {
        throw new Error('WYSIWYG mode did not switch to the single rendered editor pane');
      }
      const wysiwygWidthAt1200 = document.getElementById('wysiwyg-editor').getBoundingClientRect().width;
      const wysiwygPaneWidthAt1200 = document.getElementById('wysiwyg-pane').getBoundingClientRect().width;
      if (wysiwygWidthAt1200 < wysiwygPaneWidthAt1200 - 90) {
        throw new Error('WYSIWYG editable area should fill the available pane width at desktop size');
      }
      const wysiwygEditor = document.getElementById('wysiwyg-editor');
      wysiwygEditor.textContent = 'Plain English ';
      wysiwygEditor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      if (wysiwygEditor.textContent !== 'Plain English ' || !window.LiteMDRuntime.getMarkdown().endsWith(' ')) {
        throw new Error('WYSIWYG editor should preserve normal trailing spaces while typing plain text');
      }
      wysiwygEditor.textContent = '测试';
      wysiwygEditor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: 'ce' }));
      wysiwygEditor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: '测试' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      if (document.querySelector('#wysiwyg-editor h1') || wysiwygEditor.textContent !== '测试') {
        throw new Error('WYSIWYG editor should not rerender DOM during IME composition input');
      }
      wysiwygEditor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '测试' }));
      wysiwygEditor.textContent = '# Runtime WYSIWYG';
      wysiwygEditor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!document.querySelector('#wysiwyg-editor h1') || !window.LiteMDRuntime.getMarkdown().includes('Runtime WYSIWYG')) {
        throw new Error('WYSIWYG editor did not render typed Markdown into formatted output');
      }
      document.getElementById('btn-mode').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (document.body.classList.contains('wysiwyg-mode')) {
        throw new Error('Mode toggle did not return to split comparison mode');
      }
      window.LiteMDRuntime.setMarkdown(${JSON.stringify(ganttMarkdown)});
      await new Promise(resolve => setTimeout(resolve, 800));
      const firstHistoryMenuButton = document.querySelector('.doc-item-actions');
      if (!firstHistoryMenuButton) {
        throw new Error('Expected every history item to expose an action menu button');
      }
      firstHistoryMenuButton.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const docMenu = document.getElementById('doc-context-menu');
      const menuText = docMenu.textContent;
      if (!docMenu.classList.contains('open') || !menuText.includes('保存') || !menuText.includes('复制内容') || !menuText.includes('粘贴到文档') || !menuText.includes('复制路径') || !menuText.includes('删除')) {
        throw new Error('History item menu is missing required document actions');
      }
      document.body.click();
      const brand = document.querySelector('.toolbar-brand');
      const brandPopover = document.getElementById('brand-info-popover');
      if (!brand || !brandPopover || !brandPopover.textContent.includes('A fresh Markdown editor') || !brandPopover.textContent.includes('Version') || !brandPopover.textContent.includes('3.0')) {
        throw new Error('Expected MeloMD brand info popover content');
      }
      if (getComputedStyle(brandPopover).visibility !== 'hidden') {
        throw new Error('Brand info popover should be hidden until hover or focus');
      }
      brand.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (getComputedStyle(brandPopover).visibility !== 'visible') {
        throw new Error('Brand info popover should become visible on hover');
      }
      document.getElementById('btn-new').focus();
      if (!document.querySelector('#preview sub') || !document.querySelector('#preview sup') || !document.querySelector('#preview mark')) {
        throw new Error('Expected Markdown extension syntax to render subscript, superscript, and highlight');
      }
      const footnotes = document.querySelector('#preview .footnotes');
      const footnoteRefs = document.querySelectorAll('#preview .footnote-ref a[href^="#fn-"]');
      if (!footnotes || footnoteRefs.length < 2 || !footnotes.textContent.includes('这是第一个脚注') || !footnotes.textContent.includes('inline code')) {
        throw new Error('Expected Markdown footnotes to render as linked footnote references and a footnote list');
      }
      if (document.getElementById('preview').textContent.includes('[^note1]:')) {
        throw new Error('Footnote definitions should not appear as raw Markdown in preview');
      }
      const ganttBlock = document.querySelector('#preview .mermaid-block.mermaid-gantt');
      if (!ganttBlock || !ganttBlock.querySelector('svg')) {
        throw new Error('Expected Mermaid gantt diagram to render with the gantt layout class');
      }
      const ganttSvgWidth = ganttBlock.querySelector('svg').getBoundingClientRect().width;
      if (ganttSvgWidth < 700) {
        throw new Error('Gantt chart should keep a readable wide layout, got width ' + ganttSvgWidth);
      }
      const codeBlock = document.querySelector('#preview pre');
      if (!codeBlock) {
        throw new Error('Expected preview to render a code block');
      }
      const codeBg = getComputedStyle(codeBlock).backgroundColor;
      const rgb = Array.from(codeBg.matchAll(/\\d+(?:\\.\\d+)?/g), match => Number(match[0])).slice(0, 3);
      if (rgb.length < 3 || rgb.some(channel => channel < 220)) {
        throw new Error('Preview code block should use a light gray background, got ' + codeBg);
      }
      const pdfHtml = await window.LiteMDRuntime.buildPDFExportHTML();
      if (!pdfHtml.includes('Math Smoke') || !pdfHtml.includes('latex-dual-block')) {
        throw new Error('PDF export HTML does not include rendered preview content');
      }
      if (pdfHtml.includes('id="toolbar"') || pdfHtml.includes('id="editor-pane"')) {
        throw new Error('PDF export HTML leaked editor chrome');
      }
      const htmlExport = await window.LiteMDRuntime.buildHTMLExportDocument();
      if (!htmlExport.includes('<main id="preview">') || !htmlExport.includes('latex-dual-block')) {
        throw new Error('HTML export does not include the rendered preview document');
      }
      if (htmlExport.includes('href="vendor/') || htmlExport.includes('vendor/katex') || htmlExport.includes('vendor/highlight')) {
        throw new Error('HTML export should be self-contained and not depend on project-local vendor paths');
      }
      if (!htmlExport.includes('.katex .base') || !htmlExport.includes('font-family:KaTeX_Main') || !htmlExport.includes('data:font/woff2;base64,')) {
        throw new Error('HTML export did not inline the KaTeX stylesheet and fonts: ' + JSON.stringify({
          hasBase: htmlExport.includes('.katex .base'),
          hasFontFamily: htmlExport.includes('font-family:KaTeX_Main'),
          hasDataFont: htmlExport.includes('data:font/woff2;base64,'),
          head: htmlExport.slice(0, 500)
        }));
      }
      if (htmlExport.includes('id="toolbar"') || htmlExport.includes('id="editor-pane"')) {
        throw new Error('HTML export leaked editor chrome');
      }
      const fallbackPdfBlob = await window.LiteMDRuntime.buildBrowserPDFBlob();
      const fallbackPdfBytes = new Uint8Array(await fallbackPdfBlob.arrayBuffer());
      const fallbackPdfHeader = String.fromCharCode(...fallbackPdfBytes.slice(0, 4));
      if (fallbackPdfHeader !== '%PDF') {
        throw new Error('Browser fallback direct PDF did not produce a PDF blob');
      }
      return {
        katexCount,
        docxChildCount,
        docxBlobSize: exportedBlob.size,
        docPrCount: docPrIds.length,
        browserPdfSize: fallbackPdfBlob.size,
        htmlExportSize: htmlExport.length,
        toolbarHeight: Math.round(toolbarRect.height),
        previewLength: document.getElementById('preview').innerHTML.length,
      };
    })();
  `);

  win.setSize(360, 860);
  await new Promise(resolve => setTimeout(resolve, 350));
  const narrowToolbar = await win.webContents.executeJavaScript(`
    (() => {
      const toolbar = document.getElementById('toolbar');
      const toolbarRect = toolbar.getBoundingClientRect();
      const visibleControls = Array.from(toolbar.querySelectorAll('button, input'))
        .filter(control => control.offsetParent !== null);
      const clipped = visibleControls
        .map(control => ({ id: control.id || control.className || control.tagName, rect: control.getBoundingClientRect() }))
        .filter(item => item.rect.left < toolbarRect.left - 1 || item.rect.right > toolbarRect.right + 1);
      const overflow = toolbar.scrollWidth > Math.ceil(toolbar.clientWidth) + 2;
      return {
        viewportWidth: window.innerWidth,
        toolbarWidth: Math.round(toolbarRect.width),
        toolbarHeight: Math.round(toolbarRect.height),
        scrollWidth: toolbar.scrollWidth,
        clientWidth: toolbar.clientWidth,
        overflow,
        clipped: clipped.map(item => item.id),
        controlCount: visibleControls.length,
      };
    })();
  `);
  if (narrowToolbar.overflow || narrowToolbar.clipped.length) {
    throw new Error(`Toolbar should wrap instead of requiring horizontal scroll at narrow width: ${JSON.stringify(narrowToolbar)}`);
  }
  win.setSize(1200, 800);
  await new Promise(resolve => setTimeout(resolve, 150));

  const responsiveEditor = await win.webContents.executeJavaScript(`
    (async () => {
      document.getElementById('btn-mode').click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const widthBefore = document.getElementById('wysiwyg-editor').getBoundingClientRect().width;
      return { widthBefore };
    })();
  `);
  win.setSize(1800, 860);
  await new Promise(resolve => setTimeout(resolve, 250));
  responsiveEditor.widthAfter = await win.webContents.executeJavaScript(`
    document.getElementById('wysiwyg-editor').getBoundingClientRect().width
  `);
  if (responsiveEditor.widthAfter <= responsiveEditor.widthBefore + 300) {
    throw new Error(`WYSIWYG editable area should grow when the app window grows: ${JSON.stringify(responsiveEditor)}`);
  }
  win.setSize(1200, 800);
  await new Promise(resolve => setTimeout(resolve, 150));

  const seriousMessages = consoleMessages.filter(entry => {
    const message = String(entry.message || '');
    return entry.level >= 3 && !message.includes('Failed to load resource: net::ERR_FILE_NOT_FOUND');
  });

  if (seriousMessages.length) {
    throw new Error(`Console errors: ${JSON.stringify(seriousMessages.slice(0, 5))}`);
  }

  const pdfHtml = await win.webContents.executeJavaScript('window.LiteMDRuntime.buildPDFExportHTML()');
  const pdfWin = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  await pdfWin.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(pdfHtml)}`, {
    baseURLForDataURL: `file://${path.join(__dirname, '..')}/`,
  });
  const pdfBuffer = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    preferCSSPageSize: true,
  });
  await pdfWin.close();
  if (!pdfBuffer || pdfBuffer.length < 1000 || pdfBuffer.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('Direct PDF render did not produce a valid PDF buffer');
  }

  await win.close();
  app.quit();

  console.log(`electron smoke ok: ${JSON.stringify(result)}`);
}

run().catch(error => {
  console.error(error);
  app.quit();
  process.exit(1);
});
