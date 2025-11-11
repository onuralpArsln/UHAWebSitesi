(() => {
  const INITIAL_STATE = window.__CMS_INITIAL_STATE__ || {};
  const DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const MEDIA_BASE_PATH = '/uploads/media/';

  class CMSDashboard {
    constructor(initialState) {
      this.state = {
        articles: initialState.articles || [],
        categories: initialState.categories || [],
        stats: initialState.stats || {},
        recentArticles: initialState.recentArticles || [],
        settings: initialState.settings || {},
        branding: initialState.branding || {},
        media: initialState.media || [],
        mediaFolders: initialState.mediaFolders || [],
        mediaTree: initialState.mediaTree || null,
        mediaCurrentFolder: '',
        mediaBreadcrumbs: [],
        mediaSearchTerm: ''
      };

      this.currentArticleId = null;
      this.mediaSearchDebounce = null;
      this.articleImages = [];
      this.mediaSelectModal = null;
      this.mediaSelectModalEscapeHandler = null;
      this.cacheDom();
      this.bindEvents();
      this.initializeArticleMediaManager();
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
      this.mediaTreeContainer = document.querySelector('[data-cms="media-tree"]');
      this.mediaTreeRoot = document.querySelector('[data-cms="media-tree-root"]');
      this.mediaBreadcrumbs = document.querySelector('[data-cms="media-breadcrumbs"]');
      this.mediaSearchInput = document.querySelector('[data-cms="media-search-input"]');
      this.mediaSearchClear = document.querySelector('[data-action="clear-media-search"]');
      this.createFolderBtn = document.querySelector('[data-action="create-folder"]');

      this.articleMediaManager = this.articleForm ? this.articleForm.querySelector('[data-cms="article-media-manager"]') : null;
      this.articleImagesField = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-article-images]') : null;
      this.articleMediaInput = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-article-media-input]') : null;
      this.articleMediaList = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-article-media-list]') : null;
      this.articleMediaEmpty = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-article-media-empty]') : null;
      this.articleMediaUploadBtn = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-action="article-media-upload"]') : null;
      this.articleMediaSelectBtn = this.articleMediaManager ? this.articleMediaManager.querySelector('[data-action="article-media-select"]') : null;
      this.mediaTreeContainer = document.querySelector('[data-cms="media-tree"]');
      this.mediaTreeRoot = document.querySelector('[data-cms="media-tree-root"]');
      this.mediaBreadcrumbs = document.querySelector('[data-cms="media-breadcrumbs"]');
      this.mediaSearchInput = document.querySelector('[data-cms="media-search-input"]');
      this.mediaSearchClear = document.querySelector('[data-action="clear-media-search"]');
      this.createFolderBtn = document.querySelector('[data-action="create-folder"]');
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
            this.deleteMedia(button.dataset.mediaPath);
          } else if (action === 'rename-media') {
            this.promptRenameMedia(button.dataset.mediaPath);
          } else if (action === 'view-media') {
            this.viewMedia(button.dataset.mediaUrl);
          }
        });
      }

      document.addEventListener('click', (event) => {
        if (event.target.closest('.media-card__menu')) return;
        this.closeAllMediaMenus();
      });

      if (this.mediaSearchInput) {
        this.mediaSearchInput.addEventListener('input', (event) => this.handleMediaSearchInput(event));
        this.mediaSearchInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
          }
        });
      }

      if (this.mediaSearchClear) {
        this.mediaSearchClear.addEventListener('click', () => this.clearMediaSearch());
      }

      if (this.createFolderBtn) {
        this.createFolderBtn.addEventListener('click', () => this.promptCreateFolder());
      }

      if (this.mediaTreeContainer) {
        this.mediaTreeContainer.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action } = button.dataset;
          if (action === 'open-folder') {
            event.preventDefault();
            const folder = button.dataset.folderPath || '';
            this.openFolder(folder);
          } else if (action === 'rename-folder') {
            event.preventDefault();
            const folder = button.dataset.folderPath || '';
            this.promptRenameFolder(folder);
          }
        });
      }

      if (this.mediaBreadcrumbs) {
        this.mediaBreadcrumbs.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action="open-folder"]');
          if (!button) return;
          event.preventDefault();
          const folder = button.dataset.folderPath || '';
          this.openFolder(folder);
        });
      }

      if (this.articleMediaUploadBtn && this.articleMediaInput) {
        this.articleMediaUploadBtn.addEventListener('click', () => this.articleMediaInput.click());
      }

      if (this.articleMediaInput) {
        this.articleMediaInput.addEventListener('change', (event) => this.handleArticleMediaInput(event));
      }

      if (this.articleMediaSelectBtn) {
        this.articleMediaSelectBtn.addEventListener('click', () => this.openArticleMediaSelectModal());
      }

      if (this.articleMediaList) {
        this.articleMediaList.addEventListener('click', (event) => this.handleArticleMediaListClick(event));
        this.articleMediaList.addEventListener('input', (event) => this.handleArticleMediaListInput(event));
      }
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
      this.renderFolderTree(this.state.mediaTree);
      this.renderBreadcrumbs(this.state.mediaBreadcrumbs);
      this.updateMediaSearchInput(this.state.mediaSearchTerm);
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
      this.resetArticleImages();
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
      this.resetArticleImages();
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

      this.setArticleImages(article.images || []);

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
      payload.images = this.getArticleImagesPayload();

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
          empty.textContent = this.state.mediaSearchTerm
            ? 'Aramanızla eşleşen medya bulunamadı. Farklı bir anahtar kelime deneyin.'
            : 'Henüz medya yüklenmedi. “Dosya Yükle” butonuyla yeni dosyalar ekleyebilirsiniz.';
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
      article.dataset.mediaPath = media.path || media.filename;

      const preview = document.createElement('div');
      preview.className = 'media-card__preview';
      preview.dataset.mediaPreview = '';

      if (media.url && media.extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes((media.extension || '').toLowerCase())) {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = media.filename || media.path;
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
      title.textContent = media.filename || media.path;
      title.title = media.path || media.filename;

      const menuWrapper = document.createElement('div');
      menuWrapper.className = 'media-card__menu';

      const menuToggle = document.createElement('button');
      menuToggle.className = 'media-card__menu-btn';
      menuToggle.dataset.action = 'toggle-media-menu';
      menuToggle.dataset.mediaPath = media.path || media.filename;
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
        createMenuButton('rename-media', 'Yeniden Adlandır', { mediaPath: media.path || media.filename })
      );
      menuPanel.appendChild(
        createMenuButton('copy-media-url', 'Bağlantıyı Kopyala', { mediaUrl: media.url })
      );
      menuPanel.appendChild(
        createMenuButton('delete-media', 'Sil', { mediaPath: media.path || media.filename })
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

    initializeArticleMediaManager() {
      if (!this.articleMediaManager) return;
      this.articleImages = Array.isArray(this.articleImages) ? this.articleImages : [];
      this.renderArticleMediaList();
    }

    setArticleMediaLoading(isLoading) {
      if (!this.articleMediaManager) return;
      this.articleMediaManager.classList.toggle('is-loading', Boolean(isLoading));
    }

    resetArticleImages() {
      this.articleImages = [];
      this.renderArticleMediaList();
    }

    setArticleImages(images) {
      this.articleImages = this.normalizeArticleImages(images);
      this.renderArticleMediaList();
    }

    normalizeArticleImages(images) {
      if (!Array.isArray(images)) return [];
      return images
        .map((entry) => this.normalizeArticleImageEntry(entry))
        .filter(Boolean);
    }

    normalizeArticleImageEntry(entry) {
      if (!entry) return null;

      let source = entry;
      if (typeof entry === 'string') {
        source = { url: entry };
      }

      const normalized = {
        uid: this.generateArticleImageUid(),
        path: '',
        url: '',
        filename: '',
        title: '',
        alt: '',
        size: null,
        uploadedAt: null
      };

      const candidateUrl =
        source.url ||
        source.src ||
        source.href ||
        source.original ||
        source.preview ||
        '';

      const candidatePath = source.path || this.extractMediaPathFromUrl(candidateUrl);

      normalized.path = candidatePath || '';
      normalized.url =
        candidateUrl ||
        (normalized.path ? this.buildMediaUrlFromPath(normalized.path) : '');

      const derivedFilename =
        source.filename ||
        source.name ||
        this.getFilenameFromPath(normalized.path) ||
        this.getFilenameFromUrl(normalized.url);

      normalized.filename = derivedFilename || '';
      normalized.title = source.title || source.caption || '';
      normalized.alt = source.alt || source.altText || source.description || normalized.title || normalized.filename || '';
      normalized.size =
        source.size !== undefined
          ? Number(source.size)
          : source.bytes !== undefined
          ? Number(source.bytes)
          : null;
      normalized.uploadedAt = source.uploadedAt || source.createdAt || null;

      return normalized.url ? normalized : null;
    }

    buildMediaUrlFromPath(pathValue) {
      if (!pathValue) return '';
      const encoded = pathValue
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      return `${MEDIA_BASE_PATH}${encoded}`;
    }

    extractMediaPathFromUrl(url) {
      if (!url) return '';
      const index = url.indexOf(MEDIA_BASE_PATH);
      if (index === -1) return '';
      const relative = url.slice(index + MEDIA_BASE_PATH.length);
      return decodeURIComponent(relative.replace(/^\/+/, ''));
    }

    getFilenameFromPath(pathValue) {
      if (!pathValue) return '';
      const parts = pathValue.split('/');
      return parts[parts.length - 1] || '';
    }

    getFilenameFromUrl(url) {
      if (!url) return '';
      try {
        const parsed = new URL(url, window.location.origin);
        return this.getFilenameFromPath(parsed.pathname);
      } catch (error) {
        return this.getFilenameFromPath(url);
      }
    }

    generateArticleImageUid() {
      return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    addArticleImage(image) {
      if (!image) return;
      const existing = this.articleImages.find(
        (item) =>
          (item.path && image.path && item.path === image.path) ||
          item.url === image.url
      );
      if (existing) {
        this.showError('Bu görsel zaten eklenmiş.');
        return;
      }
      this.articleImages.push(image);
      this.renderArticleMediaList();
    }

    renderArticleMediaList() {
      if (!this.articleMediaList) return;

      this.articleMediaList.innerHTML = '';

      if (!this.articleImages.length) {
        if (this.articleMediaEmpty) {
          this.articleMediaEmpty.hidden = false;
          this.articleMediaList.appendChild(this.articleMediaEmpty);
        }
        this.syncArticleImagesField();
        return;
      }

      if (this.articleMediaEmpty) {
        this.articleMediaEmpty.hidden = true;
      }

      const fragment = document.createDocumentFragment();

      this.articleImages.forEach((image, index) => {
        const item = document.createElement('article');
        item.className = 'article-media-item';
        item.dataset.index = String(index);

        const sizeText = image.size !== null && image.size !== undefined
          ? this.formatFileSize(image.size)
          : '-';

        const escapedTitle = this.escapeHtml(image.title || '');
        const escapedAlt = this.escapeHtml(image.alt || '');
        const escapedPath = this.escapeHtml(image.path || '');
        const escapedFilename = this.escapeHtml(image.filename || '');

        item.innerHTML = `
          <div class="article-media-item__preview">
            <img src="${image.url}" alt="${escapedAlt || escapedTitle || escapedFilename}">
          </div>
          <div class="article-media-item__fields">
            <label>
              <span>Başlık</span>
              <input type="text" value="${escapedTitle}" data-field="title" placeholder="Opsiyonel başlık">
            </label>
            <label>
              <span>Alternatif Metin</span>
              <input type="text" value="${escapedAlt}" data-field="alt" placeholder="Erişilebilirlik için tanımlayıcı metin">
            </label>
          </div>
          <div class="article-media-item__meta">
            <div class="article-media-item__meta-row" title="${escapedPath}">
              <span class="article-media-item__meta-label">Dosya</span>
              <span class="article-media-item__meta-value">${escapedFilename || '-'}</span>
            </div>
            <div class="article-media-item__meta-row" title="${escapedPath}">
              <span class="article-media-item__meta-label">Yol</span>
              <span class="article-media-item__meta-value">${escapedPath || '-'}</span>
            </div>
            <div class="article-media-item__meta-row">
              <span class="article-media-item__meta-label">Boyut</span>
              <span class="article-media-item__meta-value">${sizeText}</span>
            </div>
          </div>
          <div class="article-media-item__actions">
            <button type="button" class="cms-btn cms-btn-secondary" data-action="article-media-move-up" ${index === 0 ? 'disabled' : ''} aria-label="Bir üst sıraya taşı">▲</button>
            <button type="button" class="cms-btn cms-btn-secondary" data-action="article-media-move-down" ${index === this.articleImages.length - 1 ? 'disabled' : ''} aria-label="Bir alt sıraya taşı">▼</button>
            <button type="button" class="cms-btn cms-btn-danger" data-action="article-media-remove">Sil</button>
          </div>
        `;

        fragment.appendChild(item);
      });

      this.articleMediaList.appendChild(fragment);
      this.syncArticleImagesField();
    }

    syncArticleImagesField() {
      if (!this.articleImagesField) return;
      const payload = this.getArticleImagesPayload();
      this.articleImagesField.value = JSON.stringify(payload);
    }

    getArticleImagesPayload() {
      return this.articleImages.map((image) => ({
        path: image.path || '',
        url: image.url,
        filename: image.filename || '',
        title: image.title || '',
        alt: image.alt || '',
        size: image.size !== null && image.size !== undefined ? image.size : undefined,
        uploadedAt: image.uploadedAt || undefined
      }));
    }

    handleArticleMediaInput(event) {
      const input = event.currentTarget;
      const files = Array.from(input.files || []);
      if (!files.length) return;
      this.uploadArticleImages(files);
      input.value = '';
    }

    async uploadArticleImages(files) {
      if (!files.length) return;
      this.setArticleMediaLoading(true);
      try {
        const uploads = files.map((file) => this.uploadSingleArticleImage(file));
        const results = await Promise.allSettled(uploads);
        let addedCount = 0;
        let errorMessage = null;

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            this.addArticleImage(result.value);
            addedCount += 1;
          } else if (result.status === 'rejected') {
            errorMessage = result.reason?.message || 'Bazı dosyalar yüklenemedi.';
          }
        }

        if (addedCount) {
          this.showSuccess(`${addedCount} görsel eklendi.`);
        }
        if (errorMessage) {
          this.showError(errorMessage);
        }
      } finally {
        this.setArticleMediaLoading(false);
      }
    }

    async uploadSingleArticleImage(file) {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({ folder: 'articles' });

      const response = await fetch(`/cms/media/upload?${params.toString()}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `${file.name} yüklenemedi`);
      }

      const result = await response.json();
      return this.normalizeArticleImageEntry(result.media);
    }

    handleArticleMediaListClick(event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const { action } = button.dataset;
      const item = button.closest('.article-media-item');
      if (!item) return;
      const index = Number(item.dataset.index);
      if (Number.isNaN(index)) return;

      if (action === 'article-media-remove') {
        this.removeArticleImage(index);
      } else if (action === 'article-media-move-up') {
        this.moveArticleImage(index, index - 1);
      } else if (action === 'article-media-move-down') {
        this.moveArticleImage(index, index + 1);
      }
    }

    handleArticleMediaListInput(event) {
      const input = event.target.closest('input[data-field]');
      if (!input) return;
      const item = input.closest('.article-media-item');
      if (!item) return;
      const index = Number(item.dataset.index);
      if (Number.isNaN(index)) return;
      const field = input.dataset.field;
      if (!field) return;
      this.updateArticleImageField(index, field, input.value);
    }

    removeArticleImage(index) {
      if (index < 0 || index >= this.articleImages.length) return;
      this.articleImages.splice(index, 1);
      this.renderArticleMediaList();
    }

    moveArticleImage(fromIndex, toIndex) {
      if (
        fromIndex < 0 ||
        fromIndex >= this.articleImages.length ||
        toIndex < 0 ||
        toIndex >= this.articleImages.length
      ) {
        return;
      }
      const [item] = this.articleImages.splice(fromIndex, 1);
      this.articleImages.splice(toIndex, 0, item);
      this.renderArticleMediaList();
    }

    updateArticleImageField(index, field, value) {
      const image = this.articleImages[index];
      if (!image) return;
      if (field === 'title') {
        image.title = value.trim();
      } else if (field === 'alt') {
        image.alt = value.trim();
      }
      this.syncArticleImagesField();
    }

    async openArticleMediaSelectModal() {
      try {
        const result = await this.fetchJson('/cms/media?folder=articles');
        const mediaItems = (result.media || []).filter((item) =>
          ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(
            (item.extension || '').toLowerCase()
          )
        );

        if (!mediaItems.length) {
          this.showError('Seçilebilecek görsel bulunamadı. Önce bir görsel yükleyin.');
          return;
        }

        this.buildArticleMediaSelectModal(mediaItems);
      } catch (error) {
        console.error('Article media select modal error:', error);
      }
    }

    buildArticleMediaSelectModal(mediaItems) {
      this.closeArticleMediaSelectModal();

      const overlay = document.createElement('div');
      overlay.className = 'article-media-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      overlay.innerHTML = `
        <div class="article-media-modal__backdrop" data-action="close-article-media-modal"></div>
        <div class="article-media-modal__dialog">
          <header class="article-media-modal__header">
            <h3>Medya Kütüphanesi</h3>
            <button type="button" class="article-media-modal__close" data-action="close-article-media-modal" aria-label="Kapat">×</button>
          </header>
          <div class="article-media-modal__grid" data-article-media-modal-grid></div>
        </div>
      `;

      const grid = overlay.querySelector('[data-article-media-modal-grid]');

      mediaItems.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'article-media-modal__item';
        card.innerHTML = `
          <div class="article-media-modal__preview">
            <img src="${item.url}" alt="${this.escapeHtml(item.filename || '')}">
          </div>
          <div class="article-media-modal__body">
            <h4 title="${this.escapeHtml(item.filename || '')}">${this.escapeHtml(item.filename || '')}</h4>
            <p>${this.escapeHtml(this.formatFileSize(item.size))}</p>
            <button type="button"
              class="cms-btn cms-btn-secondary"
              data-action="article-media-select-item"
              data-media-path="${item.path || item.filename}"
              data-media-url="${item.url}"
              data-media-filename="${item.filename || ''}"
              data-media-size="${item.size !== undefined ? item.size : ''}"
              data-media-uploaded="${item.uploadedAt || ''}">
              Seç
            </button>
          </div>
        `;
        grid.appendChild(card);
      });

      overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const { action } = button.dataset;
        if (action === 'close-article-media-modal') {
          this.closeArticleMediaSelectModal();
        } else if (action === 'article-media-select-item') {
          const image = this.normalizeArticleImageEntry({
            path: button.dataset.mediaPath,
            url: button.dataset.mediaUrl,
            filename: button.dataset.mediaFilename,
            size: button.dataset.mediaSize ? Number(button.dataset.mediaSize) : null,
            uploadedAt: button.dataset.mediaUploaded || null
          });
          if (image) {
            this.addArticleImage(image);
          }
        }
      });

      this.mediaSelectModalEscapeHandler = (event) => {
        if (event.key === 'Escape') {
          this.closeArticleMediaSelectModal();
        }
      };

      document.addEventListener('keydown', this.mediaSelectModalEscapeHandler);
      document.body.appendChild(overlay);
      this.mediaSelectModal = overlay;
    }

    closeArticleMediaSelectModal() {
      if (!this.mediaSelectModal) return;
      if (this.mediaSelectModalEscapeHandler) {
        document.removeEventListener('keydown', this.mediaSelectModalEscapeHandler);
        this.mediaSelectModalEscapeHandler = null;
      }
      this.mediaSelectModal.remove();
      this.mediaSelectModal = null;
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
            uploadedCount += 1;
          }
        } catch (error) {
          lastError = error;
          console.error('Media upload error:', error);
        }
      }

      if (uploadedCount > 0) {
        await this.loadMedia();
      } else {
        this.renderMediaList(this.state.media);
      }

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

      const params = new URLSearchParams();
      if (this.state.mediaCurrentFolder) {
        params.set('folder', this.state.mediaCurrentFolder);
      }

      const response = await fetch(`/cms/media/upload${params.toString() ? `?${params.toString()}` : ''}`, {
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
        const params = new URLSearchParams();
        if (this.state.mediaCurrentFolder) {
          params.set('folder', this.state.mediaCurrentFolder);
        }
        if (this.state.mediaSearchTerm) {
          params.set('search', this.state.mediaSearchTerm);
        }

        const result = await this.fetchJson(`/cms/media${params.toString() ? `?${params.toString()}` : ''}`);
        const media = result.media || [];

        this.state.media = media;
        this.state.mediaFolders = result.folders || [];
        this.state.mediaTree = result.tree || null;
        this.state.mediaBreadcrumbs = result.breadcrumbs || [];
        this.state.mediaCurrentFolder = result.currentFolder || '';

        this.renderMediaList(media);
        this.renderFolderTree(this.state.mediaTree);
        this.renderBreadcrumbs(this.state.mediaBreadcrumbs);
        this.updateMediaSearchInput(this.state.mediaSearchTerm);
      } catch (error) {
        console.error('Media load error:', error);
      }
    }

    async deleteMedia(path) {
      if (!path) return;

      const confirmed = window.confirm('Bu medya dosyasını silmek istediğinize emin misiniz?');
      if (!confirmed) return;

      try {
        const params = new URLSearchParams();
        params.set('path', path);
        const response = await fetch(`/cms/media?${params.toString()}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Dosya silinemedi');
        }

        await this.loadMedia();
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

    getMediaByPath(path) {
      return (this.state.media || []).find((item) => item.path === path);
    }

    getLastPathSegment(path) {
      if (!path) return '';
      const parts = path.split('/');
      return parts[parts.length - 1] || '';
    }

    async promptRenameMedia(path) {
      if (!path) return;
      const media = this.getMediaByPath(path);
      const currentName = media ? media.filename : this.getLastPathSegment(path);
      const stem = this.getFilenameStem(currentName);
      const extension = this.getFileExtension(currentName);
      const userInput = window.prompt('Yeni dosya adını girin (uzantısız):', stem);
      if (userInput === null) return;

      const trimmed = userInput.trim();
      if (!trimmed) {
        this.showError('Geçerli bir dosya adı girin.');
        return;
      }

      try {
        await this.renameMedia(path, trimmed + extension);
        await this.loadMedia();
        this.showSuccess('Dosya adı güncellendi.');
        this.closeAllMediaMenus();
      } catch (error) {
        this.showError(error.message || 'Dosya yeniden adlandırılamadı.');
      }
    }

    async renameMedia(path, newName) {
      const response = await fetch('/cms/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Dosya yeniden adlandırılamadı');
      }

      return response.json();
    }

    openFolder(folderPath) {
      const normalized = folderPath || '';
      this.state.mediaCurrentFolder = normalized;
      this.loadMedia();
    }

    renderFolderTree(tree) {
      if (!this.mediaTreeRoot) return;

      this.mediaTreeRoot.innerHTML = '';

      const rootItem = document.createElement('li');
      const rootButton = document.createElement('button');
      rootButton.className = 'media-tree__item';
      if (!this.state.mediaCurrentFolder) {
        rootButton.classList.add('is-active');
      }
      rootButton.dataset.action = 'open-folder';
      rootButton.dataset.folderPath = '';
      rootButton.textContent = 'Tüm Dosyalar';
      rootItem.appendChild(rootButton);
      this.mediaTreeRoot.appendChild(rootItem);

      if (!tree || !Array.isArray(tree.children)) return;

      const fragment = document.createDocumentFragment();
      tree.children.forEach((child) => {
        fragment.appendChild(this.createFolderTreeNode(child, 0));
      });
      this.mediaTreeRoot.appendChild(fragment);
    }

    createFolderTreeNode(node, depth = 0) {
      const li = document.createElement('li');
      li.className = 'media-tree__node';

      const entry = document.createElement('div');
      entry.className = 'media-tree__entry';
      entry.style.setProperty('--depth', depth);

      const openButton = document.createElement('button');
      openButton.className = 'media-tree__item';
      if (this.state.mediaCurrentFolder === node.path) {
        openButton.classList.add('is-active');
      }
      openButton.dataset.action = 'open-folder';
      openButton.dataset.folderPath = node.path;
      openButton.textContent = node.name;

      entry.appendChild(openButton);

      if (node.path) {
        const renameButton = document.createElement('button');
        renameButton.className = 'media-tree__rename';
        renameButton.dataset.action = 'rename-folder';
        renameButton.dataset.folderPath = node.path;
        renameButton.title = 'Klasörü yeniden adlandır';
        renameButton.setAttribute('aria-label', 'Klasörü yeniden adlandır');
        renameButton.textContent = '⋯';
        entry.appendChild(renameButton);
      }

      li.appendChild(entry);

      if (Array.isArray(node.children) && node.children.length > 0) {
        const childList = document.createElement('ul');
        childList.className = 'media-tree';
        node.children.forEach((child) => {
          childList.appendChild(this.createFolderTreeNode(child, depth + 1));
        });
        li.appendChild(childList);
      }

      return li;
    }

    renderBreadcrumbs(breadcrumbs) {
      if (!this.mediaBreadcrumbs) return;
      const trail = Array.isArray(breadcrumbs) ? breadcrumbs : [];
      const container = this.mediaBreadcrumbs;
      container.innerHTML = '';

      const fragment = document.createDocumentFragment();

      const rootButton = document.createElement('button');
      rootButton.className = 'media-breadcrumbs__link';
      if (!this.state.mediaCurrentFolder) {
        rootButton.classList.add('is-active');
      }
      rootButton.dataset.action = 'open-folder';
      rootButton.dataset.folderPath = '';
      rootButton.textContent = 'Tüm Dosyalar';
      fragment.appendChild(rootButton);

      trail.forEach((crumb) => {
        const separator = document.createElement('span');
        separator.className = 'media-breadcrumbs__separator';
        separator.textContent = '/';
        fragment.appendChild(separator);

        const button = document.createElement('button');
        button.className = 'media-breadcrumbs__link';
        if (this.state.mediaCurrentFolder === crumb.path) {
          button.classList.add('is-active');
        }
        button.dataset.action = 'open-folder';
        button.dataset.folderPath = crumb.path;
        button.textContent = crumb.name;
        fragment.appendChild(button);
      });

      container.appendChild(fragment);
    }

    handleMediaSearchInput(event) {
      const value = event.currentTarget.value;
      this.state.mediaSearchTerm = value.trim();
      this.updateMediaSearchInput(this.state.mediaSearchTerm);
      if (this.mediaSearchDebounce) {
        clearTimeout(this.mediaSearchDebounce);
      }
      this.mediaSearchDebounce = setTimeout(() => this.loadMedia(), 300);
    }

    updateMediaSearchInput(value) {
      if (this.mediaSearchInput) {
        this.mediaSearchInput.value = value || '';
      }
      if (this.mediaSearchClear) {
        this.mediaSearchClear.hidden = !(value && value.length);
      }
    }

    clearMediaSearch() {
      this.state.mediaSearchTerm = '';
      this.updateMediaSearchInput('');
      this.loadMedia();
    }

    promptCreateFolder() {
      const userInput = window.prompt('Yeni klasör adını girin:');
      if (userInput === null) return;
      const trimmed = userInput.trim();
      if (!trimmed) {
        this.showError('Geçerli bir klasör adı girin.');
        return;
      }
      this.createFolder(trimmed);
    }

    async createFolder(name) {
      try {
        const payload = {
          parent: this.state.mediaCurrentFolder,
          name
        };

        const response = await fetch('/cms/media/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Klasör oluşturulamadı');
        }

        const result = await response.json();
        const folder = result?.folder;
        if (folder && typeof folder.path === 'string') {
          this.state.mediaCurrentFolder = folder.path;
        }
        await this.loadMedia();
        this.showSuccess('Klasör oluşturuldu.');
      } catch (error) {
        this.showError(error.message || 'Klasör oluşturulamadı.');
      }
    }

    async promptRenameFolder(folderPath) {
      if (!folderPath) return;
      const currentName = this.getLastPathSegment(folderPath);
      const userInput = window.prompt('Yeni klasör adını girin:', currentName);
      if (userInput === null) return;

      const trimmed = userInput.trim();
      if (!trimmed) {
        this.showError('Geçerli bir klasör adı girin.');
        return;
      }

      try {
        const result = await this.renameFolder(folderPath, trimmed);
        const folder = result?.folder;
        if (folder && typeof folder.path === 'string' && this.state.mediaCurrentFolder === folderPath) {
          this.state.mediaCurrentFolder = folder.path;
        }
        await this.loadMedia();
        this.showSuccess('Klasör adı güncellendi.');
      } catch (error) {
        this.showError(error.message || 'Klasör yeniden adlandırılamadı.');
      }
    }

    async renameFolder(path, newName) {
      const response = await fetch('/cms/media/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Klasör yeniden adlandırılamadı');
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

