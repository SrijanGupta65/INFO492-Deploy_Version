import { TEMPLATE_ROWS } from './nmu-template.js';

// NMU Launch — data layer. The UI only talks to an adapter with this shape:
//   listAll() -> {Users, ProgramTypes, TemplateTasks, Programs, Tasks, ChangeLog}
//   createMany(table, recs) · update(table, id, patch) · updateMany(table, [{id, patch}]) · reset()
// Mock adapter persists to localStorage. To go live, set window.NMU_AIRTABLE = { proxyUrl: '/api/airtable' }
// before load; the proxy (server-side) injects the AIRTABLE_TOKEN env var and forwards to
// https://api.airtable.com/v0/{BASE_ID}/{table}. Never put the token in the browser.

export const ROLES = ['Program Manager', 'Program Assistant', 'Executive Director', 'Marketing Director', 'Operations Director', 'Grant Writer', 'Board Member', 'Partner'];
export const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];

// App key -> Airtable field name. Edit right-hand side to match NMU's base.
export const SCHEMA = {
  Users: { table: 'Users', fields: { name: 'Name', email: 'Email', role: 'Role', programId: 'Partner Program', active: 'Active' } },
  ProgramTypes: { table: 'Program Types', fields: { code: 'Code', name: 'Name', description: 'Description' } },
  TemplateTasks: { table: 'Template Tasks', fields: { name: 'Task', offset: 'Offset Days', role: 'Default Role', types: 'Program Types', dependsOn: 'Depends On', partnerOwned: 'Partner Owned', supportRoles: 'Supporting Roles' } },
  Programs: { table: 'Programs', fields: { name: 'Program Name', typeId: 'Program Type', location: 'Location', day1: 'Day 1', status: 'Status', partnerOrg: 'Partner Org', pocName: 'POC Name', pocEmail: 'POC Email', pocPhone: 'POC Phone', shipping: 'Shipping Address', hours: 'Pool Hours', instructors: 'Lead Instructors', driveUrl: 'Drive Folder', managerId: 'Program Manager' } },
  Tasks: { table: 'Tasks', fields: { programId: 'Program', templateId: 'Template Task', name: 'Task', due: 'Due Date', status: 'Status', role: 'Role', ownerId: 'Owner', notes: 'Notes', dependsOn: 'Depends On', partnerOwned: 'Partner Owned', manualDate: 'Manual Date', supportRoles: 'Supporting Roles' } },
  ChangeLog: { table: 'Change Log', fields: { at: 'Timestamp', userId: 'User', programId: 'Program', taskId: 'Task', field: 'Field', from: 'From', to: 'To', note: 'Note' } },
};
const LINKS = new Set(['programId', 'ownerId', 'userId', 'taskId', 'typeId', 'managerId', 'templateId']);
const MULTI = new Set(['types', 'dependsOn', 'supportRoles']);
const BOOLS = new Set(['active', 'partnerOwned', 'manualDate']);

// ---------- dates ----------
const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
export const fmt = s => s ? parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
export const fmtLong = s => s ? parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
export const fmtWhen = ts => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const rid = p => `${p}_${Math.random().toString(36).slice(2, 10)}`;

export const PHASES = [
  { label: '3–4 months prior', test: o => o <= -90 },
  { label: '2–3 months prior', test: o => o > -90 && o <= -60 },
  { label: '1–2 months prior', test: o => o > -60 && o <= -30 },
  { label: 'Final month', test: o => o > -30 && o <= -8 },
  { label: 'Final week', test: o => o > -8 && o < 0 },
  { label: 'Program week (days 1–5)', test: o => o >= 0 && o <= 4 },
  { label: 'Post-program', test: o => o > 4 },
];
export const phaseOf = o => (PHASES.find(p => p.test(o)) || PHASES[0]).label;
export const timingLabel = o => {
  if (o >= 0 && o <= 4) return `Program day ${o + 1}`;
  const a = o < 0 ? -o : o - 4, side = o < 0 ? 'prior' : 'post';
  if (a >= 60 && a % 30 === 0) return `${a / 30} months ${side}`;
  if (a % 7 === 0) return a === 7 ? `1 week ${side}` : `${a / 7} weeks ${side}`;
  return `${a} day${a > 1 ? 's' : ''} ${side}`;
};

