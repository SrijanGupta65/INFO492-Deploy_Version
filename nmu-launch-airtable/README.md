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

## Forward design (Team 6 proposal, Nov 18 2026)

Applied from "NMU Launch Planner · Forward Proposal". Working surfaces (task rows, status menus, chips, tables) keep today's look; expression is added at page openings, big numbers, the Day 1 rulers and the partner portal.

| Area | What changed |
| --- | --- |
| Roles (section 9) | Job titles map to access levels: Admin = Executive Director; Program Manager; Other Staff = Program Assistant, Grant Writer, Marketing Director, Operations Director; Partner POC = Partner. **Board Member removed.** Pages and buttons a level can't use are hidden. Other Staff change status on their own tasks only (others show a read-only label). Program types and Users & data are Admin-only. Users & data shows NMU's permission table and an Access level column |
| Navigation | 72px icon rail with the round logo; opens over the page on hover, keyboard focus or the expand button; "Keep menu open" brings back the sidebar (remembered in this browser). Tablet: labeled 76px rail. Phone: top bar + bottom tabs |
| My tasks | Compact header by default ("Show overview" opens the greeting, mission line and hero with counts and rulers). Program tabs (All programs, pinned programs, More programs), a When filter, one Open \| Include completed control, a sentence saying what's shown, Clear filters. Overdue never hides and lists blocked, then holding-up, then flagged, then oldest. Today gets its own group. Finished tasks collect in a collapsed Completed group with their done date |
| All programs | Runway \| List \| Table views. Pinned for everyone group first, then grouped by state (Group by: State, Program type, Day 1 month, None). State is one searchable dropdown with counts. Long groups show "Show N more". Pinning is "Pin for everyone" (Admins and Program Managers) with an Undo confirmation |
| Program detail | Compact card by default (Day 1 + micro ruler, work done bar, partnership pair); "Show overview" opens the serif title, countdown and full Day 1 ruler with tide marks. "Needs attention" and "Coming up", then the rest by phase. When changes only dates; Open \| Include completed changes only finished tasks. Site details: fields-added meter, "+ Add" for editors, "Not added yet" for others |
| Calendar | Same Open \| Include completed control; with one program chosen: D−n labels, Day 1 cell tint, final-countdown tint and a countdown badge |
| Change history | Plain-language feed under day headings, filter by kind (Dates, Statuses, Pins and settings); bursts of the same change within 5 minutes group into one expandable line. The program History tab uses the same feed |
| New program / Program types / Partner portal | Live preview of what will be created; checklist ruler (no today line); warmer portal opening, "Your site" card and reminder copy |

Not built (implementation dependencies D1–D3 in the proposal): partner sign-in, partner upload review states, and server-side enforcement of the role table. Hiding controls is not security.

## Notes and limits

- Due dates are calculated in Airtable: Manual Due Date if set, otherwise Session Start Date − Offset Days. Moving a single task's date stores a Manual Due Date. Moving Day 1 changes the session's Start Date, and completed tasks are pinned to their old dates first.
- Instructors are a linked table in Airtable. The app shows their names but doesn't edit them; edit instructors in Airtable.
- A partner user is tied to a Site (Users → Partner Site) and sees that site's next program.
- If anyone renames a table or field in Airtable, update `AT` in `nmu-data.js` and run `npm run bundle`.
- Airtable allows 5 requests per second per base; the adapter spaces its calls to stay under that.
