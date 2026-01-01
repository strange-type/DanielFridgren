/**
 * Global GSAP type declarations
 * GSAP is loaded via CDN and made available globally
 */

import type gsap from "gsap";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

declare global {
    interface Window {
        gsap: typeof gsap;
        ScrollTrigger: typeof ScrollTrigger;
        gsapReady?: boolean;
    }
}

export {};
