# EarnBD Work · Ludo

`earnbd-ludo-complete.html` is a standalone responsive Ludo build for the EarnBD Work project.

The games bundle also includes `soverix-29-card-v3-final-pro.html` with mobile controls, sound/vibration/effects preferences, Home navigation, and a safe New Game reset.

Included:

- 2-player and 4-player offline/pass-and-play matches
- Original 15×15 3D board with player dice/status cards beside it
- Token movement, six-to-start, captures, safe cells and exact home
- Classic, Ocean, Emerald, Neon and Sunset board themes
- Dice/move/capture/win sound effects
- Emoji/chat panel
- Optional Bot Assist beta button for offline testing (disabled by default)
- New Game control for a safe offline reset (blocked while an online room is active)
- Firebase web configuration prepared for the next online-room pass

The Firebase configuration is a browser configuration, not a service-account secret. Keep the Realtime Database rules protected and publish `database.rules.json` only after reviewing the access policy.

## Security note

Never place OpenAI/API secret keys, passwords, service-account JSON files, or private tokens in these HTML files, ZIP bundles, or GitHub Pages. Browser Firebase config is not a substitute for database rules; keep authentication and database access protected.

## Firebase online room setup

1. In Firebase Authentication, enable Email/Password.
2. In Realtime Database, choose the Singapore (`asia-southeast1`) database used by the HTML config.
3. Replace the database rules with `database.rules.json`.
4. Open `earnbd-ludo-complete.html`, register/login, then create a room and share the invite link.
5. Test with two separate browsers or phones; each player must use a different account.

The room supports up to four players, live member presence, turn rotation, emoji reactions, action history, host handoff, and disconnect cleanup. The original offline V11 board remains the gameplay surface.

## GitHub Pages deployment

1. Put `index.html`, `earnbd-ludo-complete.html`, and `soverix-29-card-v3-final-pro.html` in the same repository folder.
2. In GitHub, open **Settings → Pages**, choose **Deploy from a branch**, then select the main branch and root folder.
3. Open the generated Pages URL. The homepage buttons use the relative game filenames, so all three HTML files must stay together.
4. Firebase `database.rules.json` is uploaded through Firebase Console → Realtime Database → Rules; it is not a GitHub Pages file.

## Admin Control Center

`admin-panel.html` is the protected control center for the public hub. It supports:

- Homepage brand, hero text, notices, maintenance mode and visibility controls.
- Game catalog management: publish/hide, title, subtitle, route, icon, button label, accent color, type and sort order.
- Global 3D surface theme values for the homepage and game shells.
- Firebase user activity, presence, rooms, virtual coins/XP, roles and block status.
- Admin audit history plus JSON export/import backup for settings and games.

One-time Firebase setup:

1. Deploy the updated `database.rules.json` in Realtime Database → Rules.
2. Create or sign in with the intended admin Firebase account.
3. Open `admin-panel.html` once. Copy the displayed Firebase UID.
4. In Realtime Database, create `admins/<UID>` with the boolean value `true`.
5. Sign in again; the dashboard will unlock.

The admin page never stores an admin password in the repository. The original Ludo route and board remain separate; the panel changes public settings and catalog data without rewriting the original board internals.
