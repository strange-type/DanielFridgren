/**
 * Initialize fade-up animations for elements with .fadeup-st class
 */
export function initFadeUpAnimations() {
    // Wait for GSAP to be available
    if (!window.gsap || !window.ScrollTrigger) {
        return;
    }

    // Kill existing ScrollTriggers to prevent duplicates on page navigation
    window.ScrollTrigger.getAll().forEach(trigger => trigger.kill());

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Fade elements with fadeup-st class
    const sections = window.gsap.utils.toArray(".fadeup-st");

    // Animate to visible state
    sections.forEach((section: any, i: number) => {
        // Check if element is in viewport on page load
        const rect = (section as Element).getBoundingClientRect();
        const isInitiallyVisible = rect.top < window.innerHeight * 0.9;

        window.gsap.to(section, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power4.out",
            scrollTrigger: {
                trigger: section,
                start: "top 85%",
                toggleActions: "play none none none",
                invalidateOnRefresh: true,
            },
            // Only add delay for elements initially visible on page load
            delay: isInitiallyVisible ? i * 0.1 : 0,
        });
    });

        // Refresh ScrollTrigger after all animations are set up
        window.ScrollTrigger.refresh();
    }

