# UHA Haber Sitesi - Yüksek Performanslı SSR Haber Sistemi

## How to Launch
- `npm install`
- Copy `.env.example` to `.env` (opsiyonel); en azından `PORT` ve `SITE_URL` ayarlarını yap
- Geliştirme için `npm run dev`, production için `node server/index.js` veya `pm2 start server/index.js --name uha-news`
- Site `http://localhost:3000` adresinde, CMS `http://localhost:3000/cms` altında açılır

## How to Use
- Haberleri, kategorileri ve site ayarlarını yönetmek için CMS panelini (`/cms`) kullan
- Logo ve renkleri CMS panelindeki **Marka** sekmesinden yükleyip önizleyerek kaydet
- Frontend otomatik olarak SSR ile haberleri yayınlar; URL slug’ları ve sitemap’ler arka planda üretilir
- Yeni veriler SQLite veritabanına (`data/news.db`) kaydedilir ve ilk çalıştırmada otomatik oluşturulur

## 📋 Mevcut Durum

**Bağımsız Haber Sitesi** - Bu, tam özellikli, kendi kendine yeten bir haber sitesidir:
- ✅ **SQLite3 Veritabanı** - Tüm veriler yerel olarak saklanır, harici backend gerekmez
- ✅ **Editör CMS Paneli** - Tam özellikli içerik yönetim sistemi
- ✅ **Halka Açık Frontend** - Ziyaretçiler için SEO optimize edilmiş haber sitesi
- ✅ **Sunucu Tarafı Render** - Nunjucks tabanlı şablon sistemi ile hızlı SSR
- ✅ **Mobil Öncelikli Arayüzler** - Frontend ve CMS ekranları küçük cihazlardan başlayarak tasarlandı

## 🏗️ Mimari

### Teknoloji Yığını
- **Backend**: Node.js + Express
- **Veritabanı**: SQLite3 (better-sqlite3)
- **Şablonlama**: Nunjucks + makrolar (React benzeri fragment yapısı)
- **Depolama**: Dosya tabanlı SQLite veritabanı (`data/news.db`)

### Proje Yapısı
```
UHAWebSitesi/
├── server/              # Backend sunucu kodu
│   ├── index.js        # Ana sunucu giriş noktası
│   ├── routes/         # API ve sayfa route'ları
│   │   ├── api.js      # Halka açık API endpoint'leri
│   │   ├── cms.js      # CMS API endpoint'leri
│   │   └── pages.js    # Frontend sayfa route'ları
│   ├── services/       # İş mantığı
│   │   ├── data-service.js    # SQLite3 veritabanı servisi
│   │   ├── url-slug.js        # URL slug yönetimi
│   │   ├── sitemap.js         # Sitemap oluşturma
│   │   └── view-helpers.js    # Meta & JSON-LD yardımcıları
├── public/             # Halka açık website varlıkları
│   ├── css/            # Frontend (mobil-öncelikli) temel stiller
│   ├── js/             # Frontend etkileşimleri (lazy load, carousel vb.)
│   ├── cms/            # CMS paneline özel stiller ve JavaScript
│   └── uploads/        # CMS üzerinden yüklenen dosyalar
│       └── branding/   # Logo ve marka varlıkları (otomatik oluşturulur)
├── templates/          # HTML şablonları
│   ├── layouts/        # Ortak layout'lar (frontend + CMS)
│   ├── pages/          # Frontend sayfaları (home, article, category, search)
│   ├── widgets/        # Frontend için makro tabanlı fragment'lar
│   └── cms/            # CMS paneli layout ve bileşen makroları
└── data/               # Veritabanı depolama (gitignore)
    └── news.db         # SQLite3 veritabanı dosyası
```

### Frontend / CMS Ayrımı
- **Frontend** (Ziyaretçi arayüzü): `public/css/main.css`, `public/js/*.js`, `templates/pages/*`, `templates/widgets/*`
- **CMS** (İçerik editörü arayüzü): `public/cms/css/cms.css`, `public/cms/js/cms-app.js`, `templates/cms/**/*`
- Her iki yüzey de mobil-öncelikli olup, geniş ekran iyileştirmeleri için yalnızca `min-width` breakpoint'leri kullanır.

## 🚀 Nasıl Başlatılır