// ---------- timeline generation (PRD §10) ----------
export function generateTasks({ program, templates, users }) {
  const tpl = templates.filter(t => t.types.includes(program.typeId)).sort((a, b) => a.offset - b.offset);
  const idFor = Object.fromEntries(tpl.map(t => [t.id, rid('tsk')]));
  const active = users.filter(u => u.active);
  return tpl.map(t => {
    const holders = t.role === 'Partner'
      ? active.filter(u => u.role === 'Partner' && u.programId === program.id)
      : active.filter(u => u.role === t.role);
    return {
      id: idFor[t.id], programId: program.id, templateId: t.id, name: t.name,
      due: addDays(program.day1, t.offset), status: 'Not started', role: t.role,
      ownerId: holders.length === 1 ? holders[0].id : '', notes: '',
      dependsOn: (t.dependsOn || []).map(d => idFor[d]).filter(Boolean),
      partnerOwned: !!t.partnerOwned, manualDate: false, supportRoles: t.supportRoles || [],
    };
  });
}

// ---------- seed ----------
const A = ['typ_LTS', 'typ_SSS', 'typ_YMCA', 'typ_CITY'];

// Timeline label from the NMU sheet -> days from Day 1. Program days 1–5 = offsets 0–4;
// "post" counts from the last program day (offset 4). [ASSUMPTION: 5-day program, 30-day months]
export function parseTiming(label) {
  const l = label.toLowerCase(), n = parseInt(l.match(/\d+/)?.[0] || '0', 10);
  if (l.startsWith('program day')) return n - 1;
  const unit = /month/.test(l) ? 30 : /week/.test(l) ? 7 : 1;
  return /prior/.test(l) ? -n * unit : 4 + n * unit;
}

// Program-type rules applied to the shared sheet (PRD §10.2). Edit in the Program types screen.
const ONLY = {
  'Invite student athletes to sign up as volunteers': ['typ_SSS'],
  'Ask the host contact to share the campaign with alumni': ['typ_SSS'],
  'Test the registration system before it opens': ['typ_LTS', 'typ_SSS'],
  'Invite waitlisted families to register': ['typ_LTS', 'typ_SSS'],
  'Invite community contacts to register': ['typ_LTS', 'typ_SSS'],
};
// Added for type-specific and partner-owned work — not in NMU's sheet.
const EXTRA = [
  ['4 months prior', 'Partner: send site details (contact, shipping address, pool hours)', 'Partner', [], A, true],
  ['3 months prior', 'Compliance & legal review with city', 'Executive Director', [], ['typ_CITY'], false],
  ['5 weeks prior', 'Partner: publish listing in city registration system', 'Partner', [], ['typ_CITY'], true],
  ['5 weeks prior', 'Partner: open YMCA member registration', 'Partner', [], ['typ_YMCA'], true],
  ['3 weeks prior', 'Partner: confirm supplies received on site', 'Partner', [], A, true],
];
const DEPS = [
  ['Review and revise agreements as needed', 'Decide which agreement type will govern the partnership'],
  ['File the signed partnership agreement in the shared folder', 'Review and revise agreements as needed'],
  ['Notify selected lead instructors', 'Select lead instructors'],
  ['Collect uniform sizes from lead instructors', 'Notify selected lead instructors'],
  ['Record uniform sizes in the planning sheet', 'Collect uniform sizes from lead instructors'],
  ['Ship or deliver supplies to the host site', 'Check current inventory of program supplies'],
  ['Partner: confirm supplies received on site', 'Ship or deliver supplies to the host site'],
  ['Send calendar invitations for the virtual training', 'Confirm the virtual training date and time'],
  ['Run the virtual volunteer training', 'Send calendar invitations for the virtual training'],
  ['Send families the detailed preparation email', 'Finalize the detailed preparation email to families'],
  ['Send final registration lists to the host', 'Test the registration system before it opens'],
  ['Email certificates to instructors', 'Create certificates for instructors'],
  ['Send the report to sponsors', 'Draft the post-program report'],
  ['Publish the report online', 'Draft the post-program report'],
  ['Contact the winner to confirm contact details', 'Draw a winner for the survey incentive and document the process'],
  ['Send the incentive to the winner', 'Contact the winner to confirm contact details'],
];
const TPL = (() => {
  const all = [...TEMPLATE_ROWS.map(r => [...r, null, false]), ...EXTRA];
  const list = all.map(([timing, name, role, support, types, partnerOwned], i) => ({
    id: 'tpl_' + String(i + 1).padStart(3, '0'), name, offset: parseTiming(timing), role, supportRoles: support,
    types: types || ONLY[name] || A, dependsOn: [], partnerOwned,
  }));
  const byName = Object.fromEntries(list.map(t => [t.name, t]));
  DEPS.forEach(([a, b]) => { if (byName[a] && byName[b]) byName[a].dependsOn.push(byName[b].id); });
  return list;
})();

