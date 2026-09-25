const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');

// Mirrors validateTokenData in src/lib/kiosk/utils.js — kept inline because
// Cloud Functions run CJS and cannot import from the frontend src/ tree.
function validateTokenData(data, tenantId, now) {
  if (!data) return { valid: false, reason: 'invalid' };
  // Cross-tenant safety: stored tenantId must match the URL parameter.
  if (data.tenantId !== tenantId) return { valid: false, reason: 'invalid' };
  if (data.revokedAt) return { valid: false, reason: 'revoked' };
  // SEC-03: a token with no (or an unreadable) expiresAt is invalid — it used
  // to be valid forever. createKioskToken always writes one.
  if (!data.expiresAt) return { valid: false, reason: 'expired' };
  const expiry =
    typeof data.expiresAt.toDate === 'function'
      ? data.expiresAt.toDate()
      : new Date(data.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry < now) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, tenantId: data.tenantId, branchId: data.branchId };
}

exports.validateKioskToken = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const { tenant: tenantId, token: tokenId } = req.query;
  if (!tenantId || !tokenId) {
    res.status(400).json({ valid: false, reason: 'invalid' });
    return;
  }

  try {
    const snap = await admin
      .firestore()
      .collection(`tenants/${tenantId}/kioskTokens`)
      .doc(tokenId)
      .get();

    const result = validateTokenData(
      snap.exists ? snap.data() : null,
      tenantId,
      new Date(),
    );

    if (!result.valid) {
      res.status(401).json(result);
      return;
    }

    // Update lastUsedAt fire-and-forget — do not delay the response.
    snap.ref
      .update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() })
      .catch(() => {});

    // Generate a Firebase custom token so the kiosk client can sign into
    // Firebase Auth and read Firestore with role='kiosk' claims.
    // UID is stable for the token so repeated calls get the same Auth identity.
    const kioskUid = `kiosk_${tokenId.slice(0, 28)}`;
    const customToken = await admin.auth().createCustomToken(kioskUid, {
      role: 'kiosk',
      tenantId: result.tenantId,
      branchId: result.branchId,
    });

    res.status(200).json({ ...result, customToken });
  } catch (err) {
    console.error('validateKioskToken error:', err);
    res.status(500).json({ valid: false, reason: 'invalid' });
  }
});

exports.validateTokenData = validateTokenData;
