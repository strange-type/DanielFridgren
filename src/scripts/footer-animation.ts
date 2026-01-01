/**
 * Animate footer logo and text when it scrolls into view
 */
export function initFooterAnimation() {
    // Check if GSAP is available
    if (!window.gsap || !window.ScrollTrigger) {
        return;
    }

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    // Check if footer exists on this page
    const footer = document.querySelector(".footer");
    if (!footer) return;

    // Kill existing footer ScrollTriggers to prevent duplicates
    ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.vars.trigger === ".footer") {
            trigger.kill();
        }
    });

    // Reset to initial state - paths hidden
    gsap.set(["#footer-path-1"], {
        scaleY: 0,
        transformOrigin: "bottom center",
    });

    gsap.set(["#footer-path-2"], {
        opacity: 0,
    });

    // Reset initial state for text elements
    gsap.set(".footer-animate", {
        opacity: 0,
        y: 20,
    });

    // Check if footer is already in view
    const rect = footer.getBoundingClientRect();
    const isInView = rect.top < window.innerHeight;

    if (isInView) {
        // If already in view, animate immediately without ScrollTrigger
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

        gsap.to(".footer-animate", {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.08,
        });
    } else {
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
}