function seed() {
  const t0 = today();
  const Users = [
    ['usr_jordan', 'Jordan Ellis', 'jordan@nmu.org', 'Program Manager'],
    ['usr_sam', 'Sam Okafor', 'sam@nmu.org', 'Program Assistant'],
    ['usr_taylor', 'Taylor Brooks', 'taylor@nmu.org', 'Executive Director'],
    ['usr_riley', 'Riley Chen', 'riley@nmu.org', 'Marketing Director'],
    ['usr_morgan', 'Morgan Patel', 'morgan@nmu.org', 'Operations Director'],
    ['usr_casey', 'Casey Nguyen', 'casey@nmu.org', 'Grant Writer'],
    ['usr_avery', 'Avery Stone', 'avery@nmu.org', 'Board Member'],
    ['usr_chris', 'Chris Dunn', 'cdunn@uw.edu', 'Partner', 'prg_uw'],
    ['usr_sarah', 'Sarah Lin', 'slin@ymcatacoma.org', 'Partner', 'prg_ymca'],
  ].map(([id, name, email, role, programId]) => ({ id, name, email, role, programId: programId || '', active: true }));
  const ProgramTypes = [
    ['typ_LTS', 'LTS', 'Learn to Swim', 'Youth lessons at a partner pool. NMU runs registration and waivers.'],
    ['typ_SSS', 'SSS', 'Collegiate Swim Safely Series', 'Campus series for adult students. Student outreach, no parent consent.'],
    ['typ_YMCA', 'YMCA', 'YMCA partnership', 'The Y registers members through its own system; NMU staffs instruction.'],
    ['typ_CITY', 'CITY', 'City program', 'City parks department lists and registers. Extra compliance review.'],
  ].map(([id, code, name, description]) => ({ id, code, name, description }));
  const Programs = [
    { id: 'prg_uw', name: 'UW Swim Safely Series', typeId: 'typ_SSS', location: 'UW IMA Pool, Seattle WA', day1: addDays(t0, 24), partnerOrg: 'UW Recreation', pocName: 'Chris Dunn (Head Coach)', pocEmail: 'cdunn@uw.edu', pocPhone: '206-555-0142', shipping: '3924 Montlake Blvd NE, Seattle WA 98195', hours: 'Tue/Thu 6–8 PM', instructors: 'Jordan P., Alex R.', driveUrl: 'https://drive.google.com/drive/folders/uw-sss', managerId: 'usr_jordan', status: 'Active' },
    { id: 'prg_ymca', name: 'YMCA Tacoma Learn to Swim', typeId: 'typ_YMCA', location: 'Center for Healthy Living, Tacoma WA', day1: addDays(t0, 68), partnerOrg: 'YMCA of Pierce County', pocName: 'Sarah Lin (Aquatics Director)', pocEmail: 'slin@ymcatacoma.org', pocPhone: '253-555-0188', shipping: '1144 Market St, Tacoma WA 98402', hours: 'Sat 9 AM–12 PM', instructors: 'Sam T.', driveUrl: '', managerId: 'usr_jordan', status: 'Active' },
    { id: 'prg_rb', name: 'Rainier Beach Community Swim', typeId: 'typ_CITY', location: 'Rainier Beach Pool, Seattle WA', day1: addDays(t0, 118), partnerOrg: 'Seattle Parks & Recreation', pocName: '', pocEmail: '', pocPhone: '', shipping: '', hours: '', instructors: '', driveUrl: '', managerId: 'usr_jordan', status: 'Active' },
    { id: 'prg_bel', name: 'Bellevue Learn to Swim Pilot', typeId: 'typ_LTS', location: 'Bellevue Aquatic Center, Bellevue WA', day1: addDays(t0, -35), partnerOrg: 'City of Bellevue Aquatics', pocName: 'Ken Ward', pocEmail: 'kward@bellevue.gov', pocPhone: '425-555-0110', shipping: '601 143rd Ave NE, Bellevue WA 98007', hours: 'Mon/Wed 4–6 PM', instructors: 'Jordan P.', driveUrl: 'https://drive.google.com/drive/folders/bel-lts', managerId: 'usr_jordan', status: 'Active' },
  ];
  let Tasks = [];
  for (const p of Programs) Tasks.push(...generateTasks({ program: p, templates: TPL, users: Users }));
  Tasks = Tasks.map((t, i) => {
    const d = diffDays(t.due, t0);
    const status = d < -2 ? 'Done' : d <= 7 ? (i % 2 ? 'In progress' : 'Not started') : 'Not started';
    return { ...t, status };
  });
  const set = (prog, name, patch) => { const t = Tasks.find(x => x.programId === prog && x.name === name); if (t) Object.assign(t, patch); };
  set('prg_uw', 'Send the volunteer roster to the host for screening', { status: 'Blocked', notes: `[${fmt(addDays(t0, -3))} · Jordan Ellis] Host compliance is backlogged on volunteer screening. Followed up by email.` });
  set('prg_uw', 'Ship or deliver supplies to the host site', { status: 'In progress', notes: `[${fmt(addDays(t0, -2))} · Morgan Patel] Kickboards backordered; vendor says ships this week.` });
  set('prg_uw', 'Select lead instructors', { status: 'In progress' });
  set('prg_ymca', 'Approach financial institutions and companies about matching gifts', { status: 'Not started' });
  set('prg_ymca', 'Launch a joint fundraising campaign with the host', { status: 'In progress' });
  set('prg_rb', 'Reach out to partner contacts at the host site', { status: 'In progress' });
  const ChangeLog = [
    [-3, 'usr_jordan', 'prg_uw', 'Send the volunteer roster to the host for screening', 'Status', 'In progress', 'Blocked', 'Host screening backlog'],
    [-4, 'usr_jordan', 'prg_ymca', '', 'Day 1', fmt(addDays(t0, 61)), fmt(addDays(t0, 68)), 'Pool maintenance closure moved launch a week; 24 open tasks shifted'],
    [-2, 'usr_morgan', 'prg_uw', 'Ship or deliver supplies to the host site', 'Status', 'Not started', 'In progress', ''],
    [-1, 'usr_jordan', 'prg_rb', '', 'Program', '', 'Created', `Created from City program profile with ${Tasks.filter(x => x.programId === 'prg_rb').length} tasks`],
  ].map(([d, userId, programId, tpl, field, from, to, note], i) => {
    const t = tpl && Tasks.find(x => x.programId === programId && x.name === tpl);
    const at = parse(addDays(t0, d)); at.setHours(10 + i, 15);
    return { id: rid('log'), at: at.toISOString(), userId, programId, taskId: t ? t.id : '', field, from, to, note };
  });
  return { Users, ProgramTypes, TemplateTasks: TPL, Programs, Tasks, ChangeLog };
}

