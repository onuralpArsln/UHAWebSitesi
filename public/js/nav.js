(function () {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;

  const toggle = header.querySelector('[data-nav-toggle]');
  const panel = header.querySelector('[data-nav-panel]');
  const closeBtn = header.querySelector('[data-nav-close]');
  const overlay = header.querySelector('[data-nav-overlay]');

  if (!toggle || !panel) return;

  const TRANSITION_DURATION = 300;
  let lastFocusedElement = null;
  let closeTimer = null;

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function setHiddenState(element, isHidden) {
    if (!element) return;
    if (isHidden) {
      element.setAttribute('hidden', '');
    } else {
      element.removeAttribute('hidden');
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;

    const focusable = panel.querySelectorAll(focusableSelectors);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openNav() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    lastFocusedElement = document.activeElement;

    setHiddenState(panel, false);
    setHiddenState(overlay, false);

    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      overlay && overlay.classList.add('is-open');
    });

    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    panel.addEventListener('keydown', trapFocus);
    document.addEventListener('keydown', handleEscape);

    if (closeBtn) {
      closeBtn.focus();
    } else {
      const focusable = panel.querySelector(focusableSelectors);
      focusable && focusable.focus();
    }
  }

  function closeNav() {
    panel.classList.remove('is-open');
    overlay && overlay.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    panel.removeEventListener('keydown', trapFocus);
    document.removeEventListener('keydown', handleEscape);

    closeTimer = window.setTimeout(() => {
      setHiddenState(panel, true);
      setHiddenState(overlay, true);
      if (lastFocusedElement) {
        lastFocusedElement.focus({ preventScroll: true });
      } else {
        toggle.focus({ preventScroll: true });
      }
      closeTimer = null;
    }, TRANSITION_DURATION);
  }

  function handleEscape(event) {
    if (event.key === 'Escape') {
      closeNav();
    }
  }

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeNav();
    } else {
      openNav();
    }
  });

  closeBtn && closeBtn.addEventListener('click', closeNav);
  overlay && overlay.addEventListener('click', closeNav);

  panel.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform' && !panel.classList.contains('is-open')) {
      setHiddenState(panel, true);
    }
  });
})();

