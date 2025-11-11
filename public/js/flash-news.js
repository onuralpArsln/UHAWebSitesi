/**
 * Flash News ticker controller
 * Keeps marquee speed consistent across screen sizes and handles hover slowdown.
 */
class FlashNewsTicker {
  constructor() {
    this.widgets = [];
    this.hoverTimers = new WeakMap();
    this.resizeRaf = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const widgets = document.querySelectorAll('[data-widget="flash-news"]');
    widgets.forEach((widget) => {
      this.setupWidget(widget);
      this.widgets.push(widget);
    });

    if (this.widgets.length === 0) {
      return;
    }

    window.addEventListener('resize', () => this.handleResize());
  }

  setupWidget(widget) {
    const track = widget.querySelector('.flash-news__track');
    const ticker = widget.querySelector('.flash-news__ticker');

    if (!track || !ticker) return;

    const speed = parseFloat(widget.dataset.speed) || 60;
    const duplicates = parseInt(widget.dataset.duplicates, 10) || 2;

    this.cloneItems(track, ticker, duplicates);
    this.calculateAnimation(widget, track, ticker, speed);
    this.bindHover(widget);
  }

  cloneItems(track, ticker, duplicates) {
    // Remove previous clones
    track.querySelectorAll('[data-clone="true"]').forEach((clone) => clone.remove());

    const originals = Array.from(track.children);
    if (originals.length === 0) return;

    const baseFragment = document.createDocumentFragment();
    for (let i = 0; i < duplicates; i += 1) {
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('data-clone', 'true');
        baseFragment.appendChild(clone);
      });
    }
    track.appendChild(baseFragment);

    // Ensure track is long enough for wide screens
    const maxExtraLoops = 6;
    let loops = 0;
    while (track.scrollWidth < ticker.clientWidth * 2 && loops < maxExtraLoops) {
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute('data-clone', 'true');
        track.appendChild(clone);
      });
      loops += 1;
    }
  }

  calculateAnimation(widget, track, ticker, speed) {
    // Force layout to ensure scrollWidth is up to date
    const fullWidth = track.scrollWidth;
    const baseCount = track.querySelectorAll('.flash-news__item:not([data-clone="true"])').length;
    const cloneCount = track.querySelectorAll('.flash-news__item[data-clone="true"]').length;
    const sets = baseCount > 0 ? cloneCount / baseCount + 1 : 1;
    const segmentWidth = sets > 0 ? fullWidth / sets : fullWidth;

    const distance = segmentWidth > 0 ? segmentWidth : ticker.clientWidth;
    const pixelsPerSecond = speed > 0 ? speed : 60;
    const durationSec = distance / pixelsPerSecond;

    const baseDuration = Math.max(durationSec, 12); // minimum duration safeguard

    widget.dataset.baseDuration = baseDuration;
    widget.style.setProperty('--flash-news-offset', `${distance}px`);
    widget.style.setProperty('--flash-news-duration', `${baseDuration}s`);
  }

  bindHover(widget) {
    const pauseDelay = parseInt(widget.dataset.pauseDelay, 10) || 200;

    const enter = () => {
      const existing = this.hoverTimers.get(widget);
      if (existing) {
        window.clearTimeout(existing.timeoutId);
      }

      const baseDuration = parseFloat(widget.dataset.baseDuration) || 20;

      widget.classList.add('is-slowing');
      widget.classList.remove('is-paused');
      widget.style.setProperty('--flash-news-duration', `${baseDuration * 2}s`);

      const timeoutId = window.setTimeout(() => {
        widget.classList.add('is-paused');
      }, pauseDelay);

      this.hoverTimers.set(widget, { timeoutId, baseDuration });
    };

    const exit = () => {
      const stored = this.hoverTimers.get(widget);
      if (stored) {
        window.clearTimeout(stored.timeoutId);
        widget.style.setProperty('--flash-news-duration', `${stored.baseDuration}s`);
        this.hoverTimers.delete(widget);
      }

      widget.classList.remove('is-paused');
      widget.classList.remove('is-slowing');
    };

    widget.addEventListener('mouseenter', enter);
    widget.addEventListener('mouseleave', exit);
    widget.addEventListener('focusin', enter);
    widget.addEventListener('focusout', exit);

    widget.addEventListener(
      'touchstart',
      () => {
        enter();
        window.setTimeout(() => exit(), 1500);
      },
      { passive: true }
    );
  }

  handleResize() {
    if (this.resizeRaf) {
      window.cancelAnimationFrame(this.resizeRaf);
    }

    this.resizeRaf = window.requestAnimationFrame(() => {
      this.widgets.forEach((widget) => {
        const track = widget.querySelector('.flash-news__track');
        const ticker = widget.querySelector('.flash-news__ticker');
        if (!track || !ticker) return;

        this.cloneItems(track, ticker, parseInt(widget.dataset.duplicates, 10) || 2);
        this.calculateAnimation(widget, track, ticker, parseFloat(widget.dataset.speed) || 60);
      });
    });
  }
}

// Initialize ticker
const flashNewsTicker = new FlashNewsTicker();
window.FlashNewsTicker = flashNewsTicker;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => flashNewsTicker.init());
} else {
  flashNewsTicker.init();
}

