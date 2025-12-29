/**
 * Initialize GSAP and ScrollTrigger globally
 */
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

// Make GSAP available globally
declare global {
    interface Window {
        gsap: typeof gsap;
        ScrollTrigger: typeof ScrollTrigger;
    }
}

window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;

gsap.registerPlugin(ScrollTrigger);

// Configure ScrollTrigger for mobile
ScrollTrigger.config({
    autoRefreshEvents: "visibilitychange,DOMContentLoaded,load",
});
