/**
 * Lazy loading for images and videos
 * Progressive enhancement: low-res → high-res
 */

class LazyLoader {
  constructor() {
    this.observer = null;
    this.loadedImages = new Set();
    this.init();
  }

  /**
   * Initialize lazy loader
   */
  init() {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      this.loadAllImages();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    );

    this.observeImages();
    console.log('🖼️ Lazy loader initialized');
  }

  /**
   * Observe all lazy-loadable images
   */
  observeImages() {
    const images = document.querySelectorAll('img[data-high-res]');
    images.forEach((img) => this.observer.observe(img));
  }

  /**
   * Handle intersection observer entries
   */
  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.ensureLowResImage(entry.target);
        this.loadHighResImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  /**
   * Load high-resolution image
   */
  async loadHighResImage(img) {
    const highResUrl = img.dataset.highRes;
    if (!highResUrl || this.loadedImages.has(highResUrl)) {
      this.ensureLowResImage(img);
      return;
    }

    try {
      this.ensureLowResImage(img);

      // Add loading class
      img.classList.add('loading');

      // Create new image to preload
      const highResImg = new Image();
      
      highResImg.onload = () => {
        // Replace low-res with high-res
        img.src = highResUrl;
        img.classList.remove('loading');
        img.classList.add('loaded');
        
        this.loadedImages.add(highResUrl);
        
        // Trigger ad refresh after image load
        this.triggerAdRefresh('image-loaded');
        
        console.log('✅ High-res image loaded:', highResUrl);
      };

      highResImg.onerror = () => {
        img.classList.remove('loading');
        img.classList.add('error');
        console.warn('❌ Failed to load high-res image:', highResUrl);
      };

      // Start loading
      highResImg.src = highResUrl;

    } catch (error) {
      console.error('Error loading high-res image:', error);
      img.classList.remove('loading');
      img.classList.add('error');
    }
  }

  /**
   * Load all images (fallback)
   */
  loadAllImages() {
    const images = document.querySelectorAll('img[data-high-res]');
    images.forEach((img) => {
      this.ensureLowResImage(img);
      this.loadHighResImage(img);
    });
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
   * Load images in viewport immediately
   */
  loadVisibleImages() {
    const images = document.querySelectorAll('img[data-high-res]');
    images.forEach((img) => {
      const rect = img.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isVisible) {
        this.ensureLowResImage(img);
        this.loadHighResImage(img);
      }
    });
  }

  /**
   * Preload critical images
   */
  preloadCriticalImages() {
    // Preload first carousel image
    const firstCarouselImg = document.querySelector('.carousel-slide.active img[data-high-res]');
    if (firstCarouselImg) {
      this.ensureLowResImage(firstCarouselImg);
      this.loadHighResImage(firstCarouselImg);
    }

    // Preload first article images
    const firstArticleImgs = document.querySelectorAll('.article-card:first-child img[data-high-res]');
    firstArticleImgs.forEach((img) => {
      this.ensureLowResImage(img);
      this.loadHighResImage(img);
    });
  }

  /**
   * Ensure low-resolution image is visible before high-res loads
   */
  ensureLowResImage(img) {
    if (!img) return;
    const lowResUrl = img.dataset.lowRes;
    if (!lowResUrl) return;
    if (img.dataset.lowResLoaded === 'true') return;

    img.src = lowResUrl;
    img.dataset.lowResLoaded = 'true';
  }
}

// Initialize lazy loader
const lazyLoader = new LazyLoader();

// Export for global access
window.LazyLoader = lazyLoader;

// Load visible images on page load
document.addEventListener('DOMContentLoaded', () => {
  lazyLoader.loadVisibleImages();
});

// Load visible images on scroll (throttled)
let scrollTimeout;
window.addEventListener('scroll', () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  
  scrollTimeout = setTimeout(() => {
    lazyLoader.loadVisibleImages();
  }, 100);
});

// Preload critical images when page is fully loaded
window.addEventListener('load', () => {
  lazyLoader.preloadCriticalImages();
});