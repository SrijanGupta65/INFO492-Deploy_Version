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

## Notes and limits

- Due dates are calculated in Airtable: Manual Due Date if set, otherwise Session Start Date − Offset Days. Moving a single task's date stores a Manual Due Date. Moving Day 1 changes the session's Start Date, and completed tasks are pinned to their old dates first.
- Instructors are a linked table in Airtable. The app shows their names but doesn't edit them; edit instructors in Airtable.
- A partner user is tied to a Site (Users → Partner Site) and sees that site's next program.
- If anyone renames a table or field in Airtable, update `AT` in `nmu-data.js` and run `npm run bundle`.
- Airtable allows 5 requests per second per base; the adapter spaces its calls to stay under that.
