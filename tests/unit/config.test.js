const config = require('../../server/services/config');

describe('ConfigService', () => {
    test('should return default server config', () => {
        const serverConfig = config.getServerConfig();
        expect(serverConfig).toHaveProperty('port');
        expect(serverConfig).toHaveProperty('nodeEnv');
    });

    test('should return CMS tabs configuration', () => {
        const tabs = config.getCmsTabs();
        expect(Array.isArray(tabs)).toBe(true);
        expect(tabs.length).toBeGreaterThan(0);
        expect(tabs[0]).toHaveProperty('id');
        expect(tabs[0]).toHaveProperty('permission');
    });

    test('should detect site URL from request', () => {
        const mockReq = {
            get: jest.fn().mockReturnValue('example.com'),
            protocol: 'http',
            headers: {}
        };
        const url = config.getSiteUrl(mockReq);
        expect(url).toBe('http://example.com');
    });

    test('should detect HTTPS from headers', () => {
        const mockReq = {
            get: jest.fn().mockReturnValue('example.com'),
            headers: {
                'x-forwarded-proto': 'https'
            }
        };
        const isHttps = config.isHttps(mockReq);
        expect(isHttps).toBe(true);
    });
});
