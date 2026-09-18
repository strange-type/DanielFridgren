/**
 * Live sampling of the pixels/colors actually rendered behind the nav,
 * driving --scrim-alpha on .nav-scrim so the gradient only shows up
 * strongly where mix-blend-mode: difference would otherwise wash out to
 * low-contrast grey (backdrop luminance near 0.5), and stays off over
 * backdrops that are already near-black or near-white.
 */

const SAMPLE_Y = 48;
const SAMPLE_COUNT = 7;
const SAMPLE_BLOCK = 10; // px, area averaged per point instead of a single pixel
const MAX_ALPHA = 0.3;
const SMOOTHING = 0.25; // exponential moving average factor, lower = smoother/slower
const VIDEO_FALLBACK_LUMINANCE = 0.35; // used when a video can't be read (cross-origin canvas taint)
const TEXT_TAGS = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6", "A", "SPAN", "LI", "TIME",
    "LABEL", "BUTTON", "TD", "TH", "STRONG", "EM", "BLOCKQUOTE",
]);
const TEXT_INK_COVERAGE = 0.22;
const CHROME_SELECTOR = ".navbar, .nav-scrim, #mobile-menu, #menu-toggle";

let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;
let scrollHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let smoothedStrength: number | null = null;

function relativeLuminance(r: number, g: number, b: number): number {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function parseCssColor(value: string): [number, number, number, number] | null {
    const match = value.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
    );
    if (!match) return null;
    return [
        parseFloat(match[1]),
        parseFloat(match[2]),
        parseFloat(match[3]),
        match[4] !== undefined ? parseFloat(match[4]) : 1,
    ];
}

function findVideoInShadowTree(root: ShadowRoot | null | undefined): HTMLVideoElement | null {
    if (!root) return null;
    const direct = root.querySelector("video");
    if (direct instanceof HTMLVideoElement) return direct;
    // mux-player wraps media-chrome elements that nest their own shadow
    // roots (e.g. <media-controller>), so the <video> can be more than
    // one shadow boundary deep.
    for (const el of root.querySelectorAll("*")) {
        const found = findVideoInShadowTree(el.shadowRoot);
        if (found) return found;
    }
    return null;
}

function findMediaSource(candidates: Element[]): HTMLImageElement | HTMLVideoElement | null {
    // Search the whole stack at this point, not just ancestors of the
    // topmost hit: an image/video is often a sibling of an overlay div
    // (e.g. a hero caption box) rather than an ancestor of it.
    for (const el of candidates) {
        if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) {
            return el;
        }
        if (el.tagName === "MUX-PLAYER") {
            const video = findVideoInShadowTree((el as HTMLElement).shadowRoot);
            if (video) return video;
        }
    }
    return null;
}

function sampleMediaLuminance(
    media: HTMLImageElement | HTMLVideoElement,
    x: number,
    y: number,
): number | null {
    try {
        const rect = media.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        const isVideo = media instanceof HTMLVideoElement;
        const sw = isVideo ? media.videoWidth : media.naturalWidth;
        const sh = isVideo ? media.videoHeight : media.naturalHeight;
        if (!sw || !sh) return null;
        if (isVideo && media.readyState < 2) return null;

        // Map viewport point -> source pixel, assuming object-fit: cover
        const scale = Math.max(rect.width / sw, rect.height / sh);
        const displayedW = sw * scale;
        const displayedH = sh * scale;
        const offsetX = (displayedW - rect.width) / 2 / scale;
        const offsetY = (displayedH - rect.height) / 2 / scale;
        const relX = (x - rect.left) / rect.width;
        const relY = (y - rect.top) / rect.height;
        const sourceX = Math.min(sw - 1, Math.max(0, relX * (rect.width / scale) + offsetX));
        const sourceY = Math.min(sh - 1, Math.max(0, relY * (rect.height / scale) + offsetY));

        if (!sampleCanvas) {
            sampleCanvas = document.createElement("canvas");
            sampleCanvas.width = SAMPLE_BLOCK;
            sampleCanvas.height = SAMPLE_BLOCK;
            sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
        }
        if (!sampleCtx) return null;

        // Average a small block rather than a single pixel: sampling one
        // pixel is prone to landing exactly on a thin bright letter/logo
        // edge on one frame and just beside it the next, causing visible
        // flicker as the value swings wildly between adjacent frames.
        const blockSourceW = Math.min(sw, SAMPLE_BLOCK * 2);
        const blockSourceH = Math.min(sh, SAMPLE_BLOCK * 2);
        sampleCtx.clearRect(0, 0, SAMPLE_BLOCK, SAMPLE_BLOCK);
        sampleCtx.drawImage(
            media,
            Math.max(0, sourceX - blockSourceW / 2),
            Math.max(0, sourceY - blockSourceH / 2),
            blockSourceW,
            blockSourceH,
            0,
            0,
            SAMPLE_BLOCK,
            SAMPLE_BLOCK,
        );
        const data = sampleCtx.getImageData(0, 0, SAMPLE_BLOCK, SAMPLE_BLOCK).data;
        let total = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
            total += relativeLuminance(data[i], data[i + 1], data[i + 2]);
            count++;
        }
        return count > 0 ? total / count : null;
    } catch {
        // Tainted canvas (cross-origin media, e.g. Mux's streaming CDN) or not decoded yet
        return null;
    }
}

