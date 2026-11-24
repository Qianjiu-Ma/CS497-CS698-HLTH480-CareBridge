# CareBridge

**University of Waterloo · CS497/CS698/HLTH480 group project**

CareBridge is an AI-assisted multilingual shift handoff prototype for long-term care. It explores how care staff can turn a spoken or typed report into structured documentation, surface changes for nurse review, and give the incoming team a clear list of follow-up tasks. The app ships with fictional residents and sample shifts.

## What the application does

| Workspace | Workflow |
| --- | --- |
| **Handoff** | Review the resident roster, record completed care and observations, and prepare next-shift instructions. Enter a typed report or use browser speech recognition. Review extracted fields and the original wording before submitting. |
| **Clinical review** | Review prioritized concerns, record nurse acknowledgment and assessment, monitor follow-up, and resolve or reopen concerns with the existing review controls. |
| **My shift** | See scheduled and flexible tasks alongside active clinical concerns. Mark tasks complete or undo completion independently of the clinical review workflow. |
| **Records** | Search and filter read-only snapshots of submitted shifts. Open resident details, original transcripts, sign-off information, and the activity log. Print a record or try the simulated sync. |
| **Settings** | Adjust speech pause, review and deliberately edit demo Stop & Watch rules and thresholds, restore defaults, or print a blank paper handoff sheet. |

## Design and clinical safety

The interface keeps routine care, time-sensitive concerns, and archived information distinct. Shared navigation, responsive layouts, and reduced-motion support keep the workflow consistent across desktops and phones. Detailed records and review controls are available on demand.

AI extraction and translation help prepare a draft. Staff remain responsible for checking the original report and correcting the draft. The submission review requires confirmation for pending AI fields, blocks submission when a Tier 3 concern has no recorded nurse notification, and requires an acknowledgment and reason to proceed with an unnotified Tier 2 concern. Recording task completion leaves the associated clinical concern unchanged. Demo rules and thresholds have no clinical approval. The rule engine uses configured intake and bowel movement thresholds. Settings also retain weight and repositioning values for the prototype.

## Architecture

- **Client** — React, TypeScript, Vite, and Tailwind CSS. Shared application state connects the handoff, nurse review, incoming tasks, and records. Interface and system messages use checked-in i18next catalogs. The browser loads the selected language and remembers it locally.
- **Server** — Express provides extraction and on-demand translation. The existing Google Cloud Translation SDK and optional Gemini fallback handle free text. The same preview flow checks CareBridge’s exact-match phrasebook first and reuses successful requests in memory.
- **Persistence** — The browser stores current handoff data, settings, escalations, task state, and archived shift snapshots in local storage. Voice drafts and transcript segments use session storage. There is no application database or cross-device synchronization.

## Run locally

Use Node.js 24 and Bun. To run the seeded demo, start without an environment file.

~~~sh
git clone https://github.com/Qianjiu-Ma/CS497-CS698-HLTH480-CareBridge.git
cd CS497-CS698-HLTH480-CareBridge
bun install --frozen-lockfile
bun run dev
~~~

Open [http://localhost:3000](http://localhost:3000). Start with a typed report if the browser does not offer speech recognition or microphone access. Set the `PORT` environment variable before starting to use a different port.

To enable Gemini or configure Google Cloud Translation, copy `.env.example` to `.env`, set the relevant variables, and restart the server. Keep API keys and credential files out of Git. For Google Cloud credentials, use Application Default Credentials or point to a key file outside this checkout.

~~~sh
bun run lint   # TypeScript checks
bun run build  # Frontend production bundle
bunx playwright install chromium
bun run test:browser  # Production-build browser checks
~~~

## Localization

The interface supports English, Tagalog, Punjabi, Hindi, Mandarin Chinese, Spanish, French, and Arabic. Update all eight files in `src/locales` when changing interface copy. Use whole messages with named `{{variables}}` for dynamic values so translations can reorder them. Stop & Watch codes, room numbers, clinical values, and stored record text retain their original meaning and identifiers.

Use **Translate** to request a reading preview. Phrasebook matches work locally. Other requests share a bounded, time-limited cache keyed by the input text and source and target languages. Changes to the note or target language clear the visible preview. Machine output carries a verification label, and **Show original** returns to the recorded wording. A provider failure leaves the original available and offers **Retry translation**. Reading language and speech recognition language are independent. Auto-detect is available for typed translation, and microphone use requires a selected speech language.

CareBridge uses lazy JSON catalogs with i18next and react-i18next, following the pattern documented by OpenMRS. The preview and original-text controls draw on Teams and Slack. Care to Translate informed the distinction between a phrase library and machine output. Right-to-left reading order, logical spacing, and directional controls follow Apple’s RTL guidance. [OpenMRS](https://o3-docs.openmrs.org/en-US/docs/recipes/set-up-translations-in-a-frontend-module/) · [Teams](https://support.microsoft.com/en-gb/teams/chat/translate-a-message-in-microsoft-teams?nochrome=true) · [Slack](https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack) · [Care to Translate](https://www.caretotranslate.com/learn/faq) · [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/right-to-left)

The new runtime dependencies are i18next and react-i18next (MIT). Playwright (Apache-2.0) is a development dependency. Catalog and placeholder checks run in the same suite, so the project does not need a second localization toolchain. The existing translation path has a single request cache per process and shares in-flight work, so a general query library would add a second cache. [i18next](https://github.com/i18next/i18next) · [react-i18next](https://github.com/i18next/react-i18next) · [Playwright](https://github.com/microsoft/playwright)

Set `GOOGLE_TRANSLATE_GLOSSARY_ID` to use an existing Cloud Translation v3 glossary in the configured regional location for explicit-source requests. The included phrasebook remains available without cloud credentials. The catalogs contain machine-assisted copy and require native-speaker and clinical terminology review before use outside the fictional-data prototype. [Google Cloud glossary example](https://docs.cloud.google.com/translate/docs/samples/translate-v3-translate-text-with-glossary)

## Privacy and limitations

Use fictional data only. Browser speech recognition can use the browser vendor’s remote service. When a translation or extraction path calls an external provider, it can send the submitted text and, for some extraction paths, resident and staff labels. Translation can use a Google endpoint even without locally configured credentials. Browser storage persists on the same origin and is accessible through the browser profile.

The app simulates EMR submission and synchronization. It has no live EMR connection, user authentication, or production access controls. Staff labels and the activity log are demo records and do not provide identity verification or a tamper-evident audit trail. Speech recognition, translation, AI extraction, and rule-based alerts are subject to errors. This academic prototype is for demonstration and evaluation with fictional cases.
