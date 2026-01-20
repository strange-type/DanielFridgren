#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITEMAP_PATH = path.join(__dirname, '../dist/sitemap-index.xml');
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

async function submitToIndexNow() {
    const indexNowKey = process.env.INDEXNOW_KEY;

    if (!indexNowKey) {
        console.warn('⚠️  INDEXNOW_KEY environment variable not set. Skipping IndexNow submission.');
        return;
    }

    if (!fs.existsSync(SITEMAP_PATH)) {
        console.error(`❌ Sitemap not found at ${SITEMAP_PATH}`);
        process.exit(1);
    }

    try {
        // Read and parse sitemap
        const sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf-8');
        const parsed = await parseStringPromise(sitemapContent);

        // Extract URLs from sitemap
        const urls = parsed.sitemapindex.sitemap
            .map(sitemap => sitemap.loc[0])
            .flatMap(sitemapUrl => {
                // For each sitemap file, we'd need to parse it too
                // For now, we'll submit the main sitemap URLs
                return sitemapUrl;
            });

        // If using sitemap-index, get all sitemap files and extract URLs from them
        const allUrls = [];

        for (const sitemapUrl of urls) {
            try {
                const response = await fetch(sitemapUrl);
                const sitemapXml = await response.text();
                const sitemapData = await parseStringPromise(sitemapXml);

                if (sitemapData.urlset?.url) {
                    const pageUrls = sitemapData.urlset.url.map(item => item.loc[0]);
                    allUrls.push(...pageUrls);
                }
            } catch (err) {
                console.warn(`⚠️  Failed to parse sitemap: ${sitemapUrl}`, err.message);
            }
        }

        if (allUrls.length === 0) {
            console.warn('⚠️  No URLs found in sitemaps.');
            return;
        }

        // Submit URLs to IndexNow (max 10,000 per request)
        const chunks = [];
        for (let i = 0; i < allUrls.length; i += 10000) {
            chunks.push(allUrls.slice(i, i + 10000));
        }

        for (const urlList of chunks) {
            const payload = {
                host: 'fridgren.se',
                key: indexNowKey,
                keyLocation: 'https://fridgren.se/' + indexNowKey + '.txt',
                urlList: urlList,
            };

            try {
                const response = await fetch(INDEXNOW_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    console.log(`✅ Successfully submitted ${urlList.length} URLs to IndexNow`);
                } else {
                    const errorText = await response.text();
                    console.error(`❌ IndexNow submission failed (${response.status}): ${errorText}`);
                    process.exit(1);
                }
            } catch (error) {
                console.error('❌ Error submitting to IndexNow:', error.message);
                process.exit(1);
            }
        }
    } catch (error) {
        console.error('❌ Error processing sitemap:', error.message);
        process.exit(1);
    }
}

submitToIndexNow();
