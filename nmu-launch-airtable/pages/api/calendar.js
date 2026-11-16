// GET /api/calendar?key=<passcode>&program=<recId>&owner=<recId>
// An iCalendar (.ics) feed of open tasks and Day 1 dates, for subscribing in Google Calendar
// ("Other calendars → From URL"). Done tasks and archived programs are left out.
// Google refreshes subscribed feeds on its own schedule, usually every few hours.
import { env, passcodeOk, listAll } from '../../lib/server.js';

const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
const ymd = s => String(s || '').slice(0, 10).replace(/-/g, '');
const nextDay = s => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
// Lines longer than 75 octets must be folded (RFC 5545).
const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
const first = v => (Array.isArray(v) ? v[0] : v) || '';
const isRec = v => /^rec[A-Za-z0-9]{14}$/.test(String(v || ''));

export default async function handler(req, res) {
  if (!env().ok) return res.status(500).send('Server is missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID');
  if (!passcodeOk(req)) return res.status(401).send('Passcode required: add ?key=<team passcode> to the URL');
  const program = isRec(req.query.program) ? req.query.program : '';
  const owner = isRec(req.query.owner) ? req.query.owner : '';

  try {
    const [work, steps, sessions, sites] = [
      await listAll('Work', ['Steps', 'Session', 'Task Name', 'Due Date', 'Task Status', 'Owner', 'Category', 'Priority']),
      await listAll('Steps', ['Short Description']),
      await listAll('Session', ['Site', 'Start Date', 'Archived']),
      await listAll('Site', ['Program Name', 'Program Location']),
    ];
    const stepName = Object.fromEntries(steps.map(r => [r.id, r.fields['Short Description'] || '']));
    const siteById = Object.fromEntries(sites.map(r => [r.id, r.fields]));
    const sess = Object.fromEntries(sessions.map(r => [r.id, { ...r.fields, site: siteById[first(r.fields.Site)] || {} }]));
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//No More Under//Launch planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:NMU launch tasks', 'X-PUBLISHED-TTL:PT3H'];
    const event = (uid, date, summary, description) => {
      lines.push('BEGIN:VEVENT', `UID:${uid}@nmu-launch`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${ymd(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`,
        fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(description)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
    };

    for (const [id, s] of Object.entries(sess)) {
      if (s.Archived || !s['Start Date'] || (program && id !== program) || owner) continue;
      event(`day1-${id}`, s['Start Date'], `Day 1: ${s.site['Program Name'] || 'Program'}`, s.site['Program Location'] || '');
    }
    for (const r of work) {
      const f = r.fields, sid = first(f.Session), s = sess[sid];
      if (!s || s.Archived || !f['Due Date'] || f['Task Status'] === 'Done') continue;
      if (program && sid !== program) continue;
      if (owner && first(f.Owner) !== owner) continue;
      const name = f['Task Name'] || stepName[first(f.Steps)] || 'Task';
      const prog = s.site['Program Name'] || 'Program';
      event(r.id, f['Due Date'], `${f.Priority ? '⚑ ' : ''}${name} · ${prog}`, [`Status: ${f['Task Status'] || 'Not started'}`, f.Category ? `Type: ${f.Category}` : ''].filter(Boolean).join('\n'));
    }
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="nmu-launch.ics"');
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.status(200).send(lines.join('\r\n') + '\r\n');
  } catch (e) {
    res.status(502).send(`Could not build the calendar: ${e.message}`);
  }
}
