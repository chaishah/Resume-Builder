# Resume Studio · by Chai

A browser-based Australian résumé builder with subtle templates, reviewable imports and editable backups. Built for GitHub Pages. No account, document-upload server, paid AI API or database service is required.

## What is included

- Five single-column templates: Essential, Slate, Editorial, Graduate and Professional.
- A4 PDFs with selectable text, embedded fonts, links and controlled page breaks.
- PDF preview generated from the same document blob used for downloading.
- Editable Word DOCX and plain-text exports.
- Contact details, summary, experience, education, skills, projects, certifications, volunteering, awards, languages, referees, publications and custom sections.
- Section and entry ordering, visibility, custom headings, dates and achievement bullets.
- Local autosave, undo/redo, conflict detection, independent variants, snapshots and JSON backup/restore.
- PDF, DOCX, TXT/Markdown and pasted-text import with a correction step and preserved unassigned content.
- Local English OCR for PNG/JPEG and scanned PDF pages, including mixed text/scan PDFs.
- Career Library, guided Achievement Workshop, job-ad term coverage and a word-count page budget.
- Matching cover letters and structured selection-criteria responses, exported to PDF/DOCX/TXT.
- Local application notes, deadline and status. No automatic notifications or job submissions.
- Optional offline installation with a save-before-update flow; scan assets have a separate offline download.
- Temporary sessions, app-specific clear-data controls and no analytics.

## GitHub Pages setup

The expected Pages address is `https://chaishah.github.io/Resume-Builder/` once GitHub enables and deploys the site.

The workflow in `.github/workflows/pages.yml` tests and builds the application, uploads `dist`, requests Pages configuration and deploys. It runs on pushes to `main`, manual dispatch and when the repository becomes public. Pull requests run the build/test gate without deploying.

GitHub Free requires a public repository for Pages. A private repository needs an eligible GitHub plan. This application does not change repository visibility automatically.

If the deployment reports that Pages is not enabled, open **Settings → Pages → Build and deployment → Source → GitHub Actions**, then rerun the workflow. Enabling Pages for the first time can require repository administration permission unavailable to the default Actions token. The prepared workflow attempts automatic enablement but cannot bypass that permission boundary.

GitHub may require an environment approval according to the repository’s existing settings. Do not disable protection rules to work around that.

## Local development

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

The default app path is `/Resume-Builder/`. For a different project name or custom-domain root, set `VITE_BASE_PATH` at build time, such as `/` for a root deployment. Use a trailing slash. All runtime asset paths resolve through that base.

```sh
npm test
npm run build
npm run preview
```

`postinstall` copies licensed fonts, the PDF reader’s resources and OCR binaries from installed packages into `public`. These generated assets are ignored in source control and included in the build. The lockfile is committed for reproducible installs.

The production build also generates the service worker and offline asset lists. Offline installation requires HTTPS (or localhost); ordinary HTTP development previews do not offer installation.

## Import behaviour and limits

Imports recover content into editable sections; they do not recreate the uploaded layout. Rules identify likely section headings and contact details. Jobs and qualifications with uncertain boundaries stay grouped for review. Split blocks in the import review, then edit titles, employers and dates in the editor. Unassigned contact material is preserved in Import notes and excluded from exported applications.

- One document at a time; 10 MB document limit; up to 20 PDF pages.
- Backup limit: 15 MB. Invalid or newer-version backups are rejected before storage writes.
- DOCX archives are checked for file count and expanded size before text extraction.
- Password-protected PDFs must be unlocked by the user before import.
- Legacy `.doc`, Apple Pages and arbitrary external JSON formats are not accepted; export to DOCX/PDF or paste text.
- OCR is English and can misread names, dates and numbers. It runs only after the user selects scan recognition. Review its results.
- The importer never invents qualifications, dates, employers or achievements.

## Saving and privacy

IndexedDB stores data under `chai-resume-studio-v1`. Local settings and cache names use the `resume-studio-` prefix. No résumé content is transmitted by the app. The host still receives ordinary requests for static files and may keep access logs.

Drafts are browser-local and are not automatically synced. Browser cleanup, private sessions or storage eviction can remove drafts. Download editable JSON backups. A temporary session keeps edits in memory and should be backed up before closing or updating.

Multiple GitHub Pages projects on the same hostname share a browser origin. Namespacing prevents accidental collisions, not security isolation. A separate custom origin is a stronger boundary if needed. Delete-data controls deliberately remove only this app’s database/settings/caches.

Backups restore as new copies in a transaction. Concurrent stale edits cannot overwrite newer saves. The latest 30 snapshots per résumé are kept. A future schema migration must back up and preserve old data on failure; version 1 currently requires no legacy migration.

## Document expectations

The PDF is generated from structured text rather than screenshots. Word output is editable and uses common replacement fonts; pagination may differ from the PDF. The built-in PDF text check helps inspect extraction order but is not an ATS certification or a hiring score. Fonts cover Latin-based names and Australian English; complex scripts need a suitable future font set. Always review the downloaded document.

All supplied examples are fictional. Role Lens is deterministic term matching; it does not imply understanding of every synonym. No AI rewriting or paid model integration is included or required.

## Tests and validation

The automated suite checks schema validation, independent variants, hidden-section exclusion, safe links, role coverage, snapshot comparison, stale-write conflicts, deletion conflicts, transaction-safe backup restoration and import preservation. Document tests generate every template, extract PDF text, check A4 dimensions and long-document pagination, and inspect the editable Word archive for expected content.

Browser testing is recorded in `docs/VALIDATION.md`. Real-device Safari/Android checks remain necessary before claiming those devices have been fully validated. The app is responsive and uses native file inputs, dialogs and download/share fallbacks.

## Maintenance

Monthly Dependabot configuration covers npm packages and GitHub Actions. Review document-reader security updates promptly. Run the focused test suite before merging dependency changes. Keep user documents out of issues, logs, fixtures and source control.

See `docs/ARCHITECTURE.md` for module boundaries, release gates and future extension notes.
