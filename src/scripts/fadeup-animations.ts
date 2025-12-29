/**
 * Initialize fade-up animations for elements with .fadeup-st class
 */
export async function initFadeUpAnimations() {
    try {
        // Register ScrollToPlugin if available (dynamic import) with CDN fallback
        try {
            const { ScrollToPlugin } = await import("gsap/ScrollToPlugin");
            if (ScrollToPlugin && window.gsap) {
                window.gsap.registerPlugin(ScrollToPlugin);
            }
        } catch (e) {
            // CDN fallback for ScrollToPlugin
            await new Promise((res) => {
                const s = document.createElement("script");
                s.src =
                    "https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollToPlugin.min.js";
                s.onload = res;
                document.head.appendChild(s);
            });
            if (window.gsap && (window.gsap as any).ScrollToPlugin) {
                window.gsap.registerPlugin((window.gsap as any).ScrollToPlugin);
            }
        }

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
    } catch (err) {
        console.error("GSAP init/import failed:", err);
    }
}

