/**
 * Mobile Menu Handler
 * Manages the mobile navigation panel open/close functionality
 */

(function () {
    'use strict';

    // Get elements
    const navToggle = document.querySelector('[data-nav-toggle]');
    const navPanel = document.querySelector('[data-nav-panel]');
    const navOverlay = document.querySelector('[data-nav-overlay]');
    const navClose = document.querySelector('[data-nav-close]');

    if (!navToggle || !navPanel || !navOverlay) {
        console.warn('Mobile menu elements not found');
        return;
    }

    /**
     * Open the mobile menu
     */
    function openMenu() {
        navPanel.hidden = false;
        navOverlay.hidden = false;

        // Use setTimeout to ensure the elements are rendered before adding the class
        setTimeout(() => {
            navPanel.classList.add('is-open');
            navOverlay.classList.add('is-open');
            navToggle.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden'; // Prevent body scroll
        }, 10);
    }

    /**
     * Close the mobile menu
     */
    function closeMenu() {
        navPanel.classList.remove('is-open');
        navOverlay.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = ''; // Restore body scroll

        // Wait for transition to complete before hiding
        setTimeout(() => {
            navPanel.hidden = true;
            navOverlay.hidden = true;
        }, 300); // Match CSS transition duration
    }

    /**
     * Toggle the mobile menu
     */
    function toggleMenu() {
        const isOpen = navPanel.classList.contains('is-open');
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // Event listeners
    navToggle.addEventListener('click', toggleMenu);

    if (navClose) {
        navClose.addEventListener('click', closeMenu);
    }

    navOverlay.addEventListener('click', closeMenu);

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navPanel.classList.contains('is-open')) {
            closeMenu();
        }
    });

    // Close menu when clicking on a navigation link
    const navLinks = navPanel.querySelectorAll('a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            closeMenu();
        });
    });

})();