function findBackgroundLuminance(el: Element): number {
    let node: Element | null = el;
    for (let i = 0; i < 8 && node; i++) {
        const bg = getComputedStyle(node).backgroundColor;
        const parsed = parseCssColor(bg);
        if (parsed && parsed[3] > 0) {
            return relativeLuminance(parsed[0], parsed[1], parsed[2]);
        }
        node = node.parentElement;
    }
    return 1; // Assume page background (light) if nothing opaque found
}

function computeLuminanceAt(x: number, y: number): number | null {
    const candidates = document.elementsFromPoint(x, y).filter((el) => !el.closest(CHROME_SELECTOR));
    const target = candidates[0];
    if (!target) return null;

    const media = findMediaSource(candidates);
    if (media) {
        const luminance = sampleMediaLuminance(media, x, y);
        if (luminance !== null) return luminance;
        // Cross-origin video (e.g. Mux's streaming CDN) taints the canvas so
        // getImageData throws — fall back to a reasonable guess rather than
        // treating it as plain background, which would read as page-white.
        if (media instanceof HTMLVideoElement) return VIDEO_FALLBACK_LUMINANCE;
    }

    const bgLuminance = findBackgroundLuminance(target);
    const hasText = TEXT_TAGS.has(target.tagName) && !!target.textContent?.trim();
    if (!hasText) return bgLuminance;

    const inkColor = parseCssColor(getComputedStyle(target).color);
    if (!inkColor) return bgLuminance;
    const inkLuminance = relativeLuminance(inkColor[0], inkColor[1], inkColor[2]);
    return bgLuminance * (1 - TEXT_INK_COVERAGE) + inkLuminance * TEXT_INK_COVERAGE;
}

function updateScrim() {
    const navScrim = document.querySelector(".nav-scrim");
    if (!(navScrim instanceof HTMLElement)) return;
    if (navScrim.classList.contains("navbar-hidden")) return;

    const width = window.innerWidth;
    const samples: number[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
        const x = width * (0.1 + (0.8 * i) / (SAMPLE_COUNT - 1));
        const luminance = computeLuminanceAt(x, SAMPLE_Y);
        if (luminance !== null) samples.push(luminance);
    }
    if (samples.length === 0) return;

    const avgLuminance = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    // Peaks at luminance 0.5 (the dead zone for difference blend), 0 at the extremes
    const rawStrength = Math.max(0, 1 - Math.abs(avgLuminance - 0.5) / 0.5);

    // Smooth over time on top of the CSS opacity transition below: the
    // transition alone softens each jump, but consecutive noisy samples
    // (e.g. scrolling fast over a busy image) can still fight it.
    smoothedStrength =
        smoothedStrength === null
            ? rawStrength
            : smoothedStrength + (rawStrength - smoothedStrength) * SMOOTHING;

    // Note: this is a separate custom property from the element's own
    // `opacity` (used elsewhere for the nav's load-in fade and scroll-hide
    // behavior) — reusing that would fight with those animations.
    navScrim.style.setProperty("--scrim-alpha", (smoothedStrength * MAX_ALPHA).toFixed(3));
}

export function cleanupNavScrim() {
    if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    if (intervalId !== null) clearInterval(intervalId);
    scrollHandler = null;
    resizeHandler = null;
    intervalId = null;
}

export function initNavScrim() {
    cleanupNavScrim();

    if (!window.matchMedia("(prefers-color-scheme: light)").matches) return;
    if (typeof document.elementsFromPoint !== "function") return;

    let ticking = false;
    scrollHandler = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
            updateScrim();
            ticking = false;
        });
    };
    resizeHandler = () => updateScrim();

    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler);
    // Re-sample periodically too, so autoplaying hero video is reflected
    // even while the page isn't being scrolled.
    intervalId = setInterval(updateScrim, 600);

    updateScrim();
}
