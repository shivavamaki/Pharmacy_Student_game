# Pharmacy Guild — DOS / Mobile Hardening Proposal

This branch updates the **legacy Google Apps Script** edition of Pharmacy Guild. It does not migrate the application to Phaser, Firebase or Cloudflare, nor does it deploy the web app.

## Changes
- Optional green-on-black DOS theme, saved per browser (both main guild and recap).
- Responsive mobile layouts, larger touch targets, keyboard focus styles and reduced-motion support.
- Removed prefilled demo login and public demo database initialization UI.
- Removed hard-coded account provisioning and automatic password “repair” that reset legacy hashes to predictable passwords.
- New salted SHA-256 password format for legacy GAS accounts, with one-time conversion on valid legacy plaintext login; users can change password and are signed out afterward.
- Session authorization consults the current user account and role, rather than trusting the role cached at login.
- Checks party ownership when saving progress and evidence; validates progress/risk values.
- Disallows unavailable quests, duplicate active quest acceptance, duplicate completion and completion without approved evidence.
- Adventure recap uses sessionStorage for auth tokens rather than localStorage and no longer stores the token inside exported response JSON on the server.
- Removes unrestricted iframe embedding.

## Critical deployment notes
1. **Rotate all credentials that were ever hard-coded or predictable** before exposing the app. Previous Git commits cannot be made safe merely by removing the source lines.
2. **Use managed authentication in production.** Salted SHA-256 is a transitional compatibility improvement, not a password-hardening KDF (Argon2id/bcrypt/scrypt) and not comparable to Firebase Auth.
3. Existing 64-character legacy hashes are intentionally **not accepted as passwords**. Such accounts need trusted administrator resets or an external identity migration.
4. Existing plaintext accounts remain able to sign in once and are migrated to salted hashes. They should then change the password via the new UI.
5. The app still depends on Google Sheets and Apps Script; **no Cloudflare/Firebase production data was changed**. Confirm which deployed application is current before applying any migration.
6. Sheet permissions, Web App execute-as settings, per-user authorization, CSRF exposure and student identifiers should be reviewed before production deployment. The initial setup must be restricted to trusted script editors.
7. **Do not put real student or patient data in this public repository** and keep demo/test fixtures fictional.

## Manual validation checklist (staging, not production)
- [ ] Sign in with an existing plaintext student account; change password; sign back in.
- [ ] Sign in with a salted-hash user; verify old password fails after rotation.
- [ ] Verify users with legacy hashes must be reset; no default password fallback.
- [ ] Verify student cannot submit progress/evidence against another party.
- [ ] Verify student cannot accept a locked or already active quest.
- [ ] Verify GM cannot award the same quest XP twice; rejected/unapproved evidence cannot complete.
- [ ] Verify GM role revocation takes effect without requiring a new sign-in.
- [ ] Verify recap login/submission/export on Android and desktop.
- [ ] Verify green DOS palette and classic palette, keyboard accessibility, narrow mobile screens.
- [ ] Verify Apps Script deployment and Google Sheets read/write behavior in a staging copy.
- [ ] Verify no secrets or identifiable data are accidentally logged.

## Recommended next phase
Create a separate Phaser + TypeScript + Vite PWA client for dungeon movement, combat and animation, and integrate it with the existing **deployed** Cloudflare Worker/D1 API after reviewing its schema and authentication. Keep current quest/evidence/GM workflows as server-authoritative services.
