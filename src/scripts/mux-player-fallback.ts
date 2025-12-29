/**
 * Fallback for Mux player: replace with static image on error
 */
export function initMuxPlayerFallback(playerId: string, fallbackImageSrc: string, altText: string) {
    const player = document.getElementById(playerId);
    if (!player) return;

    player.addEventListener("error", () => {
        const figure = player.closest(".portfolio-figure");
        if (figure) {
            figure.innerHTML = `<img src="${fallbackImageSrc}" alt="${altText}" loading="lazy" />`;
        }
    });
}
