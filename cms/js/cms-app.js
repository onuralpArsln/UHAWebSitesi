/**
 * CMS Application JavaScript
 * Handles CMS panel functionality and interactions
 */

class CMSApp {
  constructor() {
    this.currentSection = 'dashboard';
    this.currentArticle = null;
    this.categories = [];
    this.init();
  }

  /**
   * Initialize CMS application
   */
  init() {
    this.setupNavigation();
    this.loadDashboard();
    this.setupEventListeners();
  }

  /**
   * Setup navigation
   */
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('href').substring(1);
        this.showSection(section);
      });
    });
  }

  /**
   * Show specific section
   */
  showSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[href="#${section}"]`).classList.add('active');

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      articles: 'Articles',
      categories: 'Categories',
      layouts: 'Layouts',
      settings: 'Settings'
    };
    document.getElementById('page-title').textContent = titles[section];

    // Show section
    document.querySelectorAll('.cms-section').forEach(sec => {
      sec.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');

    this.currentSection = section;

    // Load section data
    switch (section) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'articles':
        this.loadArticles();
        break;
      case 'categories':
        this.loadCategories();
        break;
      case 'layouts':
        this.loadLayouts();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  /**
   * Load dashboard data
   */
  async loadDashboard() {
    try {
      const response = await fetch('/cms/dashboard');
      const data = await response.json();

      // Update statistics
      const statsHtml = `
        <div class="cms-stat-card">
          <div class="cms-stat-number">${data.totalArticles}</div>
          <div class="cms-stat-label">Total Articles</div>
        </div>
        <div class="cms-stat-card">
          <div class="cms-stat-number">${data.totalCategories}</div>
          <div class="cms-stat-label">Categories</div>
        </div>
        <div class="cms-stat-card">
          <div class="cms-stat-number">${data.recentArticles.length}</div>
          <div class="cms-stat-label">Recent Articles</div>
        </div>
      `;
      document.getElementById('dashboard-stats').innerHTML = statsHtml;

      // Update recent articles
      const recentHtml = data.recentArticles.map(article => `
        <div style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
          <h4 style="margin: 0 0 0.5rem 0;">${article.title}</h4>
          <p style="margin: 0; color: var(--text-light); font-size: 0.9rem;">
            ${article.category} • ${new Date(article.publishedAt).toLocaleDateString('tr-TR')}
          </p>
        </div>
      `).join('');
      
      document.getElementById('recent-articles').innerHTML = `
        <h3>Recent Articles</h3>
        ${recentHtml || '<p>No recent articles found.</p>'}
      `;

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      this.showError('Failed to load dashboard data');
    }
  }

  /**
   * Load articles
   */
  async loadArticles() {
    try {
      const response = await fetch('/cms/articles');
      const data = await response.json();

      const articlesHtml = `
        <table class="cms-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Author</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.articles.map(article => `
              <tr>
                <td>${article.title}</td>
                <td>${article.category}</td>
                <td>${article.author}</td>
                <td>${new Date(article.publishedAt).toLocaleDateString('tr-TR')}</td>
                <td class="cms-actions">
                  <button class="cms-btn cms-btn-secondary" onclick="editArticle('${article.id}')">
                    Edit
                  </button>
                  <button class="cms-btn cms-btn-danger" onclick="deleteArticle('${article.id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      document.getElementById('articles-list').innerHTML = articlesHtml;

    } catch (error) {
      console.error('Failed to load articles:', error);
      this.showError('Failed to load articles');
    }
  }

  /**
   * Load categories
   */
  async loadCategories() {
    try {
      const response = await fetch('/cms/categories');
      const data = await response.json();

      this.categories = data.categories;

      const categoriesHtml = `
        <table class="cms-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.categories.map(category => `
              <tr>
                <td>${category.name}</td>
                <td>${category.description || '-'}</td>
                <td class="cms-actions">
                  <button class="cms-btn cms-btn-secondary" onclick="editCategory('${category.id}')">
                    Edit
                  </button>
                  <button class="cms-btn cms-btn-danger" onclick="deleteCategory('${category.id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      document.getElementById('categories-list').innerHTML = categoriesHtml;

    } catch (error) {
      console.error('Failed to load categories:', error);
      this.showError('Failed to load categories');
    }
  }

  /**
   * Load layouts
   */
  async loadLayouts() {
    try {
      const response = await fetch('/cms/layouts');
      const data = await response.json();

      const layoutsHtml = `
        <table class="cms-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Template</th>
              <th>Widgets</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.layouts.map(layout => `
              <tr>
                <td>${layout.name}</td>
                <td>${layout.template}</td>
                <td>${layout.widgets.length} widgets</td>
                <td class="cms-actions">
                  <button class="cms-btn cms-btn-secondary" onclick="editLayout('${layout.id}')">
                    Edit
                  </button>
                  <button class="cms-btn cms-btn-primary" onclick="previewLayout('${layout.id}')">
                    Preview
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      document.getElementById('layouts-list').innerHTML = layoutsHtml;

    } catch (error) {
      console.error('Failed to load layouts:', error);
      this.showError('Failed to load layouts');
    }
  }

  /**
   * Load settings
   */
  async loadSettings() {
    try {
      const response = await fetch('/cms/settings');
      const data = await response.json();

      const form = document.getElementById('settings-form');
      Object.keys(data.settings).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
          input.value = data.settings[key];
        }
      });

    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showError('Failed to load settings');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Article form submission
    document.getElementById('article-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveArticle();
    });

    // Settings form submission
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Close modal on outside click
    document.getElementById('article-modal').addEventListener('click', (e) => {
      if (e.target.id === 'article-modal') {
        this.closeArticleModal();
      }
    });
  }

  /**
   * Show article form
   */
  showArticleForm(article = null) {
    this.currentArticle = article;
    
    const modal = document.getElementById('article-modal');
    const title = document.getElementById('article-modal-title');
    const form = document.getElementById('article-form');

    if (article) {
      title.textContent = 'Edit Article';
      form.title.value = article.title;
      form.summary.value = article.summary;
      form.content.value = article.content;
      form.category.value = article.category;
      form.author.value = article.author;
      form.keywords.value = article.keywords ? article.keywords.join(', ') : '';
    } else {
      title.textContent = 'New Article';
      form.reset();
    }

    // Populate categories
    const categorySelect = document.getElementById('article-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    modal.style.display = 'block';
  }

  /**
   * Close article modal
   */
  closeArticleModal() {
    document.getElementById('article-modal').style.display = 'none';
    this.currentArticle = null;
  }

  /**
   * Save article
   */
  async saveArticle() {
    try {
      const form = document.getElementById('article-form');
      const formData = new FormData(form);
      
      const articleData = {
        title: formData.get('title'),
        summary: formData.get('summary'),
        content: formData.get('content'),
        category: formData.get('category'),
        author: formData.get('author'),
        keywords: formData.get('keywords').split(',').map(k => k.trim()).filter(k => k)
      };

      const url = this.currentArticle ? `/cms/articles/${this.currentArticle.id}` : '/cms/articles';
      const method = this.currentArticle ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(articleData)
      });

      if (response.ok) {
        this.showSuccess('Article saved successfully');
        this.closeArticleModal();
        this.loadArticles();
      } else {
        throw new Error('Failed to save article');
      }

    } catch (error) {
      console.error('Failed to save article:', error);
      this.showError('Failed to save article');
    }
  }

  /**
   * Save settings
   */
  async saveSettings() {
    try {
      const form = document.getElementById('settings-form');
      const formData = new FormData(form);
      
      const settings = {};
      for (const [key, value] of formData.entries()) {
        settings[key] = value;
      }

      const response = await fetch('/cms/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        this.showSuccess('Settings saved successfully');
      } else {
        throw new Error('Failed to save settings');
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError('Failed to save settings');
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message
   */
  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `cms-${type}`;
    messageDiv.textContent = message;

    const content = document.querySelector('.cms-content');
    content.insertBefore(messageDiv, content.firstChild);

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }
}

// Global functions for inline event handlers
function showArticleForm() {
  window.cmsApp.showArticleForm();
}

function closeArticleModal() {
  window.cmsApp.closeArticleModal();
}

function editArticle(id) {
  // In a real implementation, this would fetch the article and show the form
  console.log('Edit article:', id);
}

function deleteArticle(id) {
  if (confirm('Are you sure you want to delete this article?')) {
    // In a real implementation, this would delete the article
    console.log('Delete article:', id);
  }
}

function showCategoryForm() {
  // In a real implementation, this would show a category form
  console.log('Show category form');
}

function editCategory(id) {
  console.log('Edit category:', id);
}

function deleteCategory(id) {
  if (confirm('Are you sure you want to delete this category?')) {
    console.log('Delete category:', id);
  }
}

function showLayoutForm() {
  console.log('Show layout form');
}

function editLayout(id) {
  console.log('Edit layout:', id);
}

function previewLayout(id) {
  console.log('Preview layout:', id);
}

// Initialize CMS app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.cmsApp = new CMSApp();
});

