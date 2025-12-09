// src/pages/rss.xml.ts
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';

const SITE = 'https://wisecompany.se';

export const GET: APIRoute = async () => {
    const posts = (await getCollection('blog')) as CollectionEntry<'blog'>[];
    const visible = posts
        .filter((p) => !p.data.draft)
        .sort((a, b) => (a.data.pubDate > b.data.pubDate ? -1 : 1));

    const items = visible.map((p) => `
    <item>
      <title><![CDATA[${p.data.title}]]></title>
      <link>${SITE}/blog/${p.slug}</link>
      <pubDate>${new Date(p.data.pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${p.data.description ?? ''}]]></description>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
    </item>
  `).join('\n');

    const xml = `<?xml version="1.0" encoding="utf-8"?>
  <rss version="2.0">
    <channel>
      <title>Your site name</title>
      <link>${SITE}</link>
      <description>Your blog description</description>
      ${items}
    </channel>
  </rss>`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
        },
    });
};