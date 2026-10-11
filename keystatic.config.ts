import { config, collection, fields } from "@keystatic/core";

/**
 * Keystatic runs against the local filesystem in development and commits to
 * GitHub (via the Keystatic GitHub App) in production.
 */
const isProd = import.meta.env.PROD;

export default config({
  storage: isProd
    ? {
        kind: "github",
        repo: "strange-type/danielfridgren",
        branchPrefix: "content/",
      }
    : { kind: "local" },
  ui: {
    brand: { name: "fridgren.se" },
  },
  collections: {
    blog: collection({
      label: "Blog posts",
      slugField: "title",
      path: "src/content/blog/*",
      format: { contentField: "content" },
      entryLayout: "content",
      schema: {
        title: fields.slug({ name: { label: "Title" } }),
        description: fields.text({ label: "Description", multiline: true }),
        pubDate: fields.date({
          label: "Publish date",
          validation: { isRequired: true },
        }),
        draft: fields.checkbox({ label: "Draft", defaultValue: true }),
        author: fields.text({ label: "Author", defaultValue: "Daniel Fridgren" }),
        tags: fields.array(fields.text({ label: "Tag" }), {
          label: "Tags",
          itemLabel: (props) => props.value,
        }),
        readingTime: fields.integer({ label: "Reading time (minutes)" }),
        heroImage: fields.image({
          label: "Hero image",
          directory: "public/images/blog-images",
          publicPath: "/images/blog-images/",
        }),
        heroImageCaption: fields.text({ label: "Hero image caption" }),
        content: fields.markdoc({ label: "Content", extension: "md" }),
      },
    }),
  },
});