### Hızlı Başlangıç
```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Ortam yapılandırması (opsiyonel)
# Ayarlarınızla .env dosyası oluşturun (aşağıdaki Ortam Yapılandırması bölümüne bakın)

# 3. Geliştirme sunucusunu başlat
npm run dev
# Sunucu http://localhost:3000 adresinde başlayacak

# 4. CMS paneline eriş
# http://localhost:3000/cms adresini ziyaret edin
```

### Production Dağıtımı
```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Ortam değişkenlerini yapılandır
# Production ayarlarıyla .env dosyası oluşturun

# 3. PM2 ile başlat (önerilen)
pm2 start server/index.js --name "uha-news"

# 4. Veya Node.js process manager kullan
node server/index.js
```

### Ortam Yapılandırması
`.env` dosyası oluşturun:
```env
NODE_ENV=production
PORT=3000
SITE_URL=https://yourdomain.com
SITE_NAME=UHA News
SITE_DESCRIPTION=Son haberler ve güncellemeler
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxx
ADSENSE_SLOT_ID=xxxxxxxxxx
# Uygulama bir alt yol altında servis ediliyorsa (ör. /projects/uhawebsite) ayarlayın
# Kökten servis ediliyorsa boş bırakın veya değişkeni eklemeyin
BASE_PATH=/projects/uhawebsite
```

## 💾 Veritabanı Şeması

### Makaleler Tablosu
Veritabanı SQLite3 kullanır ve aşağıdaki makale yapısına sahiptir:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | TEXT (PK) | Benzersiz makale tanımlayıcısı |
| `header` | TEXT | Makale başlığı |
| `summaryHead` | TEXT | Özet bölümü için kısa başlık |
| `summary` | TEXT | Makale özeti (140-160 karakter önerilir) |
| `category` | TEXT | Makale kategorisi |
| `tags` | TEXT (JSON) | Etiket/anahtar kelime dizisi |
| `body` | TEXT | Tam makale içeriği (HTML) |
| `images` | TEXT (JSON) | URL, alt metin vb. içeren görsel nesneleri dizisi |
| `writer` | TEXT | Yazar/yazıcı adı |
| `creationDate` | TEXT | Yayın tarihi (ISO 8601) |
| `source` | TEXT | Haber kaynağı |
| `outlinks` | TEXT (JSON) | Harici link dizisi |
| `targettedViews` | TEXT (JSON) | Makalenin gösterileceği yerler (homepage, breaking-news, category, sidebar) |
| `updatedAt` | TEXT | Son güncelleme zaman damgası |
| `relatedArticles` | TEXT (JSON) | İlgili makale ID'leri dizisi |

**Not**: Geriye dönük uyumluluk için eski alanlar (`title`, `content`, `author`, `publishedAt`, `keywords`) korunmaktadır.

### Kategoriler Tablosu
| Alan | Tip | Açıklama |
|------|-----|----------|
| `id` | TEXT (PK) | Benzersiz kategori tanımlayıcısı |
| `name` | TEXT | Kategori adı (benzersiz) |
| `description` | TEXT | Kategori açıklaması |
| `slug` | TEXT | URL dostu slug |
| `articleCount` | INTEGER | Kategorideki makale sayısı |

### Veritabanı Konumu
- **Dosya**: `data/news.db`
- **Otomatik Oluşturma**: Veritabanı ve tablolar ilk çalıştırmada otomatik oluşturulur
- **Migrasyon**: Mevcut mock veriler ilk başlatmada veritabanına aktarılır
- **Yedekleme**: `data/` dizini gitignore'da - veritabanı dosyanızı düzenli olarak yedekleyin

## 📝 CMS Editör Paneli

### Erişim
Editör paneline erişmek için `http://localhost:3000/cms` adresini ziyaret edin.

### Özellikler

