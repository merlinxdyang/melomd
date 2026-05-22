# MeloMD

English | [简体中文](README.zh-CN.md)

MeloMD is a local-first Markdown editor for fast writing, live preview, academic notes, technical documents, and export to common document formats.

Developed by **X.D. Yang**. Current version: **3.0.0**.

## What Is New in 3.0

- Two-row responsive toolbar: green editing tools on one row, yellow/red formatting and insertion tools on another row.
- Mode switch between split comparison mode and a single-pane WYSIWYG editing mode.
- WYSIWYG and preview editing surfaces resize with the app window instead of staying fixed-width.
- Per-document history menu with save, delete, copy, paste, view path, and copy path actions.
- New Markdown files are created through a save dialog first, with `.md` as the default extension.
- Corrected macOS Dock icon behavior with a transparent, size-balanced watermelon-pencil icon.
- Electron smoke tests now cover toolbar wrapping, WYSIWYG mode, document menus, exports, and responsive resizing.

## Features

- Split-pane Markdown editing with live preview.
- Single-pane WYSIWYG mode for rendered Markdown editing.
- Local-first desktop workflow with Electron.
- Document history with full-text search.
- Markdown support for tables, task lists, footnotes, highlights, superscript, and subscript.
- LaTeX rendering with KaTeX, including inline math, display math, aligned formulas, and formula source toggles.
- Targeted `forest` syntax-tree rendering for linguistics-style LaTeX tree blocks.
- Mermaid rendering, including flowcharts and readable Gantt charts.
- Image insertion with embedded data URLs for portable documents.
- Export to Markdown, plain text, self-contained HTML, PDF, and Word `.docx`.

## Downloads

Installers and archives are published on the GitHub Releases page.

Expected 3.0.0 release assets:

- `MeloMD-3.0.0-mac-arm64.dmg` for Apple Silicon Macs.
- `MeloMD-3.0.0-mac-arm64.zip` as a macOS Apple Silicon app archive.
- `MeloMD-3.0.0-mac-x64.dmg` for Intel Macs.
- `MeloMD-3.0.0-mac-x64.zip` as a macOS Intel app archive.
- `MeloMD-3.0.0-win-x64.exe` for 64-bit Windows.
- `MeloMD-3.0.0-win-x64.zip` as a portable 64-bit Windows archive.

These local builds are unsigned unless signing certificates are available during packaging. macOS may require opening from **System Settings > Privacy & Security** or using **Open** from the Finder context menu. Windows may show a SmartScreen warning for unsigned installers.

## Run From Source

Install dependencies:

```bash
npm install
```

Start the desktop app:

```bash
npm run dev
```

Run verification:

```bash
npm run test:smoke
npm run test:electron
```

## Build

Build Apple Silicon macOS artifacts:

```bash
npm run dist:mac-arm64
```

Build Intel macOS artifacts:

```bash
npm run dist:mac-x64
```

Build Windows x64 artifacts:

```bash
npm run dist:win-x64
```

Packaged output is written to `dist/`.

## Project Structure

```text
index.html              Main editor UI and renderer
electron/               Electron main/preload process files
assets/                 MeloMD brand assets and toolbar icons
vendor/                 Bundled browser libraries for offline use
scripts/                Smoke tests and Electron integration checks
MDFILES/                Example Markdown files
```

## Export Support

MeloMD supports:

- `.md`
- `.txt`
- `.html`
- `.pdf`
- `.docx`

The HTML export is self-contained, including bundled KaTeX and syntax-highlighting styles. PDF export uses Electron's print pipeline for a closer preview-to-PDF result.

## Support

MeloMD is a personal open-source project. If it helps your writing, notes, or document workflow, voluntary support is appreciated and helps keep the project maintained.

- PayPal: [paypal.me/yxd76](https://paypal.me/yxd76)
- Alipay: scan the QR code below

<p>
  <img src="assets/support/alipay.jpeg" width="220" alt="Alipay QR code">
</p>

## License

MeloMD is released under the MIT License. See [LICENSE](LICENSE).
