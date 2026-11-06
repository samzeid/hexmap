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

// If a browser gets wedged mid-test (a detached-frame crash, or a CDP
// command that never resolves) the test's own try/finally can itself hang
// forever trying to gracefully close an unresponsive browser — the process
// never exits, and without this timeout the whole suite would sit there
// indefinitely with no indication anything was wrong. `detached: true` +
// killing the negated PID kills the whole process group, including any
// Chrome processes the test spawned, not just the Node script itself.
const TEST_TIMEOUT_MS = 3 * 60 * 1000; // comfortably above the slowest legitimate test (~110s)

function runNodeScript(scriptPath, label, timeoutMs = TEST_TIMEOUT_MS) {
  return new Promise(resolve => {
    const start = Date.now();
    const child = spawn(process.execPath, [scriptPath], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let output = '';
    let timedOut = false;
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      output += `\n[run-all] TIMED OUT after ${timeoutMs}ms — force-killing process group (pid ${child.pid})\n`;
      try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { /* already gone */ }
    }, timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ label, code: timedOut ? 1 : code, output, ms: Date.now() - start });
    });
  });
}

async function main() {
  const results = [];

  if (!integrationOnly) {
    console.log('=== unit tests ===');
    const unitDir = join(__dirname, 'unit');
    const unitFiles = readdirSync(unitDir).filter(f => f.endsWith('.test.mjs')).sort();
    for (const file of unitFiles) {
      const r = await runNodeScript(join(unitDir, file), `unit/${file}`);
      process.stdout.write(r.output);
      results.push(r);
    }
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
