// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Avatar from '../Avatar.jsx';

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

describe('Avatar — initials fallback', () => {
  it('shows initials before image preload resolves', () => {
    render(<Avatar src="https://example.com/p.jpg" name="Ann Brown" />);
    expect(screen.getByText('AB')).toBeInTheDocument();
    const el = screen.getByRole('img', { name: 'Ann Brown' });
    expect(el.tagName).toBe('DIV');
  });

  it('initials div has role="img" and aria-label', () => {
    render(<Avatar name="Ann Brown" />);
    const el = screen.getByRole('img', { name: 'Ann Brown' });
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveTextContent('AB');
  });

  it('no src → shows initials', () => {
    render(<Avatar name="Sarah Williams" />);
    expect(screen.getByText('SW')).toBeInTheDocument();
  });

  it('empty name → ? placeholder', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('single-word name → one initial', () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });
});

describe('Avatar — photo loading', () => {
  it('renders <img> after Image.onload fires', async () => {
    render(<Avatar src="https://example.com/p.jpg" name="Ann Brown" />);
    await act(async () => { MockImage.instance.onload?.(); });
    const img = screen.getByRole('img', { name: 'Ann Brown' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg');
  });

  it('falls back to initials on Image.onerror', async () => {
    render(<Avatar src="https://broken.example.com/x.jpg" name="Tom Clark" />);
    await act(async () => { MockImage.instance.onerror?.(); });
    expect(screen.getByText('TC')).toBeInTheDocument();
    const el = screen.getByRole('img', { name: 'Tom Clark' });
    expect(el.tagName).toBe('DIV');
  });

  it('cancels stale preload when src changes', async () => {
    const { rerender } = render(<Avatar src="https://example.com/a.jpg" name="Jo" />);
    rerender(<Avatar src="https://example.com/b.jpg" name="Jo" />);
    // Only the second MockImage instance should update state
    await act(async () => { MockImage.instance.onload?.(); });
    const img = screen.getByRole('img', { name: 'Jo' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.com/b.jpg');
  });
});

describe('Avatar — onClick (button)', () => {
  it('renders as <button> when onClick provided', () => {
    render(<Avatar name="Jane Doe" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Jane Doe' })).toBeInTheDocument();
  });

  it('fires onClick when button clicked', () => {
    const handler = vi.fn();
    render(<Avatar name="Jane Doe" onClick={handler} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jane Doe' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('button shows photo after image loads', async () => {
    render(<Avatar src="https://example.com/p.jpg" name="Jane Doe" onClick={() => {}} />);
    await act(async () => { MockImage.instance.onload?.(); });
    const btn = screen.getByRole('button', { name: 'Jane Doe' });
    const img = btn.querySelector('img');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg');
  });
});

describe('Avatar — sizes', () => {
  it('sm → 32px', () => {
    const { container } = render(<Avatar name="Jo" size="sm" />);
    expect(container.firstChild.style.width).toBe('32px');
    expect(container.firstChild.style.height).toBe('32px');
  });

  it('md → 36px (default)', () => {
    const { container } = render(<Avatar name="Jo" />);
    expect(container.firstChild.style.width).toBe('36px');
  });

  it('lg → 40px', () => {
    const { container } = render(<Avatar name="Jo" size="lg" />);
    expect(container.firstChild.style.width).toBe('40px');
  });

  it('xl → 48px', () => {
    const { container } = render(<Avatar name="Jo" size="xl" />);
    expect(container.firstChild.style.width).toBe('48px');
  });

  it('unknown size → falls back to md (36px)', () => {
    const { container } = render(<Avatar name="Jo" size="xxl" />);
    expect(container.firstChild.style.width).toBe('36px');
  });
});

describe('Avatar — className', () => {
  it('appends className to the initials element', () => {
    const { container } = render(<Avatar name="Jo" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('appends className to the <img> element', async () => {
    render(<Avatar src="https://example.com/p.jpg" name="Jo" className="ring-2" />);
    await act(async () => { MockImage.instance.onload?.(); });
    expect(screen.getByRole('img', { name: 'Jo' })).toHaveClass('ring-2');
  });

  it('appends className to the button element', () => {
    const { container } = render(<Avatar name="Jo" onClick={() => {}} className="ring-2" />);
    expect(container.firstChild).toHaveClass('ring-2');
  });
});
