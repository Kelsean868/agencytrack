// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Avatar from '../Avatar.jsx';
import { deriveInitials, avatarColor } from '../../../lib/kiosk/utils.js';

// ── deriveInitials ────────────────────────────────────────────────────────────

describe('deriveInitials', () => {
  it('first + last name → two initials', () => {
    expect(deriveInitials('Sarah Williams')).toBe('SW');
  });

  it('single name → one initial', () => {
    expect(deriveInitials('Cher')).toBe('C');
  });

  it('three-part name → first two initials only', () => {
    expect(deriveInitials('Mary Jane Watson')).toBe('MJ');
  });

  it('empty string → ?', () => {
    expect(deriveInitials('')).toBe('?');
  });

  it('whitespace-only → ?', () => {
    expect(deriveInitials('   ')).toBe('?');
  });

  it('null → ? without crash', () => {
    expect(deriveInitials(null)).toBe('?');
  });

  it('undefined → ? without crash', () => {
    expect(deriveInitials(undefined)).toBe('?');
  });
});

// ── avatarColor ───────────────────────────────────────────────────────────────

describe('avatarColor', () => {
  it('returns a hex color string', () => {
    expect(avatarColor('uid-abc-123')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('same UID always produces the same color', () => {
    const uid = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
    expect(avatarColor(uid)).toBe(avatarColor(uid));
  });

  it('empty uid does not crash', () => {
    expect(() => avatarColor('')).not.toThrow();
    expect(() => avatarColor(undefined)).not.toThrow();
  });
});

// ── Avatar component ──────────────────────────────────────────────────────────
// Image preloading uses `new Image()`. Mock it so tests control onload/onerror.

let MockImage;

beforeEach(() => {
  MockImage = class {
    constructor() { MockImage.instance = this; }
    set src(_v) { /* trigger is manual in each test */ }
  };
  vi.stubGlobal('Image', MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Avatar component', () => {
  it('shows initials initially (before image preload resolves)', () => {
    render(<Avatar agent={{ uid: 'u1', name: 'Ann Brown', photoURL: 'https://example.com/photo.jpg' }} />);
    // Image hasn't loaded yet — initials shown
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders photo after Image.onload fires', async () => {
    render(<Avatar agent={{ uid: 'u1', name: 'Ann Brown', photoURL: 'https://example.com/photo.jpg' }} />);
    await act(async () => { MockImage.instance.onload?.(); });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('falls back to initials when Image.onerror fires', async () => {
    render(<Avatar agent={{ uid: 'u2', name: 'Tom Clark', photoURL: 'https://broken.example.com/x.jpg' }} />);
    await act(async () => { MockImage.instance.onerror?.(); });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('TC')).toBeInTheDocument();
  });

  it('shows initials when no photoURL provided', () => {
    render(<Avatar agent={{ uid: 'u3', name: 'Sarah Williams' }} />);
    expect(screen.getByText('SW')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('single-name agent → one initial', () => {
    render(<Avatar agent={{ uid: 'u4', name: 'Cher' }} />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('empty name → ? placeholder, no crash', () => {
    render(<Avatar agent={{ uid: 'u5', name: '' }} />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('applies sm size (24px) to initials div', () => {
    const { container } = render(<Avatar agent={{ uid: 'u6', name: 'Jo' }} size="sm" />);
    const el = container.firstChild;
    expect(el.style.width).toBe('24px');
    expect(el.style.height).toBe('24px');
  });

  it('applies tv size (60px) to initials div', () => {
    const { container } = render(<Avatar agent={{ uid: 'u7', name: 'Jo' }} size="tv" />);
    const el = container.firstChild;
    expect(el.style.width).toBe('60px');
    expect(el.style.height).toBe('60px');
  });

  it('applies tv size (60px) to photo img after load', async () => {
    render(<Avatar agent={{ uid: 'u8', name: 'Jo Marks', photoURL: 'https://x.com/p.jpg' }} size="tv" />);
    await act(async () => { MockImage.instance.onload?.(); });
    const img = screen.getByRole('img');
    expect(img.style.width).toBe('60px');
    expect(img.style.height).toBe('60px');
  });
});
