# UHA News Website - High Performance SSR News System

## 🚀 How to Start

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your AdSense settings

# 3. Start development server
npm run dev
# Server will start on http://localhost:3000

# 4. Access CMS panel
# Visit http://localhost:3000/cms
```

### Production Deployment
```bash
# 1. Build for production
npm run build

# 2. Start with PM2 (recommended for Hostinger)
pm2 start server/index.js --name "uha-news"

# 3. Or use Hostinger's Node.js manager
# Upload files and configure in Hostinger control panel
```

### Environment Configuration
Create `.env` file with:
```env
NODE_ENV=production
PORT=3000
SITE_URL=https://yourdomain.com
SITE_NAME=UHA News
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxx
ADSENSE_SLOT_ID=xxxxxxxxxx
```

### Database
The application uses SQLite3 for data storage. The database file (`data/news.db`) is automatically created on first run. All articles and categories are stored locally in the database - no external backend required.

### Features Overview
- ✅ **Custom SSR Engine** - React-like templating with server-side rendering
- ✅ **SEO Optimized** - JSON-LD schemas, meta tags, sitemaps, friendly URLs
- ✅ **Performance** - LCP < 2s, FID < 100ms, CLS < 0.1, Lighthouse > 90
- ✅ **AdSense Ready** - Smart refresh triggers, lazy loading, mobile optimization
- ✅ **CMS Panel** - Content management with drag-drop layout designer
- ✅ **Progressive Loading** - Low-res WebP → high-res async loading
- ✅ **Widget System** - Carousel, ads, related news, comments

---

# Geliştirici kuralları

Lazy load images
SSR - hmtl injection for elements, content, image alts and content for seo

### Reklam Yenileme Stratejisi
Adsense policy içinde kalarak yenileme miktarı arrtırmak 
Yenileme tetikleri
- [ ] Manşet carouselda kullanıcı tıklamasına bağlı değişiklik
- [ ] Reklamlar Lazy loading içerikten sonra yüklenecek
- [ ] İlgili haberler (sentence transformer ile) önerisi sayfa yenileme teşviki ve in-feed reklam 
- [ ] Özellikle mobilde ilk 1 alanda reklam yok
- [ ] Metin + Görsel + Native + In-feed
- [ ] Son dakika haberi düştükçe içerik bazlı yenileme başlat etkileşimde reklam yenile 
- [ ] Akordiyon, canlı yayın vs ile etkileşimde yenileme
- [ ] Sayfa sonunda otomatik yeni içerik ve reklam
- [ ] Haber resimleri galeri olsun, geçişte reklam
- [ ] Anket tıklaması ile reklam ( Haberlerde anket ? )


### SEO yapılacaklar 
Mobil site başarısı seo için daha önemli
Yapay zeka sayesinde hızlı haber girişi

https://search.google.com/test/rich-results testi 
Habere ait sayfanın <head> veya <body> etiketinde JSON-LD formatında (JavaScript Nesne Gösterimi - Bağlı Veri) ekle, NewsArticle şeması kullan


Largest Contentful Paint (LCP)  en büyük görsel ya da metin öğesinin ekranda görünür hale gelme süresi. Hedef: 2 saniye veya daha az Görselleri sıkıştır (WebP kullan)

First Input Delay (FID) JS dosyalarını parçala (code splitting) Kullanıcı etkileşimiyle alakalı olmayan scriptleri “defer” et


Cumulative Layout Shift (CLS) Her resme genişlik ve yükseklik değerini HTML’de ver Reklamlar ve embed’ler için sabit alan (placeholder) ayır Font yüklenmeden önce “flash” yaşanmaması için font-display: swap kullan

Mutlaka alt metin yaz  jhabe başlığını Haber görsellerine alt metin ekle
<img alt="İzmir depremi 5.2 büyüklüğünde">
Görsel arama trafiği azımsanmayacak kadar kazançlıdır.


Hızlı Dizin Oluşturma (Indexing) için Araç Kullanımı: Google'ın haber akışına girmek ve içeriğinizin anında dizine eklenmesini sağlamak için Google News Publisher Center ve Search Console'daki uygun araçları ve API'leri (varsa) etkin bir şekilde kullanın.


Başlıkta anahtar kelimeyi erken kullan
Haber başlığının ilk 60 karakterinde asıl kelimeyi geçir.
“Deprem oldu” değil; “İzmir’de 5.2 büyüklüğünde deprem oldu” gibi.
Google kısa başlıklara değil, anlamlı başlıklara âşık.

Haber URL’leri kısa ve temiz olmalı
/haber/12345?id=6789 değil,
/izmir-5-2-buyuklugunde-deprem-oldu gibi.
Bu hem SEO hem sosyal medya paylaşımı için altın değerinde.

Schema.org yapılandırılmış veri ekle
Haber sitelerinde “Article”, “NewsArticle”, “BreadcrumbList” şemaları olmazsa olmaz.
Google News ve Discover’da görünürlük sağlar.

Haber özetlerini düzgün yaz
<meta name="description"> etiketiyle özet ekle.
140–160 karakter arası, anahtar kelimeyi doğal geçir, clickbait değil bilgi içersin.

Hız (PageSpeed) kutsaldır
Lighthouse skorun 90+ olmalı.
Resimleri sıkıştır, JS’yi ertele

habere tarih ekle: “Güncelleme: 21 Ekim 2025”

İç linkleme (contextual linking)
Her haber, en az iki benzer habere link versin.
Hem SEO hem kullanıcı tutma süresi için doping etkisi.

Site haritası (sitemap.xml + news-sitemap.xml)
Google News için özel sitemap oluştur.
Yeni haberler anında dizine girer, “freshness score” yükselir.


Anahtar kelime doldurma (keyword stuffing)
“Deprem oldu, deprem İzmir, deprem haberleri…”
Google 2005’te bu oyunu çözmüştü. Artık cezalandırıyor.

Tüm sayfalarda aynı meta description varsa,
Google hangisini göstereceğini şaşırır, sen de sıralamada düşersin.



Yorum alanı olan siteler, “aktif topluluk” olarak görülür.
Engagement sinyalleri SEO’ya direkt katkıdır.
Gerçek kullanıcıyı yorum yapmaya teşvik et:
Yazının sonunda minik bir soru bırak: “Sizce bu olayda kim haklıydı?” ( belki iki üç controversial yorumu ekle ya da editörlerimizden yorumlar yz ile )
