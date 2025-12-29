/**
 * Close mobile menu when clicking on a link
 */
export function initMobileMenuLinks() {
    const mobileMenu = document.getElementById("mobile-menu");
    const menuToggle = document.getElementById("menu-toggle");
    const links = mobileMenu?.querySelectorAll("a");

    links?.forEach((link) => {
        link.addEventListener("click", () => {
            mobileMenu?.classList.remove("open");
            menuToggle?.classList.remove("open");
            document.body.style.overflow = "auto";
            document.body.style.paddingRight = "0";
        });
    });
}
