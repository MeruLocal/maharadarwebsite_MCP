// package.json / server.json / src/server.ts version parity. Exit 1 on drift.
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const srv = JSON.parse(readFileSync('server.json', 'utf8'));
const src = readFileSync('src/server.ts', 'utf8').match(/SERVER_VERSION = '([^']+)'/)?.[1];
const seen = { 'package.json': pkg.version, 'server.json': srv.version, 'src/server.ts': src };
console.log(seen);
if (new Set(Object.values(seen)).size !== 1) { console.error('Version drift'); process.exit(1); }
