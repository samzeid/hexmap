// Pulls the character-state merge functions straight out of the live
// inventory/script.js and evaluates them in an isolated scope, instead of
// maintaining a hand-copied duplicate here. A copy would silently drift out
// of sync the next time someone edits the real merge logic — passing tests
// that no longer mean anything. This way the unit tests always exercise
// whatever is actually shipping.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, '..', '..', 'inventory', 'script.js');

const START_MARKER = 'function canonicalJson(value) {';
const END_MARKER = 'function defaultContainers() {';

export function extractMergeFunctions() {
  const src = readFileSync(scriptPath, 'utf8');
  const startIdx = src.indexOf(START_MARKER);
  const endIdx = src.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      'extractMergeFunctions: could not locate the merge-function block in ' +
      'inventory/script.js (start or end marker not found, or out of order). ' +
      'The merge functions were likely renamed, moved, or restructured — update ' +
      'START_MARKER/END_MARKER in tests/unit/extract-merge-functions.mjs to match, ' +
      'so this suite keeps testing the real implementation instead of failing to ' +
      'find it at all.'
    );
  }
  const block = src.slice(startIdx, endIdx);
  const factory = new Function(`
    'use strict';
    ${block}
    return { canonicalJson, jsonEq, mergeById, mergeSlotGrid, mergeOneContainer, mergeContainerList, CHAR_COLLECTION_MERGERS, mergeCharTopLevel };
  `);
  const fns = factory();
  for (const name of ['canonicalJson', 'jsonEq', 'mergeById', 'mergeSlotGrid', 'mergeOneContainer', 'mergeContainerList', 'CHAR_COLLECTION_MERGERS', 'mergeCharTopLevel']) {
    if (typeof fns[name] === 'undefined') {
      throw new Error(`extractMergeFunctions: expected "${name}" in the extracted block but it wasn't defined. The merge functions were likely renamed — update this extractor.`);
    }
  }
  return fns;
}
