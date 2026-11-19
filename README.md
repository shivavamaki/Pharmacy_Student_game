# Pharmacy Guild — DOS Edition

A mobile-friendly DOS-inspired web game built on the existing Cloudflare application.

## Architecture
- Frontend: static ES modules, local pixel artwork, and DOS interface CSS in frontend/.
- Authentication: existing Firebase Google sign-in and role checks.
- Backend: Cloudflare Workers + D1; existing characters, parties, quests, progress and GM/admin controls stay intact.
- PWA: manifest supports standalone presentation when the browser permits it. Offline gameplay is NOT enabled.
- Old Google Apps Script runtime/source files have been removed from this branch only. They remain in Git history and on main.

## Test
Use Node.js 24+:

    npm ci
    npm test

## Preview deployment
Deploy this branch to a separate Cloudflare Pages preview, serving frontend/ as site root with no build command. Before login can work on the preview hostname, add that hostname to Firebase authorized domains and configure the dev Worker ALLOWED_ORIGIN accordingly. API_ORIGIN currently points to the development Worker; no production traffic is changed by this commit.

## Scope and limits
This is a browser game with DOS-inspired UI, not a DOS emulator. Phaser is not yet installed. Do not migrate real users, reset passwords, change production D1 or merge the old Apps Script PR as part of this theme update. Historical migration instructions remain in MIGRATION.md; current DOS guidance is in docs/dos-edition.md.
