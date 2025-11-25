# Agentic Mock Data Documentation

This document describes the automatic mock data generation process in the UHA News CMS.

## Source Code location
The mock data logic is located in `server/services/data-service.js`.

## How it works
The system automatically checks if the database is empty on startup and populates it with sample data if needed.

### 1. Trigger Mechanism
The `migrateMockDataIfNeeded()` method runs during the `DataService` initialization. It executes the following check:

```javascript
// Check if articles table is empty
const articleCount = this.db.prepare('SELECT COUNT(*) as count FROM articles').get();

if (articleCount.count === 0) {
  console.log('📦 Migrating mock data to database...');
  // ... proceeds to insert mock data
}
```

### 2. Mock Data Generation
The `generateMockArticles()` method defines the initial content. It creates **6 articles**, one for each main category, to ensure the site is not empty upon installation.

#### The 6 Mock Articles:

1.  **Gündem**
    *   **Title:** İzmir'de 5.2 Büyüklüğünde Deprem Oldu
    *   **ID:** 1
    *   **Targeted Views:** `homepage`, `breaking-news`

2.  **Ekonomi**
    *   **Title:** Türkiye Ekonomisinde Büyüme Rakamları Açıklandı
    *   **ID:** 2
    *   **Targeted Views:** `homepage`, `category`

3.  **Spor**
    *   **Title:** Galatasaray Avrupa Ligi'nde Büyük Zafer
    *   **ID:** 3
    *   **Targeted Views:** `homepage`, `category`

4.  **Teknoloji**
    *   **Title:** Teknoloji Sektöründe Yeni Yatırımlar
    *   **ID:** 4
    *   **Targeted Views:** `category`

5.  **Sağlık**
    *   **Title:** Sağlık Bakanlığı'ndan Aşı Açıklaması
    *   **ID:** 5
    *   **Targeted Views:** `category`

6.  **Eğitim**
    *   **Title:** Eğitim Sisteminde Yeni Düzenlemeler
    *   **ID:** 6
    *   **Targeted Views:** `category`

### 3. Categories
The system also initializes the following categories if they don't exist:
*   Gündem
*   Ekonomi
*   Spor
*   Teknoloji
*   Sağlık
*   Eğitim
