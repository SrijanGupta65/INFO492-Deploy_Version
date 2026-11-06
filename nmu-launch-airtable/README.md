# NMU Launch: Airtable version

A copy of `Project management system prototype/` connected to NMU's Airtable base. The original folder is unchanged.

The schema it reads and writes is described in the "NMU Airtable Design" doc: Session + Site (programs), Work (tasks), Steps (template tasks, one shared list tagged by program type), Template List (program types), Users + Roles, and Change Log.

## How it fits together

```
Browser (index.html)  →  /api/airtable/<table>  (Vercel function, holds the token)  →  Airtable API
```

- `index.html`: the app. On a deployed site it uses Airtable; opened as a local file, or with `?mock=1`, it runs on sample data stored in the browser.
- `nmu-data.js`: data layer. `AT` lists every Airtable table and field name the app uses. The Airtable adapter translates between the app's records and the base.
- `nmu-bundle.js`: generated from `nmu-template.js` + `nmu-data.js`. After editing either, run `npm run build`.
- `api/airtable/[table].js`: server function that adds the token and only allows the app's nine tables.

## Settings

Two environment variables, never committed:

| Name | Value |
| --- | --- |
| `AIRTABLE_TOKEN` | Airtable personal access token. Scopes `data.records:read` and `data.records:write`, access to this base only |
| `AIRTABLE_BASE_ID` | The base ID from its URL (starts with `app`) |

Locally, copy `.env.example` to `.env`. On Vercel, add both under Project → Settings → Environment Variables.

## Deploy on Vercel

1. Import the `fdawit/INFO492` repo in Vercel.
2. Set **Root Directory** to `nmu-launch-airtable`. Framework preset: Other. No build command.
3. Add the two environment variables, then deploy.
4. Turn on **Deployment Protection** (password or Vercel login). The app has no sign-in yet, so anyone with the link could otherwise read and change the base.

To run locally with live data: `npx vercel dev` from this folder (uses `.env`).

## Notes and limits

- Due dates are calculated in Airtable: Manual Due Date if set, otherwise Session Start Date − Offset Days. Moving a single task's date stores a Manual Due Date. Moving Day 1 changes the session's Start Date, and completed tasks are pinned to their old dates first.
- Instructors are a linked table in Airtable. The app shows their names but doesn't edit them; edit instructors in Airtable.
- A partner user is tied to a Site (Users → Partner Site) and sees that site's next program.
- If anyone renames a table or field in Airtable, update `AT` in `nmu-data.js` and run `npm run build`.
- Airtable allows 5 requests per second per base; the adapter spaces its calls to stay under that.
