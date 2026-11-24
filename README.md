# CareBridge

**University of Waterloo · CS497 group project**

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

- **Client** — React, TypeScript, Vite, and Tailwind CSS. Shared application state connects the handoff, nurse review, incoming tasks, and records. The app uses the Web Speech API where supported and ships a language catalog and phrasebook.
- **Server** — Express serves the client and provides extraction and translation endpoints. Gemini is optional. The app includes deterministic extraction fallbacks and uses Google translation options where available. Selected results may be cached in server memory.
- **Persistence** — The browser stores current handoff data, settings, escalations, task state, and archived shift snapshots in local storage. Voice drafts and transcript segments use session storage. There is no application database or cross-device synchronization.

## Run locally

Use Node.js 24 and Bun. To run the seeded demo, start without an environment file.

~~~sh
git clone https://github.com/Qianjiu-Ma/CS497-CareBridge.git
cd CS497-CareBridge
bun install --frozen-lockfile
bun run dev
~~~

Open [http://localhost:3000](http://localhost:3000). Start with a typed report if the browser does not offer speech recognition or microphone access. Set the `PORT` environment variable before starting to use a different port.

To enable Gemini or configure Google Cloud Translation, copy `.env.example` to `.env`, set the relevant variables, and restart the server. Keep API keys and credential files out of Git. For Google Cloud credentials, use Application Default Credentials or point to a key file outside this checkout.

~~~sh
bun run lint   # TypeScript checks
bun run build  # Frontend production bundle
~~~

## Privacy and limitations

Use fictional data only. Browser speech recognition can use the browser vendor’s remote service. When a translation or extraction path calls an external provider, it can send the submitted text and, for some extraction paths, resident and staff labels. Translation can use a Google endpoint even without locally configured credentials. Browser storage persists on the same origin and is accessible through the browser profile.

The app simulates EMR submission and synchronization. It has no live EMR connection, user authentication, or production access controls. Staff labels and the activity log are demo records and do not provide identity verification or a tamper-evident audit trail. Speech recognition, translation, AI extraction, and rule-based alerts are subject to errors. This academic prototype is for demonstration and evaluation with fictional cases.
