const { sanitizeDhaHtml, sanitizeParagraphText, stripTrailingDhaToken } = require('../../workers/dha-sanitize');

describe('DHA RSS sanitizer', () => {
  test('removes trailing (DHA) token only (keeps paragraph content)', () => {
    expect(stripTrailingDhaToken("Çalışmalar devam ediyor. (DHA)")).toBe('Çalışmalar devam ediyor.');
    expect(stripTrailingDhaToken("Çalışmalar devam ediyor.(DHA)")).toBe('Çalışmalar devam ediyor.');
    expect(stripTrailingDhaToken("Çalışmalar devam ediyor. (DHA)   ")).toBe('Çalışmalar devam ediyor.');
  });

  test('removes byline prefix at start of paragraph and keeps story text', () => {
    const p = "Yavuz YILMAZ/ İNEGÖL(Bursa), (DHA)- BURSA'nın İnegöl ilçesinde arama çalışması başlattı.";
    expect(sanitizeParagraphText(p)).toBe("BURSA'nın İnegöl ilçesinde arama çalışması başlattı.");
  });

  test('removes multi-author byline prefix and keeps story text', () => {
    const p = "Olgucan KALKAN – Ali DANAŞ / İSTANBUL,(DHA)- BEŞİKTAŞ Teknik Direktörü açıklama yaptı.";
    expect(sanitizeParagraphText(p)).toBe('BEŞİKTAŞ Teknik Direktörü açıklama yaptı.');
  });

  test('drops standalone Haber-Kamera byline paragraph', () => {
    const p1 = "Haber-Kamera: Emre ÖNCEL- Berkay YILDIZ/ SAMSUN, (DHA)-";
    const p2 = "Haber - Kamera: Tunahan KIR/ANTALYA, (DHA)";
    expect(sanitizeParagraphText(p1)).toBe('');
    expect(sanitizeParagraphText(p2)).toBe('');
  });

  test('sanitizes full HTML with multiple <p> blocks', () => {
    const html = [
      "<p>Yavuz YILMAZ/ İNEGÖL(Bursa), (DHA)- BURSA'nın İnegöl ilçesinde arama çalışması başlattı.</p>",
      "<p>Arama çalışmaları gece boyunca devam edecek. (DHA)</p>",
      "<p>Haber-Kamera: Emre ÖNCEL- Berkay YILDIZ/ SAMSUN, (DHA)-</p>"
    ].join('');

    expect(sanitizeDhaHtml(html)).toBe(
      "<p>BURSA'nın İnegöl ilçesinde arama çalışması başlattı.</p>" +
        "<p>Arama çalışmaları gece boyunca devam edecek.</p>"
    );
  });
});


