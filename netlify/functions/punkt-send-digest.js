import webpush from 'web-push';
import {
    stockholmNow,
    readTasksFile,
    parseTasks,
    readSubscriptions,
    writeSubscriptions,
    readLastDigestSent,
    writeLastDigestSent
} from './lib/punkt-data.js';

const { PUNKT_VAPID_PRIVATE_KEY, PUNKT_VAPID_SUBJECT } = process.env;
const PUBLIC_VAPID_KEY = process.env.PUBLIC_PUNKT_VAPID_KEY;

// Stockholm-local time the digest should go out at. Env-overridable
// like the rest of Punkt's config (see lib/punkt-data.js) so the time
// can change from the Netlify dashboard without a redeploy.
const DIGEST_TIME = process.env.PUNKT_DIGEST_TIME || '07:00';

/**
 * Same "Today" bucket the app itself shows (see bucket() in
 * src/pages/punkt/index.astro) — a task with no explicit date, "today",
 * "evening", or a date that's already passed, all count. Kept in the
 * tasks file's own order rather than re-splitting into a separate
 * "This Evening" group the way the in-app view does, since that's a
 * simplification that reads fine in a single notification body.
 */
function todayBucket(tasks, today) {
    return tasks.filter(
        (t) => !t.done && t.when && (t.when === 'today' || t.when === 'evening' || t.when <= today)
    );
}

/**
 * Runs on a schedule (see netlify.toml), independently of
 * punkt-send-reminders.js. Once Stockholm-local time reaches
 * DIGEST_TIME and today's digest hasn't already gone out, pushes a
 * notification listing everything currently in Today to every stored
 * subscription. Sends nothing on a day Today is empty, but still
 * records the date as handled either way so this doesn't keep
 * re-checking (and re-reading the tasks file) for the rest of the day.
 */
export const handler = async () => {
    if (!PUNKT_VAPID_PRIVATE_KEY || !PUBLIC_VAPID_KEY || !PUNKT_VAPID_SUBJECT) {
        console.error('Punkt digest: missing VAPID env vars, skipping run');
        return { statusCode: 200, body: 'not configured' };
    }

    const { date: today, time: nowTime } = stockholmNow();
    if (nowTime < DIGEST_TIME) {
        return { statusCode: 200, body: 'not time yet' };
    }

    const { date: lastSent, sha: digestSha } = await readLastDigestSent();
    if (lastSent === today) {
        return { statusCode: 200, body: 'already sent today' };
    }

    const { content: tasksContent } = await readTasksFile();
    const due = todayBucket(parseTasks(tasksContent), today);

    if (due.length === 0) {
        await writeLastDigestSent(today, digestSha);
        return { statusCode: 200, body: 'nothing in Today' };
    }

    const { subscriptions, sha: subsSha } = await readSubscriptions();
    if (subscriptions.length === 0) {
        console.log('Punkt digest: Today has items but no push subscriptions are stored yet');
        await writeLastDigestSent(today, digestSha);
        return { statusCode: 200, body: 'no subscriptions' };
    }

    webpush.setVapidDetails(PUNKT_VAPID_SUBJECT, PUBLIC_VAPID_KEY, PUNKT_VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
        title: `Idag (${due.length})`,
        body: due.map((t) => `• ${t.title}`).join('\n')
    });

    const deadEndpoints = new Set();
    await Promise.all(
        subscriptions.map(async (subscription) => {
            try {
                await webpush.sendNotification(subscription, payload);
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    deadEndpoints.add(subscription.endpoint);
                } else {
                    console.error(
                        'Punkt digest: push failed for',
                        subscription.endpoint,
                        error.statusCode,
                        error.body || error.message
                    );
                }
            }
        })
    );

    await writeLastDigestSent(today, digestSha);

    if (deadEndpoints.size > 0) {
        const remaining = subscriptions.filter((s) => !deadEndpoints.has(s.endpoint));
        await writeSubscriptions(remaining, subsSha, 'Prune expired Punkt push subscriptions');
    }

    return { statusCode: 200, body: `sent digest with ${due.length} task(s)` };
};
