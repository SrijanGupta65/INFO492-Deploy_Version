import { TEMPLATE_ROWS } from './nmu-template.js';

// NMU Launch — data layer. The UI only talks to an adapter with this shape:
//   listAll() -> {Users, ProgramTypes, TemplateTasks, Programs, Tasks, ChangeLog}
//   createMany(table, recs) · update(table, id, patch) · updateMany(table, [{id, patch}]) · reset()
// Mock adapter persists to localStorage. The Airtable adapter is used when
// window.NMU_AIRTABLE = { proxyUrl: '/api/airtable' } is set before load (index.html does this on
// a deployed site). The proxy (api/airtable/[table].js) adds the AIRTABLE_TOKEN server-side and
// forwards to https://api.airtable.com/v0/{BASE_ID}/{table}. Never put the token in the browser.

export const ROLES = ['Program Manager', 'Program Assistant', 'Executive Director', 'Marketing Director', 'Operations Director', 'Grant Writer', 'Board Member', 'Partner'];
export const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];

// Table and field names in NMU's Airtable base (see "NMU Airtable Design").
// If an admin renames a table or field in Airtable, change the name here too.
export const AT = {
  types: { table: 'Template List', name: 'List Name (Unique)', code: 'Code', description: 'Description', status: 'Status' },
  steps: { table: 'Steps', name: 'Short Description', days: 'Days', types: 'Template', role: 'Roles', support: 'Supporting Roles', deps: 'Dependencies', partner: 'Partner Owned' },
  roles: { table: 'Roles', name: 'Role Name' },
  users: { table: 'Users', email: 'Email Address', first: 'First Name', last: 'Last Name', status: 'Status', roles: 'Roles', site: 'Partner Site' },
  sites: { table: 'Site', name: 'Program Name', location: 'Program Location', partnerOrg: 'Partner Org', pocName: 'POC Name', pocEmail: 'POC Email', pocPhone: 'POC Phone', shipping: 'Shipping Address' },
  sessions: { table: 'Session', label: 'Session Name', site: 'Site', start: 'Start Date', status: 'Status', hours: 'Program Hours', instructors: 'Instructors', type: 'Program Type', manager: 'Program Manager', drive: 'Drive Folder' },
  instructors: { table: 'Instructors', name: 'Instructor Name' },
  work: { table: 'Work', session: 'Session', step: 'Steps', name: 'Task Name', due: 'Due Date', manualDue: 'Manual Due Date', offset: 'Offset Days', status: 'Task Status', completed: 'Completed Date', role: 'Role', owner: 'Owner', notes: 'Notes', deps: 'Depends On', partner: 'Partner Owned' },
  log: { table: 'Change Log', at: 'Timestamp', user: 'User', session: 'Session', work: 'Work', field: 'Field', from: 'Old Value', to: 'New Value', note: 'Note' },
};
// Program fields stored on the Site record (the rest live on the Session).
const SITE_KEYS = ['name', 'location', 'partnerOrg', 'pocName', 'pocEmail', 'pocPhone', 'shipping'];

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

