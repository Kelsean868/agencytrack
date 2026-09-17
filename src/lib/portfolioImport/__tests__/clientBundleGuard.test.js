import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * RULING 1 GUARD (17 Sep 2026): "xlsx@0.18.5 stays admin-script-only and never
 * enters the client bundle; add a guard test that fails if it does."
 *
 * WHY THIS IS A TEST AND NOT A CODE REVIEW HABIT:
 * `xlsx` is currently a devDependency, which keeps it out of the app by accident
 * of where it is listed, not by any rule. One `import * as XLSX from 'xlsx'` in a
 * component and Vite bundles it into what every field agent downloads — a
 * ~400 KB unmaintained parser, on the phones of people on intermittent
 * connections. Nothing would error; the app would just get heavier and less safe.
 *
 * The parse moved to the server precisely so the browser never needs a
 * spreadsheet reader. This test is what keeps that true.
 */

/** Repo root from this file's own location — never from the working directory. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SRC = join(REPO_ROOT, 'src');

/** Everything under src/ that Vite could pull into a bundle. Tests are excluded. */
function appSourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      appSourceFiles(full, out);
    } else if (/\.(js|jsx)$/.test(entry) && !/\.test\.[jt]sx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Bare module specifiers this file imports (relative paths are not our concern). */
function bareImports(body) {
  const specs = [];
  for (const re of [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    for (const m of body.matchAll(re)) specs.push(m[1]);
  }
  return specs.filter((s) => !s.startsWith('.') && !s.startsWith('/'));
}

describe('client bundle guard (ruling 1)', () => {
  const files = appSourceFiles();

  it('finds app source to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no app source imports a spreadsheet reader', () => {
    // `exceljs` is here too: it belongs to the Cloud Function. Pulling it into the
    // browser would be the same mistake wearing a maintained package's name.
    const BANNED = ['xlsx', 'exceljs', 'node-xlsx', 'read-excel-file', 'sheetjs'];
    const offenders = [];
    for (const file of files) {
      for (const spec of bareImports(readFileSync(file, 'utf8'))) {
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (BANNED.includes(pkg)) offenders.push(`${relative(REPO_ROOT, file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('xlsx is a devDependency, never a runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies)).not.toContain('xlsx');
    expect(Object.keys(pkg.dependencies)).not.toContain('exceljs');
    expect(Object.keys(pkg.devDependencies)).toContain('xlsx');
  });

  it('no app source imports the parser — parsing is server-side', () => {
    // The import RULES are the other half of ruling 1. They live in the Cloud
    // Function so the browser never decides what a policy status means; a
    // component importing the parser would put a second, client-side answer to
    // that question into the app.
    const offenders = [];
    for (const file of files) {
      const rel = relative(REPO_ROOT, file).split(sep).join('/');
      if (rel.startsWith('src/lib/portfolioImport/')) continue; // the module itself
      const body = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*portfolioImport\/(parseOipaExport|buildImportPlan)['"]/.test(body)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
