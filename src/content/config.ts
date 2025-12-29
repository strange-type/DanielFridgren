// src/content/config.ts
import { z, defineCollection } from 'astro:content';

const toBoolean = z.preprocess((val) => {
    if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
    }
    return val;
}, z.boolean());

const blogCollection = defineCollection({
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        pubDate: z.string(),
        tags: z.array(z.string()).optional(),
        draft: toBoolean.optional(),
        author: z.string().optional(),
        readingTime: z.number().optional(),
        heroImage: z.string().optional(),
        heroImageCaption: z.string().optional(),
    }),
});

const workCollection = defineCollection({
    schema: z.object({
        title: z.string(),
        slug: z.string().optional(),
        date: z.string(),
        type: z.string().optional(),
        client: z.string().optional(),
        description: z.string().optional(),
        heroImage: z.string().optional(),
        ogImage: z.string().optional(),
        secondaryImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
        seoKeywords: z.array(z.string()).optional(),
        playbackId: z.string().optional(),
        playbackAccent: z.string().optional(),
        thumbnailTime: z.number().optional(),
        loop: toBoolean.optional(),
        autoplay: z.string().optional(),
    }),
});

export const collections = {
    blog: blogCollection,
    work: workCollection,
};