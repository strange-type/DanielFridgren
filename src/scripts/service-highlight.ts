/**
 * Highlight the service item closest to the center of the viewport on scroll
 */
export function initServiceHighlight() {
    const serviceItems = document.querySelectorAll(
        ".service-item"
    ) as NodeListOf<HTMLElement>;

    if (serviceItems.length === 0) return;

    let ticking = false;

    const updateHighlight = () => {
        const viewportHeight = window.innerHeight;
        const targetY = viewportHeight * 0.5; // Center of viewport

        let closestItem: HTMLElement | null = null;
        let closestDistance = Infinity;

        // Find the item closest to the center
        serviceItems.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.top + rect.height / 2;
            const distance = Math.abs(itemCenter - targetY);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestItem = item;
            }
        });

        // Only highlight the closest item
        serviceItems.forEach((item) => {
            if (item === closestItem) {
                item.classList.add("in-focus");
            } else {
                item.classList.remove("in-focus");
            }
        });

        ticking = false;
    };

    window.addEventListener(
        "scroll",
        () => {
            if (!ticking) {
                requestAnimationFrame(updateHighlight);
                ticking = true;
            }
        },
        { passive: true }
    );

    // Initial call
    updateHighlight();
}
