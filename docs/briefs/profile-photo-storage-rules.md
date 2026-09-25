# Brief — Profile photo upload: open one Storage path (SEC-12 follow-up)

**Model:** Sonnet 5 · **Effort:** medium
**Type:** rules change → human-merge; Kyron runs the deploy. Claude Code never merges or deploys.

## Problem
`storage.rules` (added verbatim from the live Console in SEC-12) denies every read and write:
`match /{allPaths=**} { allow read, write: if false; }`.
The app's only Storage use is `uploadProfilePhoto()` in `src/services/userService.js`, which writes
`avatars/{tenantId}/{uid}.jpg` (JPEG, compressed client-side) and then calls `getDownloadURL`.
Both calls are denied, so profile photo upload is broken in production.

## Change
1. Replace `storage.rules` with this (keep the catch-all deny below the avatar match):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile photos — the only Storage path the app uses.
    match /avatars/{tenantId}/{fileName} {
      allow read: if request.auth != null
        && request.auth.token.get('tenantId', '') == tenantId;
      allow create, update: if request.auth != null
        && request.auth.token.get('tenantId', '') == tenantId
        && fileName == request.auth.uid + '.jpg'
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType == 'image/jpeg';
      // No delete: the app never deletes avatars.
    }
    // Everything else stays closed.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

2. Rewrite `tests/rules/storage.rules.test.mjs`. Change the header comment: the file no longer pins "production denies all". Test matrix (each case must pass):
   1. Owner uploads own avatar, JPEG, < 2 MB → ALLOW
   2. Owner overwrites own avatar → ALLOW
   3. Owner reads own avatar → ALLOW
   4. Same-tenant colleague reads the avatar → ALLOW
   5. Other-tenant user reads the avatar → DENY
   6. Unauthenticated read → DENY
   7. User uploads to another user's file (`avatars/{tenant}/{otherUid}.jpg`) → DENY
   8. User uploads into another tenant's folder → DENY
   9. Upload ≥ 2 MB → DENY
   10. Upload with contentType `image/png` → DENY
   11. Owner deletes own avatar → DENY
   12. Write to any other path (e.g. `uploads/x.jpg`) → DENY
3. Check `src/components/profile/ProfileScreen.jsx`: when the upload fails, it must show a clear error message and not hang on a spinner. If it already does, change nothing. If not, add the error state (loading/error/empty rule).
4. Do not touch `firestore.rules`, functions, or any other file.

## Known and accepted
`getDownloadURL` returns a URL with a token. Anyone who has that URL can view the photo; that bypasses these rules by Firebase design. This is fine for an avatar. Record it in the PR body under "Known limits".

## Deliverables
1. One PR: `storage.rules`, `tests/rules/storage.rules.test.mjs`, and a ProfileScreen change only if step 3 needs it.
2. Emulator run output pasted in the PR:
   `firebase emulators:exec --only firestore,storage "node tests/rules/storage.rules.test.mjs"` → 12/12 pass.
3. `npm test` and lint pass.
4. PR body ends with the deploy command for Kyron, exactly:
   `firebase deploy --only storage --project agencytrack-2a610`
5. Post-deploy smoke walk for Kyron (written in the PR body, run by Kyron after deploy):
   1. Sign in as an agent → Profile → upload a photo → the photo shows, with no error.
   2. Refresh the page → the photo is still there.
   3. Sign in as a manager in the same tenant → the agent's photo shows where avatars appear.
6. Add a FOLLOW_UPS line: "Tenant Admin has no Persistency view — design question, not a bug (found in #975 smoke)."
