'use strict';

const fs   = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'email-templates');

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * escapeHtml(value)
 *
 * SEC-14 (audit 2026-09-24): makes a value safe to place in HTML text or a
 * quoted attribute. Pure. `&` is part of the same single pass, so an entity in
 * the input (`&lt;`) comes out as literal text (`&amp;lt;`), never as markup.
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * renderTemplate(filename, vars)
 *
 * Loads the template file from functions/email-templates/<filename>,
 * replaces every {{key}} marker with vars[key], and returns the
 * rendered string. Missing vars default to '' so a typo never throws.
 *
 * .html templates escape every value (SEC-14): names and other user-set
 * fields must not become markup — a name holding an <a href> would otherwise
 * put a live phishing link inside a genuine AgencyTrack email. URLs still work:
 * `&` becomes `&amp;` in an href, which the mail client decodes back. .txt
 * templates stay raw — plain text is not parsed as HTML.
 *
 * Files are read synchronously at call time (CF cold-start is
 * acceptable; templates are small and infrequently called).
 */
function renderTemplate(filename, vars) {
  const filepath = path.join(TEMPLATES_DIR, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  const encode = filename.endsWith('.html') ? escapeHtml : String;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? encode(vars[key]) : ''
  );
}

/**
 * renderString(template, vars)
 *
 * Like renderTemplate but operates on an inline string rather than a file.
 * Used for subjects, which are short enough to keep as literals in the CF.
 */
function renderString(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
  );
}

/**
 * buildMailDoc(to, subjectTemplate, txtFile, htmlFile, vars)
 *
 * Returns a mail/ collection document shape ready for
 * admin.firestore().collection('mail').add(doc).
 *
 * subjectTemplate — inline string, may contain {{variable}} markers.
 * txtFile / htmlFile — filenames relative to functions/email-templates/.
 */
function buildMailDoc(to, subjectTemplate, txtFile, htmlFile, vars) {
  return {
    to,
    message: {
      subject: renderString(subjectTemplate, vars),
      text:    renderTemplate(txtFile, vars),
      html:    renderTemplate(htmlFile, vars),
    },
  };
}

module.exports = { escapeHtml, renderTemplate, renderString, buildMailDoc };
