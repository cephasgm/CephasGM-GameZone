\# CephasGM GameZone — Frontend



> \*\*Premium online sports betting, live casino \& virtual games platform.\*\*

> Static HTML/CSS/JS front end, installable as a Progressive Web App, powered by a Node.js + PostgreSQL backend.



\[!\[Live Site](https://img.shields.io/badge/live-bet.cephasgm.org-0055ff?style=for-the-badge)](https://bet.cephasgm.org)

\[!\[API](https://img.shields.io/badge/api-api.cephasgm.org-542bff?style=for-the-badge)](https://api.cephasgm.org/health)

\[!\[PWA](https://img.shields.io/badge/PWA-installable-00e07a?style=for-the-badge)](#-progressive-web-app)



\---



\## 📖 Overview



CephasGM GameZone is a full-stack online betting platform built for the Tanzanian and East African market. This repository contains the \*\*frontend\*\* — a lightweight, dependency-free static site that talks to a REST + WebSocket backend.



\*\*Key highlights\*\*



\- 🎯 \*\*Sports betting\*\* — pre-match and in-play markets with live odds

\- ✈️ \*\*Aviator crash game\*\* — provably fair, up to 60× multipliers

\- ⚽ \*\*Virtual games\*\* — Football, Horse Racing, Car Racing, Netball

\- 🎰 \*\*Casino hub\*\* — slots, table games, live dealers

\- 💰 \*\*Wallet system\*\* — deposits, withdrawals, transactions, KYC

\- 🎁 \*\*Bonuses \& referrals\*\* — welcome bonus, deposit match, commission

\- 🔒 \*\*Full authentication\*\* — email/phone signup, JWT, email + SMS OTP

\- 📱 \*\*Progressive Web App\*\* — installable, offline-capable, push-ready



\---



\## 🌐 Live URLs



| Service | URL |

|---------|-----|

| \*\*Frontend\*\* (this repo) | <https://bet.cephasgm.org> |

| \*\*Backend API\*\* | <https://api.cephasgm.org> |

| \*\*API health\*\* | <https://api.cephasgm.org/health> |

| \*\*GitHub Pages mirror\*\* | <https://cephasgm.github.io/CephasGM-GameZone> |

| \*\*Backend repo\*\* | <https://github.com/cephasgm/CephasGM-GameZone-Backend> |



\---



\## 🛠 Tech Stack



| Layer | Technology |

|-------|-----------|

| Markup | HTML5 (hand-written, no framework) |

| Styling | Tailwind CSS (CDN) + custom glassmorphism CSS |

| Scripting | Vanilla JavaScript (ES2017+) |

| Icons | Inline SVG + emoji |

| Fonts | Inter (Google Fonts) |

| PWA | Service Worker + Web App Manifest |

| API Client | Custom `js/api.js` (fetch wrapper, JWT + auto-refresh) |

| Hosting | GitHub Pages + Cloudflare DNS |

| CDN / SSL | Cloudflare (proxy) + Let's Encrypt (via GitHub Pages) |



\*\*No build step.\*\* Files are served as-is. Editing HTML/CSS/JS and pushing is enough to deploy.



\---



\## 📁 Project Structure



```

CephasGM-GameZone/

│

├── index.html                       # Landing page (guest vs user view)

├── sports.html                      # Pre-match sports betting hub

├── live-betting.html                # In-play markets with live simulation

├── casino.html                      # Casino game hub

├── aviator.html                     # Crash game (live backend rounds)

├── adventure-games.html             # Bonus game category

│

├── virtual-football.html            # Virtual sports — football

├── virtual-horse-racing.html        # Virtual sports — horse racing

├── virtual-car-racing.html          # Virtual sports — car racing

├── virtual-netball.html             # Virtual sports — netball

│

├── dashboard.html                   # User control center

├── profile.html                     # Personal info

├── settings.html                    # Password, currency, 2FA

├── wallet.html                      # Balance + full transaction history

├── deposit.html                     # Add funds (M-Pesa, card, bank)

├── withdraw.html                    # Request payout

├── transactions.html                # Filterable ledger

├── bet-history.html                 # Past bets

├── bonuses.html                     # Available \& claimed bonuses

├── promotions.html                  # Marketing campaigns

├── referrals.html                   # Referral code \& earnings

├── kyc.html                         # Identity verification

├── notifications.html               # In-app alerts

├── messages.html                    # Support chat

├── support.html                     # Support tickets

├── leaderboard.html                 # Competitive rankings

├── vip.html                         # Loyalty program

│

├── signin.html                      # Sign in (email or phone)

├── signup.html                      # Sign up (email or phone)

├── forgot-password.html             # Password reset request

├── verify-email.html                # OTP entry

│

├── about.html                       # Informational pages

├── contact.html

├── faq.html

├── privacy.html

├── terms.html

├── cookies.html

├── responsible-gambling.html

├── self-exclusion.html

│

├── offline.html                     # Fallback page when offline

├── manifest.json                    # PWA manifest

├── sw.js                            # Service worker (caching + offline)

├── CNAME                            # Custom domain (bet.cephasgm.org)

├── icons/                           # App icons (all sizes)

├── js/

│   ├── api.js                       # API client — auth, wallet, bets

│   └── auth-ui.js                   # Auto user badge + sign-out

└── README.md

```



\---



\## 🚀 Getting Started (Local Development)



\### Prerequisites



\- Any modern web browser (Chrome, Edge, Firefox, Safari)

\- A local HTTP server (service workers don't work over `file://`)



\### Run locally



From the project root:



```bash

\# Option 1 — Python (pre-installed on Windows / macOS / Linux)

python -m http.server 5500



\# Option 2 — Node.js

npx --yes http-server -p 5500



\# Option 3 — VS Code Live Server extension

\# Right-click index.html → "Open with Live Server"

```



Then open <http://localhost:5500> in your browser.



> ⚠️ \*\*Important:\*\* Don't open the HTML files directly by double-clicking. Use an HTTP server so the service worker and API calls work correctly.



\### Pointing to a different backend



Edit `js/api.js` and change the `API\_BASE` constant:



```javascript

var API\_BASE = 'https://api.cephasgm.org/api/v1';

```



For local backend development, point it at `http://localhost:5000/api/v1` and ensure `CORS\_ORIGINS` on the backend includes `http://localhost:5500`.



\---



\## 🌍 Deployment



The site is deployed automatically via \*\*GitHub Pages\*\* on every push to `main`.



\### Custom domain setup



\- \*\*Custom domain:\*\* `bet.cephasgm.org` (via `CNAME` file)

\- \*\*DNS:\*\* Cloudflare — `CNAME bet → cephasgm.github.io` (DNS only, not proxied)

\- \*\*SSL:\*\* issued automatically by GitHub Pages (Let's Encrypt)



To deploy a change:



```bash

git add .

git commit -m "Your change"

git push

```



GitHub Pages rebuilds in \~60 seconds.



\---



\## 🔌 Backend Integration



The frontend talks to the backend exclusively through `js/api.js`, a small wrapper around `fetch` that handles:



\- \*\*JWT access + refresh tokens\*\* stored in `localStorage`

\- \*\*Automatic token refresh\*\* when the access token expires

\- \*\*Consistent error handling\*\* — throws an object with `message` and `code`

\- \*\*Auth-aware requests\*\* — attaches `Authorization: Bearer <token>` automatically



\### Common usage



```javascript

// Sign in

await CephasGM.api.login('user@example.com', 'password');



// Check if logged in

if (CephasGM.api.isLoggedIn()) { /\* ... \*/ }



// Get wallet balance

const wallet = await CephasGM.api.wallet();



// Place a bet

await CephasGM.api.post('/bets', {

&#x20; type: 'SINGLE',

&#x20; stake: 1000,

&#x20; selections: \[{ eventId: 'm1', selection: 'Arsenal', odds: 1.95 }],

});



// Sign out

await CephasGM.api.logout();

```



\### Auth-aware navbar



Include `js/auth-ui.js` after `js/api.js` on any page. It auto-injects a user badge and sign-out button, and enforces:



\- `data-requires-auth` on `<body>` → redirects guests to sign-in

\- `data-requires-auth-link` on any element → link requires auth

\- `data-requires-guest-link` → only for guests (redirects logged-in users)



\---



\## 📱 Progressive Web App



The site is a full PWA — installable on Android, iOS, Windows, macOS, and Linux.



\### Features



\- ✅ \*\*Installable\*\* — "Add to Home Screen" prompt on mobile, install button on desktop

\- ✅ \*\*Offline fallback\*\* — `offline.html` shown when the network is unavailable

\- ✅ \*\*Cache-first\*\* for static assets, network-first for API

\- ✅ \*\*Custom app icons\*\* — 72×72 → 512×512 + maskable variants

\- ✅ \*\*Theme colour\*\* `#0a0a12` matching the platform

\- ✅ \*\*Shortcuts\*\* — quick-launch to Aviator, Virtual Football, Live Betting, Dashboard

\- ✅ \*\*Screenshots\*\* — for the richer install prompt (Chrome)



\### Service worker strategy



| Request type | Strategy |

|--------------|----------|

| HTML navigations | Network-first, cache fallback, `offline.html` last resort |

| Static assets (CSS, JS, images, fonts) | Stale-while-revalidate |

| External CDN (Tailwind, Google Fonts, images) | Cache-first |

| API calls | Network-only (never cached) |



\### Testing PWA features



1\. Serve over HTTPS or `http://localhost`

2\. Open DevTools → \*\*Application\*\* tab

3\. Check \*\*Manifest\*\* and \*\*Service Workers\*\* sections

4\. Toggle \*\*Offline\*\* in the Network tab to test fallback



\---



\## 🔒 Privacy \& Auth Model



\*\*Public pages\*\* (browsable by guests)

\- `index.html`, `sports.html`, `live-betting.html`, `casino.html`, `aviator.html`

\- All informational pages (`about`, `privacy`, `terms`, etc.)



\*\*Auth-required pages\*\* (redirect guests to sign-in)

\- `dashboard.html`, `profile.html`, `settings.html`

\- `wallet.html`, `deposit.html`, `withdraw.html`, `transactions.html`

\- `bet-history.html`, `bonuses.html`, `kyc.html`, `referrals.html`

\- `notifications.html`, `messages.html`, `support.html`



Guests can \*\*browse\*\* odds and game listings, but any action that touches money or personal data redirects to `signin.html?redirect=<original>`.



\---



\## 🎨 Design System



| Token | Value |

|-------|-------|

| Background base | `#0a0a12` |

| Primary gradient | `linear-gradient(135deg, #0055ff, #542bff)` |

| Success | `#00e07a` |

| Danger | `#ff0044` |

| Warning | `#ffcc00` |

| Glass background | `rgba(0,0,0,0.6)` + `backdrop-filter: blur(20px)` |

| Border (subtle) | `rgba(255,255,255,0.06)` |

| Font | Inter (300–900) |

| Radius (cards) | 16–24px |

| Radius (buttons) | 50px (pill) |



\---



\## 🧪 Browser Support



| Browser | Version |

|---------|---------|

| Chrome / Edge | 90+ |

| Firefox | 88+ |

| Safari (macOS + iOS) | 14+ |

| Samsung Internet | 14+ |



Requires \*\*ES2017\*\*, \*\*CSS Grid\*\*, \*\*CSS Custom Properties\*\*, `fetch`, `Promise`, `async/await`.



\---



\## 📝 Roadmap



\- \[ ] Real-time odds via WebSocket (Socket.io client)

\- \[ ] Live bet slip synced across tabs

\- \[ ] Cash-out for Aviator and live football

\- \[ ] Real casino game provider integration (Evolution, Pragmatic)

\- \[ ] Cashier with M-Pesa, Tigo Pesa, Airtel Money, Flutterwave

\- \[ ] Multi-language support (English + Kiswahili)

\- \[ ] Native push notifications

\- \[ ] Dark / light theme toggle



\---



\## 🤝 Contributing



This is a private project. If you're part of the team:



1\. Create a feature branch: `git checkout -b feat/your-feature`

2\. Commit your changes: `git commit -m "Add your feature"`

3\. Push to the branch: `git push origin feat/your-feature`

4\. Open a Pull Request



\### Commit message convention



```

feat: add cash-out button to Aviator

fix: correct odds calculation on multi-bet slip

style: match card padding on mobile

docs: update README deployment section

```



\---



\## ⚠️ Responsible Gambling



\- Strictly \*\*18+\*\*

\- Self-exclusion tools available at `/self-exclusion.html`

\- Responsible gambling resources at `/responsible-gambling.html`

\- National helpline referrals linked from the support centre



If you or someone you know has a gambling problem, seek help immediately.



\---



\## 📄 License



\*\*Proprietary.\*\* © 2025 Cephas GM. All rights reserved.



Unauthorized copying, distribution, or use of this code, design, or assets is strictly prohibited.



\---



\## 📞 Contact



\- \*\*Website:\*\* <https://bet.cephasgm.org>

\- \*\*Support:\*\* <https://bet.cephasgm.org/support.html>

\- \*\*Email:\*\* support@cephasgm.org

\- \*\*Backend repo:\*\* <https://github.com/cephasgm/CephasGM-GameZone-Backend>



\---



<p align="center">

&#x20; <strong>CephasGM GameZone</strong> — Innovating for Tomorrow 🚀

&#x20; <br>

&#x20; <sub>Made with ❤️ for the East African betting market</sub>

</p>

