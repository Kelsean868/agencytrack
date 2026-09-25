'use strict';

// SEC-14 (audit 2026-09-24): renderTemplate used to insert every {{var}} into
// the HTML templates raw, so a user whose name held markup could put a live
// link inside a genuine AgencyTrack email. HTML templates now escape; plain-text
// templates and inline subjects stay raw (they are not parsed as HTML).

const { escapeHtml, renderTemplate, renderString } = require('../utils/email');

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });

  it('escapes & first, so an entity in the input is not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('stringifies non-strings and leaves safe text alone', () => {
    expect(escapeHtml(12.5)).toBe('12.5');
    expect(escapeHtml('Kyron Marchan')).toBe('Kyron Marchan');
  });
});

describe('renderTemplate', () => {
  const hostile = {
    userName: '<a href="https://evil.example">Reset your password</a>',
    managerName: `O'Brien & "Sons"`,
    weekStarting: '<script>alert(1)</script>',
    appUrl: 'https://portal.agencytrack.app/?a=1&b=2',
    contactEmail: 'help@agencytrack.app',
  };

  it('escapes every interpolated value in an .html template', () => {
    const html = renderTemplate('compliance-nudge.html', hostile);
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('O&#39;Brien &amp; &quot;Sons&quot;');
  });

  it('keeps links working: & in a URL becomes &amp;, which browsers decode in href', () => {
    const html = renderTemplate('compliance-nudge.html', hostile);
    expect(html).toContain('https://portal.agencytrack.app/?a=1&amp;b=2');
  });

  it('leaves .txt templates raw — plain text is not parsed as HTML', () => {
    const txt = renderTemplate('compliance-nudge.txt', hostile);
    expect(txt).toContain(`O'Brien & "Sons"`);
    expect(txt).toContain('https://portal.agencytrack.app/?a=1&b=2');
  });

  it('still renders a missing var as empty', () => {
    const html = renderTemplate('compliance-nudge.html', {});
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe('renderString (subjects)', () => {
  it('stays raw — a subject line is plain text', () => {
    expect(renderString('Hi {{name}}', { name: 'A & B' })).toBe('Hi A & B');
  });
});
