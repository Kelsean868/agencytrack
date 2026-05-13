'use strict';

const fs   = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'email-templates');

/**
 * renderTemplate(filename, vars)
 *
 * Loads the template file from functions/email-templates/<filename>,
 * replaces every {{key}} marker with vars[key], and returns the
 * rendered string. Missing vars default to '' so a typo never throws.
 *
 * Files are read synchronously at call time (CF cold-start is
 * acceptable; templates are small and infrequently called).
 */
function renderTemplate(filename, vars) {
  const filepath = path.join(TEMPLATES_DIR, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ''
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

module.exports = { renderTemplate, renderString, buildMailDoc };
