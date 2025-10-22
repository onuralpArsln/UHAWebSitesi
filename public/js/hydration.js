/**
 * Client-side hydration for SSR content
 * Makes server-rendered content interactive
 */

class HydrationEngine {
  constructor() {
    this.widgets = new Map();
    this.initialized = false;
  }

  /**
   * Initialize hydration
   */
  init() {
    if (this.initialized) return;
    
    console.log('🚀 Starting hydration...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.hydrate());
    } else {
      this.hydrate();
    }
    
    this.initialized = true;
  }

  /**
   * Hydrate all widgets
   */
  hydrate() {
    // Find all widget containers
    const widgetContainers = document.querySelectorAll('[data-widget]');
    
    widgetContainers.forEach(container => {
      const widgetType = container.dataset.widget;
      this.hydrateWidget(widgetType, container);
    });

    // Initialize lazy loading
    if (window.LazyLoader) {
      window.LazyLoader.init();
    }

    // Initialize carousel
    if (window.Carousel) {
      window.Carousel.init();
    }

    // Initialize ad refresh
    if (window.AdRefresh) {
      window.AdRefresh.init();
    }

    console.log('✅ Hydration complete');
  }

  /**
   * Hydrate specific widget
   */
  hydrateWidget(widgetType, container) {
    switch (widgetType) {
      case 'carousel':
        this.hydrateCarousel(container);
        break;
      case 'ad':
        this.hydrateAd(container);
        break;
      case 'related-news':
        this.hydrateRelatedNews(container);
        break;
      default:
        console.warn(`Unknown widget type: ${widgetType}`);
    }
  }

  /**
   * Hydrate carousel widget
   */
  hydrateCarousel(container) {
    const track = container.querySelector('.carousel-track');
    const slides = container.querySelectorAll('.carousel-slide');
    const prevBtn = container.querySelector('.carousel-prev');
    const nextBtn = container.querySelector('.carousel-next');
    const indicators = container.querySelectorAll('.indicator');

    if (!track || slides.length === 0) return;

    let currentSlide = 0;
    const totalSlides = slides.length;

    // Show initial slide
    this.showSlide(currentSlide, slides, indicators);

    // Previous button
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        this.showSlide(currentSlide, slides, indicators);
        this.triggerAdRefresh('carousel-prev');
      });
    }

    // Next button
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentSlide = (currentSlide + 1) % totalSlides;
        this.showSlide(currentSlide, slides, indicators);
        this.triggerAdRefresh('carousel-next');
      });
    }

    // Indicators
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        currentSlide = index;
        this.showSlide(currentSlide, slides, indicators);
        this.triggerAdRefresh('carousel-indicator');
      });
    });

    // Auto-play (optional)
    this.startAutoPlay(container, () => {
      currentSlide = (currentSlide + 1) % totalSlides;
      this.showSlide(currentSlide, slides, indicators);
    });

    console.log('🎠 Carousel hydrated');
  }

  /**
   * Show specific slide
   */
  showSlide(index, slides, indicators) {
    // Hide all slides
    slides.forEach(slide => slide.classList.remove('active'));
    
    // Show current slide
    if (slides[index]) {
      slides[index].classList.add('active');
    }

    // Update indicators
    indicators.forEach(indicator => indicator.classList.remove('active'));
    if (indicators[index]) {
      indicators[index].classList.add('active');
    }
  }

  /**
   * Start auto-play
   */
  startAutoPlay(container, callback) {
    let autoPlayInterval;
    
    const startAutoPlay = () => {
      autoPlayInterval = setInterval(callback, 5000); // 5 seconds
    };

    const stopAutoPlay = () => {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
      }
    };

    // Start auto-play
    startAutoPlay();

    // Pause on hover
    container.addEventListener('mouseenter', stopAutoPlay);
    container.addEventListener('mouseleave', startAutoPlay);

    // Pause on focus
    container.addEventListener('focusin', stopAutoPlay);
    container.addEventListener('focusout', startAutoPlay);
  }

  /**
   * Hydrate ad widget
   */
  hydrateAd(container) {
    const adSlot = container.querySelector('[data-ad-slot]');
    
    if (adSlot) {
      // Initialize AdSense (placeholder)
      this.initializeAdSense(adSlot);
      console.log('📢 Ad widget hydrated');
    }
  }

  /**
   * Initialize AdSense (placeholder)
   */
  initializeAdSense(adSlot) {
    // This would be replaced with actual AdSense code
    const placeholder = adSlot.querySelector('.ad-placeholder');
    if (placeholder) {
      placeholder.innerHTML = `
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 4px;">
          <p>AdSense Ad</p>
          <small>${adSlot.dataset.adSlot}</small>
        </div>
      `;
    }
  }

  /**
   * Hydrate related news widget
   */
  hydrateRelatedNews(container) {
    const articles = container.querySelectorAll('.related-article');
    
    articles.forEach(article => {
      const link = article.querySelector('a');
      if (link) {
        link.addEventListener('click', () => {
          this.triggerAdRefresh('related-news-click');
        });
      }
    });

    console.log('📰 Related news hydrated');
  }

  /**
   * Trigger ad refresh
   */
  triggerAdRefresh(trigger) {
    if (window.AdRefresh) {
      window.AdRefresh.refresh(trigger);
    }
  }
}

// Initialize hydration when script loads
const hydration = new HydrationEngine();
hydration.init();

// Export for global access
window.HydrationEngine = HydrationEngine;