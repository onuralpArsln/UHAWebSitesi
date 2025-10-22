/**
 * AdSense refresh management
 * Handles ad refresh triggers based on user interactions
 */

class AdRefresh {
  constructor() {
    this.refreshTriggers = new Map();
    this.refreshCount = 0;
    this.maxRefreshes = 10; // AdSense policy limit
    this.refreshCooldown = 30000; // 30 seconds between refreshes
    this.lastRefresh = 0;
    this.adSlots = new Map();
  }

  /**
   * Initialize ad refresh system
   */
  init() {
    this.setupAdSlots();
    this.setupRefreshTriggers();
    console.log('📢 Ad refresh system initialized');
  }

  /**
   * Setup ad slots
   */
  setupAdSlots() {
    const adContainers = document.querySelectorAll('[data-ad-slot]');
    
    adContainers.forEach(container => {
      const slotId = container.dataset.adSlot;
      this.adSlots.set(slotId, {
        container,
        refreshCount: 0,
        lastRefresh: 0
      });
    });
  }

  /**
   * Setup refresh triggers
   */
  setupRefreshTriggers() {
    // Carousel interactions
    this.addTrigger('carousel-prev', () => this.refreshAds('carousel'));
    this.addTrigger('carousel-next', () => this.refreshAds('carousel'));
    this.addTrigger('carousel-indicator', () => this.refreshAds('carousel'));
    this.addTrigger('carousel-swipe', () => this.refreshAds('carousel'));
    this.addTrigger('carousel-autoplay', () => this.refreshAds('carousel'));

    // Image loading
    this.addTrigger('image-loaded', () => this.refreshAds('content'));

    // Related news clicks
    this.addTrigger('related-news-click', () => this.refreshAds('related'));

    // Breaking news updates
    this.addTrigger('breaking-news', () => this.refreshAds('breaking'));

    // Gallery interactions
    this.addTrigger('gallery-next', () => this.refreshAds('gallery'));
    this.addTrigger('gallery-prev', () => this.refreshAds('gallery'));

    // Poll interactions
    this.addTrigger('poll-vote', () => this.refreshAds('poll'));

    // Infinite scroll
    this.addTrigger('infinite-scroll', () => this.refreshAds('scroll'));

    // Accordion interactions
    this.addTrigger('accordion-toggle', () => this.refreshAds('accordion'));

    // Live stream interactions
    this.addTrigger('live-stream', () => this.refreshAds('live'));
  }

  /**
   * Add refresh trigger
   */
  addTrigger(triggerName, callback) {
    this.refreshTriggers.set(triggerName, callback);
  }

  /**
   * Trigger ad refresh
   */
  refresh(triggerName) {
    const trigger = this.refreshTriggers.get(triggerName);
    if (trigger) {
      trigger();
    } else {
      console.warn(`Unknown refresh trigger: ${triggerName}`);
    }
  }

  /**
   * Refresh ads with cooldown and limits
   */
  refreshAds(context = 'general') {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastRefresh < this.refreshCooldown) {
      console.log('⏳ Ad refresh on cooldown');
      return;
    }

    // Check max refreshes
    if (this.refreshCount >= this.maxRefreshes) {
      console.log('🚫 Max ad refreshes reached');
      return;
    }

    // Perform refresh
    this.performRefresh(context);
    this.refreshCount++;
    this.lastRefresh = now;

    console.log(`🔄 Ad refresh triggered (${context}) - Count: ${this.refreshCount}`);
  }

  /**
   * Perform actual ad refresh
   */
  performRefresh(context) {
    // Refresh different ad slots based on context
    switch (context) {
      case 'carousel':
        this.refreshAdSlot('carousel');
        break;
      case 'content':
        this.refreshAdSlot('main');
        this.refreshAdSlot('sidebar');
        break;
      case 'related':
        this.refreshAdSlot('related');
        break;
      case 'breaking':
        this.refreshAdSlot('breaking');
        this.refreshAdSlot('main');
        break;
      case 'gallery':
        this.refreshAdSlot('gallery');
        break;
      case 'poll':
        this.refreshAdSlot('poll');
        break;
      case 'scroll':
        this.refreshAdSlot('infinite');
        break;
      case 'accordion':
        this.refreshAdSlot('accordion');
        break;
      case 'live':
        this.refreshAdSlot('live');
        break;
      default:
        this.refreshAdSlot('main');
    }
  }

  /**
   * Refresh specific ad slot
   */
  refreshAdSlot(slotId) {
    const adSlot = this.adSlots.get(slotId);
    if (!adSlot) return;

    const now = Date.now();
    
    // Check slot-specific cooldown
    if (now - adSlot.lastRefresh < this.refreshCooldown) {
      return;
    }

    // Update slot state
    adSlot.refreshCount++;
    adSlot.lastRefresh = now;

    // Simulate ad refresh (replace with actual AdSense code)
    this.simulateAdRefresh(adSlot.container, slotId);
  }

  /**
   * Simulate ad refresh (placeholder)
   */
  simulateAdRefresh(container, slotId) {
    const placeholder = container.querySelector('.ad-placeholder');
    if (placeholder) {
      // Add loading state
      placeholder.classList.add('loading');
      
      // Simulate refresh delay
      setTimeout(() => {
        placeholder.classList.remove('loading');
        placeholder.innerHTML = `
          <div style="background: #e0e0e0; padding: 20px; text-align: center; border-radius: 4px;">
            <p>Ad Refreshed</p>
            <small>${slotId} - Refresh #${this.refreshCount}</small>
          </div>
        `;
      }, 500);
    }
  }

  /**
   * Get refresh statistics
   */
  getStats() {
    return {
      totalRefreshes: this.refreshCount,
      maxRefreshes: this.maxRefreshes,
      remainingRefreshes: this.maxRefreshes - this.refreshCount,
      lastRefresh: this.lastRefresh,
      cooldownRemaining: Math.max(0, this.refreshCooldown - (Date.now() - this.lastRefresh)),
      adSlots: Array.from(this.adSlots.entries()).map(([id, slot]) => ({
        id,
        refreshCount: slot.refreshCount,
        lastRefresh: slot.lastRefresh
      }))
    };
  }

  /**
   * Reset refresh counter (for testing)
   */
  reset() {
    this.refreshCount = 0;
    this.lastRefresh = 0;
    this.adSlots.forEach(slot => {
      slot.refreshCount = 0;
      slot.lastRefresh = 0;
    });
    console.log('🔄 Ad refresh counter reset');
  }

  /**
   * Set custom refresh limits
   */
  setLimits(maxRefreshes, cooldown) {
    this.maxRefreshes = maxRefreshes;
    this.refreshCooldown = cooldown;
    console.log(`📊 Ad refresh limits updated: ${maxRefreshes} max, ${cooldown}ms cooldown`);
  }
}

// Initialize ad refresh system
const adRefresh = new AdRefresh();

// Export for global access
window.AdRefresh = adRefresh;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  adRefresh.init();
});

// Expose stats for debugging
window.getAdStats = () => adRefresh.getStats();
window.resetAdStats = () => adRefresh.reset();