// ---------- Airtable adapter ----------
// Translates between the app's tables (Programs, Tasks, TemplateTasks, ProgramTypes, Users, ChangeLog)
// and NMU's base (Session + Site, Work, Steps, Template List, Users + Roles, Change Log).
//   Program      = a Session, plus the Site it runs at (name, location, contact, shipping live on the Site)
//   Task         = a Work record; its due date is calculated in Airtable from the Session start date
//   Template task = a Step; one shared list, each step tagged with the program types it applies to
// Offsets: the app counts days from Day 1 (negative = before); Airtable's "Days" counts days before
// the start date (positive = before). Airtable days = -(app offset).
export function createAirtableAdapter({ proxyUrl }) {
  const A = AT;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let lastCall = 0;
  const call = async (table, { method = 'GET', query = '', body } = {}) => {
    const wait = 220 - (Date.now() - lastCall); // Airtable allows 5 requests per second per base
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(`${proxyUrl}/${encodeURIComponent(table)}${query}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let msg = `Airtable ${res.status}`;
      try { const j = await res.json(); if (j.error) msg += ` · ${j.error.message || j.error.type || j.error}`; } catch (e) { }
      throw new Error(msg);
    }
    return res.json();
  };
  const listTable = async table => {
    const out = []; let offset = '';
    do {
      const j = await call(table, { query: offset ? `?offset=${encodeURIComponent(offset)}` : '' });
      out.push(...j.records); offset = j.offset || '';
    } while (offset);
    return out;
  };
  const chunks = (a, n = 10) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  const one = v => (Array.isArray(v) ? v[0] : v) || '';
  const many = v => (Array.isArray(v) ? v : []);

  // Records the app creates get a temporary id ("prg_…", "tsk_…") until Airtable answers.
  const ids = {};
  const real = id => ids[id] || id;
  const isRec = id => /^rec[A-Za-z0-9]{14}$/.test(id || '');
  const link = id => (isRec(real(id)) ? [real(id)] : []);
  const links = list => (list || []).map(real).filter(isRec);

  // Writes run one at a time, in order, so a record exists before anything links to it.
  let queue = Promise.resolve();
  const queued = fn => { const p = queue.catch(() => { }).then(fn); queue = p; return p; };

  let cache = { Programs: [], Tasks: [], TemplateTasks: [], roleId: {} };
  const roleLink = name => (cache.roleId[name] ? [cache.roleId[name]] : []);
  const roleLinks = names => (names || []).map(n => cache.roleId[n]).filter(Boolean);
  const programOf = id => cache.Programs.find(p => p.id === real(id));

  async function listAll() {
    const T = await listTable(A.types.table), S = await listTable(A.steps.table), R = await listTable(A.roles.table);
    const U = await listTable(A.users.table), Si = await listTable(A.sites.table), Se = await listTable(A.sessions.table);
    const I = await listTable(A.instructors.table), W = await listTable(A.work.table), L = await listTable(A.log.table);
    const roleName = Object.fromEntries(R.map(r => [r.id, r.fields[A.roles.name] || '']));
    const roleId = Object.fromEntries(R.map(r => [r.fields[A.roles.name], r.id]));
    const siteById = Object.fromEntries(Si.map(r => [r.id, r]));
    const instName = Object.fromEntries(I.map(r => [r.id, r.fields[A.instructors.name] || '']));

    const ProgramTypes = T.filter(r => r.fields[A.types.status] !== 'Inactive').map(r => {
      const f = r.fields;
      return { id: r.id, code: f[A.types.code] || f[A.types.name] || '', name: f[A.types.name] || '', description: f[A.types.description] || '' };
    });
    const TemplateTasks = S.map(r => {
      const f = r.fields;
      return {
        id: r.id, name: f[A.steps.name] || '', offset: -(Number(f[A.steps.days]) || 0), role: roleName[one(f[A.steps.role])] || '',
        supportRoles: many(f[A.steps.support]).map(id => roleName[id]).filter(Boolean), types: many(f[A.steps.types]),
        dependsOn: many(f[A.steps.deps]), partnerOwned: !!f[A.steps.partner],
      };
    });
    const tplById = Object.fromEntries(TemplateTasks.map(t => [t.id, t]));
    const Programs = Se.map(r => {
      const f = r.fields, site = siteById[one(f[A.sessions.site])], sf = site ? site.fields : {};
      return {
        id: r.id, siteId: site ? site.id : '', name: sf[A.sites.name] || f[A.sessions.label] || 'Untitled program',
        typeId: one(f[A.sessions.type]), location: sf[A.sites.location] || '', day1: f[A.sessions.start] || '', status: f[A.sessions.status] || 'Not started',
        partnerOrg: sf[A.sites.partnerOrg] || '', pocName: sf[A.sites.pocName] || '', pocEmail: sf[A.sites.pocEmail] || '', pocPhone: sf[A.sites.pocPhone] || '',
        shipping: sf[A.sites.shipping] || '', hours: f[A.sessions.hours] || '',
        instructors: many(f[A.sessions.instructors]).map(id => instName[id]).filter(Boolean).join(', '),
        driveUrl: f[A.sessions.drive] || '', managerId: one(f[A.sessions.manager]),
      };
    });
    const Tasks = W.map(r => {
      const f = r.fields, tpl = tplById[one(f[A.work.step])] || {};
      return {
        id: r.id, programId: one(f[A.work.session]), templateId: one(f[A.work.step]), name: f[A.work.name] || tpl.name || 'Untitled task',
        due: f[A.work.due] || '', status: f[A.work.status] || (f[A.work.completed] ? 'Done' : 'Not started'),
        role: roleName[one(f[A.work.role])] || tpl.role || '', ownerId: one(f[A.work.owner]), notes: f[A.work.notes] || '',
        dependsOn: many(f[A.work.deps]), partnerOwned: !!f[A.work.partner], manualDate: !!f[A.work.manualDue],
        supportRoles: tpl.supportRoles || [],
      };
    });
    // A partner sees the program at their site: the next one coming up, else the most recent.
    const t0 = today();
    const partnerProgram = siteId => {
      const at = Programs.filter(p => p.siteId && p.siteId === siteId).sort((a, b) => (a.day1 < b.day1 ? -1 : 1));
      return (at.find(p => p.day1 >= t0) || at[at.length - 1] || {}).id || '';
    };
    const Users = U.map(r => {
      const f = r.fields, name = [f[A.users.first], f[A.users.last]].filter(Boolean).join(' ');
      return {
        id: r.id, name: name || f[A.users.email] || 'Unnamed user', email: f[A.users.email] || '', role: roleName[one(f[A.users.roles])] || '',
        programId: partnerProgram(one(f[A.users.site])), active: f[A.users.status] !== 'Inactive',
      };
    });
    const ChangeLog = L.map(r => {
      const f = r.fields;
      return {
        id: r.id, at: f[A.log.at] || r.createdTime, userId: one(f[A.log.user]), programId: one(f[A.log.session]), taskId: one(f[A.log.work]),
        field: f[A.log.field] || '', from: f[A.log.from] || '', to: f[A.log.to] || '', note: f[A.log.note] || '',
      };
    });
    const db = { Users, ProgramTypes, TemplateTasks, Programs, Tasks, ChangeLog };
    cache = { ...db, roleId };
    return JSON.parse(JSON.stringify(db));
  }

  // ----- app record -> Airtable fields -----
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const taskFields = (p, current = {}) => {
    const f = {};
    if (has(p, 'name')) f[A.work.name] = p.name;
    if (has(p, 'status')) { f[A.work.status] = p.status; f[A.work.completed] = p.status === 'Done' ? today() : null; }
    if (has(p, 'ownerId')) f[A.work.owner] = link(p.ownerId);
    if (has(p, 'notes')) f[A.work.notes] = p.notes;
    if (has(p, 'role')) f[A.work.role] = roleLink(p.role);
    if (has(p, 'dependsOn')) f[A.work.deps] = links(p.dependsOn);
    if (has(p, 'partnerOwned')) f[A.work.partner] = !!p.partnerOwned;
    if (p.manualDate === false) f[A.work.manualDue] = null;
    // A moved date is stored as a manual date. Dates that just follow Day 1 are left to Airtable's formula.
    if (has(p, 'due') && (p.manualDate === true || current.manualDate)) f[A.work.manualDue] = p.due || null;
    return f;
  };
  const sessionFields = p => {
    const f = {};
    if (has(p, 'day1')) f[A.sessions.start] = p.day1;
    if (has(p, 'typeId')) f[A.sessions.type] = link(p.typeId);
    if (has(p, 'hours')) f[A.sessions.hours] = p.hours;
    if (has(p, 'driveUrl')) f[A.sessions.drive] = p.driveUrl || null;
    if (has(p, 'managerId')) f[A.sessions.manager] = link(p.managerId);
    if (has(p, 'status') && ['Not started', 'In progress', 'Complete'].includes(p.status)) f[A.sessions.status] = p.status;
    // "instructors" is a linked table in Airtable; it is read-only here (edit instructors in Airtable).
    return f;
  };
  const siteFields = p => {
    const f = {};
    for (const k of SITE_KEYS) if (has(p, k)) f[A.sites[k]] = p[k] || null;
    return f;
  };
  const stepFields = p => {
    const f = {};
    if (has(p, 'name')) f[A.steps.name] = p.name;
    if (has(p, 'offset')) f[A.steps.days] = -Number(p.offset || 0);
    if (has(p, 'role')) f[A.steps.role] = roleLink(p.role);
    if (has(p, 'supportRoles')) f[A.steps.support] = roleLinks(p.supportRoles);
    if (has(p, 'types')) f[A.steps.types] = links(p.types);
    if (has(p, 'dependsOn')) f[A.steps.deps] = links(p.dependsOn);
    if (has(p, 'partnerOwned')) f[A.steps.partner] = !!p.partnerOwned;
    return f;
  };
  const userFields = p => {
    const f = {};
    if (has(p, 'name')) { const [first, ...rest] = String(p.name).trim().split(/\s+/); f[A.users.first] = first || ''; f[A.users.last] = rest.join(' '); }
    if (has(p, 'email')) f[A.users.email] = p.email || null;
    if (has(p, 'role')) f[A.users.roles] = roleLink(p.role);
    if (has(p, 'programId')) { const prog = programOf(p.programId); f[A.users.site] = prog && prog.siteId ? [prog.siteId] : []; }
    if (has(p, 'active')) f[A.users.status] = p.active ? 'Active' : 'Inactive';
    return f;
  };
  const typeFields = p => {
    const f = {};
    if (has(p, 'name')) f[A.types.name] = p.name;
    if (has(p, 'code')) f[A.types.code] = p.code;
    if (has(p, 'description')) f[A.types.description] = p.description;
    return f;
  };
  const logFields = e => ({
    [A.log.user]: link(e.userId), [A.log.session]: link(e.programId), [A.log.work]: link(e.taskId),
    [A.log.field]: e.field || '', [A.log.from]: String(e.from ?? ''), [A.log.to]: String(e.to ?? ''), [A.log.note]: e.note || '',
  });

  // One app patch can touch several Airtable tables (a Program = Session + Site).
  const patchToWrites = (table, id, p) => {
    const rid = real(id);
    if (table === 'Tasks') {
      const cur = cache.Tasks.find(t => t.id === rid) || {};
      if (has(p, 'manualDate')) cur.manualDate = p.manualDate;
      return [[A.work.table, rid, taskFields(p, cur)]];
    }
    if (table === 'Programs') {
      const prog = programOf(id) || {};
      const out = [[A.sessions.table, rid, sessionFields(p)]];
      if (prog.siteId) out.push([A.sites.table, prog.siteId, siteFields(p)]);
      // Completed tasks keep their dates when Day 1 moves: pin them before the start date changes.
      if (has(p, 'day1') && p.day1 !== prog.day1) {
        cache.Tasks.filter(t => t.programId === rid && t.status === 'Done' && !t.manualDate && t.due)
          .forEach(t => { t.manualDate = true; out.unshift([A.work.table, t.id, { [A.work.manualDue]: t.due }]); });
      }
      return out;
    }
    if (table === 'TemplateTasks') return [[A.steps.table, rid, stepFields(p)]];
    if (table === 'Users') return [[A.users.table, rid, userFields(p)]];
    if (table === 'ProgramTypes') return [[A.types.table, rid, typeFields(p)]];
    return []; // Change Log entries are never edited
  };
  const writeAll = async writes => {
    const byTable = {};
    for (const [t, id, fields] of writes) if (isRec(id) && Object.keys(fields).length) (byTable[t] = byTable[t] || []).push({ id, fields });
    for (const [t, recs] of Object.entries(byTable)) for (const c of chunks(recs)) await call(t, { method: 'PATCH', body: { records: c } });
  };
  const create = async (table, fieldsList) => {
    const made = [];
    for (const c of chunks(fieldsList)) { const j = await call(table, { method: 'POST', body: { records: c.map(fields => ({ fields })) } }); made.push(...j.records); }
    return made;
  };

  async function createMany(table, recs) {
    if (table === 'Programs') {
      for (const r of recs) {
        const [site] = await create(A.sites.table, [siteFields(r)]);
        const [session] = await create(A.sessions.table, [{ ...sessionFields({ ...r, status: 'Not started' }), [A.sessions.site]: [site.id] }]);
        ids[r.id] = session.id;
        cache.Programs.push({ ...r, id: session.id, siteId: site.id });
      }
    } else if (table === 'Tasks') {
      const fieldsList = recs.map(r => {
        const prog = programOf(r.programId) || {}, tpl = cache.TemplateTasks.find(t => t.id === real(r.templateId));
        const offset = tpl ? tpl.offset : (prog.day1 && r.due ? diffDays(r.due, prog.day1) : 0);
        return {
          ...taskFields({ ...r, dependsOn: undefined }), [A.work.session]: link(r.programId), [A.work.step]: link(r.templateId),
          [A.work.offset]: -offset, [A.work.manualDue]: r.manualDate ? r.due || null : null,
        };
      });
      const made = await create(A.work.table, fieldsList);
      made.forEach((m, i) => { ids[recs[i].id] = m.id; });
      const withDeps = recs.filter(r => r.dependsOn && r.dependsOn.length); // second pass: links between new tasks
      for (const c of chunks(withDeps)) await call(A.work.table, { method: 'PATCH', body: { records: c.map(r => ({ id: real(r.id), fields: { [A.work.deps]: links(r.dependsOn) } })) } });
    } else if (table === 'TemplateTasks') {
      const made = await create(A.steps.table, recs.map(r => stepFields({ ...r, dependsOn: undefined })));
      made.forEach((m, i) => { ids[recs[i].id] = m.id; });
      const withDeps = recs.filter(r => r.dependsOn && r.dependsOn.length);
      for (const c of chunks(withDeps)) await call(A.steps.table, { method: 'PATCH', body: { records: c.map(r => ({ id: real(r.id), fields: { [A.steps.deps]: links(r.dependsOn) } })) } });
    } else if (table === 'Users') {
      const made = await create(A.users.table, recs.map(r => ({ ...userFields(r), [A.users.status]: 'Active' })));
      made.forEach((m, i) => { ids[recs[i].id] = m.id; });
    } else if (table === 'ProgramTypes') {
      const made = await create(A.types.table, recs.map(r => ({ ...typeFields(r), [A.types.status]: 'Active' })));
      made.forEach((m, i) => { ids[recs[i].id] = m.id; });
    } else if (table === 'ChangeLog') {
      await create(A.log.table, recs.map(logFields));
    }
    return Object.fromEntries(recs.map(r => [r.id, real(r.id)]));
  }

  return {
    mode: 'airtable',
    listAll: () => queue.catch(() => { }).then(listAll),
    createMany: (table, recs) => queued(() => createMany(table, recs)),
    update: (table, id, patch) => queued(() => writeAll(patchToWrites(table, id, patch))),
    updateMany: (table, list) => queued(() => writeAll(list.flatMap(x => patchToWrites(table, x.id, x.patch)))),
    resolveId: id => real(id),
    async reset() { throw new Error('Reset is only available with mock data'); },
  };
}

export const createAdapter = () => (window.NMU_AIRTABLE && window.NMU_AIRTABLE.proxyUrl) ? createAirtableAdapter(window.NMU_AIRTABLE) : createMockAdapter();