#### Makale Yönetimi
- **Tüm Makaleleri Görüntüle**: Tablo, başlık/kategori/muhabir/durum bilgilerini listeler
- **Yeni Haber Ekle**: `Yeni Haber` butonu aşağıdaki alanlarla modern formu açar:
  - **Başlık (`header`)** – zorunlu, haber başlığı
  - **Özet Başlık (`summaryHead`)** – opsiyonel, listelerde kullanılan yardımcı başlık
  - **Özet (`summary`)** – kart görünümleri için kısa açıklama
  - **Metin (`body`)** – zorunlu, haberin tamamı (HTML desteklenir)
  - **Kategori (`category`)** – zorunlu, mevcut kategorilerden seçim
  - **Etiketler (`tags`)** – virgülle ayrılmış anahtar kelimeler
  - **Görseller (`images`)** – JSON dizi veya satır başına URL
  - **Video (`videoUrl`)** – gömülü oynatıcı için video bağlantısı
  - **Kaynak (`source`)** – haber kaynağı
  - **Muhabir (`writer`)** – içeriği hazırlayan kişi
  - **Durum (`status`)** – `Yayında` veya `Gizli`
  - **Basın İlan ID (`pressAnnouncementId`)** – özel duyuru numarası (opsiyonel)
  - **Hedef (`targettedViews`)** – carousel, manşet, akış vb. alanlar için çoklu seçim
  - **Dış Bağlantılar (`outlinks`)** – referans URL listesi
- **Makale Düzenle**: Satırdaki `Düzenle` butonuyla tüm alanları güncelleyerek formu açar
- **Makale Sil**: Onay diyaloğu ile kalıcı olarak kaldırır
- **Kaydetmeden Ayrılma Koruması**: Tam sayfa editör, yanlış tıklamalarla kapanmaz; `İptal` ile güvenle listeye dönebilirsiniz

#### Dashboard
- İstatistik özeti (toplam makaleler, kategoriler)
- Son makaleler listesi
- Tüm bölümlere hızlı erişim

#### Kategori Yönetimi
- Tüm kategorileri görüntüle
- Yeni kategori oluştur
- Kategorileri düzenle/sil

#### Ayarlar
- Site yapılandırması
- AdSense ayarları
- Site metadata

#### Marka Yönetimi
- **Site Adı**: Logo ile birlikte tüm frontend'de kullanılan başlık metni
- **Renk Paleti**: Birincil, ikincil ve vurgu renkleri için canlı renk seçimleri (CSS değişkenleri anında güncellenir)
- **Logo Yükleme**: Üst menü ve footer için ayrı logo alanları; PNG, JPG, WEBP veya SVG dosyaları desteklenir
- **Canlı Önizleme**: Yüklediğiniz görseller ve renkler kaydetmeden önce panel içerisinde gösterilir
- **Dosya Konumu**: Yüklenen logolar `public/uploads/branding/` dizinine kaydedilir; mevcut logolar yenileriyle otomatik olarak değiştirilir
- **Manuel Güncelleme**: Aynı klasöre elle logo dosyası atılabilir; yeni dosyanın kullanılabilmesi için CMS üzerinden kaydetmeyi unutmayın

### Şablon & Bileşen Yapısı
- `templates/cms/layouts/base.njk` – CMS sayfaları için temel şablon
- `templates/cms/components/` – sidebar, topbar, tablo ve formları içeren makrolar
- `templates/cms/pages/dashboard.njk` – panelde render edilen ana sayfa
- `public/cms/` – panelin stil ve javascript dosyaları

### CMS Form İpuçları
- **Görseller**: JSON dizisi `[{"url":"...","alt":"..."}]` veya her satıra bir URL girin
- **Harici Linkler**: Her satıra bir URL yazarak ekleyebilirsiniz
- **Etiketler**: Virgülle ayırın (örn. `ekonomi, büyüme`)
- **Hedef Alanlar**: Formdaki çoklu seçim kutularından alan seçin; API tarafında dizi olarak saklanır
- **Durum**: `Yayında` → `visible`, `Gizli` → `hidden` olarak kaydedilir
- **Logo Dosyaları**: PNG/JPG/WEBP/SVG formatı desteklenir; dosya boyutu < 3 MB olmalıdır

## 🌐 Halka Açık Frontend

### Route'lar
- `/` - Öne çıkan makalelerle ana sayfa
- `/haber/:slug` - Tekil makale sayfası
- `/kategori/:categorySlug` - Kategori listeleme sayfası
- `/arama?q=sorgu` - Arama sonuçları
- `/sitemap.xml` - XML sitemap
- `/news-sitemap.xml` - Google News sitemap
- `/rss.xml` - RSS feed
- `/robots.txt` - Robots dosyası

### Özellikler
- SEO için sunucu tarafı render
- SEO optimize edilmiş meta etiketler ve JSON-LD şemaları
- Dost URL slug'ları
- İlgili makale önerileri
- Kategori navigasyonu
- Arama işlevselliği
- RSS feed desteği

