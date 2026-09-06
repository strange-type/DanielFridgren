import webpush from 'web-push';
import {
    readTasksFile,
    writeTasksFile,
    parseTasks,
    serializeTasks,
    readSubscriptions,
    writeSubscriptions,
    writeLastReminderError
} from './lib/punkt-data.js';

const { PUNKT_VAPID_PRIVATE_KEY, PUNKT_VAPID_SUBJECT } = process.env;
const PUBLIC_VAPID_KEY = process.env.PUBLIC_PUNKT_VAPID_KEY;
const TIMEZONE = 'Europe/Stockholm';

function stockholmNow() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}`
    };
}

/**
 * Runs on a schedule (see netlify.toml) rather than being called by
 * the app directly. Finds tasks whose reminder time has passed today
 * and hasn't been sent yet, pushes a notification to every stored
 * subscription, and marks those tasks (and prunes dead subscriptions)
 * in a single follow-up write each.
 */
export const handler = async () => {
    if (!PUNKT_VAPID_PRIVATE_KEY || !PUBLIC_VAPID_KEY || !PUNKT_VAPID_SUBJECT) {
        console.error('Punkt reminders: missing VAPID env vars, skipping run');
        return { statusCode: 200, body: 'not configured' };
    }

    webpush.setVapidDetails(PUNKT_VAPID_SUBJECT, PUBLIC_VAPID_KEY, PUNKT_VAPID_PRIVATE_KEY);

    const { date: today, time: nowTime } = stockholmNow();

    const { content: tasksContent, sha: tasksSha } = await readTasksFile();
    const tasks = parseTasks(tasksContent);

    const due = tasks.filter(
        (t) =>
            !t.done &&
            t.remind &&
            (t.when === 'today' || t.when === 'evening' || t.when === today) &&
            t.notifiedOn !== today &&
            t.remind <= nowTime
    );

    if (due.length === 0) {
        return { statusCode: 200, body: 'nothing due' };
    }

    const { subscriptions, sha: subsSha } = await readSubscriptions();
    if (subscriptions.length === 0) {
        console.log('Punkt reminders: tasks are due but no push subscriptions are stored yet');
        return { statusCode: 200, body: 'no subscriptions' };
    }

    const deadEndpoints = new Set();
    let lastError = null;

    for (const task of due) {
        const payload = JSON.stringify({
            title: task.title,
            body: task.note || 'Påminnelse från Punkt'
        });
        let deliveredToAtLeastOne = false;
        await Promise.all(
            subscriptions.map(async (subscription) => {
                try {
                    await webpush.sendNotification(subscription, payload);
                    deliveredToAtLeastOne = true;
                } catch (error) {
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        deadEndpoints.add(subscription.endpoint);
                    } else {
                        console.error(
                            'Punkt reminders: push failed for',
                            subscription.endpoint,
                            error.statusCode,
                            error.body || error.message
                        );
                        lastError = {
                            taskId: task.id,
                            taskTitle: task.title,
                            endpoint: subscription.endpoint,
                            statusCode: error.statusCode ?? null,
                            body: error.body || error.message || String(error)
                        };
                    }
                }
            })
        );
        // Only mark as sent once a push actually went through — marking
        // it unconditionally here previously hid real delivery failures
        // (a bad VAPID config, a rejected payload, etc.) since the task
        // would never be retried on the next run.
        if (deliveredToAtLeastOne) task.notifiedOn = today;
    }

    if (lastError) await writeLastReminderError(lastError);

    await writeTasksFile(serializeTasks(tasks), tasksSha, 'Mark Punkt reminders as sent');

    if (deadEndpoints.size > 0) {
        const remaining = subscriptions.filter((s) => !deadEndpoints.has(s.endpoint));
        await writeSubscriptions(remaining, subsSha, 'Prune expired Punkt push subscriptions');
    }

    return { statusCode: 200, body: `sent ${due.length} reminder(s)` };
};
