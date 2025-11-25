const urlSlugService = require('../../server/services/url-slug');

describe('URLSlugService', () => {
    beforeEach(() => {
        // Clear cache if possible or mock internal state
        // Since it's a singleton, we might need to be careful.
        // Ideally, we would reset the singleton, but for now we test its behavior.
    });

    test('should generate a slug from title', () => {
        const title = 'Test Haber Başlığı';
        const slug = urlSlugService.generateSlug(title);
        expect(slug).toBe('test-haber-basligi');
    });

    test('should handle special characters', () => {
        const title = 'Şampiyon Beşiktaş & Fenerbahçe!';
        const slug = urlSlugService.generateSlug(title);
        expect(slug).toBe('sampiyon-besiktas-and-fenerbahce');
    });

    test('should be a singleton', () => {
        const anotherInstance = require('../../server/services/url-slug');
        expect(urlSlugService).toBe(anotherInstance);
    });
});
