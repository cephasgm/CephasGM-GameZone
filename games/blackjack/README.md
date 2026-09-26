# Blackjack.js

A simple Blackjack game I built using plain JavaScript, HTML, and CSS. The game lets you play one vs one against an automated dealer with basic betting and proper Blackjack rules.

**🕹 Live Demo:** [blackjack-rb.netlify.app](https://blackjack-rb.netlify.app/)

---

## Features

- One vs one Blackjack against the dealer
- Adjustable betting before each round
- Hit and Stand actions
- Smart hand summing
- Payouts include 1:1 and 3:2 for a natural Blackjack
- Real-time UI updates and chip count tracking
- Works on desktop and mobile

## Notes

I kept things simple and focused on core frontend skills like DOM manipulation, state management, and modular code. The layout uses CSS and a bit of styling, including a frosted-glass modal.

---

## Cardmeister `<playing-card>`

This project uses the amazing **Cardmeister** library to render the playing cards. The lightweight JavaScript file defines a `<playing-card>` web component.  It contains all 52 card SVGs, creating them on the fly without needing to load or store separate image files.

**Repository:** [github.com/cardmeister/cardmeister.github.io](https://github.com/cardmeister/cardmeister.github.io)

---

## 📱 Add to Home Screen (Install as Mobile App)

You can install Blackjack.js as a mobile app for quick access!

### Android (Chrome, Edge, Brave, etc.)
1. Open the web app in your browser.
2. Tap the **three-dot menu** (⋮).
3. Select **"Add to Home screen"**.
4. Confirm and the app icon will appear on your device.

### iOS (Safari)
1. Open the web app in Safari.
2. Tap the **Share** button (⏍).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The app icon will appear on your home screen.

## How to Run Locally

1.  Clone the repository:
    ```bash
    git clone https://github.com/ronny-kb/blackjack-js.git
    ```
2.  Host the `index.html` file locally.
