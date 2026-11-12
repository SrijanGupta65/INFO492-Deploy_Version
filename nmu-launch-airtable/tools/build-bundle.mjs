// Rebuilds nmu-bundle.js from nmu-template.js + nmu-data.js.
// The page loads the bundle as a plain script, so the module syntax is stripped and every
// exported name is published on window.NMUData. Run after editing either source file:
//   npm run bundle
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = ['nmu-template.js', 'nmu-data.js'];
const names = [];

const body = sources.map(file => {
  const code = readFileSync(join(root, file), 'utf8');
  return code
    .split('\n')
    .filter(line => !/^import\s/.test(line))
    .map(line => line.replace(/^export\s+(const|function|async function|let)\s+([A-Za-z_$][\w$]*)/, (_, kind, name) => {
      names.push(name);
      return `${kind} ${name}`;
    }))
    .join('\n');
}).join('\n');

const out = `// GENERATED from nmu-template.js + nmu-data.js by tools/build-bundle.mjs. Edit those files, then run \`npm run bundle\`.
(function(){
${body}
window.NMUData = { ${names.join(', ')} };
})();
`;
writeFileSync(join(root, 'public', 'nmu-bundle.js'), out);
console.log(`nmu-bundle.js written · ${names.length} exports`);
