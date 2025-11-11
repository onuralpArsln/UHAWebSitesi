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
        settings: initialState.settings || {},
        branding: initialState.branding || {},
        media: initialState.media || []
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
      this.pageTitleElement = this.topBar ? this.topBar.querySelector('#page-title') : null;
      this.pageSubtitleElement = this.topBar ? this.topBar.querySelector('.cms-header__subtitle') : null;
      this.viewSiteBtn = this.topBar ? this.topBar.querySelector('[data-action="view-site"]') : null;

      this.dashboardSection = document.querySelector('[data-cms="dashboard-section"]');
      this.statsContainer = document.querySelector('[data-cms="stats"]');
      this.recentArticlesContainer = document.querySelector('[data-cms="recent-articles"]');

      this.articleSection = document.querySelector('[data-cms="articles-section"]');
      this.articleTable = document.querySelector('[data-cms="articles-table"]');
      this.articleTableBody = this.articleTable ? this.articleTable.querySelector('tbody') : null;
      this.refreshArticlesBtn = document.querySelector('[data-action="refresh-articles"]');
      this.newArticleBtn = document.querySelector('[data-action="new-article"]');

      this.editorSection = document.querySelector('[data-cms="editor-section"]');
      this.articleForm = document.querySelector('[data-cms="article-form"]');
      this.editorTitle = this.editorSection ? this.editorSection.querySelector('[data-cms="editor-title"]') : null;
      this.cancelEditorButtons = document.querySelectorAll('[data-action="cancel-editor"]');

      this.categoriesSection = document.querySelector('[data-cms="categories-section"]');
      this.categoriesTable = document.querySelector('[data-cms="categories-table"]');
      this.categoriesTableBody = this.categoriesTable ? this.categoriesTable.querySelector('tbody') : null;

      this.settingsSection = document.querySelector('[data-cms="settings-section"]');
      this.settingsForm = document.querySelector('[data-cms="settings-form"]');

      this.brandingSection = document.querySelector('[data-cms="branding-section"]');
      this.brandingForm = document.querySelector('[data-cms="branding-form"]');
      this.brandingPreview = document.querySelector('[data-cms="branding-preview"]');
      this.brandingPreviewHeader = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-header"]') : null;
      this.brandingPreviewHeaderLogo = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-header-logo"]') : null;
      this.brandingPreviewBody = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-body"]') : null;
      this.brandingPreviewFooter = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-footer"]') : null;
      this.brandingPreviewFooterLogo = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-footer-logo"]') : null;
      this.brandingPreviewSiteName = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-site-name"]') : null;
      this.brandingColorValueNodes = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-color-value]') : [];
      this.brandingColorInputs = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-color]') : [];
      this.brandingChipNodes = this.brandingPreview ? this.brandingPreview.querySelectorAll('[data-cms="branding-preview-chip"]') : [];
      this.brandingFileInputs = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-upload]') : [];

      this.mediaSection = document.querySelector('[data-cms="media-section"]');
      this.mediaListContainer = this.mediaSection ? this.mediaSection.querySelector('[data-cms="media-list"]') : null;
      this.mediaUploadInput = document.querySelector('[data-cms="media-upload-input"]');
      this.refreshMediaBtn = document.querySelector('[data-action="refresh-media"]');
      this.openMediaUploadBtn = document.querySelector('[data-action="open-media-upload"]');
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
        this.newArticleBtn.addEventListener('click', () => this.openArticleEditor());
      }

      if (this.articleTableBody) {
        this.articleTableBody.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action, articleId } = button.dataset;
          if (!articleId) return;

          if (action === 'edit-article') {
            this.loadArticle(articleId);
          } else if (action === 'delete-article') {
            this.deleteArticle(articleId);
          }
        });
      }

      this.cancelEditorButtons.forEach((button) => {
        button.addEventListener('click', () => this.returnToArticleList());
      });

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

      if (this.brandingForm) {
        this.brandingForm.addEventListener('submit', (event) => {
          event.preventDefault();
          this.saveBranding();
        });
      }

      this.brandingColorInputs.forEach((input) => {
        input.addEventListener('input', (event) => {
          this.handleBrandingColorInput(event);
        });
        input.addEventListener('change', (event) => {
          this.handleBrandingColorInput(event);
        });
      });

      this.brandingFileInputs.forEach((input) => {
        input.addEventListener('change', (event) => {
          this.handleBrandingFileInput(event);
        });
      });

      if (this.openMediaUploadBtn && this.mediaUploadInput) {
        this.openMediaUploadBtn.addEventListener('click', () => this.mediaUploadInput.click());
      }

      if (this.mediaUploadInput) {
        this.mediaUploadInput.addEventListener('change', (event) => {
          this.handleMediaUpload(event);
        });
      }

      if (this.refreshMediaBtn) {
        this.refreshMediaBtn.addEventListener('click', () => this.loadMedia());
      }

      if (this.mediaSection) {
        this.mediaSection.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action } = button.dataset;
          if (action === 'toggle-media-menu') {
            this.toggleMediaMenu(button);
          } else if (action === 'copy-media-url') {
            this.copyMediaUrl(button.dataset.mediaUrl);
          } else if (action === 'delete-media') {
            this.deleteMedia(button.dataset.mediaFilename);
          } else if (action === 'rename-media') {
            this.promptRenameMedia(button.dataset.mediaFilename);
          } else if (action === 'view-media') {
            this.viewMedia(button.dataset.mediaUrl);
          }
        });
      }

      document.addEventListener('click', (event) => {
        if (event.target.closest('.media-card__menu')) return;
        this.closeAllMediaMenus();
      });
    }

    renderInitialState() {
      this.showSection('dashboard');
      this.renderStats(this.state.stats);
      this.renderArticlesTable(this.state.articles);
      this.renderRecentArticles(this.state.recentArticles);
      this.renderCategories(this.state.categories);
      this.populateSettingsForm(this.state.settings);
      this.populateBrandingForm(this.state.branding);
      this.renderMediaList(this.state.media);
      this.loadMedia();
    }

    showSection(sectionId) {
      const sectionTitles = {
        dashboard: 'Dashboard',
        articles: 'Haberler',
        categories: 'Kategoriler',
        media: 'Medya Kontrolleri',
        branding: 'Marka',
        settings: 'Site Ayarları'
      };

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

      if (this.editorSection) {
        this.editorSection.setAttribute('hidden', '');
        this.editorSection.classList.remove('active');
      }

      if (this.pageTitleElement) {
        this.pageTitleElement.textContent = sectionTitles[sectionId] || 'Dashboard';
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

    populateBrandingForm(branding) {
      if (!this.brandingForm) return;

      const defaults = {
        siteName: 'UHA News',
        primaryColor: '#1a365d',
        secondaryColor: '#2d3748',
        accentColor: '#3182ce',
        headerLogo: '',
        footerLogo: ''
      };

      const current = { ...defaults, ...(branding || {}) };
      this.state.branding = current;

      const siteNameField = this.brandingForm.querySelector('[name="siteName"]');
      if (siteNameField) {
        siteNameField.value = current.siteName;
      }

      this.brandingColorInputs.forEach((input) => {
        const key = input.dataset.brandingColor;
        if (!key) return;
        const prop = `${key}Color`;
        const value = current[prop] || defaults[prop] || '#1a365d';
        input.value = value;
        this.updateBrandingColorValue(key, value);
      });

      this.updateBrandingPreview(current);

      if (this.pageSubtitleElement) {
        this.pageSubtitleElement.textContent = current.siteName || 'UHA News';
      }
    }

    updateBrandingColorValue(key, value) {
      this.brandingColorValueNodes.forEach((node) => {
        if (node.dataset.brandingColorValue === key) {
          node.textContent = value;
        }
      });

      this.brandingChipNodes.forEach((chip) => {
        if (chip.dataset.chip === key) {
          chip.textContent = value;
          chip.style.backgroundColor = value;
        }
      });
    }

    updateBrandingPreview(branding) {
      if (!branding) return;

      if (this.brandingPreviewHeader) {
        this.brandingPreviewHeader.style.backgroundColor = branding.primaryColor;
      }
      if (this.brandingPreviewFooter) {
        this.brandingPreviewFooter.style.backgroundColor = branding.secondaryColor;
      }
      if (this.brandingPreviewBody) {
        this.brandingPreviewBody.style.borderTop = `4px solid ${branding.accentColor}`;
      }
      if (this.brandingPreviewSiteName) {
        this.brandingPreviewSiteName.textContent = branding.siteName || 'UHA News';
      }

      if (this.brandingPreviewHeaderLogo) {
        if (branding.headerLogo) {
          if (this.brandingPreviewHeaderLogo.tagName !== 'IMG') {
            const img = document.createElement('img');
            img.src = branding.headerLogo;
            img.alt = 'Logo önizleme';
            img.dataset.cms = 'branding-preview-header-logo';
            this.brandingPreviewHeaderLogo.replaceWith(img);
            this.brandingPreviewHeaderLogo = img;
          } else {
            this.brandingPreviewHeaderLogo.src = branding.headerLogo;
          }
        } else {
          if (this.brandingPreviewHeaderLogo.tagName === 'IMG') {
            const placeholder = document.createElement('div');
            placeholder.className = 'branding-preview__logo-placeholder';
            placeholder.dataset.cms = 'branding-preview-header-logo';
            placeholder.textContent = branding.siteName || 'UHA News';
            this.brandingPreviewHeaderLogo.replaceWith(placeholder);
            this.brandingPreviewHeaderLogo = placeholder;
          } else {
            this.brandingPreviewHeaderLogo.textContent = branding.siteName || 'UHA News';
          }
        }
      }

      if (this.brandingPreviewFooterLogo) {
        if (branding.footerLogo) {
          if (this.brandingPreviewFooterLogo.tagName !== 'IMG') {
            const img = document.createElement('img');
            img.src = branding.footerLogo;
            img.alt = 'Footer logo önizleme';
            img.dataset.cms = 'branding-preview-footer-logo';
            this.brandingPreviewFooterLogo.replaceWith(img);
            this.brandingPreviewFooterLogo = img;
          } else {
            this.brandingPreviewFooterLogo.src = branding.footerLogo;
          }
        } else if (branding.headerLogo) {
          if (this.brandingPreviewFooterLogo.tagName !== 'IMG') {
            const img = document.createElement('img');
            img.src = branding.headerLogo;
            img.alt = 'Footer logo önizleme';
            img.dataset.cms = 'branding-preview-footer-logo';
            this.brandingPreviewFooterLogo.replaceWith(img);
            this.brandingPreviewFooterLogo = img;
          } else {
            this.brandingPreviewFooterLogo.src = branding.headerLogo;
          }
        } else {
          if (this.brandingPreviewFooterLogo.tagName === 'IMG') {
            const placeholder = document.createElement('div');
            placeholder.className = 'branding-preview__logo-placeholder';
            placeholder.dataset.cms = 'branding-preview-footer-logo';
            placeholder.textContent = branding.siteName || 'UHA News';
            this.brandingPreviewFooterLogo.replaceWith(placeholder);
            this.brandingPreviewFooterLogo = placeholder;
          } else {
            this.brandingPreviewFooterLogo.textContent = branding.siteName || 'UHA News';
          }
        }
      }
    }

    handleBrandingColorInput(event) {
      const input = event.currentTarget;
      if (!input || !input.dataset.brandingColor) return;
      const key = input.dataset.brandingColor;
      const value = input.value;
      this.updateBrandingColorValue(key, value);

      const prop = `${key}Color`;
      this.state.branding[prop] = value;
      this.updateBrandingPreview(this.state.branding);
    }

    handleBrandingFileInput(event) {
      const input = event.currentTarget;
      if (!input || !input.files || input.files.length === 0) return;
      const file = input.files[0];
      const target = input.dataset.brandingUpload;
      if (!target) return;

      const url = URL.createObjectURL(file);
      if (target === 'header' && this.brandingPreviewHeaderLogo) {
        if (this.brandingPreviewHeaderLogo.tagName === 'IMG') {
          this.brandingPreviewHeaderLogo.src = url;
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Logo önizleme';
          img.dataset.cms = 'branding-preview-header-logo';
          this.brandingPreviewHeaderLogo.replaceWith(img);
          this.brandingPreviewHeaderLogo = img;
        }
      }
      if (target === 'footer' && this.brandingPreviewFooterLogo) {
        if (this.brandingPreviewFooterLogo.tagName === 'IMG') {
          this.brandingPreviewFooterLogo.src = url;
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Footer logo önizleme';
           img.dataset.cms = 'branding-preview-footer-logo';
          this.brandingPreviewFooterLogo.replaceWith(img);
          this.brandingPreviewFooterLogo = img;
        }
      }
    }

    async saveBranding() {
      if (!this.brandingForm) return;

      const submitButton = this.brandingForm.querySelector('[data-action="save-branding"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const formData = new FormData(this.brandingForm);
        const response = await fetch('/cms/branding', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Marka ayarları kaydedilemedi');
        }

        const result = await response.json();
        const branding = result.branding || {};
        this.state.branding = branding;
        this.populateBrandingForm(branding);
        this.showSuccess('Marka ayarları güncellendi.');
      } catch (error) {
        this.showError(error.message || 'Marka ayarları kaydedilemedi.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    }

    openArticleEditor(article = null) {
      if (!this.editorSection || !this.articleForm) return;

      this.articleForm.reset();
      this.clearTargetCheckboxes();
      this.currentArticleId = null;

      if (article) {
        this.currentArticleId = article.id;
        if (this.editorTitle) {
          this.editorTitle.textContent = 'Haberi Düzenle';
        }
        this.fillArticleForm(article);
      } else if (this.editorTitle) {
        this.editorTitle.textContent = 'Yeni Haber';
      }

      const statusField = this.articleForm.querySelector('[name="status"]');
      if (statusField && !article) {
        statusField.value = 'visible';
      }

      this.switchToEditorView();
    }

    returnToArticleList() {
      this.currentArticleId = null;
      if (this.articleForm) {
        this.articleForm.reset();
      }
      this.clearTargetCheckboxes();
      this.switchToArticlesView();
    }

    fillArticleForm(article) {
      const setValue = (selector, value) => {
        const field = this.articleForm.querySelector(selector);
        if (field) field.value = value || '';
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
        tagsField.value = Array.isArray(article.tags) ? article.tags.join(', ') : '';
      }

      const imagesField = this.articleForm.querySelector('[name="images"]');
      if (imagesField) {
        imagesField.value = this.stringifyImages(article.images);
      }

      const outlinksField = this.articleForm.querySelector('[name="outlinks"]');
      if (outlinksField) {
        outlinksField.value = Array.isArray(article.outlinks) ? article.outlinks.join('\n') : '';
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
          this.openArticleEditor(article);
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
        if (!response.ok) throw new Error();

        if (this.currentArticleId === articleId) {
          this.returnToArticleList();
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
        this.returnToArticleList();
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

    renderMediaList(mediaItems) {
      if (!this.mediaListContainer) return;
      this.closeAllMediaMenus();

      let grid = this.mediaListContainer.querySelector('[data-cms="media-grid"]');
      let empty = this.mediaListContainer.querySelector('[data-cms="media-empty"]');

      if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
        if (grid) {
          grid.remove();
          grid = null;
        }
        if (!empty) {
          empty = document.createElement('div');
          empty.className = 'cms-empty-state';
          empty.dataset.cms = 'media-empty';
          empty.textContent = 'Henüz medya yüklenmedi. “Dosya Yükle” butonuyla yeni dosyalar ekleyebilirsiniz.';
          this.mediaListContainer.innerHTML = '';
          this.mediaListContainer.appendChild(empty);
        }
        return;
      }

      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'media-grid';
        grid.dataset.cms = 'media-grid';
        this.mediaListContainer.innerHTML = '';
        this.mediaListContainer.appendChild(grid);
      } else {
        grid.innerHTML = '';
      }

      if (empty) {
        empty.remove();
      }

      const fragment = document.createDocumentFragment();

      mediaItems.forEach((item) => {
        fragment.appendChild(this.createMediaCard(item));
      });

      grid.appendChild(fragment);
    }

    createMediaCard(media) {
      const article = document.createElement('article');
      article.className = 'media-card';
      article.dataset.mediaFilename = media.filename;

      const preview = document.createElement('div');
      preview.className = 'media-card__preview';
      preview.dataset.mediaPreview = '';

      if (media.url && media.extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(media.extension.toLowerCase())) {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = media.filename;
        preview.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.textContent = (media.extension || 'DOSYA').toUpperCase();
        preview.appendChild(span);
      }

      const body = document.createElement('div');
      body.className = 'media-card__body';

      const header = document.createElement('header');
      header.className = 'media-card__header';

      const title = document.createElement('span');
      title.className = 'media-card__title';
      title.textContent = media.filename;
      title.title = media.filename;

      const menuWrapper = document.createElement('div');
      menuWrapper.className = 'media-card__menu';

      const menuToggle = document.createElement('button');
      menuToggle.className = 'media-card__menu-btn';
      menuToggle.dataset.action = 'toggle-media-menu';
      menuToggle.dataset.mediaFilename = media.filename;
      menuToggle.textContent = '⋮';

      const menuPanel = document.createElement('div');
      menuPanel.className = 'media-card__menu-panel';
      menuPanel.dataset.mediaMenu = '';
      menuPanel.hidden = true;

      const createMenuButton = (action, text, extra = {}) => {
        const btn = document.createElement('button');
        btn.dataset.action = action;
        btn.textContent = text;
        Object.entries(extra).forEach(([key, value]) => {
          btn.dataset[key] = value;
        });
        return btn;
      };

      menuPanel.appendChild(
        createMenuButton('view-media', 'Görüntüle', { mediaUrl: media.url })
      );
      menuPanel.appendChild(
        createMenuButton('rename-media', 'Yeniden Adlandır', { mediaFilename: media.filename })
      );
      menuPanel.appendChild(
        createMenuButton('copy-media-url', 'Bağlantıyı Kopyala', { mediaUrl: media.url })
      );
      menuPanel.appendChild(
        createMenuButton('delete-media', 'Sil', { mediaFilename: media.filename })
      );

      menuWrapper.appendChild(menuToggle);
      menuWrapper.appendChild(menuPanel);

      header.appendChild(title);
      header.appendChild(menuWrapper);

      const meta = document.createElement('div');
      meta.className = 'media-card__meta';

      const sizeLabel = document.createElement('span');
      sizeLabel.textContent = this.formatFileSize(media.size);

      const dateLabel = document.createElement('span');
      dateLabel.textContent = this.formatDate(media.uploadedAt);

      meta.appendChild(sizeLabel);
      meta.appendChild(dateLabel);

      body.appendChild(header);
      body.appendChild(meta);

      article.appendChild(preview);
      article.appendChild(body);

      return article;
    }

    async handleMediaUpload(event) {
      const input = event.currentTarget;
      const files = Array.from(input.files || []);
      if (!files.length) return;

      let uploadedCount = 0;
      let lastError = null;

      for (const file of files) {
        try {
          const mediaItem = await this.uploadMediaFile(file);
          if (mediaItem) {
            this.state.media = [mediaItem, ...this.state.media.filter((item) => item.filename !== mediaItem.filename)];
            uploadedCount += 1;
          }
        } catch (error) {
          lastError = error;
          console.error('Media upload error:', error);
        }
      }

      this.renderMediaList(this.state.media);

      if (uploadedCount > 0) {
        this.showSuccess(`${uploadedCount} dosya yüklendi.`);
      }
      if (lastError) {
        this.showError(lastError.message || 'Bazı dosyalar yüklenemedi.');
      }

      input.value = '';
    }

    async uploadMediaFile(file) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/cms/media/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `${file.name} yüklenemedi`);
      }

      const result = await response.json();
      return result.media;
    }

    async loadMedia() {
      try {
        const result = await this.fetchJson('/cms/media');
        const media = result.media || [];
        this.state.media = media;
        this.renderMediaList(media);
      } catch (error) {
        console.error('Media load error:', error);
      }
    }

    async deleteMedia(filename) {
      if (!filename) return;

      const confirmed = window.confirm('Bu medya dosyasını silmek istediğinize emin misiniz?');
      if (!confirmed) return;

      try {
        const response = await fetch(`/cms/media/${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Dosya silinemedi');
        }

        this.state.media = this.state.media.filter((item) => item.filename !== filename);
        this.renderMediaList(this.state.media);
        this.showSuccess('Dosya silindi.');
        this.closeAllMediaMenus();
      } catch (error) {
        this.showError(error.message || 'Dosya silinemedi.');
      }
    }

    async copyMediaUrl(url) {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        this.showSuccess('Bağlantı kopyalandı.');
        this.closeAllMediaMenus();
      } catch (error) {
        console.error('Clipboard error:', error);
        this.showError('Bağlantı kopyalanamadı.');
      }
    }

    formatFileSize(bytes) {
      if (!bytes && bytes !== 0) return '-';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
      }
      return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    getFileExtension(filename) {
      if (!filename) return '';
      const index = filename.lastIndexOf('.');
      return index > 0 ? filename.slice(index) : '';
    }

    getFilenameStem(filename) {
      if (!filename) return '';
      const index = filename.lastIndexOf('.');
      if (index > 0) {
        return filename.slice(0, index);
      }
      return filename;
    }

    async promptRenameMedia(filename) {
      if (!filename) return;
      const stem = this.getFilenameStem(filename);
      const extension = this.getFileExtension(filename);
      const userInput = window.prompt('Yeni dosya adını girin (uzantısız):', stem);
      if (userInput === null) return;

      const trimmed = userInput.trim();
      if (!trimmed) {
        this.showError('Geçerli bir dosya adı girin.');
        return;
      }

      try {
        const updated = await this.renameMedia(filename, trimmed + extension);
        if (updated?.media) {
          this.state.media = this.state.media.map((item) =>
            item.filename === filename ? updated.media : item
          );
          this.renderMediaList(this.state.media);
          this.showSuccess('Dosya adı güncellendi.');
          this.closeAllMediaMenus();
        }
      } catch (error) {
        this.showError(error.message || 'Dosya yeniden adlandırılamadı.');
      }
    }

    async renameMedia(filename, newName) {
      const response = await fetch(`/cms/media/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Dosya yeniden adlandırılamadı');
      }

      return response.json();
    }

    viewMedia(url) {
      if (!url) return;
      window.open(url, '_blank', 'noopener');
    }

    toggleMediaMenu(button) {
      if (!button) return;
      const card = button.closest('.media-card');
      if (!card) return;
      const isOpen = card.classList.contains('is-menu-open');
      this.closeAllMediaMenus();
      if (!isOpen) {
        card.classList.add('is-menu-open');
        const menu = card.querySelector('[data-media-menu]');
        if (menu) {
          menu.hidden = false;
        }
      }
    }

    closeAllMediaMenus() {
      const openCards = document.querySelectorAll('.media-card.is-menu-open');
      openCards.forEach((card) => {
        card.classList.remove('is-menu-open');
        const menu = card.querySelector('[data-media-menu]');
        if (menu) {
          menu.hidden = true;
        }
      });
    }

    escapeHtml(value) {
      if (value === null || value === undefined) return '';
      const div = document.createElement('div');
      div.textContent = value;
      return div.innerHTML;
    }

    clearTargetCheckboxes() {
      if (!this.articleForm) return;
      const checkboxes = this.articleForm.querySelectorAll('input[name="targettedViews"]');
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    }

    switchToEditorView() {
      if (!this.editorSection) return;

      this.sections.forEach((section) => {
        if (section === this.editorSection) {
          section.classList.add('active');
          section.removeAttribute('hidden');
        } else if (section.dataset.cms === 'articles-section') {
          section.classList.remove('active');
          section.setAttribute('hidden', '');
        }
      });

      this.navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#articles');
      });

      this.editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (this.pageTitleElement) {
        this.pageTitleElement.textContent = 'Haber Düzenleyici';
      }
    }

    switchToArticlesView() {
      if (!this.articleSection) return;

      this.sections.forEach((section) => {
        if (section === this.articleSection) {
          section.classList.add('active');
          section.removeAttribute('hidden');
        } else if (section.dataset.cms === 'editor-section') {
          section.classList.remove('active');
          section.setAttribute('hidden', '');
        }
      });

      this.navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#articles');
      });

      this.articleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (this.pageTitleElement) {
        this.pageTitleElement.textContent = 'Haberler';
      }
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

