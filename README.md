# MeloMD

MeloMD is a fresh Markdown editor for quick writing and converting. It is designed for fast drafting, live preview, academic notes, technical documents, and one-click export to common document formats.

Developed by **X.D. Yang**. Current version: **2.0.0**.

## Highlights

- Split-pane Markdown editing with live preview.
- Local-first desktop workflow with an Electron macOS app.
- Polished MeloMD interface with custom toolbar icons and brand assets.
- Markdown extensions for tables, task lists, footnotes, highlights, superscript, and subscript.
- LaTeX rendering with KaTeX, including display math, inline math, and common aligned formulas.
- Targeted `forest` syntax-tree rendering for linguistics-style LaTeX tree blocks.
- Mermaid diagram rendering, including flowcharts and readable Gantt charts.
- Image insertion with embedded data URLs for portable documents.
- Export to Markdown, plain text, self-contained HTML, PDF, and Word `.docx`.
- Source-toggle blocks for LaTeX so rendered formulas stay clean while the original code remains accessible.

## Download

See the GitHub Releases page for macOS installers:

- `MeloMD-2.0.0-arm64.dmg` for Apple Silicon Macs.
- `MeloMD-2.0.0-x64.dmg` for Intel Macs.

These local builds are unsigned unless a Developer ID certificate is available during packaging. On first launch, macOS may require opening from **System Settings > Privacy & Security** or using **Open** from the Finder context menu.

## Run From Source

Install dependencies:

```bash
npm install
```

Start the desktop app in development mode:

```bash
npm run dev
```

Run verification:

```bash
npm run test:smoke
npm run test:electron
npm audit --omit=dev
```

## Build macOS Installers

Build Apple Silicon:

```bash
npm run dist:mac-arm64
```

Build Intel:

```bash
npm run dist:mac-x64
```

The packaged output is written to `dist/`. The prepared local release folder for version 2.0.0 is:

```text
MeloMD_macOS_2.0/
  Apple-Silicon-arm64/MeloMD-2.0.0-arm64.dmg
  Intel-x64/MeloMD-2.0.0-x64.dmg
```

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

MeloMD currently supports:

- `.md`
- `.txt`
- `.html`
- `.pdf`
- `.docx`

The HTML export is self-contained, including bundled KaTeX and syntax-highlighting styles. PDF export uses a direct Electron print pipeline for a closer preview-to-PDF result.

## License

MeloMD is released under the MIT License. See [LICENSE](LICENSE).
