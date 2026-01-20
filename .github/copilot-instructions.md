# GitHub Copilot Instructions

This repository contains a personal website built with Astro, TypeScript, and MDX.

## Project Overview

- **Tech Stack**: Astro, TypeScript, MDX, Tailwind CSS
- **Package Manager**: pnpm (version 10.24.0+)
- **Purpose**: Personal website featuring a blog and case studies

## Development Commands

- `pnpm install` - Install dependencies
- `pnpm dev` - Start development server at http://localhost:4321
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

## Code Style and Conventions

- Prefer writing clear code and use inline comments sparingly
- **TypeScript strict mode** for all code
- **Prefer functional patterns** over class-based components
- **Small, focused components** with single responsibility
- **Use .astro extension** for Astro components
- **Keep changes minimal** - avoid over-engineering this small personal site
- **Maintain consistency** with existing patterns
- **Formatted with Prettier** (prettier-plugin-astro configured)
- For TypeScript/JavaScript/CSS: Document all methods, types and interfaces with JSDoc comments

### General Guidelines

- Use TypeScript for all new code
- Follow strict TypeScript configuration (extends "astro/tsconfigs/strict")
- Use Prettier for code formatting (prettier-plugin-astro is configured)
- Prefer functional patterns over class-based components

### File Organization

```
scripts/          # Image generation utilities
src/
  components/     # Reusable UI components (.astro files)
  content/        # Blog posts and case studies (MDX format)
    blog/         # Blog posts
    cases/        # Case studies
  layouts/        # Page layouts (.astro files)
  pages/          # Routes and pages (.astro files)
  global.css      # Global styles
public/           # Static assets
```

### Astro Components

- Use `.astro` file extension for Astro components
- Astro components should have frontmatter (JavaScript/TypeScript between `---` delimiters) followed by template markup
- Keep components small and focused on a single responsibility
- Use TypeScript in frontmatter sections

### Content (MDX)

- Blog posts go in `src/content/blog/`
- Case studies go in `src/content/cases/`
- Use MDX format for all content files
- Follow existing frontmatter patterns in content files

### TypeScript

- JSX configuration uses React: `"jsx": "react-jsx"`, `"jsxImportSource": "react"`
- Types from `@astrojs/react` are included
- Exclude `dist` and `node_modules` directories

### Styling

The site uses **custom CSS with design tokens** (CSS custom properties), not Tailwind CSS or other utility-first frameworks.

- **Global styles**: `src/global.css` (~1,150 lines, 24KB)
  - CSS reset
  - Design tokens (spacing, colors, typography, etc.)
  - Base element styles
  - Utility classes (`.prose`, `.text`, `.button`, etc.)
  - Component styles (some component-specific styles exist here but should ideally be scoped)
- **Component-scoped styles**: Individual `.astro` files can include `<style>` blocks for component-specific CSS
- **Spacing system**: T-shirt sizing convention (`--space-3xs` through `--space-xxl`, plus `--space-80/96/128/160` for larger values)
- **Font weights**: 300 (light), 400 (regular), 500 (medium), 600 (demi-bold) - with minimal italic usage
- **Dark mode**: Automatic via `prefers-color-scheme` media query

### Integrations

The project uses these Astro integrations:
- `@astrojs/sitemap` - Sitemap generation
- `astro-robots` - robots.txt generation
- `astro-llms-generate` - LLM content generation
- `astro-icon` - Icon system using Iconify

### Dependencies

- React components are supported via `@astrojs/react`
- GSAP for animations
- Lenis for smooth scrolling
- Lottie for animations (via lottie-web and astro-integration-lottie)
- Hyphenopoly for text hyphenation

## Best Practices

1. **Keep changes minimal** - This is a small personal site, avoid over-engineering
2. **Maintain consistency** - Follow existing patterns in the codebase
3. **Test locally** - Always run `pnpm dev` to verify changes work
4. **Build verification** - Run `pnpm build` to ensure production build succeeds
5. **Content structure** - Preserve existing frontmatter structure when modifying MDX files
6. **Performance** - Keep the site fast and lightweight
7. **Accessibility** - Ensure components are accessible

## Common Tasks

### Adding a Blog Post

1. Create new MDX file in `src/content/blog/`
2. Add proper frontmatter (check existing posts for structure)
3. Write content in MDX format

### Adding a Case Study

1. Create new MDX file in `src/content/cases/`
2. Add proper frontmatter (check existing cases for structure)
3. Write content in MDX format

### Creating New Components

1. Add `.astro` file to `src/components/`
2. Use TypeScript in frontmatter section
3. Keep component focused and reusable
4. Import and use in pages or layouts as needed

### Modifying Layouts

1. Layout files are in `src/layouts/`
2. Main layouts include: `Layout.astro`, `BlogPost.astro`, `CaseLayout.astro`, `AboutLayout.astro`
3. Ensure changes maintain consistency across all pages using the layout

## SEO Configuration

- Site URL is configured as "https://fridgren.se"
- Sitemap is automatically generated
- robots.txt is handled by astro-robots integration
- SEO component is available at `src/components/seo.astro`

## Notes

- The site uses procedural SVG image generation (scripts directory)
- Analytics via Plausible (@plausible-analytics/tracker)
- Video player via Mux (@mux/mux-player)
