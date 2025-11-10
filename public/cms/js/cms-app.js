(() => {
  const INITIAL_STATE = window.__CMS_INITIAL_STATE__ || {};
  const DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  class CMSDashboard {
    constructor(initialState) {
      this.state = {
        articles: initialState.articles || [],
        categories: initialState.categories || [],
        stats: initialState.stats || {},
        recentArticles: initialState.recentArticles || [],
        settings: initialState.settings || {}
      };

      this.currentArticleId = null;
      this.cacheDom();
      this.bindEvents();
      this.renderInitialState();
    }

    cacheDom() {
      this.sidebar = document.querySelector('[data-cms="sidebar"]');
      this.navLinks = this.sidebar ? this.sidebar.querySelectorAll('.nav-link') : [];
      this.sections = document.querySelectorAll('.cms-section');
      this.topBar = document.querySelector('[data-cms="topbar"]');
      this.viewSiteBtn = this.topBar ? this.topBar.querySelector('[data-action="view-site"]') : null;

      this.dashboardSection = document.querySelector('[data-cms="dashboard-section"]');
      this.statsContainer = document.querySelector('[data-cms="stats"]');
      this.recentArticlesContainer = document.querySelector('[data-cms="recent-articles"]');

      this.articleSection = document.querySelector('[data-cms="articles-section"]');
      this.articleTable = document.querySelector('[data-cms="articles-table"]');
      this.articleTableBody = this.articleTable ? this.articleTable.querySelector('tbody') : null;
      this.refreshArticlesBtn = document.querySelector('[data-action="refresh-articles"]');
      this.newArticleBtn = document.querySelector('[data-action="new-article"]');

      this.articleModal = document.querySelector('[data-cms="article-modal"]');
      this.articleForm = document.querySelector('[data-cms="article-form"]');
      this.articleModalTitle = this.articleModal ? this.articleModal.querySelector('[data-cms="article-modal-title"]') : null;
      this.closeModalButtons = document.querySelectorAll('[data-action="close-article-modal"]');

      this.categoriesSection = document.querySelector('[data-cms="categories-section"]');
      this.categoriesTable = document.querySelector('[data-cms="categories-table"]');
      this.categoriesTableBody = this.categoriesTable ? this.categoriesTable.querySelector('tbody') : null;

      this.settingsSection = document.querySelector('[data-cms="settings-section"]');
      this.settingsForm = document.querySelector('[data-cms="settings-form"]');

      this.root = document.documentElement;
    }

    bindEvents() {
      this.navLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          const sectionId = link.getAttribute('href').replace('#', '');
          this.showSection(sectionId);
        });
      });

      if (this.viewSiteBtn) {
        this.viewSiteBtn.addEventListener('click', () => {
          window.open('/', '_blank', 'noopener');
        });
      }

      if (this.refreshArticlesBtn) {
        this.refreshArticlesBtn.addEventListener('click', () => this.loadArticles());
      }

      if (this.newArticleBtn) {
        this.newArticleBtn.addEventListener('click', () => this.openArticleModal());
      }

      if (this.articleTableBody) {
        this.articleTableBody.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action, articleId } = button.dataset;
          if (!articleId && action !== 'new-article') return;

          if (action === 'edit-article') {
            this.loadArticle(articleId);
          } else if (action === 'delete-article') {
            this.deleteArticle(articleId);
          }
        });
      }

      this.closeModalButtons.forEach((button) => {
        button.addEventListener('click', () => this.closeArticleModal());
      });

      if (this.articleModal) {
        this.articleModal.addEventListener('click', (event) => {
          if (event.target === this.articleModal) {
            this.closeArticleModal();
          }
        });
      }

      if (this.articleForm) {
        this.articleForm.addEventListener('submit', (event) => {
          event.preventDefault();
          this.saveArticle();
        });
      }

      if (this.settingsForm) {
        this.settingsForm.addEventListener('submit', (event) => {
          event.preventDefault();
          this.saveSettings();
        });
      }
    }

    renderInitialState() {
      this.showSection('dashboard');
      this.renderStats(this.state.stats);
      this.renderArticlesTable(this.state.articles);
      this.renderRecentArticles(this.state.recentArticles);
      this.renderCategories(this.state.categories);
      this.populateSettingsForm(this.state.settings);
    }

    showSection(sectionId) {
      this.navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
      });

      this.sections.forEach((section) => {
        if (section.id === sectionId) {
          section.classList.add('active');
          section.removeAttribute('hidden');
        } else {
          section.classList.remove('active');
          section.setAttribute('hidden', '');
        }
      });

      if (this.articleModal) {
        this.articleModal.setAttribute('hidden', '');
      }
    }

    renderStats(stats) {
      if (!this.statsContainer) return;
      const statNumbers = this.statsContainer.querySelectorAll('.cms-stat-number');
      const values = [
        stats.totalArticles || 0,
        stats.totalCategories || 0,
        stats.visibleArticles || 0,
        stats.hiddenArticles || 0
      ];
      statNumbers.forEach((node, index) => {
        if (values[index] !== undefined) {
          node.textContent = values[index];
        }
      });
    }

    renderRecentArticles(articles) {
      if (!this.recentArticlesContainer) return;
      const list = this.recentArticlesContainer.querySelector('.cms-list');
      if (!list) return;

      if (!articles.length) {
        list.innerHTML = '<li class="cms-empty-state">Henüz haber bulunmuyor.</li>';
        return;
      }

      list.innerHTML = articles
        .slice(0, 5)
        .map(
          (article) => `
            <li>
              <div class="cms-list__title">${this.escapeHtml(article.header || 'Başlık yok')}</div>
              <div class="cms-list__meta">
                ${this.escapeHtml(article.category || 'Kategori yok')} • ${this.formatDate(article.creationDate)}
              </div>
            </li>
          `
        )
        .join('');
    }

    renderArticlesTable(articles) {
      if (!this.articleTableBody) return;
      if (!Array.isArray(articles) || articles.length === 0) {
        this.articleTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="cms-empty-state">
              Henüz haber bulunmuyor. “Yeni Haber” butonuyla içerik oluşturabilirsiniz.
            </td>
          </tr>
        `;
        return;
      }

      this.articleTableBody.innerHTML = articles
        .map((article) => {
          const statusClass = article.status === 'hidden' ? 'cms-status cms-status--hidden' : 'cms-status';
          const summaryLine = article.summaryHead
            ? `<div class="cms-table-subline">${this.escapeHtml(article.summaryHead)}</div>`
            : '';
          return `
            <tr data-article-id="${article.id}">
              <td>
                <strong>${this.escapeHtml(article.header || 'Başlık yok')}</strong>
                ${summaryLine}
              </td>
              <td>${this.escapeHtml(article.category || '-')}</td>
              <td>${this.escapeHtml(article.writer || '-')}</td>
              <td><span class="${statusClass}">${article.status === 'hidden' ? 'Gizli' : 'Yayında'}</span></td>
              <td>${this.formatDate(article.creationDate, '-')}</td>
              <td class="cms-actions">
                <button class="cms-btn cms-btn-secondary" data-action="edit-article" data-article-id="${article.id}">Düzenle</button>
                <button class="cms-btn cms-btn-danger" data-action="delete-article" data-article-id="${article.id}">Sil</button>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    renderCategories(categories) {
      if (!this.categoriesTableBody) return;
      if (!Array.isArray(categories) || categories.length === 0) {
        this.categoriesTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="cms-empty-state">Henüz kategori bulunmuyor.</td>
          </tr>
        `;
        return;
      }

      this.categoriesTableBody.innerHTML = categories
        .map(
          (category) => `
            <tr data-category-id="${category.id}">
              <td>${this.escapeHtml(category.name)}</td>
              <td>${this.escapeHtml(category.description || '-')}</td>
              <td>${category.articleCount || 0}</td>
              <td class="cms-actions">
                <button class="cms-btn cms-btn-secondary" data-action="edit-category" data-category-id="${category.id}">Düzenle</button>
                <button class="cms-btn cms-btn-danger" data-action="delete-category" data-category-id="${category.id}">Sil</button>
              </td>
            </tr>
          `
        )
        .join('');
    }

    populateSettingsForm(settings) {
      if (!this.settingsForm) return;
      Object.entries(settings || {}).forEach(([key, value]) => {
        const field = this.settingsForm.querySelector(`[name="${key}"]`);
        if (field) {
          field.value = value || '';
        }
      });
    }

    openArticleModal(article = null) {
      if (!this.articleModal || !this.articleForm) return;
      this.articleModal.removeAttribute('hidden');
      this.articleModal.setAttribute('aria-hidden', 'false');

      this.articleForm.reset();
      this.clearTargetCheckboxes();
      this.currentArticleId = null;

      if (article) {
        this.currentArticleId = article.id;
        if (this.articleModalTitle) {
          this.articleModalTitle.textContent = 'Haberi Düzenle';
        }
        this.fillArticleForm(article);
      } else {
        if (this.articleModalTitle) {
          this.articleModalTitle.textContent = 'Yeni Haber';
        }
        const statusField = this.articleForm.querySelector('[name="status"]');
        if (statusField) {
          statusField.value = 'visible';
        }
      }
    }

    closeArticleModal() {
      if (!this.articleModal || !this.articleForm) return;
      this.articleModal.setAttribute('hidden', '');
      this.articleModal.setAttribute('aria-hidden', 'true');
      this.articleForm.reset();
      this.clearTargetCheckboxes();
      this.currentArticleId = null;
    }

    clearTargetCheckboxes() {
      const checkboxes = this.articleForm.querySelectorAll('input[name="targettedViews"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    }

    fillArticleForm(article) {
      const setValue = (selector, value) => {
        const field = this.articleForm.querySelector(selector);
        if (field) {
          field.value = value || '';
        }
      };

      setValue('[name="header"]', article.header);
      setValue('[name="summaryHead"]', article.summaryHead);
      setValue('[name="summary"]', article.summary);
      setValue('[name="category"]', article.category);
      setValue('[name="writer"]', article.writer);
      setValue('[name="source"]', article.source);
      setValue('[name="videoUrl"]', article.videoUrl);
      setValue('[name="pressAnnouncementId"]', article.pressAnnouncementId);
      setValue('[name="status"]', article.status === 'hidden' ? 'hidden' : 'visible');
      setValue('[name="body"]', article.body);

      const tagsField = this.articleForm.querySelector('[name="tags"]');
      if (tagsField) {
        const tags = Array.isArray(article.tags) ? article.tags.join(', ') : '';
        tagsField.value = tags;
      }

      const imagesField = this.articleForm.querySelector('[name="images"]');
      if (imagesField) {
        imagesField.value = this.stringifyImages(article.images);
      }

      const outlinksField = this.articleForm.querySelector('[name="outlinks"]');
      if (outlinksField) {
        const outlinks = Array.isArray(article.outlinks) ? article.outlinks.join('\n') : '';
        outlinksField.value = outlinks;
      }

      const checkboxes = this.articleForm.querySelectorAll('input[name="targettedViews"]');
      const targets = Array.isArray(article.targettedViews) ? new Set(article.targettedViews) : new Set();
      checkboxes.forEach((checkbox) => {
        checkbox.checked = targets.has(checkbox.value);
      });
    }

    stringifyImages(images) {
      if (!images || !images.length) return '';
      try {
        return JSON.stringify(images, null, 2);
      } catch (error) {
        return '';
      }
    }

    serializeArticleForm() {
      const formData = new FormData(this.articleForm);
      const payload = Object.fromEntries(formData.entries());

      const targettedViews = Array.from(
        this.articleForm.querySelectorAll('input[name="targettedViews"]:checked')
      ).map((checkbox) => checkbox.value);

      payload.targettedViews = targettedViews;
      payload.status = payload.status || 'visible';
      payload.pressAnnouncementId = payload.pressAnnouncementId || '';
      payload.writer = payload.writer || '';
      payload.videoUrl = payload.videoUrl || '';

      return payload;
    }

    async loadArticles() {
      try {
        const data = await this.fetchJson('/cms/articles');
        if (!data) return;
        this.state.articles = data.articles || [];
        this.renderArticlesTable(this.state.articles);
        this.renderRecentArticles(this.state.articles.slice(0, 5));
        this.updateStatsFromPayload(data);
      } catch (error) {
        this.showError('Haberler yüklenirken bir hata oluştu.');
      }
    }

    updateStatsFromPayload(payload) {
      if (!payload || !payload.pagination) return;
      const visible = (payload.articles || []).filter((article) => article.status !== 'hidden').length;
      const hidden = (payload.articles || []).filter((article) => article.status === 'hidden').length;
      const stats = {
        totalArticles: payload.pagination.total || payload.articles.length,
        totalCategories: this.state.stats.totalCategories || 0,
        visibleArticles: visible,
        hiddenArticles: hidden
      };
      this.state.stats = { ...this.state.stats, ...stats };
      this.renderStats(this.state.stats);
    }

    async loadArticle(articleId) {
      try {
        const article = await this.fetchJson(`/cms/articles/${articleId}`);
        if (article) {
          this.openArticleModal(article);
        }
      } catch (error) {
        this.showError('Haber bilgileri alınamadı.');
      }
    }

    async deleteArticle(articleId) {
      const confirmed = window.confirm('Bu haberi silmek istediğinize emin misiniz?');
      if (!confirmed) return;

      try {
        const response = await fetch(`/cms/articles/${articleId}`, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error();
        }
        this.showSuccess('Haber silindi.');
        await this.loadArticles();
      } catch (error) {
        this.showError('Haber silinemedi.');
      }
    }

    async saveArticle() {
      try {
        const payload = this.serializeArticleForm();
        const method = this.currentArticleId ? 'PUT' : 'POST';
        const url = this.currentArticleId ? `/cms/articles/${this.currentArticleId}` : '/cms/articles';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Haber kaydedilemedi');
        }

        this.showSuccess('Haber kaydedildi.');
        this.closeArticleModal();
        await this.loadArticles();
      } catch (error) {
        this.showError(error.message);
      }
    }

    async saveSettings() {
      if (!this.settingsForm) return;
      const formData = new FormData(this.settingsForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/cms/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error();
        this.showSuccess('Ayarlar güncellendi.');
      } catch (error) {
        this.showError('Ayarlar kaydedilemedi.');
      }
    }

    async fetchJson(url, options) {
      const response = await fetch(url, options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        this.showError(error.error || 'Beklenmeyen bir hata oluştu.');
        throw new Error(error.error || 'Request failed');
      }
      return response.json();
    }

    formatDate(value, fallback = '-') {
      if (!value) return fallback;
      try {
        return DATE_FORMATTER.format(new Date(value));
      } catch (error) {
        return fallback;
      }
    }

    escapeHtml(value) {
      if (value === null || value === undefined) return '';
      const div = document.createElement('div');
      div.textContent = value;
      return div.innerHTML;
    }

    showSuccess(message) {
      this.showToast(message, 'success');
    }

    showError(message) {
      this.showToast(message, 'error');
    }

    showToast(message, type = 'success') {
      const container = document.querySelector('[data-cms="toast-container"]') || this.createToastContainer();
      const toast = document.createElement('div');
      toast.className = `cms-toast cms-toast--${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }

    createToastContainer() {
      const container = document.createElement('div');
      container.dataset.cms = 'toast-container';
      container.className = 'cms-toast-container';
      document.body.appendChild(container);
      return container;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    new CMSDashboard(INITIAL_STATE);
  });
})();

