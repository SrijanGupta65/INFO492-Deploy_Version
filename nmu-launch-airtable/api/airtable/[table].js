// Vercel serverless function: GET/POST/PATCH /api/airtable/<table>
// Forwards the app's requests to Airtable and adds the token on the server, so the token
// never reaches the browser. Only the tables the app uses are allowed through.
//
// Needs two environment variables (Vercel → Project → Settings → Environment Variables):
//   AIRTABLE_TOKEN    personal access token (data.records:read, data.records:write; this base only)
//   AIRTABLE_BASE_ID  the base the app reads and writes (starts with "app")

const ALLOWED_TABLES = new Set([
  'Template List', 'Steps', 'Roles', 'Users', 'Site', 'Session', 'Instructors', 'Work', 'Change Log',
]);
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH']);

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!token || !base) {
    return res.status(500).json({ error: { message: 'Server is missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID' } });
  }

  const table = String(req.query.table || '');
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(403).json({ error: { message: `Table not allowed: ${table}` } });
  }
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: { message: `Method not allowed: ${req.method}` } });
  }

  // Only pass through paging, so the browser can't send arbitrary Airtable query options.
  const qs = req.query.offset ? `?offset=${encodeURIComponent(String(req.query.offset))}` : '';
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}${qs}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: { message: `Could not reach Airtable: ${e.message}` } });
  }
}
