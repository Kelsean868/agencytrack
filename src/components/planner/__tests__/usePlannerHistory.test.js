import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import usePlannerHistory from '../usePlannerHistory';

function makeEntry(label, overrides = {}) {
  return {
    label,
    undo: vi.fn().mockResolvedValue(),
    redo: vi.fn().mockResolvedValue(),
    ...overrides,
  };
}

async function callUndo(result) {
  let entry;
  await act(async () => { entry = await result.current.undo(); });
  return entry;
}

async function callRedo(result) {
  let entry;
  await act(async () => { entry = await result.current.redo(); });
  return entry;
}

describe('usePlannerHistory', () => {
  it('starts with canUndo/canRedo both false', () => {
    const { result } = renderHook(() => usePlannerHistory());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('push makes canUndo true; undo calls entry.undo and flips to canRedo', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const entry = makeEntry('Create appointment');
    act(() => { result.current.push(entry); });
    await waitFor(() => expect(result.current.canUndo).toBe(true));

    const returned = await callUndo(result);
    expect(entry.undo).toHaveBeenCalledTimes(1);
    expect(returned).toBe(entry);
    await waitFor(() => expect(result.current.canUndo).toBe(false));
    expect(result.current.canRedo).toBe(true);
  });

  it('redo calls entry.redo and moves the entry back onto the undo stack', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const entry = makeEntry('Edit appointment');
    act(() => { result.current.push(entry); });
    await callUndo(result);

    await callRedo(result);
    expect(entry.redo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    expect(result.current.canRedo).toBe(false);
  });

  it('a new push clears the redo stack', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const entryA = makeEntry('A');
    const entryB = makeEntry('B');
    act(() => { result.current.push(entryA); });
    await callUndo(result);
    await waitFor(() => expect(result.current.canRedo).toBe(true));

    act(() => { result.current.push(entryB); });
    expect(result.current.canRedo).toBe(false);
    expect(result.current.canUndo).toBe(true);
  });

  it('caps the undo stack at 20 entries, dropping the oldest', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const entries = Array.from({ length: 22 }, (_, i) => makeEntry(`entry-${i}`));
    act(() => { entries.forEach((e) => result.current.push(e)); });
    await waitFor(() => expect(result.current.canUndo).toBe(true));

    // Undo all 20 remaining entries — the two oldest (entry-0, entry-1) were
    // dropped by the cap, so the 20th (last) undo call should be entry-2's.
    const undoneLabels = [];
    for (let i = 0; i < 20; i += 1) {
      const entry = await callUndo(result);
      undoneLabels.push(entry.label);
    }
    expect(undoneLabels[undoneLabels.length - 1]).toBe('entry-2');
    // Stack is now exhausted — a further undo is a no-op (returns null).
    const extra = await callUndo(result);
    expect(extra).toBeNull();
  });

  it('tracks current ids via the entry closure so redo-then-undo targets the fresh id', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const idRef = { current: 'id-1' };
    const entry = {
      label: 'Create appointment',
      undo: vi.fn(async () => { /* would delete idRef.current */ }),
      redo: vi.fn(async () => { idRef.current = 'id-2'; }),
    };
    act(() => { result.current.push(entry); });
    await callUndo(result);
    await callRedo(result);
    expect(idRef.current).toBe('id-2');
    await callUndo(result);
    // The same entry object is reused across undo/redo cycles, so its undo()
    // closure reads the mutated idRef — this is what lets the caller target
    // the fresh id minted by redo.
    expect(entry.undo).toHaveBeenCalledTimes(2);
  });

  it('restores the entry to the undo stack when undo() rejects', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    const entry = makeEntry('Flaky', { undo: vi.fn().mockRejectedValue(new Error('offline')) });
    act(() => { result.current.push(entry); });

    let caught = null;
    await act(async () => {
      try { await result.current.undo(); } catch (err) { caught = err; }
    });
    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toBe('offline');
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    expect(result.current.canRedo).toBe(false);
  });

  it('undo() no-ops while a previous undo is still in flight (in-flight guard)', async () => {
    const { result } = renderHook(() => usePlannerHistory());
    let resolveTop;
    const bottomEntry = makeEntry('Bottom');
    const topEntry = makeEntry('Top', {
      undo: vi.fn(() => new Promise((resolve) => { resolveTop = resolve; })),
    });
    act(() => {
      result.current.push(bottomEntry);
      result.current.push(topEntry);
    });
    await waitFor(() => expect(result.current.canUndo).toBe(true));

    let firstCallPromise;
    let secondCallResult;
    act(() => {
      firstCallPromise = result.current.undo(); // pops topEntry, hangs on its undo()
      secondCallResult = result.current.undo(); // busy guard -> no-op, resolves null
    });
    await act(async () => { expect(await secondCallResult).toBeNull(); });
    resolveTop();
    await act(async () => { await firstCallPromise; });
    expect(topEntry.undo).toHaveBeenCalledTimes(1);
    expect(bottomEntry.undo).not.toHaveBeenCalled();
  });
});
