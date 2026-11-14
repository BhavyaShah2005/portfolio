# Bhavya Shah Portfolio

A scroll-driven portfolio: the character stays centre stage, scrolling moves a camera over him, and his eyes and head follow the cursor.

## Run locally

Option 1: double-click `index.html`. It opens in your browser and works as is.

Option 2 (a local server, closer to how it runs when hosted):

    cd portfolio
    python -m http.server 8000

Then open http://localhost:8000

With Node instead: `npx serve .`

## Files

- `index.html`: the page content. Edit the text inside `<main>` (intro, skills, now, projects, journey, contact).
- `styles.css`: all styling. Colours and fonts are the variables in `:root` at the top.
- `script.js`: the camera, eye tracking, head turn and blinking. The `SHOTS` table near the top sets each camera stop (point to frame, zoom, screen position, tilt).
- `assets/body.webp`, `assets/head.webp`: the character, cut into a body layer and a head layer with open eye sockets. The eyes themselves are drawn in the SVG inside `index.html`.

## Notes

- Fonts load from Google Fonts, so they need an internet connection. Offline, system fonts are used.
- To deploy, upload the folder to any static host (GitHub Pages, Netlify, Vercel). No build step.
