// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotesThread from '../NotesThread.jsx';

const THREAD = [
  { at: null, text: 'legacy note', during: false, legacy: true },
  { at: '2026-07-24T13:00:00.000Z', text: 'live-meeting note', during: true },
];

describe('NotesThread — E4', () => {
  it('renders each entry and tags THIS MEETING notes', () => {
    render(<NotesThread thread={THREAD} onAdd={vi.fn()} />);
    const entries = screen.getAllByTestId('note-entry');
    expect(entries).toHaveLength(2);
    expect(screen.getByText('legacy note')).toBeInTheDocument();
    expect(screen.getByText('live-meeting note')).toBeInTheDocument();
    // Only the `during` note gets the tag.
    expect(screen.getAllByTestId('note-this-meeting')).toHaveLength(1);
    // Legacy entry reads "Earlier" (no timestamp).
    expect(screen.getByText('Earlier')).toBeInTheDocument();
  });

  it('shows the empty state when there are no notes', () => {
    render(<NotesThread thread={[]} onAdd={vi.fn()} />);
    expect(screen.getByTestId('notes-empty')).toHaveTextContent('No notes yet');
  });

  it('add-note calls onAdd with the trimmed text and clears the input', () => {
    const onAdd = vi.fn();
    render(<NotesThread thread={[]} onAdd={onAdd} />);
    const input = screen.getByTestId('note-add-input');
    fireEvent.change(input, { target: { value: '  hello world  ' } });
    fireEvent.click(screen.getByTestId('note-add-btn'));
    expect(onAdd).toHaveBeenCalledWith('hello world');
    expect(input.value).toBe('');
  });

  it('the add button is disabled for blank input and while saving', () => {
    const { rerender } = render(<NotesThread thread={[]} onAdd={vi.fn()} />);
    expect(screen.getByTestId('note-add-btn')).toBeDisabled();          // blank
    rerender(<NotesThread thread={[]} onAdd={vi.fn()} saving />);
    fireEvent.change(screen.getByTestId('note-add-input'), { target: { value: 'x' } });
    expect(screen.getByTestId('note-add-btn')).toBeDisabled();          // saving
  });

  it('is read-only (no add field) when onAdd is absent', () => {
    render(<NotesThread thread={THREAD} />);
    expect(screen.queryByTestId('note-add-input')).toBeNull();
    expect(screen.getAllByTestId('note-entry')).toHaveLength(2);
  });
});
