// @ts-check
import { defineConfig } from "astro/config";
import robots from "astro-robots";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://fridgren.se",
  trailingSlash: "always",
  integrations: [
    robots({
      policy: [
        {
          userAgent: ["*"],
          allow: "/",
          disallow: ["/punkt"],
        },
      ],
    }),
    sitemap({
      filter: (page) => !page.includes("/punkt"),
      customPages: [
        "https://fridgren.se/documents/examensarbete-daniel-johansson.pdf",
      ],
    }),
    icon(),
  ],
});