// ---------- adapters ----------
const KEY = 'nmu-launch-proto-db-v2';
const clone = o => JSON.parse(JSON.stringify(o));

export function createMockAdapter() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!db) db = seed();
  const persist = () => localStorage.setItem(KEY, JSON.stringify(db));
  persist();
  return {
    mode: 'mock',
    async listAll() { return clone(db); },
    async createMany(table, recs) { db[table].push(...clone(recs)); persist(); return recs; },
    async update(table, id, patch) { db[table] = db[table].map(r => r.id === id ? { ...r, ...patch } : r); persist(); },
    async updateMany(table, list) { const m = Object.fromEntries(list.map(x => [x.id, x.patch])); db[table] = db[table].map(r => m[r.id] ? { ...r, ...m[r.id] } : r); persist(); },
    async reset() { db = seed(); persist(); return clone(db); },
  };
}

const toFields = (key, rec) => {
  const out = {};
  for (const [k, f] of Object.entries(SCHEMA[key].fields)) {
    if (rec[k] === undefined) continue;
    let v = rec[k];
    if (LINKS.has(k)) v = v ? [v] : [];
    out[f] = v;
  }
  return out;
};
const fromRecord = (key, r) => {
  const rec = { id: r.id };
  for (const [k, f] of Object.entries(SCHEMA[key].fields)) {
    let v = r.fields[f];
    if (LINKS.has(k)) v = (v && v[0]) || '';
    else if (MULTI.has(k)) v = v || [];
    else if (BOOLS.has(k)) v = !!v;
    rec[k] = v ?? '';
  }
  return rec;
};

