# Personal Site

My personal website built with Astro, featuring a blog, case studies portfolio, and serverless contact functionality.

**Live Site:** [fridgren.se](https://fridgren.se)

## Tech Stack

- **Astro 5.16+** - Static site generator with content collections
- **TypeScript** - Strict mode enabled
- **MDX** - Content with frontmatter validation (Zod schemas)
- **React** - Component support via @astrojs/react
- **Custom CSS** - Design tokens and CSS custom properties (no Tailwind)
- **GSAP 3.13** - Scroll animations with ScrollTrigger
- **Mux** - Video playback
- **SendGrid** - Transactional emails via Netlify functions
- **Netlify** - Deployment with serverless functions

## Features

- 📝 **MDX Blog** with draft support and RSS feed
- 💼 **Case Studies** with video support via Mux
- 📧 **Contact Form** with rate limiting and spam protection
- 🌙 **Dark Mode** via `prefers-color-scheme`
- ✨ **Scroll Animations** using GSAP
- 🔍 **SEO Optimized** with IndexNow integration
- 🎨 **Custom Design System** with CSS tokens

## Getting Started

**Requirements:** pnpm 10.28.1+

```bash
# Install dependencies
pnpm install

# Start dev server (with --host flag)
pnpm dev

# Visit http://localhost:4321
```

## Build & Deploy

```bash
# Build for production + submit to IndexNow
pnpm build

# Preview production build
pnpm preview
```

The build command runs `astro build` followed by `scripts/submit-indexnow.js` which automatically submits your sitemap URLs to search engines.

## Project Structure

```
scripts/              # Build scripts (IndexNow submission)
netlify/functions/    # Serverless functions (contact, newsletter)
src/
  components/         # Reusable UI components (.astro)
  content/
    blog/             # Blog posts (MDX with frontmatter)
    work/             # Case studies (MDX with frontmatter)
    config.ts         # Content collection schemas (Zod)
  layouts/            # Page layouts (Layout, BlogPost, CaseLayout)
  pages/              # Routes and pages (.astro)
  scripts/            # Client-side scripts (GSAP animations)
  global.css          # Global styles and design tokens
public/               # Static assets (fonts, images)
```

## Environment Variables

Required for full functionality:

- `SENDGRID_API_KEY` - SendGrid API key for contact form
- `SENDGRID_FROM_EMAIL` - Verified sender email
- `CONTACT_EMAIL` - Recipient email for contact form
- `INDEXNOW_KEY` - Key for IndexNow API (optional)

## Deployment

Deployed on **Netlify** with:
- Automatic builds on push
- Serverless functions for contact/newsletter
- Redirects: www → non-www, http → https
- Build command: `pnpm build`

## Documentation

For detailed technical documentation, architecture details, and code conventions, see [CLAUDE.md](./CLAUDE.md).

## License

This project uses **multi-licensing**:

- **Code (MIT License)** - Source code, configuration, and build scripts are free to use, modify, and distribute
- **Content & Design (All Rights Reserved)** - Blog post text, case studies, design assets, and visual styling remain copyrighted
- **Blog Images (Unsplash License)** - Photos from Unsplash, free to use under [Unsplash License](https://unsplash.com/license)

See [LICENSE](./LICENSE) for full details.