import { describe, it, expect } from 'vitest';
import {
  roleLabel, displayTitle, experienceYears, producingRoster, groupByUnit,
} from '../unitGrouping';

describe('unitGrouping — title + experience', () => {
  it('displayTitle falls back levelTitle → careerLevel → role label', () => {
    expect(displayTitle({ role: 'unit_manager', careerLevel: 'Trainee Manager' })).toBe('Trainee Manager');
    expect(displayTitle({ role: 'unit_manager', levelTitle: 'Unit Manager', careerLevel: 'x' })).toBe('Unit Manager');
    expect(displayTitle({ role: 'agent' })).toBe('Agent');
    expect(displayTitle({ role: 'unit_manager' })).toBe('Unit Manager');
  });

  it('roleLabel maps known roles', () => {
    expect(roleLabel('branch_manager')).toBe('Branch Manager');
    expect(roleLabel('nonsense')).toBe('Agent');
  });

  it('displayTitle treats a blank levelTitle as absent (falls to careerLevel)', () => {
    expect(displayTitle({ role: 'unit_manager', levelTitle: '', careerLevel: 'Trainee Manager' })).toBe('Trainee Manager');
    expect(displayTitle({ role: 'unit_manager', levelTitle: '   ', careerLevel: '' })).toBe('Unit Manager');
  });

  it('experienceYears computes whole years by calendar anniversary; null when absent/malformed', () => {
    expect(experienceYears('2021-01-01', new Date('2026-06-01T00:00:00Z'))).toBe(5);
    // anniversary not yet reached this year → one fewer completed year
    expect(experienceYears('2021-08-01', new Date('2026-06-01T00:00:00Z'))).toBe(4);
    expect(experienceYears(null)).toBeNull();
    expect(experienceYears('garbage')).toBeNull();
    expect(experienceYears('2030-01-01', new Date('2026-01-01T00:00:00Z'))).toBe(0);
  });
});

describe('unitGrouping — roster + units (RULING 3)', () => {
  const um = { id: 'um1', role: 'unit_manager', name: 'Trainee Mgr', careerLevel: 'Trainee Manager', unitId: 'um1', contractStartDate: '2023-01-01' };
  const agentA = { id: 'ag1', role: 'agent', name: 'Ann', unitId: 'um1', contractStartDate: '2024-01-01' };
  const agentB = { id: 'ag2', role: 'agent', name: 'Bob', unitId: 'um1' };
  const bm = { id: 'bm1', role: 'branch_manager', name: 'Boss' };
  const admin = { id: 'ad1', role: 'cro', name: 'BackOffice' };

  it('producingRoster includes agents AND unit managers (not BM/admin)', () => {
    const roster = producingRoster([um, agentA, agentB, bm, admin]);
    expect(roster.map((u) => u.id).sort()).toEqual(['ag1', 'ag2', 'um1']);
  });

  it('groupByUnit places the UM as unit head, agents as advisors', () => {
    const { units, adminCount, unitCount } = groupByUnit([um, agentA, agentB, bm, admin]);
    expect(unitCount).toBe(1);
    expect(units[0].unitId).toBe('um1');
    expect(units[0].headName).toBe('Trainee Mgr');
    expect(units[0].headTitle).toBe('Trainee Manager');
    expect(units[0].advisorCount).toBe(2);
    // BM + CRO are admins (non-producing, non-head)
    expect(adminCount).toBe(2);
  });

  it('single-unit branch renders normally (no <2-unit empty path)', () => {
    const { units, unitCount } = groupByUnit([um, agentA]);
    expect(unitCount).toBe(1);
    expect(units[0].advisorCount).toBe(1);
  });

  it('two units sort by advisor count desc', () => {
    const um2 = { id: 'um2', role: 'unit_manager', name: 'Mgr2', unitId: 'um2' };
    const ag3 = { id: 'ag3', role: 'agent', unitId: 'um2' };
    const ag4 = { id: 'ag4', role: 'agent', unitId: 'um2' };
    const { units } = groupByUnit([um, agentA, um2, ag3, ag4]);
    expect(units[0].unitId).toBe('um2'); // 2 advisors
    expect(units[1].unitId).toBe('um1'); // 1 advisor
  });
});
