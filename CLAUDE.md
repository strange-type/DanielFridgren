# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal website built with Astro, TypeScript, and MDX. The site features a blog, work/case studies portfolio, and contact functionality. It's deployed on Netlify with serverless functions.

**Tech Stack**: Astro 5.16+, TypeScript (strict mode), MDX, React components
**Package Manager**: pnpm 10.28.1+
**Site URL**: https://fridgren.se

## Development Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start dev server at http://localhost:4321 (with --host flag)
pnpm build            # Build for production + submit URLs to IndexNow
pnpm preview          # Preview production build

# Direct Astro access
pnpm astro [command]  # Run Astro CLI commands directly
```

Note: `pnpm build` runs two steps: (1) `astro build`, and (2) `node scripts/submit-indexnow.js` which submits sitemap URLs to IndexNow API for search engine indexing.

## Architecture

### Content Collections

The site uses Astro's content collections system defined in `src/content/config.ts`:

- **blog** collection: Blog posts in `src/content/blog/`
  - Schema includes: title, description, pubDate, tags, draft, author, readingTime, heroImage, heroImageCaption
  - Draft posts are supported via `draft: true` frontmatter

- **work** collection: Portfolio/case studies in `src/content/work/`
  - Schema includes: title, slug, date, type, client, description, heroImage, ogImage, secondaryImage, tags, seoKeywords
  - Video support via Mux: playbackId, playbackAccent, thumbnailTime, loop, autoplay

Both collections use MDX format and have frontmatter validation via Zod schemas.

### Page Structure

- `src/pages/`: Routes and pages (.astro files)
  - `index.astro`: Homepage
  - `about.astro`: About page
  - `contact.astro`: Contact form page
  - `colophon.astro`: Site details/credits
  - `newsletter.astro`: Newsletter signup
  - `blog/[slug].astro`: Dynamic blog post pages
  - `blog/index.astro`: Blog listing
  - `work/[slug].astro`: Dynamic case study pages
  - `work/index.astro`: Work listing
  - `rss.xml.ts`: RSS feed generation
  - `404.astro`: Custom 404 page

### Layouts

Core layout files in `src/layouts/`:
- `Layout.astro`: Base layout with SEO, global styles, analytics
- `BlogPost.astro`: Blog post layout with frontmatter display
- `CaseLayout.astro`: Case study/work layout

### Serverless Functions

Netlify functions in `netlify/functions/`:

1. **contact.js**: Contact form handler
   - Uses SendGrid for email delivery
   - Implements rate limiting (3 submissions per minute per IP)
   - Anti-spam: honeypot field + minimum form fill time (3 seconds)
   - Validates name (2+ chars), email format, message (10+ chars)
   - Environment variables: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `CONTACT_EMAIL`

2. **subscribe-email.js**: Newsletter subscription handler

### Integrations

Configured in `astro.config.mjs`:
- `@astrojs/sitemap`: Automatic sitemap generation (used by IndexNow script)
- `astro-robots`: robots.txt generation
- `astro-llms-generate`: LLM-powered content generation
- `astro-icon`: Icon system using Iconify (@iconify-json/heroicons, @iconify-json/mdi)
- `@astrojs/react`: React component support

### Key Dependencies

- **Video**: `@mux/mux-player` for video playback
- **Email**: `@sendgrid/mail` for transactional emails
- **Animations**: `gsap` for animations, `lottie-web` + `astro-integration-lottie` for Lottie animations
- **SEO**: SEO component at `src/components/seo.astro`

### TypeScript Configuration

- Extends `astro/tsconfigs/strict` (strict type checking)
- JSX configured for React: `"jsx": "react-jsx"`, `"jsxImportSource": "react"`
- Types from `@astrojs/react` included
- Excludes `dist` and `node_modules`

### Build & Deployment

- **Deployment**: Netlify (configured via `netlify.toml`)
- **Build command**: `pnpm build` (includes IndexNow submission)
- **Redirects**: All www → non-www, all http → https (configured in netlify.toml)
- **Functions**: Uses esbuild bundler for Netlify functions

### IndexNow Integration

Post-build script `scripts/submit-indexnow.js`:
- Reads generated sitemap from `dist/sitemap-index.xml`
- Parses all sitemap URLs and extracts page URLs
- Submits URLs to IndexNow API for fast search engine indexing
- Requires `INDEXNOW_KEY` environment variable
- Key must be placed in `public/{INDEXNOW_KEY}.txt` for verification

### Styling

- Global styles in `src/global.css`


## Code Style

- **TypeScript strict mode** for all code
- **Prefer functional patterns** over class-based components
- **Small, focused components** with single responsibility
- **Use .astro extension** for Astro components
- **Keep changes minimal** - avoid over-engineering this small personal site
- **Maintain consistency** with existing patterns
- **Formatted with Prettier** (prettier-plugin-astro configured)

## Important Patterns

1. **Content authoring**: All blog posts and case studies use MDX format with validated frontmatter schemas
2. **Dynamic routes**: Use `[slug].astro` pattern for blog and work pages
3. **SEO**: Use the `src/components/seo.astro` component consistently across pages
4. **React components**: Supported via @astrojs/react integration when needed
5. **Icons**: Use astro-icon with Iconify icon sets (heroicons and mdi available)
