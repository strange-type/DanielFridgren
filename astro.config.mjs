// @ts-check
import { defineConfig } from "astro/config";
import robots from "astro-robots";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://fridgren.se",
  trailingSlash: "ignore",
  adapter: netlify(),
  integrations: [
    robots({
      policy: [
        {
          userAgent: ["*"],
          allow: "/",
          disallow: ["/keystatic/", "/api/keystatic/"],
        },
      ],
    }),
    sitemap({
      filter: (page) => !page.includes("/keystatic"),
      customPages: [
        "https://fridgren.se/documents/examensarbete-daniel-johansson.pdf",
      ],
    }),
    icon(),
    react(),
    keystatic(),
  ],
});
