import { describe, it, expect } from 'vitest';
import { SCENES } from '../scenes';

describe('FR harness scene registry', () => {
  it('scene ids are unique (the harness and the walk open a scene by id; a clash silently shows the first)', () => {
    const ids = SCENES.map((s) => s.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});
