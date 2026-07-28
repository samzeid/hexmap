// Pulls trimOldBackups() straight out of the live inventory/script.js —
// same "extract real code, don't hand-copy" reasoning as
// extract-merge-functions.mjs. This is the function that decides which
// backup snapshots get deleted (the other half of "starring protects a
// backup from deletion" — see the Backups tab UI in script.js for the half
// that lets a DM mark one starred).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, '..', '..', 'inventory', 'script.js');

const RETENTION_MARKER = 'const BACKUP_RETENTION_COUNT = ';
const FN_MARKER = 'function trimOldBackups(charId) {';

export function extractTrimOldBackups() {
  const src = readFileSync(scriptPath, 'utf8');

  const retIdx = src.indexOf(RETENTION_MARKER);
  if (retIdx === -1) {
    throw new Error('extractTrimOldBackups: could not find BACKUP_RETENTION_COUNT — update RETENTION_MARKER.');
  }
  const retMatch = src.slice(retIdx).match(/^const BACKUP_RETENTION_COUNT = (\d+);/);
  if (!retMatch) {
    throw new Error('extractTrimOldBackups: BACKUP_RETENTION_COUNT is no longer a plain integer literal — update the extractor.');
  }

  const fnIdx = src.indexOf(FN_MARKER);
  if (fnIdx === -1) {
    throw new Error('extractTrimOldBackups: could not find trimOldBackups() — it was likely renamed or restructured, update FN_MARKER.');
  }
  const braceStart = fnIdx + FN_MARKER.length - 1;
  let depth = 0, fnEnd = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { fnEnd = i; break; } }
  }
  if (fnEnd === -1) throw new Error('extractTrimOldBackups: no matching closing brace for trimOldBackups().');
  const fnBody = src.slice(braceStart + 1, fnEnd);

  const factory = new Function('database', `
    'use strict';
    const BACKUP_RETENTION_COUNT = ${retMatch[1]};
    function trimOldBackups(charId) { ${fnBody} }
    return trimOldBackups;
  `);
  return factory;
}
