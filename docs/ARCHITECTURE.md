# Architecture

## Execution model

This is a static React/TypeScript application built by Vite. GitHub Pages serves files; the browser owns all document processing and storage. The UI is a working editor with a local workspace. No external application service is called.

## Modules

| Module                                | Role                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `model.ts`                            | Versioned Zod document schema, defaults, templates, text export and diagnostics     |
| `storage.ts`                          | Dexie tables, revision conflict checks, snapshots and transactional backup recovery |
| `useWorkspace.ts`                     | Active document, undo history, serialized saves and temporary-session state         |
| `EditorForms.tsx`                     | Profile, section, entry, template and achievement editing                           |
| `ToolsPanel.tsx`                      | Role tailoring, letters, criteria, Career Library and snapshot comparison           |
| `importer.ts` / `import.worker.ts`    | Validated file extraction, source blocks and conservative field mapping             |
| `ocr.ts`                              | Explicit local OCR using Tesseract; PDF pages rasterized serially                   |
| `document.tsx` / `pdf.worker.tsx`     | Shared text-based PDF layout running outside the UI thread                          |
| `exporter.ts`                         | Worker orchestration, Word generation and application-pack text                     |
| `PdfPreview.tsx` / `PreviewPanel.tsx` | Render the completed Blob, validate current revision and inspect extracted text     |
| `offline.ts` / `generate-sw.mjs`      | Optional app-scoped cache, update handling and separate OCR caching                 |

## Data decisions

A résumé is one versioned structured document. Entries have stable IDs, sections carry their order and visibility, and templates never rewrite content. Application variants are independent copies with a parent reference. Snapshots are immutable copies associated with the source résumé ID.

Backups explicitly identify the application and schema version. Restoring creates fresh IDs and remaps snapshots within a single transaction. Malformed and newer-version data is rejected before mutation. Nothing claims automatic cross-device synchronization.

Imports preserve unsupported or ambiguous content for review. Extraction and inference are separate layers. A user can split extracted blocks and assign them before creating the draft. Files and their bytes are not persisted automatically. PDF scripts are not run by the application; only text extraction and page rendering are used.

## Rendering and performance

Heavy document libraries are loaded on demand. PDF rendering happens in a module worker and is cancelled when a newer revision is requested. The preview and download use the same completed Blob. The UI cannot download an older PDF while a new generation is in progress. Preview canvases are only rendered when visible, while an extracted-text view remains available for content inspection.

Vite's esbuild JSX transform is used directly so window-only development refresh code does not leak into PDF workers. PDF.js and Tesseract assets are bundled locally; production rendering does not depend on a third-party CDN.

## Boundaries

- No cloud sync, public résumé links, live collaboration, scraping or automatic job applications.
- No secret API keys or hosted AI model calls.
- A keyword coverage check is not an ATS score.
- DOCX pagination is allowed to differ from PDF and that distinction is explained in the UI.
- Scan recognition remains user-reviewed and English-focused.
- Local saving is not a durable off-device backup.

## Release gates

Run tests, type checking and the production build. Review generated PDFs for text and pagination. Exercise import/review/edit/download with fictional files, and verify dependency security. Verify Pages at the real base path and check font/worker requests. For meaningful rendering changes, rerun the PDF fixtures rather than broad unrelated tests.

Future schema changes require explicit migration fixtures and rollback planning. Future custom-origin deployments need a new browser backup/restore because browser storage is origin-specific. Do not globally clear origin storage or cache names shared with another application.