## ✨ Özellikler Genel Bakış

### Temel Özellikler
- ✅ **Nunjucks SSR** - Sunucu tarafında, makro tabanlı React benzeri şablonlama
- ✅ **SQLite3 Veritabanı** - Yerel, dosya tabanlı depolama (harici backend yok)
- ✅ **CMS Paneli** - Tam özellikli editör arayüzü
- ✅ **SEO Optimize** - JSON-LD şemaları, meta etiketler, sitemap'ler, dost URL'ler
- ✅ **Performans** - LCP < 2s, FID < 100ms, CLS < 0.1, Lighthouse > 90
- ✅ **AdSense Hazır** - Akıllı yenileme tetikleri, lazy loading, mobil optimizasyon
- ✅ **Progressive Loading** - Düşük çözünürlüklü WebP → yüksek çözünürlüklü asenkron yükleme
- ✅ **Widget Sistemi** - Carousel, reklamlar, ilgili haberler, yorumlar
- ✅ **Akıllı Carousel** - İlk görseli anında gönderir, kalan 24 görseli ihtiyaç halinde lazy load eder
- ✅ **Marka Yönetimi** - Logo ve ana renkler CMS panelinden saniyeler içinde değiştirilebilir

### Makale Özellikleri
- Başlık, özet, içerik, görsellerle zengin makale yapısı
- Kategorilendirme için etiket sistemi
- Kaynak atfı
- Harici linkler (outlinks)
- Hedeflenen yerleştirme (homepage, breaking-news, vb.)
- İlgili makale sistemi
- SEO dostu URL'ler

## 🔧 Geliştirme Kuralları

### Lazy Loading
- Görseller daha iyi performans için lazy load edilir
- Önce düşük çözünürlüklü placeholder'lar yüklenir, sonra yüksek çözünürlüklü görseller

### SSR (Sunucu Tarafı Render)
- SEO için elementler, içerik, görsel alt metinleri için HTML injection
- Optimal SEO için tüm içerik sunucu tarafında render edilir

### Reklam Yenileme Stratejisi
AdSense politika uyumluluğu korunarak yenileme fırsatlarını maksimize etme:
- [ ] Manşet carousel'da kullanıcı tıklamasına bağlı değişiklik
- [ ] Reklamlar Lazy loading içerikten sonra yüklenecek
- [ ] İlgili haberler önerisi sayfa yenileme teşviki ve in-feed reklam
- [ ] Özellikle mobilde ilk 1 alanda reklam yok
- [ ] Metin + Görsel + Native + In-feed
- [ ] Son dakika haberi düştükçe içerik bazlı yenileme başlat, etkileşimde reklam yenile
- [ ] Akordiyon, canlı yayın vs ile etkileşimde yenileme
- [ ] Sayfa sonunda otomatik yeni içerik ve reklam
- [ ] Haber resimleri galeri olsun, geçişte reklam
- [ ] Anket tıklaması ile reklam

### SEO En İyi Uygulamaları

#### Mobil Site Başarısı
Mobil site başarısı SEO için daha önemli. Yapay zeka sayesinde hızlı haber girişi.

#### JSON-LD Şema
- Habere ait sayfanın `<head>` veya `<body>` etiketinde JSON-LD formatında NewsArticle şeması kullan
- Test: https://search.google.com/test/rich-results

#### Core Web Vitals
- **LCP (Largest Contentful Paint)**: Hedef: 2 saniye veya daha az
  - Görselleri sıkıştır (WebP kullan)
- **FID (First Input Delay)**: Hedef: < 100ms
  - JS dosyalarını parçala (code splitting)
  - Kullanıcı etkileşimiyle alakalı olmayan scriptleri "defer" et
- **CLS (Cumulative Layout Shift)**: Hedef: < 0.1
  - Her resme genişlik ve yükseklik değerini HTML'de ver
  - Reklamlar ve embed'ler için sabit alan (placeholder) ayır
  - Font yüklenmeden önce "flash" yaşanmaması için font-display: swap kullan

#### Görsel Optimizasyonu
- Mutlaka alt metin yaz - haber başlığını haber görsellerine alt metin ekle
- Örnek: `<img alt="İzmir depremi 5.2 büyüklüğünde">`
- Görsel arama trafiği azımsanmayacak kadar kazançlıdır