export function createAirtableAdapter({ proxyUrl }) {
  const url = key => `${proxyUrl}/${encodeURIComponent(SCHEMA[key].table)}`;
  const call = async (u, opts = {}) => {
    const res = await fetch(u, { ...opts, headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    return res.json();
  };
  const chunks = (a, n = 10) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  return {
    mode: 'airtable',
    async listAll() {
      const db = {};
      for (const key of Object.keys(SCHEMA)) {
        db[key] = []; let offset = '';
        do {
          const j = await call(url(key) + (offset ? `?offset=${offset}` : ''));
          db[key].push(...j.records.map(r => fromRecord(key, r)));
          offset = j.offset || '';
        } while (offset);
      }
      return db;
    },
    // Two passes so links between new records (Tasks.dependsOn) resolve to real Airtable ids.
    async createMany(key, recs) {
      const idMap = {};
      for (const c of chunks(recs)) {
        const j = await call(url(key), { method: 'POST', body: JSON.stringify({ records: c.map(r => ({ fields: toFields(key, { ...r, dependsOn: undefined }) })) }) });
        j.records.forEach((r, i) => { idMap[c[i].id] = r.id; });
      }
      const withDeps = recs.filter(r => r.dependsOn && r.dependsOn.length);
      for (const c of chunks(withDeps)) {
        await call(url(key), { method: 'PATCH', body: JSON.stringify({ records: c.map(r => ({ id: idMap[r.id], fields: { [SCHEMA[key].fields.dependsOn]: r.dependsOn.map(d => idMap[d] || d) } })) }) });
      }
      return idMap;
    },
    async update(key, id, patch) { await call(url(key), { method: 'PATCH', body: JSON.stringify({ records: [{ id, fields: toFields(key, patch) }] }) }); },
    async updateMany(key, list) { for (const c of chunks(list)) await call(url(key), { method: 'PATCH', body: JSON.stringify({ records: c.map(x => ({ id: x.id, fields: toFields(key, x.patch) })) }) }); },
    async reset() { throw new Error('Reset is only available with mock data'); },
  };
}

export const createAdapter = () => (window.NMU_AIRTABLE && window.NMU_AIRTABLE.proxyUrl) ? createAirtableAdapter(window.NMU_AIRTABLE) : createMockAdapter();
