# PDF Stack Thumbnail Generator

A lightweight, client-side web application for generating layered, fanned, and drop-shadowed thumbnail images from PDF files. Built with vanilla HTML, CSS, and JavaScript (powered by Mozilla's `PDF.js`) so it runs directly on **GitHub Pages** with zero build steps.
Can be view live on: https://fdf-legedatabasen.github.io/pdf-thumbnail-generator/
<img width="2544" height="1308" alt="image" src="https://github.com/user-attachments/assets/27a768fe-bd42-4c33-9c55-833cc439641f" />


## Features
- **100% Client-Side Privacy:** PDFs never leave your browser.
- **Customizable Page Stack:**
  - Choose the first $N$ pages (e.g., first 3 pages) or specify custom page numbers/ranges (`1, 2, 4` or `1-3`).
  - Toggle Front-to-Back (Page 1 on top) or Back-to-Front layer ordering.
- **Rotation & Cascade Spread:**
  - Adjust base angle, rotation step per page, and horizontal/vertical spread offsets.
- **Drop Shadows & Borders:**
  - Customize shadow blur, opacity, and X/Y offsets.
  - Choose **Dotted** (cutout card style), **Solid**, **Dashed**, or **None** for page borders, plus adjustable corner radius.
- **Export as PNG or WebP:**
  - Supports full alpha transparency or solid background colors.
  - Live file-size comparison between **PNG** and **WebP** with adjustable WebP quality slider.

## Running Locally
Because `app.js` uses ES modules (`<script type="module">`), serve the folder with any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Or using Node npx
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Deploying to GitHub Pages
1. Push `index.html`, `style.css`, `app.js`, and `README.md` to your GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**, pick `main` (or `master`) and `/ (root)`, then click **Save**.
