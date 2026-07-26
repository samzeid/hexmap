// Orchestrates the full test bed: builds the harness from the current
// index.html, starts the static server, runs the unit tests and then every
// integration test in tests/integration/ (each as its own process, so one
// hanging browser doesn't take the rest down with it), and prints a
// pass/fail summary. Exits non-zero if anything failed.
//
//   node run-all.mjs                  — everything
//   node run-all.mjs --unit-only
//   node run-all.mjs --integration-only
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildHarness } from './build-harness.mjs';
import { startServer } from './server.mjs';
import { PORT } from './integration/helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const unitOnly = args.includes('--unit-only');
const integrationOnly = args.includes('--integration-only');

function runNodeScript(scriptPath, label) {
  return new Promise(resolve => {
    const start = Date.now();
    const child = spawn(process.execPath, [scriptPath], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', code => {
      resolve({ label, code, output, ms: Date.now() - start });
    });
  });
}

async function main() {
  const results = [];

  if (!integrationOnly) {
    console.log('=== unit tests ===');
    const r = await runNodeScript(join(__dirname, 'unit', 'merge.test.mjs'), 'unit/merge.test.mjs');
    process.stdout.write(r.output);
    results.push(r);
  }

  if (!unitOnly) {
    console.log('\nBuilding test harness from current index.html...');
    buildHarness();

    console.log(`Starting static server on port ${PORT}...`);
    const server = await startServer(PORT);

    try {
      const integrationDir = join(__dirname, 'integration');
      const files = readdirSync(integrationDir)
        .filter(f => f.endsWith('.test.mjs'))
        .sort();

      for (const file of files) {
        console.log(`\n=== integration/${file} ===`);
        const r = await runNodeScript(join(integrationDir, file), `integration/${file}`);
        process.stdout.write(r.output);
        results.push(r);
      }
    } finally {
      server.close();
    }
  }

  console.log('\n\n=== SUMMARY ===');
  let anyFail = false;
  for (const r of results) {
    const ok = r.code === 0;
    if (!ok) anyFail = true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.label}  (${r.ms}ms)`);
  }
  console.log(anyFail ? '\nSome tests failed.' : '\nAll tests passed.');
  process.exit(anyFail ? 1 : 0);
}

main();
