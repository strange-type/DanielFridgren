// src/pages/rss.xml.ts
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

const SITE = 'https://fridgren.se';
const SITE_TITLE = 'Daniel Fridgren';
const SITE_DESCRIPTION = 'Senior UX Design for product leaders. Thoughts on design, complex systems and technology.';

export async function GET() {
  const posts = (await getCollection('blog')) as CollectionEntry<'blog'>[];
  const visible = posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => (a.data.pubDate > b.data.pubDate ? -1 : 1));

  const items = visible.map((p) => `
    <item>
      <title><![CDATA[${p.data.title}]]></title>
      <link>${SITE}/blog/${p.slug}/</link>
      <pubDate>${new Date(p.data.pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${p.data.description ?? ''}]]></description>
      <author>Daniel Fridgren</author>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}/</guid>
    </item>
  `).join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
      <title>${SITE_TITLE}</title>
      <link>${SITE}</link>
      <description>${SITE_DESCRIPTION}</description>
      <language>en-us</language>
      <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
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