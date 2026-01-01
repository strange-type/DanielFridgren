/**
 * Animate footer logo and text when it scrolls into view
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function initFooterAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    // Kill existing footer ScrollTriggers to prevent duplicates
    ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.vars.trigger === ".footer") {
            trigger.kill();
        }
    });

    // Set initial state - paths hidden
    gsap.set(["#footer-path-1"], {
        scaleY: 0,
    });

    gsap.set(["#footer-path-2"], {
        opacity: 0,
    });

    // Set initial state for text elements
    gsap.set(".footer-animate", {
        opacity: 0,
        y: 20,
    });

    // Create staggered animation when footer scrolls into view
    ScrollTrigger.create({
        trigger: ".footer",
        start: "top bottom",
        once: true,
        invalidateOnRefresh: true,
        onEnter: () => {
            // Animate logo paths
            gsap.to(["#footer-path-1"], {
                scaleY: 1,
                duration: 0.6,
                ease: "power2.out",
                stagger: 0.25,
            });

            gsap.to(["#footer-path-2"], {
                opacity: 1,
                duration: 1.6,
                ease: "power2.out",
                stagger: 0.15,
            });

            // Animate text elements with stagger
            gsap.to(".footer-animate", {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: "power2.out",
                stagger: 0.08,
            });
        },
    });
}
