// MUST stay in sync with the matching file at src/utils/validators.js.
// Email-format spec is locked across client + server defense-in-depth (Track C
// C2, Q6 ratification 2026-05-08). If the regex changes here, update the
// client copy in the same PR.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_RE.test(email.trim());
}

module.exports = { EMAIL_RE, isValidEmail };
