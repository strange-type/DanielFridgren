// @ts-check
import { defineConfig } from "astro/config";
import robots from "astro-robots";
import sitemap from "@astrojs/sitemap";
import astroLLMsGenerator from 'astro-llms-generate';
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://fridgren.se",
  integrations: [robots(), sitemap(), astroLLMsGenerator(), icon()],
});
