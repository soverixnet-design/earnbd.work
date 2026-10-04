# EarnBD Work · Ludo

`earnbd-ludo-complete.html` is a standalone responsive Ludo build for the EarnBD Work project.

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
