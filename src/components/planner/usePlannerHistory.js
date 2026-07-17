import { useCallback, useReducer, useRef } from 'react';

/**
 * usePlannerHistory — client-side undo/redo history over the agent planner's
 * Firestore mutations (Run 9 A1).
 *
 * Each history entry is `{ label, undo, redo }` where `undo`/`redo` are async
 * functions that perform the REAL inverse/forward mutation through the same
 * service layer the original action used — undo is never display-only. The
 * caller (AgentPlannerPanel) builds these closures per action; a common
 * pattern is a mutable `{ current: id }` ref captured in the closure so a
 * `redo` that re-creates a doc (fresh id each time) updates the ref, and the
 * following `undo` targets the freshest id.
 *
 * Implementation note: the two stacks live in plain refs, not `useState`,
 * because the imperative undo()/redo() logic needs to pop-then-await-then-
 * push synchronously against the CURRENT stack — reading a value written
 * inside a `setState` functional updater immediately after calling the
 * setter is not reliable (the updater isn't guaranteed to run before the
 * next line executes). A `useReducer` force-render ties ref mutations back
 * to a re-render so `canUndo`/`canRedo` (read straight from the refs during
 * render) reflect the latest state.
 *
 * - 20-step cap: the oldest entry is dropped once the undo stack exceeds it.
 * - Pushing a new entry clears the redo stack (standard editor semantics —
 *   a fresh action invalidates whatever was undone before it).
 * - In-flight guard: `undo()`/`redo()` no-op (return null) while a previous
 *   call is still resolving, so a rapid double-tap can't race two mutations
 *   against the same document.
 * - On a failed undo/redo (the service call rejects), the popped entry is
 *   restored to its original stack so the user can retry — the error
 *   propagates to the caller to handle (e.g. an error toast).
 *
 * `push` is returned as a plain function specifically so a later feature
 * (Run 9 A5 bulk operations) can push its own multi-step entries through the
 * same history instance — AgentPlannerPanel owns the single hook instance and
 * can hand `push` down to any future bulk-op UI as a prop/callback.
 */
const MAX_HISTORY = 20;

export default function usePlannerHistory() {
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const busyRef = useRef(false);
  const [, forceRender] = useReducer((c) => c + 1, 0);

  const push = useCallback((entry) => {
    const next = [...undoStackRef.current, entry];
    undoStackRef.current = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    redoStackRef.current = [];
    forceRender();
  }, []);

  const undo = useCallback(async () => {
    if (busyRef.current) return null;
    if (undoStackRef.current.length === 0) return null;
    const entry = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    forceRender();
    busyRef.current = true;
    try {
      await entry.undo();
      redoStackRef.current = [...redoStackRef.current, entry];
      forceRender();
      return entry;
    } catch (err) {
      // The mutation didn't actually reverse — restore the entry so it's
      // still a valid undo candidate (stack integrity over silent loss).
      undoStackRef.current = [...undoStackRef.current, entry];
      forceRender();
      throw err;
    } finally {
      busyRef.current = false;
    }
  }, []);

  const redo = useCallback(async () => {
    if (busyRef.current) return null;
    if (redoStackRef.current.length === 0) return null;
    const entry = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    forceRender();
    busyRef.current = true;
    try {
      await entry.redo();
      const next = [...undoStackRef.current, entry];
      undoStackRef.current = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      forceRender();
      return entry;
    } catch (err) {
      redoStackRef.current = [...redoStackRef.current, entry];
      forceRender();
      throw err;
    } finally {
      busyRef.current = false;
    }
  }, []);

  return {
    push,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
  };
}
