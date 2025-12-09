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
    }),

});

export const collections = {
    blog: blogCollection,
};