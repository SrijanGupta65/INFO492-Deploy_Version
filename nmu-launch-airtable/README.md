# NMU Launch: Airtable version

A copy of `Project management system prototype/` connected to NMU's Airtable base. The original folder is unchanged.

The schema it reads and writes is described in the "NMU Airtable Design" doc: Session + Site (programs), Work (tasks), Steps (template tasks, one shared list tagged by program type), Template List (program types), Users + Roles, and Change Log.

## How it fits together

```
Browser (public/index.html)  →  /api/airtable/<table>  (server route, holds the token)  →  Airtable API
```

- `public/index.html`: the app. On a deployed site it uses Airtable; opened as a local file, or with `?mock=1`, it runs on sample data stored in the browser.
- `nmu-data.js`: data layer. `AT` lists every Airtable table and field name the app uses. The Airtable adapter translates between the app's records and the base.
- `public/nmu-bundle.js`: generated from `nmu-template.js` + `nmu-data.js`. After editing either, run `npm run bundle`.
- `pages/api/airtable/[table].js`: server route that adds the token, checks the optional passcode, and only allows the app's nine tables.
- `pages/api/upload.js`: uploads a file (up to 3 MB) to a task's Attachments field in Airtable.
- `pages/api/calendar.js`: an .ics feed of open tasks and Day 1 dates for subscribing in Google Calendar.
- `lib/server.js`: shared server helpers (env vars, passcode check, paging through a table).
- Next.js is only there so the host can run that server route. There are no React pages; `/` serves `public/index.html`.

## Settings

Environment variables, never committed:

| Name | Value |
| --- | --- |
| `AIRTABLE_TOKEN` | Airtable personal access token. Scopes `data.records:read` and `data.records:write`, access to this base only |
| `AIRTABLE_BASE_ID` | The base ID from its URL (starts with `app`) |
| `APP_PASSCODE` | Optional. If set, each visitor is asked for this code once per browser. Without it, anyone with the link can read and change the base |

Locally, copy `.env.example` to `.env.local`, then `npm install` and `npm run dev`.

## Deploy on AWS Amplify

1. In the AWS console, open **AWS Amplify** → **Create new app** → **GitHub**, and pick `SrijanGupta65/info492-deploy_version`, branch `main`.
2. Tick **My app is a monorepo** and enter `nmu-launch-airtable` as the root directory. Amplify picks up `amplify.yml` from the repo root and detects Next.js (SSR).
3. Under **Advanced settings → Environment variables**, add `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` and, if wanted, `APP_PASSCODE`.
4. Save and deploy. Pushes to `main` redeploy automatically.

`amplify.yml` copies those variables into `.env.production` during the build, because Amplify does not pass them to the running server otherwise. After changing a variable, redeploy.

## Features added from NMU feedback (Catalina & Mary)

| Feedback | Where it lives |
| --- | --- |
| Prioritize programs, by state; program tabs; custom ordering | All programs: Active / Archived tabs, state tabs, ★ pin (shared, Session → Pinned), sort menu |
| Filter by type, city, state, dates and weeks, combined | All programs filter bar (search, type, city, Day 1 period incl. this/next week and a custom range) |
| Start up to 6 months in the past | New program: Day 1 can be up to 183 days ago, with an option to mark past tasks done. Checklists now have a "4–6 months prior" phase |
| Select tasks on the timeline; handle unexpected changes | Program timeline: checkboxes + bulk bar (status, owner, type, move ±days, set date, flag) |
| Reusable task titles with details | Add task: title suggestions from the checklists and earlier added tasks; picking one fills role and type; details become the first note. Any task can be renamed |
| Task priority; at-a-glance view | Flag as priority (Work → Priority). My tasks opens with Overdue / Due in 7 days / Flagged / Blocked cards and a Flagged group on top |
| Color-coding by status and activity type | Activity types (Funding, Admin, Outreach, Logistics, Instruction) color each task; overdue rows are tinted orange |
| Archive programs, keep history | Archive / Restore on the program page (Session → Archived). Archived programs are read-only and keep every task, file and log entry |
| File uploads and links on tasks (critical) | Task drawer: attach files (Work → Attachments) and links (Work → Links) |
| Calendar view / Google Calendar | Calendar screen (month view), Download .ics, and a subscribe link for Google Calendar |
| Export to Google Sheets | Export to Sheets on All programs and each program (CSV; in Sheets use File → Import) |

Airtable fields these use: Site → City, State · Session → Pinned, Archived · Steps → Category · Work → Category, Priority, Attachments, Links.
Steps and tasks without a saved Category show a type suggested from their wording; Users & data has a button to save those suggestions to Airtable.

## Notes and limits

- Due dates are calculated in Airtable: Manual Due Date if set, otherwise Session Start Date − Offset Days. Moving a single task's date stores a Manual Due Date. Moving Day 1 changes the session's Start Date, and completed tasks are pinned to their old dates first.
- Instructors are a linked table in Airtable. The app shows their names but doesn't edit them; edit instructors in Airtable.
- A partner user is tied to a Site (Users → Partner Site) and sees that site's next program.
- If anyone renames a table or field in Airtable, update `AT` in `nmu-data.js` and run `npm run bundle`.
- Airtable allows 5 requests per second per base; the adapter spaces its calls to stay under that.
