/**
 * Carousel functionality
 * Handles navigation, auto-play, and ad refresh triggers
 */

class Carousel {
  constructor() {
    this.carousels = new Map();
    this.autoPlayIntervals = new Map();
  }

  /**
   * Initialize all carousels
   */
  init() {
    const carouselWidgets = document.querySelectorAll('[data-widget="carousel"]');
    
    carouselWidgets.forEach((widget, index) => {
      this.initCarousel(widget, index);
    });

    console.log('🎠 Carousels initialized');
  }

  /**
   * Initialize single carousel
   */
  initCarousel(widget, index) {
    const track = widget.querySelector('.carousel-track');
    const slides = widget.querySelectorAll('.carousel-slide');
    const prevBtn = widget.querySelector('.carousel-prev');
    const nextBtn = widget.querySelector('.carousel-next');
    const indicators = widget.querySelectorAll('.indicator');

    if (!track || slides.length === 0) return;

    const carousel = {
      widget,
      track,
      slides,
      prevBtn,
      nextBtn,
      indicators,
      currentSlide: 0,
      totalSlides: slides.length,
      isAutoPlaying: true,
      autoPlayDelay: 5000
    };

    this.carousels.set(index, carousel);
    this.setupCarouselEvents(carousel);
    this.loadCurrentSlideImage(carousel);
    this.startAutoPlay(carousel);
  }

  /**
   * Setup carousel event listeners
   */
  setupCarouselEvents(carousel) {
    const { prevBtn, nextBtn, indicators } = carousel;

    // Previous button
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.previousSlide(carousel);
        this.triggerAdRefresh('carousel-prev');
      });
    }

    // Next button
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.nextSlide(carousel);
        this.triggerAdRefresh('carousel-next');
      });
    }

    // Indicators
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        this.goToSlide(carousel, index);
        this.triggerAdRefresh('carousel-indicator');
      });
    });

    // Keyboard navigation
    carousel.widget.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          this.previousSlide(carousel);
          this.triggerAdRefresh('carousel-keyboard');
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.nextSlide(carousel);
          this.triggerAdRefresh('carousel-keyboard');
          break;
      }
    });

    // Pause auto-play on hover
    carousel.widget.addEventListener('mouseenter', () => {
      this.pauseAutoPlay(carousel);
    });

    carousel.widget.addEventListener('mouseleave', () => {
      this.resumeAutoPlay(carousel);
    });

    // Pause auto-play on focus
    carousel.widget.addEventListener('focusin', () => {
      this.pauseAutoPlay(carousel);
    });

    carousel.widget.addEventListener('focusout', () => {
      this.resumeAutoPlay(carousel);
    });

    // Touch/swipe support
    this.setupTouchEvents(carousel);
  }

  /**
   * Setup touch events for mobile
   */
  setupTouchEvents(carousel) {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    carousel.widget.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    });

    carousel.widget.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
      
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Only trigger if horizontal swipe is more significant than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.previousSlide(carousel);
        } else {
          this.nextSlide(carousel);
        }
        this.triggerAdRefresh('carousel-swipe');
      }
    });
  }

  /**
   * Go to next slide
   */
  nextSlide(carousel) {
    carousel.currentSlide = (carousel.currentSlide + 1) % carousel.totalSlides;
    this.updateCarousel(carousel);
  }

  /**
   * Go to previous slide
   */
  previousSlide(carousel) {
    carousel.currentSlide = (carousel.currentSlide - 1 + carousel.totalSlides) % carousel.totalSlides;
    this.updateCarousel(carousel);
  }

  /**
   * Go to specific slide
   */
  goToSlide(carousel, index) {
    if (index >= 0 && index < carousel.totalSlides) {
      carousel.currentSlide = index;
      this.updateCarousel(carousel);
    }
  }

  /**
   * Update carousel display
   */
  updateCarousel(carousel) {
    const { slides, indicators, currentSlide } = carousel;

    // Update slides
    slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === currentSlide);
    });

    // Update indicators
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === currentSlide);
    });

    // Update button states
    this.updateButtonStates(carousel);

    // Load high-res image for current slide
    this.loadCurrentSlideImage(carousel);
  }

  /**
   * Update button states
   */
  updateButtonStates(carousel) {
    const { prevBtn, nextBtn, currentSlide, totalSlides } = carousel;

    if (prevBtn) {
      prevBtn.disabled = currentSlide === 0;
    }

    if (nextBtn) {
      nextBtn.disabled = currentSlide === totalSlides - 1;
    }
  }

  /**
   * Load high-res image for current slide
   */
  loadCurrentSlideImage(carousel) {
    const currentSlide = carousel.slides[carousel.currentSlide];
    if (currentSlide) {
      const img = currentSlide.querySelector('img[data-high-res]');
      if (img && window.LazyLoader) {
        window.LazyLoader.ensureLowResImage(img);
        window.LazyLoader.loadHighResImage(img);
      }
    }

    const nextSlide = carousel.slides[carousel.currentSlide + 1];
    if (nextSlide) {
      const nextImg = nextSlide.querySelector('img[data-high-res]');
      if (nextImg && window.LazyLoader) {
        window.LazyLoader.ensureLowResImage(nextImg);
      }
    }
  }

  /**
   * Start auto-play
   */
  startAutoPlay(carousel) {
    if (carousel.totalSlides <= 1) return;

    const interval = setInterval(() => {
      if (carousel.isAutoPlaying) {
        this.nextSlide(carousel);
        this.triggerAdRefresh('carousel-autoplay');
      }
    }, carousel.autoPlayDelay);

    this.autoPlayIntervals.set(carousel, interval);
  }

  /**
   * Pause auto-play
   */
  pauseAutoPlay(carousel) {
    carousel.isAutoPlaying = false;
  }

  /**
   * Resume auto-play
   */
  resumeAutoPlay(carousel) {
    carousel.isAutoPlaying = true;
  }

  /**
   * Stop auto-play
   */
  stopAutoPlay(carousel) {
    const interval = this.autoPlayIntervals.get(carousel);
    if (interval) {
      clearInterval(interval);
      this.autoPlayIntervals.delete(carousel);
    }
    carousel.isAutoPlaying = false;
  }

  /**
   * Trigger ad refresh
   */
  triggerAdRefresh(trigger) {
    if (window.AdRefresh) {
      window.AdRefresh.refresh(trigger);
    }
  }

  /**
   * Destroy carousel
   */
  destroy(carousel) {
    this.stopAutoPlay(carousel);
    this.carousels.delete(carousel);
  }

  /**
   * Get carousel by index
   */
  getCarousel(index) {
    return this.carousels.get(index);
  }

  /**
   * Get all carousels
   */
  getAllCarousels() {
    return Array.from(this.carousels.values());
  }
}

// Initialize carousel when script loads
const carousel = new Carousel();

// Export for global access
window.Carousel = carousel;