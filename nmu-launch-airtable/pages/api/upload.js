// POST /api/upload  { recordId, filename, contentType, file (base64) }
// Uploads one file to a Work record's "Attachments" field using Airtable's upload endpoint,
// so files go straight into Airtable without a separate file host. Airtable allows up to 5 MB;
// the app keeps files to 3 MB so the request stays under the host's size limit.
import { env, passcodeOk } from '../../lib/server.js';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

const FIELD = 'Attachments';

export default async function handler(req, res) {
  const { token, base, ok } = env();
  if (!ok) return res.status(500).json({ error: { message: 'Server is missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID' } });
  if (!passcodeOk(req)) return res.status(401).json({ error: { message: 'Passcode required' } });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: { message: 'Method not allowed' } }); }

  const { recordId, filename, contentType, file } = req.body || {};
  if (!/^rec[A-Za-z0-9]{14}$/.test(String(recordId || ''))) return res.status(400).json({ error: { message: 'Bad record id' } });
  if (!filename || String(filename).length > 255) return res.status(400).json({ error: { message: 'Bad file name' } });
  if (!file || typeof file !== 'string') return res.status(400).json({ error: { message: 'No file' } });

  try {
    const r = await fetch(`https://content.airtable.com/v0/${base}/${recordId}/${encodeURIComponent(FIELD)}/uploadAttachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: String(contentType || 'application/octet-stream'), file, filename: String(filename) }),
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: { message: `Could not reach Airtable: ${e.message}` } });
  }
}