#### Hızlı Dizin Oluşturma
- Google News Publisher Center kullan
- Search Console'daki araçları etkin kullan
- Yeni haberler anında dizine girer

#### Başlık Optimizasyonu
- Başlıkta anahtar kelimeyi erken kullan
- Haber başlığının ilk 60 karakterinde asıl kelimeyi geçir
- "Deprem oldu" değil; "İzmir'de 5.2 büyüklüğünde deprem oldu" gibi
- Google kısa başlıklara değil, anlamlı başlıklara önem verir

#### URL Yapısı
- Haber URL'leri kısa ve temiz olmalı
- `/haber/12345?id=6789` değil
- `/izmir-5-2-buyuklugunde-deprem-oldu` gibi
- SEO ve sosyal medya paylaşımı için önemli

#### Schema.org
- "Article", "NewsArticle", "BreadcrumbList" şemaları kullan
- Google News ve Discover'da görünürlük sağlar

#### Meta Açıklamalar
- `<meta name="description">` etiketiyle özet ekle
- 140–160 karakter arası
- Anahtar kelimeyi doğal geçir, clickbait değil bilgi içersin

#### Sayfa Hızı
- Lighthouse skorun 90+ olmalı
- Resimleri sıkıştır, JS'yi ertele

#### İçerik Güncellemeleri
- Habere tarih ekle: "Güncelleme: 21 Ekim 2025"

#### İç Linkleme
- İç linkleme (contextual linking)
- Her haber, en az iki benzer habere link versin
- SEO ve kullanıcı tutma süresi için önemli

#### Site Haritaları
- Site haritası (sitemap.xml + news-sitemap.xml)
- Google News için özel sitemap oluştur
- Yeni haberler anında dizine girer, "freshness score" yükselir

### SEO Hatalarından Kaçınma

#### Anahtar Kelime Doldurma
- "Deprem oldu, deprem İzmir, deprem haberleri…"
- Google 2005'te bu oyunu çözmüştü. Artık cezalandırıyor.

#### Tekrarlayan Meta Açıklamalar
- Tüm sayfalarda aynı meta description varsa
- Google hangisini göstereceğini şaşırır, sıralamada düşersin

#### Yorum Etkileşimi
- Yorum alanı olan siteler, "aktif topluluk" olarak görülür
- Engagement sinyalleri SEO'ya direkt katkıdır
- Gerçek kullanıcıyı yorum yapmaya teşvik et
- Yazının sonunda minik bir soru bırak: "Sizce bu olayda kim haklıydı?"

## 🔐 Güvenlik Notları

- **CMS Erişimi**: Şu anda açık (kimlik doğrulama yok)
- **Gelecek**: Giriş/şifre koruması eklenecek
- **Veritabanı**: SQLite3 dosyası düzenli olarak yedeklenmelidir
- **Ortam Değişkenleri**: Hassas verileri `.env` dosyasında tutun (git'e commit edilmez)

## 📦 Bağımlılıklar

### Production
- `better-sqlite3` - SQLite3 veritabanı
- `express` - Web sunucu framework'ü
- `multer` - Çok parçalı form verisi ve logo yüklemeleri
- `helmet` - Güvenlik başlıkları
- `compression` - Yanıt sıkıştırma
- `cors` - CORS desteği
- `dotenv` - Ortam değişkenleri
- `slugify` - URL slug oluşturma
- `sharp` - Görsel işleme
- `nunjucks` - Sunucu tarafında şablonlama
- `xml2js` - XML parsing
- `node-cache` - Önbellekleme

### Development
- `nodemon` - Dosya değişikliklerinde otomatik yeniden başlatma

## 🛠️ Bakım

### Veritabanı Yedekleme
```bash
# Veritabanını yedekle
cp data/news.db data/news.db.backup

# Veritabanını geri yükle
cp data/news.db.backup data/news.db
```

### Veritabanı Migrasyonu
Veritabanı şeması başlangıçta otomatik olarak migrate edilir. Yeni sütunlar yoksa eklenir ve mevcut veriler korunur.

## 📞 Destek

Sorunlar veya sorular için kod tabanını kontrol edin veya repository'de bir issue oluşturun.

---

**Son Güncelleme**: Mevcut sürüm, SQLite3 veritabanı ve tüm makale alanlarıyla tam CMS işlevselliğini desteklemektedir.
