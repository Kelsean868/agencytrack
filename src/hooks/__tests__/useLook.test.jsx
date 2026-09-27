import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

let authState = { role: 'agent', loading: false, tenantId: 't1' };

vi.mock('../../context/AuthContext', () => ({ useAuth: () => authState }));

import useLook from '../useLook';

describe('useLook — gate parity (brief §5.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-look');
    authState = { role: 'agent', loading: false, tenantId: 't1' };
  });

  it('agent with no opt-in ⇒ nexus and NO data-look attribute (app renders as today)', async () => {
    const { result } = renderHook(() => useLook());
    expect(result.current).toBe('nexus');
    await waitFor(() => expect(document.documentElement.hasAttribute('data-look')).toBe(false));
  });

  it('agent + opt-in ⇒ fr and the attribute is set', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    const { result } = renderHook(() => useLook());
    expect(result.current).toBe('fr');
    await waitFor(() => expect(document.documentElement.getAttribute('data-look')).toBe('fr'));
  });

  it('a manager on a browser with an agent opt-in never gets the attribute (main.jsx pre-set is removed)', async () => {
    localStorage.setItem('agencytrack-look', 'fr');
    document.documentElement.setAttribute('data-look', 'fr'); // what main.jsx did before auth
    authState = { role: 'branch_manager', loading: false, tenantId: 't1' };
    const { result } = renderHook(() => useLook());
    expect(result.current).toBe('nexus');
    await waitFor(() => expect(document.documentElement.hasAttribute('data-look')).toBe(false));
  });

  it('does not touch the attribute while auth is still loading', async () => {
    document.documentElement.setAttribute('data-look', 'fr');
    authState = { role: null, loading: true, tenantId: null };
    renderHook(() => useLook());
    expect(document.documentElement.getAttribute('data-look')).toBe('fr');
  });
});
