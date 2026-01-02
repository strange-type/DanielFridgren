/**
 * Initialize navbar behavior: mobile menu toggle and shy navbar on scroll
 */

// Store event handlers so we can remove them
let menuToggleHandler: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;

export function cleanupNavbar() {
    const menuToggle = document.getElementById("menu-toggle");

    if (menuToggleHandler) {
        menuToggle?.removeEventListener("click", menuToggleHandler);
    }
    if (scrollHandler) {
        window.removeEventListener("scroll", scrollHandler);
    }
}

export function initNavbar() {
    // Clean up existing listeners first
    cleanupNavbar();

    const menuToggle = document.getElementById("menu-toggle");
    const mobileMenu = document.getElementById("mobile-menu");
    const navbar = document.querySelector(".navbar");

    // Mobile menu toggle
    menuToggleHandler = () => {
        mobileMenu?.classList.toggle("open");
        menuToggle?.classList.toggle("open");
        const isOpen = mobileMenu?.classList.contains("open");

        if (isOpen) {
            const scrollbarWidth =
                window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = "hidden";
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        } else {
            document.body.style.overflow = "auto";
            document.body.style.paddingRight = "0";
        }
    };

    menuToggle?.addEventListener("click", menuToggleHandler);

    // Shy navbar behavior
    let lastScrollTop = 0;
    let ticking = false;

    scrollHandler = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    };

    const handleScroll = () => {
        const scrollTop =
            window.pageYOffset || document.documentElement.scrollTop;

        // Don't hide navbar at the very top of the page
        if (scrollTop <= 100) {
            navbar?.classList.remove("navbar-hidden");
            lastScrollTop = scrollTop;
            return;
        }

        // Scrolling down
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            navbar?.classList.add("navbar-hidden");
        }
        // Scrolling up
        else if (scrollTop < lastScrollTop) {
            navbar?.classList.remove("navbar-hidden");
        }

        lastScrollTop = scrollTop;
    };

    window.addEventListener("scroll", scrollHandler);
}
