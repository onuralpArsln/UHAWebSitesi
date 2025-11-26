class Carousel {
  constructor(element) {
    this.element = element;
    this.track = element.querySelector('.carousel-track');
    this.slides = Array.from(element.querySelectorAll('.carousel-slide'));
    this.indicators = Array.from(element.querySelectorAll('.indicator'));
    this.prevBtn = element.querySelector('.carousel-prev');
    this.nextBtn = element.querySelector('.carousel-next');

    this.currentIndex = 0;
    this.slideCount = this.slides.length;

    // Config
    this.autoPlayEnabled = element.dataset.autoplay === 'true';
    this.autoPlayDelay = parseInt(element.dataset.delay) || 5000;
    this.intervalId = null;

    // Touch state
    this.touchStartX = 0;
    this.touchEndX = 0;

    this.init();
  }

  init() {
    if (this.slideCount === 0) return;

    // Event Listeners
    this.prevBtn?.addEventListener('click', () => {
      this.prevSlide();
      this.resetAutoPlay();
    });

    this.nextBtn?.addEventListener('click', () => {
      this.nextSlide();
      this.resetAutoPlay();
    });

    this.indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        this.goToSlide(index);
        this.resetAutoPlay();
      });
    });

    // Touch Support
    this.track.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
      this.stopAutoPlay();
    }, { passive: true });

    this.track.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
      this.startAutoPlay();
    }, { passive: true });

    // Pause on hover
    this.element.addEventListener('mouseenter', () => this.stopAutoPlay());
    this.element.addEventListener('mouseleave', () => this.startAutoPlay());

    // Start
    this.updateSlides();
    this.startAutoPlay();
  }

  handleSwipe() {
    const threshold = 50;
    if (this.touchEndX < this.touchStartX - threshold) {
      this.nextSlide();
    } else if (this.touchEndX > this.touchStartX + threshold) {
      this.prevSlide();
    }
  }

  goToSlide(index) {
    // Handle wrapping
    if (index < 0) index = this.slideCount - 1;
    if (index >= this.slideCount) index = 0;

    this.currentIndex = index;
    this.updateSlides();
  }

  nextSlide() {
    this.goToSlide(this.currentIndex + 1);
  }

  prevSlide() {
    this.goToSlide(this.currentIndex - 1);
  }

  updateSlides() {
    // Update classes
    this.slides.forEach((slide, index) => {
      if (index === this.currentIndex) {
        slide.classList.add('active');
        slide.style.display = 'block'; // Ensure visibility
      } else {
        slide.classList.remove('active');
        slide.style.display = 'none';
      }
    });

    // Update indicators
    this.indicators.forEach((indicator, index) => {
      if (index === this.currentIndex) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });
  }

  startAutoPlay() {
    if (this.autoPlayEnabled && !this.intervalId) {
      this.intervalId = setInterval(() => {
        this.nextSlide();
      }, this.autoPlayDelay);
    }
  }

  stopAutoPlay() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resetAutoPlay() {
    this.stopAutoPlay();
    this.startAutoPlay();
  }
}

// Initialize all carousels
document.addEventListener('DOMContentLoaded', () => {
  const carousels = document.querySelectorAll('[data-widget="carousel"]');
  carousels.forEach(el => new Carousel(el));
});