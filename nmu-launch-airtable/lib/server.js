// Shared helpers for the API routes. Server-side only: the token never reaches the browser.

export function env() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  return { token, base, ok: !!(token && base) };
}

// Optional shared passcode. If APP_PASSCODE is set, a request must carry it in the
// X-App-Passcode header (the app) or the ?key= query parameter (calendar feeds).
export function passcodeOk(req) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return true;
  return req.headers['x-app-passcode'] === passcode || req.query.key === passcode;
}

// Reads every record of a table, following Airtable's paging. fields limits the columns returned.
export async function listAll(table, fields = []) {
  const { token, base } = env();
  const out = [];
  let offset = '';
  do {
    const qs = new URLSearchParams();
    fields.forEach(f => qs.append('fields[]', f));
    if (offset) qs.set('offset', offset);
    const r = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Airtable ${r.status} reading ${table}`);
    const j = await r.json();
    out.push(...j.records);
    offset = j.offset || '';
  } while (offset);
  return out;
}
