// Add loaded class to carousel once images load to prevent CLS
document.addEventListener('DOMContentLoaded', () => {
    const carousels = document.querySelectorAll('[data-widget="carousel"]');

    carousels.forEach(carousel => {
        const firstSlide = carousel.querySelector('.carousel-slide');
        if (firstSlide) {
            const firstImg = firstSlide.querySelector('img');
            if (firstImg) {
                if (firstImg.complete && firstImg.naturalHeight !== 0) {
                    carousel.classList.add('loaded');
                } else {
                    firstImg.addEventListener('load', () => {
                        carousel.classList.add('loaded');
                    }, { once: true });

                    // Fallback: mark as loaded after 2 seconds even if image doesn't load
                    setTimeout(() => {
                        carousel.classList.add('loaded');
                    }, 2000);
                }
            } else {
                carousel.classList.add('loaded');
            }
        } else {
            carousel.classList.add('loaded');
        }
    });
});
