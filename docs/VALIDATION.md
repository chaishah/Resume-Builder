# Validation record

6 September 2026. All sample documents and browser data used in these checks are fictional.

## Automated checks

- 17 tests pass across data-integrity/recovery and document-export suites.
- TypeScript checking passes.
- Production Vite build passes, including local font, PDF-reader and OCR assets, the Pages base path and generated offline files.
- Production dependency audit reports zero known vulnerabilities after updating PDF.js to a patched version.
- All five templates generate selectable-text A4 PDFs containing contact details and expected achievements.
- A long-career fixture spans multiple pages and retains its final achievement; no empty final page is produced by that fixture.
- Résumé, cover-letter and selection-criteria Word exports contain editable content in their document XML.
- Backups validate before write and restore as independent copies with remapped snapshots.
- Stale concurrent edits and stale saves after deletion are rejected without overwriting the winning state.
- Import parsing preserves ambiguous source text and source-page references rather than inventing missing fields.

## Browser checks performed

- Opened and visually inspected the workspace and desktop editor.
- Opened a fictional example, generated its actual PDF preview and inspected the extracted text.
- Exercised the PDF download button; the app reported that the download was ready. The browser automation did not expose a downloadable file event, so filesystem export validity is covered by the separate document tests rather than a captured browser download.
- Imported a generated Word DOCX and verified the review blocks contain its experience paragraphs.
- Imported a generated text PDF, reached section review, created an editable draft, edited its headline and returned to the workspace with the saved change.
- Imported a synthetic PNG scan and ran local OCR. Recovered the name, professional summary, experience and education into review blocks.
- Fixed worker compatibility issues discovered during these checks: removed window-only refresh injection from PDF rendering and let PDF.js own its text-extraction worker from the browser display context.

## Remaining validation limits

- The available browser session was desktop Chrome. Real iPhone Safari, Android Chrome, Firefox, screen-reader and device keyboard checks were not executed in this environment.
- Responsive CSS includes phone layouts, touch controls, full-width input fields and safe-area handling, but that does not substitute for device validation.
- Offline installation requires a secure origin and was not end-to-end tested in the HTTP preview. The production service worker and cache lists are built; check installation and updates on the HTTPS Pages deployment.
- OCR was tested on one clean English image. Recognition accuracy is not advertised as a percentage. Scanned/mixed PDF code uses the same OCR engine with serial page rendering and still requires user review.
- The first GitHub Pages deployment depends on repository eligibility and Pages settings/permissions. The Actions run is the authoritative deployment result.

## Safari preview regression fix

The reported `undefined is not a function (near '...i of e...')` error maps to the archived PDF.js bundle's `for await` loop in `getTextContent()`. Safari versions before 26.4 lack ReadableStream async iteration; the original call reproduces the failure when that iterator is absent. See [WebKit's Safari 26.4 release notes](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/).

- Preview and PDF import now consume text streams through `getReader()` and release the reader lock. A regression test extracts a real generated PDF with stream async iteration disabled and verifies the name, email and achievement text.
- The app uses PDF.js's matching legacy display and worker builds for browser compatibility, retaining the existing patched dependency version. Mozilla documents Safari support under its [legacy build](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#legacy-build).
- Text-check errors no longer hide rendered pages. Page counts are available as soon as the PDF opens, and loading/rendering failures offer Open PDF and retry controls.
- Desktop Chrome live preview was visually inspected after the fix. The production build and all 17 tests pass. This regression simulation does not substitute for a real iPhone Safari check.

## Useful follow-up device check

On the deployed HTTPS app, create a short draft on iPhone Safari, import a DOCX/PDF, preview and save PDF to Files, export a backup, reload and restore it. Then enable offline editing and reopen without a connection. Keep test data fictional. This is validation work, not an invitation to upload personal test documents into the repository.
