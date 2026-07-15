import { describe, it, expect } from 'vitest';
import { buildSubmissionNameMap } from '../utils';

// SEC-012: agent names must survive an empty roster (kiosk cannot `list` users)
// by falling back to the submission-carried `agentName`.
describe('buildSubmissionNameMap (SEC-012)', () => {
  it('maps agentId → agentName from submissions', () => {
    const map = buildSubmissionNameMap([
      { agentId: 'a1', agentName: 'Alice' },
      { agentId: 'a2', agentName: 'Bob' },
    ]);
    expect(map.get('a1')).toBe('Alice');
    expect(map.get('a2')).toBe('Bob');
  });

  it('falls back to userId when agentId is absent', () => {
    const map = buildSubmissionNameMap([{ userId: 'u9', agentName: 'Carol' }]);
    expect(map.get('u9')).toBe('Carol');
  });

  it('keeps the first non-empty name per agent (later dupes ignored)', () => {
    const map = buildSubmissionNameMap([
      { agentId: 'a1', agentName: 'Alice' },
      { agentId: 'a1', agentName: 'Alice Renamed' },
    ]);
    expect(map.get('a1')).toBe('Alice');
  });

  it('skips submissions with empty/whitespace/non-string agentName', () => {
    const map = buildSubmissionNameMap([
      { agentId: 'a1', agentName: '   ' },
      { agentId: 'a2', agentName: '' },
      { agentId: 'a3', agentName: 42 },
      { agentId: 'a4' },
    ]);
    expect(map.has('a1')).toBe(false);
    expect(map.has('a2')).toBe(false);
    expect(map.has('a3')).toBe(false);
    expect(map.has('a4')).toBe(false);
  });

  it('trims surrounding whitespace', () => {
    const map = buildSubmissionNameMap([{ agentId: 'a1', agentName: '  Dave  ' }]);
    expect(map.get('a1')).toBe('Dave');
  });

  it('skips submissions with neither agentId nor userId', () => {
    const map = buildSubmissionNameMap([{ agentName: 'Nobody' }]);
    expect(map.size).toBe(0);
  });

  it('returns an empty map for null/undefined/empty input', () => {
    expect(buildSubmissionNameMap(undefined).size).toBe(0);
    expect(buildSubmissionNameMap(null).size).toBe(0);
    expect(buildSubmissionNameMap([]).size).toBe(0);
  });
});
