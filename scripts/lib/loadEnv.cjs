/**
 * Shared `.env.local` parser (CommonJS sibling) — FU-F-2.
 *
 * CommonJS twin of `scripts/lib/loadEnv.mjs` (shipped in FU-F-1, PR #198).
 * Maintain in parallel: if you change one parser, change both.
 *
 * Strict parser preserving the embedded-key detection from `auth-helpers.mjs`
 * (TOOLING-N safety, banked from the SEC-9 autonomous-run incident).
 *
 * USAGE
 *   const { loadEnv } = require('./lib/loadEnv.cjs');
 *   const env = loadEnv();                                            // default: cwd/.env.local
 *   const env = loadEnv(path.resolve(__dirname, '../.env.local'));    // explicit path
 *
 *   // To preserve legacy process.env-mutation contract:
 *   Object.assign(process.env, loadEnv(path.resolve(__dirname, '../.env.local')));
 *
 * SEMANTICS (identical to .mjs sibling)
 *   - Filter: ^[A-Z_][A-Z0-9_]*= (Rule 4 alignment). Lower-case keys silently dropped.
 *   - Embedded-key detection: if a line's value contains another `[A-Z_]+=` token,
 *     the value is truncated at that token (TOOLING-N defense).
 *   - Quote-stripping: `"..."` and `'...'` wrappers removed.
 *   - Comments (`#`-prefixed lines) and blank lines skipped.
 *   - Multi-line values NOT supported.
 *   - Missing file returns frozen empty object (no throw).
 *
 * RETURNS
 *   Object.freeze({...}) — frozen dict, no `process.env` mutation. Module-scoped
 *   singleton cache keyed by resolved path.
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const _cache = new Map();

function loadEnv(path) {
  const resolved = resolve(path ?? resolve(process.cwd(), '.env.local'));
  if (_cache.has(resolved)) return _cache.get(resolved);

  const env = {};
  if (!existsSync(resolved)) {
    const frozen = Object.freeze(env);
    _cache.set(resolved, frozen);
    return frozen;
  }

  const content = readFileSync(resolved, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2];

    // Embedded-key detection (TOOLING-N)
    const embeddedMatch = value.match(/\s+[A-Z_][A-Z0-9_]*=/);
    if (embeddedMatch) value = value.slice(0, embeddedMatch.index);

    // Quote stripping
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  const frozen = Object.freeze(env);
  _cache.set(resolved, frozen);
  return frozen;
}

module.exports = { loadEnv };
