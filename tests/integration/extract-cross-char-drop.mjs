// Pulls the item-placement logic straight out of handleCrossCharDrop's
// transaction callback in the live inventory/script.js (instead of a
// hand-copied duplicate that could silently drift out of sync — same
// reasoning as tests/unit/extract-merge-functions.mjs). This is the code
// that decides *where* a cross-character gift lands; test 07 exercises it
// under realistic transaction-contention timing without needing to
// automate a full cross-tab drag-and-drop gesture in the browser.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, '..', '..', 'inventory', 'script.js');

function extractBraceBody(src, markerEndingInBrace) {
  const idx = src.indexOf(markerEndingInBrace);
  if (idx === -1) {
    throw new Error(`extractBraceBody: marker not found: ${markerEndingInBrace.slice(0, 80)}...`);
  }
  const braceStart = idx + markerEndingInBrace.length - 1;
  if (src[braceStart] !== '{') {
    throw new Error(`extractBraceBody: marker does not end in "{": ${markerEndingInBrace.slice(0, 80)}...`);
  }
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(braceStart + 1, i); }
  }
  throw new Error(`extractBraceBody: no matching closing brace for marker: ${markerEndingInBrace.slice(0, 80)}...`);
}

// Unique to handleCrossCharDrop's write (saveChar's own transaction uses
// `charId`, not `targetCharId`, as its path parameter — see saveChar() in
// inventory/script.js).
const TRANSACTION_MARKER = '/inventory_characters/${targetCharId}/state`).transaction(currentRaw => {';
const SAFE_PARSE_MARKER = 'function safeParseJson(str) {';
const BLANK_STATE_MARKER = 'function blankState() {';
const DEFAULT_CONTAINERS_MARKER = 'function defaultContainers() {';

export function extractPlacementFn() {
  const src = readFileSync(scriptPath, 'utf8');
  const transactionBody = extractBraceBody(src, TRANSACTION_MARKER);
  const safeParseJsonBody = extractBraceBody(src, SAFE_PARSE_MARKER);
  const blankStateBody = extractBraceBody(src, BLANK_STATE_MARKER);
  const defaultContainersBody = extractBraceBody(src, DEFAULT_CONTAINERS_MARKER);

  // compactContainerSlots is intentionally NOT extracted — it depends on
  // window.ITEM_LIBRARY (a large external data table) to resolve real
  // items, which is irrelevant to what this test is checking (the row-
  // placement algorithm). For the plain test-fixture items used here
  // (no _ref, no library match) it's a documented no-op in the real
  // implementation, so a no-op stub here is faithful, not a simplification
  // of the logic under test.
  const factory = new Function('cleanItem', 'linkedContainer', 'currentRaw', `
    'use strict';
    function safeParseJson(str) { ${safeParseJsonBody} }
    function blankState() { ${blankStateBody} }
    function defaultContainers() { ${defaultContainersBody} }
    function compactContainerSlots() {}
    return (function() { ${transactionBody} })();
  `);
  return factory;
}
