(() => {
  const INITIAL_STATE = window.__CMS_INITIAL_STATE__ || {};
  const DATE_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const MEDIA_BASE_PATH = '/uploads/media/';
  const LOGO_HEIGHT_DEFAULT = 44;
  const LOGO_HEIGHT_MIN = 24;
  const LOGO_HEIGHT_MAX = 160;

  class ColorUtils {
    static hexToHsl(hex) {
      let r = 0, g = 0, b = 0;
      if (hex.length === 4) {
        r = "0x" + hex[1] + hex[1];
        g = "0x" + hex[2] + hex[2];
        b = "0x" + hex[3] + hex[3];
      } else if (hex.length === 7) {
        r = "0x" + hex[1] + hex[2];
        g = "0x" + hex[3] + hex[4];
        b = "0x" + hex[5] + hex[6];
      }
      r /= 255;
      g /= 255;
      b /= 255;
      let cmin = Math.min(r, g, b),
        cmax = Math.max(r, g, b),
        delta = cmax - cmin,
        h = 0,
        s = 0,
        l = 0;

      if (delta == 0) h = 0;
      else if (cmax == r) h = ((g - b) / delta) % 6;
      else if (cmax == g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;

      h = Math.round(h * 60);
      if (h < 0) h += 360;

      l = (cmax + cmin) / 2;
      s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
      s = +(s * 100).toFixed(1);
      l = +(l * 100).toFixed(1);

      return { h, s, l };
    }

    static hslToHex(h, s, l) {
      s /= 100;
      l /= 100;
      let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
        m = l - c / 2,
        r = 0,
        g = 0,
        b = 0;

      if (0 <= h && h < 60) { r = c; g = x; b = 0; }
      else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
      else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
      else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
      else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
      else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

      r = Math.round((r + m) * 255).toString(16);
      g = Math.round((g + m) * 255).toString(16);
      b = Math.round((b + m) * 255).toString(16);

      if (r.length == 1) r = "0" + r;
      if (g.length == 1) g = "0" + g;
      if (b.length == 1) b = "0" + b;

      return "#" + r + g + b;
    }
  }

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
        mediaCurrentFolder: '',
        mediaBreadcrumbs: [],
        mediaSearchTerm: '',
        mediaSearchTerm: '',
        homepageLayout: initialState.homepageLayout || [],
        articleLayout: initialState.articleLayout || [],
        users: initialState.users || [],
        cmsTabs: initialState.cmsTabs || [],
        targetOptions: initialState.targetOptions || [],
        carouselLimit: initialState.carouselLimit || 5,
        anaMansetLimit: initialState.anaMansetLimit || 25
      };

      this.mediaLoaded = Array.isArray(this.state.media) && this.state.media.length > 0;
      this.mediaLoadingPromise = null;

      this.currentArticleId = null;
      this.mediaSearchDebounce = null;
      this.articleImages = [];
      this.headlineImage = null;
      this.mediaSelectModal = null;
      this.mediaSelectModalEscapeHandler = null;
      this.cacheDom();
      this.bindEvents();
      this.initializeArticleMediaManager();
      this.initializeHeadlineMediaManager();
      this.initializeLayoutManager();
      this.initializeArticleLayoutManager();
      this.initializeHeadlineLayoutManager();
      this.initializeAnaMansetLayoutManager();
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
      this.categorySelect = this.articleForm ? this.articleForm.querySelector('[name="category"]') : null;

      this.settingsSection = document.querySelector('[data-cms="settings-section"]');
      this.settingsForm = document.querySelector('[data-cms="settings-form"]');

      this.brandingSection = document.querySelector('[data-cms="branding-section"]');
      this.brandingForm = document.querySelector('[data-cms="branding-form"]');
      this.brandingPreview = document.querySelector('[data-cms="branding-preview"]');
      this.brandingPreviewTopBar = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-top-bar"]') : null;
      this.brandingPreviewDate = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-date"]') : null;
      this.brandingPreviewHeaderMain = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-header-main"]') : null;
      this.brandingPreviewHeaderLogo = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-header-logo"]') : null;
      this.brandingPreviewSiteName = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-site-name"]') : null;
      this.brandingPreviewHeaderBorder = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-header-border"]') : null;
      this.brandingPreviewNav = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-nav"]') : null;
      this.brandingPreviewNavLinks = this.brandingPreview ? Array.from(this.brandingPreview.querySelectorAll('[data-cms="branding-preview-nav-link"]')) : [];
      this.brandingPreviewBody = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-body"]') : null;
      this.brandingPreviewSectionTitle = this.brandingPreview ? this.brandingPreview.querySelector('.branding-preview__section-title') : null;
      this.brandingPreviewNewsCategories = this.brandingPreview ? Array.from(this.brandingPreview.querySelectorAll('.branding-preview__news-category')) : [];
      this.brandingPreviewNewsImages = this.brandingPreview ? Array.from(this.brandingPreview.querySelectorAll('.branding-preview__news-image')) : [];
      this.brandingPreviewFooter = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-footer"]') : null;
      this.brandingPreviewFooterLogo = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-footer-logo"]') : null;
      this.brandingPreviewFooterLinks = this.brandingPreview ? Array.from(this.brandingPreview.querySelectorAll('.branding-preview__footer-links span')) : [];
      this.brandingPreviewSiteName = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-site-name"]') : null;
      this.brandingPreviewNav = this.brandingPreview ? this.brandingPreview.querySelector('[data-cms="branding-preview-nav"]') : null;
      this.brandingPreviewNavLinks = this.brandingPreview ? this.brandingPreview.querySelectorAll('[data-cms="branding-preview-nav-link"]') : [];
      this.brandingColorValueNodes = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-color-value]') : [];
      this.brandingColorInputs = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-color]') : [];
      this.brandingFileInputs = this.brandingForm ? this.brandingForm.querySelectorAll('[data-branding-upload]') : [];
      this.brandingSuggestionButtons = this.brandingForm ? this.brandingForm.querySelectorAll('[data-action="suggest-color"]') : [];
      this.brandingSiteNameInput = this.brandingForm ? this.brandingForm.querySelector('#branding-site-name') : null;
      this.brandingLogoHeightInput = this.brandingForm ? this.brandingForm.querySelector('[data-branding-logo-height]') : null;
      this.brandingFaviconPreviewImg = this.brandingForm ? this.brandingForm.querySelector('[data-branding-favicon-preview-img]') : null;
      this.brandingFaviconPlaceholder = this.brandingForm ? this.brandingForm.querySelector('[data-branding-favicon-placeholder]') : null;

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
      this.headlineMediaManager = this.articleForm ? this.articleForm.querySelector('[data-cms="headline-media-manager"]') : null;
      this.headlineImageField = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-headline-image]') : null;
      this.headlineMediaInput = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-headline-media-input]') : null;
      this.headlineMediaList = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-headline-media-list]') : null;
      this.headlineMediaEmpty = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-headline-media-empty]') : null;
      this.headlineUploadBtn = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-action="headline-media-upload"]') : null;
      this.headlineSelectBtn = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-action="headline-media-select"]') : null;
      this.headlineRemoveBtn = this.headlineMediaManager ? this.headlineMediaManager.querySelector('[data-action="headline-media-remove"]') : null;
      this.videoUploadInput = document.querySelector('#field-video-upload');
      this.uploadVideoBtn = document.querySelector('[data-action="upload-video"]');
      this.selectVideoBtn = document.querySelector('[data-action="select-video-media"]');
      this.videoUrlInput = document.querySelector('#field-videoUrl');
      this.mediaTreeContainer = document.querySelector('[data-cms="media-tree"]');
      this.mediaTreeRoot = document.querySelector('[data-cms="media-tree-root"]');
      this.mediaBreadcrumbs = document.querySelector('[data-cms="media-breadcrumbs"]');
      this.mediaSearchInput = document.querySelector('[data-cms="media-search-input"]');
      this.mediaSearchClear = document.querySelector('[data-action="clear-media-search"]');
      this.createFolderBtn = document.querySelector('[data-action="create-folder"]');

      this.usersSection = document.querySelector('[data-cms="users-section"]');
      this.usersTable = document.querySelector('[data-cms="users-table"]');
      this.usersTableBody = this.usersTable ? this.usersTable.querySelector('tbody') : null;
      this.refreshUsersBtn = document.querySelector('[data-action="refresh-users"]');
      this.newUserBtn = document.querySelector('[data-action="new-user"]');

      this.userEditorSection = document.querySelector('[data-cms="user-editor-section"]');
      this.userForm = document.querySelector('[data-cms="user-form"]');
      this.userEditorTitle = document.querySelector('[data-cms="user-editor-title"]');
      this.cancelUserEditorBtn = document.querySelector('[data-action="cancel-user-editor"]');

      this.logoutBtn = document.querySelector('[data-action="logout"]');
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

      if (this.logoutBtn) {
        this.logoutBtn.addEventListener('click', () => {
          this.logout();
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

      if (this.categoriesSection) {
        this.categoriesSection.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action, categoryId } = button.dataset;

          if (action === 'new-category') {
            this.promptCreateCategory();
          } else if (action === 'edit-category' && categoryId) {
            this.promptEditCategory(categoryId);
          } else if (action === 'delete-category' && categoryId) {
            this.deleteCategory(categoryId);
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
          if (input.dataset.brandingColor === 'primary') {
            this.generateColorSuggestions(input.value);
          }
        });
        input.addEventListener('change', (event) => {
          this.handleBrandingColorInput(event);
          if (input.dataset.brandingColor === 'primary') {
            this.generateColorSuggestions(input.value);
          }
        });
      });

      this.brandingSuggestionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetKey = btn.dataset.suggestFor;
          const color = btn.dataset.suggestedColor;
          if (targetKey && color) {
            this.applySuggestedColor(targetKey, color);
          }
        });
      });

      this.brandingFileInputs.forEach((input) => {
        input.addEventListener('change', (event) => {
          this.handleBrandingFileInput(event);
        });
      });

      if (this.brandingSiteNameInput) {
        this.brandingSiteNameInput.addEventListener('input', (event) => {
          this.handleBrandingSiteNameInput(event);
        });
      }

      if (this.brandingLogoHeightInput) {
        ['input', 'change'].forEach((eventName) => {
          this.brandingLogoHeightInput.addEventListener(eventName, () => this.handleBrandingLogoHeightInput());
        });
      }

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

      if (this.headlineUploadBtn && this.headlineMediaInput) {
        this.headlineUploadBtn.addEventListener('click', () => this.headlineMediaInput.click());
      }

      if (this.headlineMediaInput) {
        this.headlineMediaInput.addEventListener('change', (event) => this.handleHeadlineMediaUpload(event));
      }

      if (this.headlineSelectBtn) {
        this.headlineSelectBtn.addEventListener('click', () => this.openHeadlineImageSelectModal());
      }

      if (this.headlineRemoveBtn) {
        this.headlineRemoveBtn.addEventListener('click', () => this.clearHeadlineImage());
      }

      if (this.headlineMediaList) {
        this.headlineMediaList.addEventListener('input', (event) => this.handleHeadlineFieldInput(event));
      }

      if (this.uploadVideoBtn && this.videoUploadInput) {
        this.uploadVideoBtn.addEventListener('click', () => this.videoUploadInput.click());
      }

      if (this.videoUploadInput) {
        this.videoUploadInput.addEventListener('change', (event) => this.handleVideoUpload(event));
      }

      if (this.selectVideoBtn) {
        this.selectVideoBtn.addEventListener('click', () => this.openVideoMediaSelectModal());
      }

      if (this.refreshUsersBtn) {
        this.refreshUsersBtn.addEventListener('click', () => this.loadUsers());
      }

      if (this.newUserBtn) {
        this.newUserBtn.addEventListener('click', () => this.openUserEditor());
      }

      if (this.usersTableBody) {
        this.usersTableBody.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-action]');
          if (!button) return;
          const { action, userId } = button.dataset;
          if (action === 'edit-user') {
            this.openUserEditor(userId);
          } else if (action === 'delete-user') {
            this.deleteUser(userId);
          }
        });
      }

      if (this.cancelUserEditorBtn) {
        this.cancelUserEditorBtn.addEventListener('click', () => this.showSection('users'));
      }

      if (this.userForm) {
        this.userForm.addEventListener('submit', (event) => {
          event.preventDefault();
          this.saveUser();
        });
      }
    }

    renderInitialState() {
      this.showSection('dashboard');
      this.renderStats(this.state.stats);
      this.renderArticlesTable(this.state.articles);
      this.renderRecentArticles(this.state.recentArticles);
      this.renderCategories(this.state.categories);
      this.renderCategoryOptions(this.state.categories);
      this.updateCategoryStats();
      this.populateSettingsForm(this.state.settings);
      this.populateBrandingForm(this.state.branding);
      if (this.mediaLoaded) {
        this.renderMediaList(this.state.media);
        this.renderFolderTree(this.state.mediaTree);
        this.renderBreadcrumbs(this.state.mediaBreadcrumbs);
        this.updateMediaSearchInput(this.state.mediaSearchTerm);
      } else {
        this.updateMediaSearchInput('');
      }
      this.renderUsersTable(this.state.users);

      // Apply permission-based UI restrictions
      const user = this.state.currentUser;
      if (user) {
        const hasPermission = (perm) => {
          return user.isMaster || user.role === 'admin' || (user.permissions && user.permissions.includes(perm));
        };

        const tabPermissions = {};
        if (this.state.cmsTabs) {
          this.state.cmsTabs.forEach(tab => {
            tabPermissions[`#${tab.id}`] = tab.permission;
          });
        }

        Object.entries(tabPermissions).forEach(([selector, permission]) => {
          if (!hasPermission(permission)) {
            const link = document.querySelector(`a[href="${selector}"]`);
            if (link) link.parentElement.style.display = 'none';
          }
        });

        // Additional specific checks for actions (double protection)
        if (!hasPermission('manage_settings')) {
          // Ensure settings/branding forms are disabled or hidden if they were somehow accessed
          if (this.brandingForm) this.brandingForm.remove();
          if (this.settingsForm) this.settingsForm.remove();
        }
      }
    }

    async showSection(sectionId) {
      const sectionTitles = {
        dashboard: 'Dashboard',
        articles: 'Haberler',
        categories: 'Kategoriler',
        media: 'Medya Kontrolleri',
        branding: 'Marka',
        settings: 'Site Ayarları',
        users: 'Kullanıcı Yönetimi'
      };

      // Hide all sections
      this.sections.forEach(section => {
        this.setSectionVisibility(section, false);
      });

      // Show target section
      const targetSection = document.getElementById(sectionId);
      if (targetSection) {
        this.setSectionVisibility(targetSection, true);
      }

      // Update active nav link
      this.navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });

      if (this.pageTitleElement) {
        this.pageTitleElement.textContent = sectionTitles[sectionId] || 'Dashboard';
      }

      // Load specific data based on section
      if (sectionId === 'categories') {
        await this.loadCategories();
      } else if (sectionId === 'media') {
        await this.loadMedia();
      } else if (sectionId === 'headline-layout') {
        await this.loadHeadlineLayout();
      }

      if (sectionId === 'layout') {
        // Update category dropdowns when showing layout section
        this.updateLayoutCategorySelects();
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
              <td><span class="${statusClass}" data-action="toggle-status" data-article-id="${article.id}" style="cursor: pointer;" title="Durumu değiştirmek için tıklayın">${article.status === 'hidden' ? 'Gizli' : 'Yayında'}</span></td>
              <td>${this.formatDate(article.creationDate, '-')}</td>
              <td class="cms-actions">
                <button class="cms-btn cms-btn-secondary" data-action="edit-article" data-article-id="${article.id}">Düzenle</button>
                <button class="cms-btn cms-btn-danger" data-action="delete-article" data-article-id="${article.id}">Sil</button>
              </td>
            </tr>
          `;
        })
        .join('');

      // Add event listeners for status toggle
      this.articleTableBody.querySelectorAll('[data-action="toggle-status"]').forEach(el => {
        el.addEventListener('click', (e) => {
          const articleId = e.currentTarget.dataset.articleId;
          this.toggleArticleStatus(articleId);
        });
      });
    }

    async toggleArticleStatus(articleId) {
      const article = this.state.articles.find(a => a.id === articleId);
      if (!article) return;

      const newStatus = article.status === 'hidden' ? 'visible' : 'hidden';

      try {
        const response = await fetch(`/cms/articles/${articleId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error();

        // Optimistic update
        article.status = newStatus;
        this.renderArticlesTable(this.state.articles);
        this.updateStatsFromPayload({ articles: this.state.articles });
        this.showSuccess(`Haber durumu güncellendi: ${newStatus === 'hidden' ? 'Gizli' : 'Yayında'}`);

      } catch (error) {
        this.showError('Durum güncellenemedi.');
      }
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

    renderCategoryOptions(categories) {
      if (!this.categorySelect) return;

      const options = Array.isArray(categories) ? categories : [];
      const currentValue = this.categorySelect.value;

      this.categorySelect.innerHTML = [
        '<option value="">Kategori seçin</option>',
        ...options.map(
          (category) =>
            `<option value="${this.escapeHtml(category.name)}">${this.escapeHtml(category.name)}</option>`
        )
      ].join('');

      if (currentValue && options.some((category) => category.name === currentValue)) {
        this.categorySelect.value = currentValue;
      }
    }

    updateCategoryStats(count) {
      const totalCategories =
        count !== undefined
          ? count
          : Array.isArray(this.state.categories)
            ? this.state.categories.length
            : 0;

      this.state.stats = {
        ...this.state.stats,
        totalCategories
      };

      this.renderStats(this.state.stats);
    }

    applyCategories(categories) {
      const list = Array.isArray(categories) ? categories : [];
      this.state.categories = list;
      this.renderCategories(list);
      this.renderCategoryOptions(list);
      this.updateCategoryStats(list.length);
      this.updateLayoutCategorySelects();
    }

    async loadUsers() {
      try {
        const response = await fetch('/api/auth/users');
        if (!response.ok) throw new Error();
        const users = await response.json();
        this.state.users = users;
        this.renderUsersTable(users);
      } catch (error) {
        this.showError('Kullanıcılar yüklenemedi.');
      }
    }

    renderUsersTable(users) {
      if (!this.usersTableBody) return;
      if (!Array.isArray(users) || users.length === 0) {
        this.usersTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="cms-empty-state">Henüz kullanıcı bulunmuyor.</td>
          </tr>
        `;
        return;
      }

      this.usersTableBody.innerHTML = users
        .map((user) => {
          const roleBadge = user.role === 'admin'
            ? '<span class="cms-badge cms-badge--primary">Yönetici</span>'
            : '<span class="cms-badge">Editör</span>';

          const actions = user.id === 'master-admin'
            ? '<span class="cms-text-muted">Sistem Yöneticisi</span>'
            : `
              <button class="cms-btn cms-btn-secondary" data-action="edit-user" data-user-id="${user.id}">Düzenle</button>
              <button class="cms-btn cms-btn-danger" data-action="delete-user" data-user-id="${user.id}">Sil</button>
            `;

          return `
            <tr data-user-id="${user.id}">
              <td><strong>${this.escapeHtml(user.username)}</strong></td>
              <td>${this.escapeHtml(user.displayName || '-')}</td>
              <td>${roleBadge}</td>
              <td>${this.formatDate(user.lastLogin, '-')}</td>
              <td>${this.formatDate(user.createdAt, '-')}</td>
              <td class="cms-actions">${actions}</td>
            </tr>
          `;
        })
        .join('');
    }

    openUserEditor(userId = null) {
      if (!this.userEditorSection || !this.userForm) return;

      // Hide every other section using the shared helper so inline styles are cleaned up
      this.sections.forEach(section => this.setSectionVisibility(section, false));
      this.setSectionVisibility(this.userEditorSection, true);

      this.navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === '#users');
      });

      this.userEditorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

      this.userForm.reset();
      const idInput = this.userForm.querySelector('[name="id"]');
      const usernameInput = this.userForm.querySelector('[name="username"]');
      const passwordInput = this.userForm.querySelector('[name="password"]');

      if (userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (!user) return;

        this.userEditorTitle.textContent = 'Kullanıcı Düzenle';
        if (this.pageTitleElement) {
          this.pageTitleElement.textContent = 'Kullanıcı Düzenle';
        }
        idInput.value = user.id;
        usernameInput.value = user.username;
        usernameInput.disabled = true; // Cannot change username
        passwordInput.placeholder = 'Değiştirmek için doldurun';
        passwordInput.required = false;

        this.userForm.querySelector('[name="displayName"]').value = user.displayName || '';
        this.userForm.querySelector('[name="role"]').value = user.role || 'editor';

        // Permissions
        const permissions = user.permissions || [];
        this.userForm.querySelectorAll('[name="permissions"]').forEach(cb => {
          cb.checked = permissions.includes(cb.value);
        });
      } else {
        this.userEditorTitle.textContent = 'Yeni Kullanıcı';
        if (this.pageTitleElement) {
          this.pageTitleElement.textContent = 'Yeni Kullanıcı';
        }
        idInput.value = '';
        usernameInput.value = '';
        usernameInput.disabled = false;
        passwordInput.placeholder = '';
        passwordInput.required = true;
        this.userForm.querySelector('[name="role"]').value = 'editor';
        this.userForm.querySelectorAll('[name="permissions"]').forEach(cb => cb.checked = false);
      }
    }

    async saveUser() {
      const formData = new FormData(this.userForm);
      const data = Object.fromEntries(formData.entries());

      // Handle permissions array
      const permissions = [];
      this.userForm.querySelectorAll('[name="permissions"]:checked').forEach(cb => {
        permissions.push(cb.value);
      });
      data.permissions = permissions;

      const isEdit = !!data.id;
      const url = isEdit ? `/api/auth/users/${data.id}` : '/api/auth/users';
      const method = isEdit ? 'PUT' : 'POST';

      if (!data.password && isEdit) {
        delete data.password;
      }

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'İşlem başarısız');

        this.showSuccess(isEdit ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu');
        this.loadUsers();
        this.showSection('users');
      } catch (error) {
        this.showError(error.message);
      }
    }

    async deleteUser(userId) {
      if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;

      try {
        const response = await fetch(`/api/auth/users/${userId}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('Silme işlemi başarısız');

        this.showSuccess('Kullanıcı silindi');
        this.loadUsers();
      } catch (error) {
        this.showError(error.message);
      }
    }

    updateLayoutCategorySelects() {
      console.log('🔵 updateLayoutCategorySelects called, categories:', this.state.categories);
      if (!this.layoutTable) return;

      const categorySelects = this.layoutTable.querySelectorAll('select[data-config="categorySlug"]');
      console.log('🔵 Found category selects:', categorySelects.length);

      categorySelects.forEach(select => {
        const widgetIndex = parseInt(select.dataset.widgetIndex);

        // Get the current value from widget config, not from DOM
        // Check both categorySlug (new) and slug (old) for compatibility
        const widget = this.state.homepageLayout[widgetIndex];
        const currentValue = widget && widget.config ?
          (widget.config.categorySlug || widget.config.slug) : '';

        console.log(`🔵 Widget ${widgetIndex}: configured category = ${currentValue}`);

        // Rebuild options
        if (this.state.categories.length > 0) {
          select.innerHTML = this.state.categories.map(cat =>
            `<option value="${this.escapeHtml(cat.slug)}"
                    ${cat.slug === currentValue ? 'selected' : ''}>
              ${this.escapeHtml(cat.name)}
            </option>`
          ).join('');

          // If previously selected category no longer exists, select first available
          if (currentValue && !this.state.categories.find(c => c.slug === currentValue)) {
            select.value = this.state.categories[0].slug;
            this.updateWidgetConfig(widgetIndex, 'categorySlug', select);
          }
        } else {
          // No categories available
          select.innerHTML = '<option value="">Kategori bulunamadı</option>';
        }
      });
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
        footerLogo: '',
        favicon: '',
        headerLogoHeight: LOGO_HEIGHT_DEFAULT
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

      if (this.brandingLogoHeightInput) {
        this.brandingLogoHeightInput.value = current.headerLogoHeight;
      }

      this.updateBrandingPreview(current);
      this.updateFaviconPreview(current.favicon);

      if (this.pageSubtitleElement) {
        this.pageSubtitleElement.textContent = current.siteName || 'UHA News';
      }

      // Generate initial suggestions based on primary color
      if (current.primaryColor) {
        this.generateColorSuggestions(current.primaryColor);
      }
    }

    generateColorSuggestions(primaryHex) {
      if (!primaryHex) return;

      // Helper function to clamp values between 0 and 100
      const clamp = (value) => Math.max(0, Math.min(100, value));

      // Get primary color HSL values
      const hsl = ColorUtils.hexToHsl(primaryHex);
      const Hp = hsl.h;
      const Sp = hsl.s;
      const Lp = hsl.l;

      const suggestions = {};

      // İkincil Renk (Secondary)
      // H = Hp ± 5, S = Sp - 15, L = Lp + 10
      const secondaryH = (Hp + 5) % 360; // Using +5 for consistency
      const secondaryS = clamp(Sp - 15);
      const secondaryL = clamp(Lp + 10);
      suggestions.secondary = ColorUtils.hslToHex(secondaryH, secondaryS, secondaryL);

      // Vurgu Rengi (Accent)
      // H = Hp ± 12, S = min(100, Sp + 25), L = Lp + 8
      const accentH = (Hp + 12) % 360; // Using +12 for consistency
      const accentS = Math.min(100, Sp + 25);
      const accentL = clamp(Lp + 8);
      suggestions.accent = ColorUtils.hslToHex(accentH, accentS, accentL);

      // Logo Metin Rengi (LogoText)
      // If Lp < 50: H = Hp, S = Sp * 0.2, L = 85
      // Else: H = Hp, S = Sp * 0.2, L = 15
      const logoTextH = Hp;
      const logoTextS = clamp(Sp * 0.2);
      const logoTextL = Lp < 50 ? 85 : 15;
      suggestions.logoText = ColorUtils.hslToHex(logoTextH, logoTextS, logoTextL);

      // Navigasyon Arkaplan Rengi (NavBackground)
      // H = Hp, S = Sp - 20, L = Lp - 5
      const navBgH = Hp;
      const navBgS = clamp(Sp - 20);
      const navBgL = clamp(Lp - 5);
      suggestions.navBackground = ColorUtils.hslToHex(navBgH, navBgS, navBgL);

      // İkincil Metin Rengi (NavText/SecondaryText)
      // If NavBackground L < 50: H = Hp, S = 5, L = 85
      // Else: H = Hp, S = 5, L = 20
      const navTextH = Hp;
      const navTextS = 5;
      const navTextL = navBgL < 50 ? 85 : 20;
      suggestions.navText = ColorUtils.hslToHex(navTextH, navTextS, navTextL);

      this.brandingSuggestionButtons.forEach(btn => {
        const key = btn.dataset.suggestFor;
        if (suggestions[key]) {
          btn.hidden = false;
          btn.dataset.suggestedColor = suggestions[key];
          const preview = btn.querySelector('.cms-color-suggestion__preview');
          if (preview) {
            preview.style.backgroundColor = suggestions[key];
          }
        }
      });
    }

    applySuggestedColor(key, color) {
      const input = this.brandingForm.querySelector(`[data-branding-color="${key}"]`);
      if (input) {
        input.value = color;
        // Trigger input event to update preview and values
        input.dispatchEvent(new Event('input'));

        // Show a small toast or feedback
        this.showToast('Önerilen renk uygulandı', 'success');
      }
    }

    updateBrandingColorValue(key, value) {
      this.brandingColorValueNodes.forEach((node) => {
        if (node.dataset.brandingColorValue === key) {
          node.textContent = value;
        }
      });
    }

    updateBrandingPreview(branding) {
      if (!branding) return;

      const primaryColor = branding.primaryColor || '#1a365d';
      const secondaryColor = branding.secondaryColor || '#2d3748';
      const accentColor = branding.accentColor || '#3182ce';
      const logoTextColor = branding.logoTextColor || '#3182ce';
      const navTextColor = branding.navTextColor || '#ffffff';
      const navBackgroundColor = branding.navBackgroundColor || '#1a365d';
      const siteName = branding.siteName || 'UHA News';
      const headerLogoHeight = this.normalizeLogoHeight(branding.headerLogoHeight);
      branding.headerLogoHeight = headerLogoHeight;

      // Top Bar (Primary Color)
      if (this.brandingPreviewTopBar) {
        this.brandingPreviewTopBar.style.backgroundColor = primaryColor;
      }
      if (this.brandingPreviewDate) {
        this.brandingPreviewDate.style.color = navTextColor;
      }

      // Main Header
      if (this.brandingPreviewHeaderMain) {
        this.brandingPreviewHeaderMain.style.backgroundColor = primaryColor;
      }
      if (this.brandingPreviewSiteName) {
        this.brandingPreviewSiteName.textContent = siteName;
        this.brandingPreviewSiteName.style.color = logoTextColor;
      }
      if (this.brandingPreviewHeaderBorder) {
        this.brandingPreviewHeaderBorder.style.borderBottomColor = accentColor;
      }

      // Navigation Bar
      if (this.brandingPreviewNav) {
        this.brandingPreviewNav.style.backgroundColor = navBackgroundColor;
      }
      if (this.brandingPreviewNavLinks && this.brandingPreviewNavLinks.length > 0) {
        this.brandingPreviewNavLinks.forEach(link => {
          link.style.color = navTextColor;
        });
      }

      // Content Area
      if (this.brandingPreviewSectionTitle) {
        this.brandingPreviewSectionTitle.style.color = primaryColor;
      }
      if (this.brandingPreviewNewsCategories && this.brandingPreviewNewsCategories.length > 0) {
        this.brandingPreviewNewsCategories.forEach(category => {
          category.style.backgroundColor = accentColor;
        });
      }
      if (this.brandingPreviewNewsImages && this.brandingPreviewNewsImages.length > 0) {
        this.brandingPreviewNewsImages.forEach(image => {
          image.style.background = `linear-gradient(135deg, ${accentColor}, ${primaryColor})`;
        });
      }

      // Footer (Primary Color)
      if (this.brandingPreviewFooter) {
        this.brandingPreviewFooter.style.backgroundColor = primaryColor;
      }
      if (this.brandingPreviewFooterLinks && this.brandingPreviewFooterLinks.length > 0) {
        this.brandingPreviewFooterLinks.forEach(link => {
          link.style.color = navTextColor;
        });
      }

      // Handle header logo - only show img if logo exists, otherwise show site name
      if (branding.headerLogo) {
        if (this.brandingPreviewHeaderLogo) {
          if (this.brandingPreviewHeaderLogo.tagName === 'IMG') {
            this.brandingPreviewHeaderLogo.src = branding.headerLogo;
            this.applyPreviewLogoHeight(this.brandingPreviewHeaderLogo, headerLogoHeight);
          } else {
            const img = document.createElement('img');
            img.src = branding.headerLogo;
            img.alt = 'Logo önizleme';
            img.className = 'branding-preview__logo-img';
            img.dataset.cms = 'branding-preview-header-logo';
            this.applyPreviewLogoHeight(img, headerLogoHeight);
            this.brandingPreviewHeaderLogo.replaceWith(img);
            this.brandingPreviewHeaderLogo = img;
          }
        } else if (this.brandingPreviewHeaderMain) {
          const headerContent = this.brandingPreviewHeaderMain.querySelector('.branding-preview__header-content');
          if (headerContent) {
            // Remove site name if it exists
            if (this.brandingPreviewSiteName) {
              this.brandingPreviewSiteName.remove();
            }
            const img = document.createElement('img');
            img.src = branding.headerLogo;
            img.alt = 'Logo önizleme';
            img.className = 'branding-preview__logo-img';
            img.dataset.cms = 'branding-preview-header-logo';
            this.applyPreviewLogoHeight(img, headerLogoHeight);
            headerContent.appendChild(img);
            this.brandingPreviewHeaderLogo = img;
          }
        }
      } else {
        // Show site name if logo doesn't exist
        if (this.brandingPreviewHeaderLogo && this.brandingPreviewHeaderLogo.tagName === 'IMG') {
          const headerContent = this.brandingPreviewHeaderLogo.parentElement;
          if (headerContent) {
            this.brandingPreviewHeaderLogo.remove();
            const siteNameSpan = document.createElement('span');
            siteNameSpan.className = 'branding-preview__site-name';
            siteNameSpan.dataset.cms = 'branding-preview-site-name';
            siteNameSpan.textContent = siteName;
            siteNameSpan.style.color = logoTextColor;
            headerContent.appendChild(siteNameSpan);
            this.brandingPreviewSiteName = siteNameSpan;
            this.brandingPreviewHeaderLogo = null;
          }
        } else if (this.brandingPreviewSiteName) {
          this.brandingPreviewSiteName.textContent = siteName;
          this.brandingPreviewSiteName.style.color = logoTextColor;
        }
      }

      // Handle footer logo
      if (this.brandingPreviewFooterLogo) {
        if (branding.footerLogo) {
          if (this.brandingPreviewFooterLogo.tagName !== 'IMG') {
            const img = document.createElement('img');
            img.src = branding.footerLogo;
            img.alt = 'Footer logo önizleme';
            img.className = 'branding-preview__footer-logo-img';
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
            img.className = 'branding-preview__footer-logo-img';
            img.dataset.cms = 'branding-preview-footer-logo';
            this.brandingPreviewFooterLogo.replaceWith(img);
            this.brandingPreviewFooterLogo = img;
          } else {
            this.brandingPreviewFooterLogo.src = branding.headerLogo;
          }
        } else {
          if (this.brandingPreviewFooterLogo.tagName === 'IMG') {
            const placeholder = document.createElement('div');
            placeholder.className = 'branding-preview__footer-logo-text';
            placeholder.dataset.cms = 'branding-preview-footer-logo';
            placeholder.textContent = siteName;
            placeholder.style.color = accentColor;
            this.brandingPreviewFooterLogo.replaceWith(placeholder);
            this.brandingPreviewFooterLogo = placeholder;
          } else {
            this.brandingPreviewFooterLogo.textContent = siteName;
            this.brandingPreviewFooterLogo.style.color = accentColor;
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
      const logoHeight = this.getCurrentLogoHeight();
      if (target === 'header') {
        if (this.brandingPreviewHeaderLogo) {
          if (this.brandingPreviewHeaderLogo.tagName === 'IMG') {
            this.brandingPreviewHeaderLogo.src = url;
            this.applyPreviewLogoHeight(this.brandingPreviewHeaderLogo, logoHeight);
          } else {
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Logo önizleme';
            img.className = 'branding-preview__logo-img';
            img.dataset.cms = 'branding-preview-header-logo';
            this.applyPreviewLogoHeight(img, logoHeight);
            this.brandingPreviewHeaderLogo.replaceWith(img);
            this.brandingPreviewHeaderLogo = img;
          }
        } else if (this.brandingPreviewHeaderMain) {
          const headerContent = this.brandingPreviewHeaderMain.querySelector('.branding-preview__header-content');
          if (headerContent) {
            // Remove site name if it exists
            if (this.brandingPreviewSiteName) {
              this.brandingPreviewSiteName.remove();
            }
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Logo önizleme';
            img.className = 'branding-preview__logo-img';
            img.dataset.cms = 'branding-preview-header-logo';
            this.applyPreviewLogoHeight(img, logoHeight);
            headerContent.appendChild(img);
            this.brandingPreviewHeaderLogo = img;
          }
        }
      }
      if (target === 'footer' && this.brandingPreviewFooterLogo) {
        if (this.brandingPreviewFooterLogo.tagName === 'IMG') {
          this.brandingPreviewFooterLogo.src = url;
        } else {
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Footer logo önizleme';
          img.className = 'branding-preview__footer-logo-img';
          img.dataset.cms = 'branding-preview-footer-logo';
          this.brandingPreviewFooterLogo.replaceWith(img);
          this.brandingPreviewFooterLogo = img;
        }
      }

      if (target === 'favicon') {
        this.updateFaviconPreview(url);
      }
    }

    updateFaviconPreview(src) {
      if (this.brandingFaviconPreviewImg) {
        if (src) {
          this.brandingFaviconPreviewImg.src = src;
          this.brandingFaviconPreviewImg.hidden = false;
          if (this.brandingFaviconPlaceholder) {
            this.brandingFaviconPlaceholder.hidden = true;
          }
        } else {
          this.brandingFaviconPreviewImg.hidden = true;
          if (this.brandingFaviconPlaceholder) {
            this.brandingFaviconPlaceholder.hidden = false;
          }
        }
      }
    }

    handleBrandingSiteNameInput(event) {
      const input = event.currentTarget;
      if (!input) return;
      const siteName = input.value.trim() || 'UHA News';

      // Update preview site name in real-time
      if (this.brandingPreviewSiteName) {
        this.brandingPreviewSiteName.textContent = siteName;
      }

      // Update state
      if (this.state.branding) {
        this.state.branding.siteName = siteName;
      }
    }

    handleBrandingLogoHeightInput() {
      if (!this.brandingLogoHeightInput || !this.state.branding) return;
      const value = this.normalizeLogoHeight(this.brandingLogoHeightInput.value);
      this.brandingLogoHeightInput.value = value;
      this.state.branding.headerLogoHeight = value;
      this.updateBrandingPreview(this.state.branding);
    }

    normalizeLogoHeight(value) {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.min(Math.max(parsed, LOGO_HEIGHT_MIN), LOGO_HEIGHT_MAX);
      }
      return LOGO_HEIGHT_DEFAULT;
    }

    getCurrentLogoHeight() {
      if (this.state.branding && this.state.branding.headerLogoHeight !== undefined) {
        return this.normalizeLogoHeight(this.state.branding.headerLogoHeight);
      }
      if (this.brandingLogoHeightInput) {
        return this.normalizeLogoHeight(this.brandingLogoHeightInput.value);
      }
      return LOGO_HEIGHT_DEFAULT;
    }

    applyPreviewLogoHeight(element, height) {
      if (!element || element.tagName !== 'IMG') return;
      const value = `${height}px`;
      element.style.setProperty('--branding-logo-height', value);
      element.style.height = value;
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
      this.resetHeadlineImage();
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

        // Set default targeted view: Category Feed
        const categoryFeedCheckbox = this.articleForm.querySelector('input[name="targettedViews"][value="category-feed"]');
        if (categoryFeedCheckbox) {
          categoryFeedCheckbox.checked = true;
        }
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
    this.resetHeadlineImage();
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
      this.setHeadlineImageFromArticle(article.headlineImage || null);

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
      payload.headlineImage = this.getHeadlineImagePayload();

      return payload;
    }

    async loadArticles() {
      try {
        const data = await this.fetchJson(`/cms/articles?t=${Date.now()}`);
        if (!data) return;
        this.state.articles = data.articles || [];
        this.renderArticlesTable(this.state.articles);
        this.renderRecentArticles(this.state.articles.slice(0, 5));
        this.updateStatsFromPayload(data);
      } catch (error) {
        this.showError('Haberler yüklenirken bir hata oluştu.');
      }
    }

    async loadCategories() {
      try {
        const data = await this.fetchJson('/cms/categories');
        if (!data) return;
        this.applyCategories(data.categories || []);
      } catch (error) {
        this.showError('Kategoriler yüklenirken bir hata oluştu.');
      }
    }

    async createCategory(name, description) {
      try {
        const response = await fetch('/cms/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Kategori oluşturulamadı');
        }

        await response.json();
        await this.loadCategories();
        this.showSuccess('Kategori oluşturuldu.');
      } catch (error) {
        this.showError(error.message || 'Kategori oluşturulamadı.');
      }
    }

    async updateCategory(categoryId, payload) {
      try {
        const response = await fetch(`/cms/categories/${categoryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Kategori güncellenemedi');
        }

        await response.json();
        await this.loadCategories();
        this.showSuccess('Kategori güncellendi.');
      } catch (error) {
        this.showError(error.message || 'Kategori güncellenemedi.');
      }
    }

    async deleteCategory(categoryId) {
      const category = (this.state.categories || []).find((item) => item.id === categoryId);
      const categoryName = category ? category.name : '';
      const confirmed = window.confirm(
        categoryName
          ? `'${categoryName}' kategorisini silmek istediğinize emin misiniz? Bu kategoriye bağlı haberlerin kategorisi kaldırılacaktır.`
          : 'Bu kategoriyi silmek istediğinize emin misiniz?'
      );

      if (!confirmed) return;

      try {
        const response = await fetch(`/cms/categories/${categoryId}`, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Kategori silinemedi');
        }

        await response.json();
        await this.loadCategories();
        this.showSuccess('Kategori silindi.');
      } catch (error) {
        this.showError(error.message || 'Kategori silinemedi.');
      }
    }

    async promptCreateCategory() {
      const nameInput = window.prompt('Yeni kategori adını girin');
      if (nameInput === null) return;

      const trimmedName = nameInput.trim();
      if (!trimmedName) {
        this.showError('Kategori adı boş bırakılamaz.');
        return;
      }

      const descriptionInput = window.prompt('Kategori açıklaması (opsiyonel)', '');
      const trimmedDescription = descriptionInput !== null ? descriptionInput.trim() : '';
      await this.createCategory(trimmedName, trimmedDescription);
    }

    async promptEditCategory(categoryId) {
      const category = (this.state.categories || []).find((item) => item.id === categoryId);
      if (!category) return;

      const nameInput = window.prompt('Kategori adını düzenleyin', category.name);
      if (nameInput === null) return;
      const trimmedName = nameInput.trim();
      if (!trimmedName) {
        this.showError('Kategori adı boş bırakılamaz.');
        return;
      }

      const descriptionInput = window.prompt(
        'Kategori açıklamasını düzenleyin (opsiyonel)',
        category.description || ''
      );
      if (descriptionInput === null) return;
      const trimmedDescription = descriptionInput.trim();

      await this.updateCategory(categoryId, {
        name: trimmedName,
        description: trimmedDescription
      });
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

    async updateArticleTargets(articleId, { add = [], remove = [] } = {}) {
      if (!articleId) throw new Error('Geçersiz haber ID');

      const targetsToAdd = Array.isArray(add) ? add.filter(Boolean) : [];
      const targetsToRemove = Array.isArray(remove) ? remove.filter(Boolean) : [];

      if (!targetsToAdd.length && !targetsToRemove.length) {
        return { success: true, targets: [] };
      }

      const response = await fetch(`/cms/articles/${articleId}/targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetsToAdd,
          targetsToRemove
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Hedef alan güncellenemedi');
      }

      return response.json();
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

        const savedArticle = await response.json();
        this.showSuccess('Haber başarıyla kaydedildi!');
        this.returnToArticleList();
        this.loadArticles();

        // If article targets carousel, refresh the headline layout
        if (savedArticle.targettedViews && savedArticle.targettedViews.includes('carousel')) {
          this.loadHeadlineLayout();
        }
        if (savedArticle.targettedViews && savedArticle.targettedViews.includes('ana-manset')) {
          this.loadAnaMansetLayout();
        }
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

      const ext = (media.extension || '').toLowerCase();
      if (media.url && ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = media.filename || media.path;
        preview.appendChild(img);
      } else if (media.url && ext && ['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
        const video = document.createElement('video');
        video.src = media.url;
        video.controls = false; // No controls for thumbnail
        video.muted = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';

        // Add play icon overlay
        const playIcon = document.createElement('div');
        playIcon.className = 'media-card__play-icon';
        playIcon.innerHTML = '▶';
        playIcon.style.position = 'absolute';
        playIcon.style.top = '50%';
        playIcon.style.left = '50%';
        playIcon.style.transform = 'translate(-50%, -50%)';
        playIcon.style.color = 'white';
        playIcon.style.fontSize = '24px';
        playIcon.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
        playIcon.style.pointerEvents = 'none';

        preview.appendChild(video);
        preview.appendChild(playIcon);

        // Play on hover
        article.addEventListener('mouseenter', () => {
          video.play().catch(() => { });
        });
        article.addEventListener('mouseleave', () => {
          video.pause();
          video.currentTime = 0;
        });
      } else {
        const span = document.createElement('span');
        span.textContent = (media.extension || 'DOSYA').toUpperCase();
        preview.appendChild(span);
      }

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
      preview.appendChild(menuWrapper);

      const body = document.createElement('div');
      body.className = 'media-card__body';

      const header = document.createElement('header');
      header.className = 'media-card__header';

      const title = document.createElement('span');
      title.className = 'media-card__title';
      title.textContent = media.filename || media.path;
      title.title = media.path || media.filename;

      header.appendChild(title);

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

    initializeHeadlineMediaManager() {
      if (!this.headlineMediaManager) return;
      this.renderHeadlineImage();
    }

    resetHeadlineImage() {
      this.headlineImage = null;
      this.renderHeadlineImage();
    }

    setHeadlineImage(image) {
      this.headlineImage = image ? { ...image } : null;
      this.renderHeadlineImage();
    }

    setHeadlineImageFromArticle(image) {
      if (!image) {
        this.setHeadlineImage(null);
        return;
      }
      const normalized = this.normalizeArticleImageEntry(image);
      this.setHeadlineImage(normalized);
    }

    renderHeadlineImage() {
      if (!this.headlineMediaList) return;
      this.headlineMediaList.innerHTML = '';

      if (!this.headlineImage) {
        if (this.headlineMediaEmpty) {
          this.headlineMediaEmpty.hidden = false;
          this.headlineMediaList.appendChild(this.headlineMediaEmpty);
        }
        this.toggleHeadlineRemoveButton(false);
        this.syncHeadlineImageField();
        return;
      }

      if (this.headlineMediaEmpty) {
        this.headlineMediaEmpty.hidden = true;
      }

      const image = this.headlineImage;
      const sizeText = image.size !== null && image.size !== undefined
        ? this.formatFileSize(image.size)
        : '-';
      const escapedTitle = this.escapeHtml(image.title || '');
      const escapedAlt = this.escapeHtml(image.alt || '');
      const escapedPath = this.escapeHtml(image.path || '');
      const escapedFilename = this.escapeHtml(image.filename || '');

      const item = document.createElement('article');
      item.className = 'article-media-item';
      item.innerHTML = `
        <div class="article-media-item__preview">
          <img src="${image.url}" alt="${escapedAlt || escapedTitle || escapedFilename || 'Manşet tasarımı'}">
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
      `;

      this.headlineMediaList.appendChild(item);
      this.toggleHeadlineRemoveButton(true);
      this.syncHeadlineImageField();
    }

    toggleHeadlineRemoveButton(enabled) {
      if (!this.headlineRemoveBtn) return;
      this.headlineRemoveBtn.disabled = !enabled;
    }

    syncHeadlineImageField() {
      if (!this.headlineImageField) return;
      const payload = this.getHeadlineImagePayload();
      if (!payload) {
        this.headlineImageField.value = '';
        return;
      }
      this.headlineImageField.value = JSON.stringify(payload);
    }

    getHeadlineImagePayload() {
      if (!this.headlineImage) return null;
      return {
        path: this.headlineImage.path || '',
        url: this.headlineImage.url,
        filename: this.headlineImage.filename || '',
        title: this.headlineImage.title || '',
        alt: this.headlineImage.alt || '',
        size: this.headlineImage.size !== null && this.headlineImage.size !== undefined
          ? this.headlineImage.size
          : undefined,
        uploadedAt: this.headlineImage.uploadedAt || undefined
      };
    }

    async handleHeadlineMediaUpload(event) {
      const input = event.currentTarget;
      const file = (input.files || [])[0];
      if (!file) return;

      try {
        const mediaItem = await this.uploadMediaFile(file);
        if (mediaItem) {
          const image = this.normalizeArticleImageEntry({
            path: mediaItem.path || mediaItem.filename,
            url: mediaItem.url,
            filename: mediaItem.filename || '',
            size: mediaItem.size !== undefined ? Number(mediaItem.size) : null,
            uploadedAt: mediaItem.uploadedAt || null
          });
          if (image) {
            this.setHeadlineImage(image);
            this.showSuccess('Manşet tasarımı yüklendi.');
          }
        }
      } catch (error) {
        console.error('Headline media upload error:', error);
        this.showError(error.message || 'Manşet tasarımı yüklenemedi.');
      } finally {
        input.value = '';
      }
    }

    async openHeadlineImageSelectModal() {
      try {
        await this.ensureMediaLoaded();

        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        const currentFolder = this.state.mediaCurrentFolder || '';
        const searchTerm = this.state.mediaSearchTerm || '';

        let mediaItems = Array.isArray(this.state.media)
          ? this.state.media.filter((item) =>
            imageExtensions.includes((item.extension || '').toLowerCase())
          )
          : [];

        if (!mediaItems.length) {
          const params = new URLSearchParams();
          if (currentFolder) {
            params.set('folder', currentFolder);
          }
          if (searchTerm) {
            params.set('search', searchTerm);
          }

          const result = await this.fetchJson(
            `/cms/media${params.toString() ? `?${params.toString()}` : ''}`
          );
          const fetchedMedia = result.media || [];

          if (fetchedMedia.length) {
            this.state.media = fetchedMedia;
            this.state.mediaFolders = result.folders || this.state.mediaFolders;
            this.state.mediaTree = result.tree || this.state.mediaTree;
            this.state.mediaBreadcrumbs =
              result.breadcrumbs || this.state.mediaBreadcrumbs;
            if (result.currentFolder !== undefined) {
              this.state.mediaCurrentFolder = result.currentFolder;
            }

            mediaItems = fetchedMedia.filter((item) =>
              imageExtensions.includes((item.extension || '').toLowerCase())
            );
          }
        }

        if (!mediaItems.length) {
          this.showError('Seçilebilecek görsel bulunamadı. Önce bir görsel yükleyin.');
          return;
        }

        const folderLabel = currentFolder ? currentFolder : 'Tüm Dosyalar';
        this.buildMediaSelectModal(
          mediaItems,
          folderLabel,
          searchTerm,
          (selectedMedia) => {
            const image = this.normalizeArticleImageEntry({
              path: selectedMedia.path || selectedMedia.filename,
              url: selectedMedia.url,
              filename: selectedMedia.filename || '',
              size: selectedMedia.size !== undefined ? Number(selectedMedia.size) : null,
              uploadedAt: selectedMedia.uploadedAt || null
            });
            if (image) {
              this.setHeadlineImage(image);
              this.showSuccess('Manşet tasarımı seçildi.');
            }
          },
          'Manşet Tasarımını Seç'
        );
      } catch (error) {
        console.error('Headline media select modal error:', error);
        this.showError('Manşet tasarımı seçilemedi.');
      }
    }

    handleHeadlineFieldInput(event) {
      const input = event.target.closest('input[data-field]');
      if (!input || !this.headlineImage) return;
      const field = input.dataset.field;
      if (!field) return;
      this.headlineImage[field] = input.value.trim();
      this.syncHeadlineImageField();
    }

    clearHeadlineImage(showNotification = true) {
      const hadImage = Boolean(this.headlineImage);
      this.headlineImage = null;
      this.renderHeadlineImage();
      if (showNotification && hadImage) {
        this.showSuccess('Manşet tasarımı kaldırıldı.');
      }
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

    async handleVideoUpload(event) {
      const input = event.currentTarget;
      const file = input.files[0];
      if (!file) return;

      const button = this.uploadVideoBtn;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Yükleniyor...';

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/cms/media/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Video yüklenemedi');
        }

        const result = await response.json();
        const media = result.media;

        if (this.videoUrlInput) {
          this.videoUrlInput.value = media.url;
          this.showSuccess('Video yüklendi ve URL eklendi.');
        }
      } catch (error) {
        this.showError(error.message);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        input.value = '';
      }
    }

    async openVideoMediaSelectModal() {
      try {
        await this.ensureMediaLoaded();

        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
        const currentFolder = this.state.mediaCurrentFolder || '';
        const searchTerm = this.state.mediaSearchTerm || '';

        let mediaItems = Array.isArray(this.state.media)
          ? this.state.media.filter((item) =>
            videoExtensions.includes((item.extension || '').toLowerCase())
          )
          : [];

        if (!mediaItems.length) {
          // Try fetching if empty (might be in a different folder view)
          // For simplicity, we just check current state. If user navigates folders, 
          // the modal needs to handle it. 
          // Re-using buildArticleMediaSelectModal but with video filter context is tricky 
          // because that modal is designed for images (addArticleImage).
          // We will create a specialized version or adapt the existing one.
          // For now, let's adapt buildArticleMediaSelectModal to accept a callback.
        }

        this.buildMediaSelectModal(mediaItems, currentFolder, searchTerm, (selectedMedia) => {
          if (this.videoUrlInput) {
            this.videoUrlInput.value = selectedMedia.url;
            this.showSuccess('Video seçildi.');
          }
        }, 'Video Seç');

      } catch (error) {
        console.error('Video select modal error:', error);
      }
    }

    // Refactored to be generic
    buildMediaSelectModal(mediaItems, folderLabel = '', searchTerm = '', onSelect, title = 'Medya Kütüphanesi') {
      this.closeArticleMediaSelectModal(); // Close any existing

      const overlay = document.createElement('div');
      overlay.className = 'article-media-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const folderText = folderLabel ? folderLabel : 'Tüm Dosyalar';
      const searchText = searchTerm ? ` • Arama: ${this.escapeHtml(searchTerm)}` : '';

      overlay.innerHTML = `
        <div class="article-media-modal__backdrop" data-action="close-article-media-modal"></div>
        <div class="article-media-modal__dialog">
          <header class="article-media-modal__header">
            <div class="article-media-modal__title">
              <h3>${title}</h3>
              <p class="article-media-modal__meta">
                Klasör: ${this.escapeHtml(folderText)}${searchText}
              </p>
            </div>
            <button type="button" class="article-media-modal__close" data-action="close-article-media-modal" aria-label="Kapat">×</button>
          </header>
          <div class="article-media-modal__grid" data-article-media-modal-grid></div>
        </div>
      `;

      const grid = overlay.querySelector('[data-article-media-modal-grid]');

      if (mediaItems.length === 0) {
        grid.innerHTML = '<div class="cms-empty-state">Bu klasörde uygun medya bulunamadı.</div>';
      } else {
        mediaItems.forEach((item) => {
          const card = document.createElement('article');
          card.className = 'article-media-modal__item';
          card.dataset.action = 'media-select-item';

          // Preview logic
          let previewContent = '';
          const ext = (item.extension || '').toLowerCase();
          if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
            previewContent = `<img src="${item.url}" alt="${this.escapeHtml(item.filename || '')}">`;
          } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
            previewContent = `
              <div style="position: relative; width: 100%; height: 100%; background: #000; display: flex; align-items: center; justify-content: center;">
                <video src="${item.url}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>
                <div style="position: absolute; color: white; font-size: 24px;">▶</div>
              </div>
             `;
          } else {
            previewContent = `<div class="media-card__preview"><span>${ext.toUpperCase()}</span></div>`;
          }

          card.innerHTML = `
            <div class="article-media-modal__preview">
              ${previewContent}
            </div>
            <div class="article-media-modal__body">
              <h4 title="${this.escapeHtml(item.filename || '')}">${this.escapeHtml(item.filename || '')}</h4>
              <p>${this.escapeHtml(this.formatFileSize(item.size))}</p>
              <button type="button" class="cms-btn cms-btn-secondary">Seç</button>
            </div>
          `;

          card.addEventListener('click', () => {
            onSelect(item);
            this.closeArticleMediaSelectModal();
          });

          grid.appendChild(card);
        });
      }

      overlay.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action="close-article-media-modal"]');
        if (button) {
          this.closeArticleMediaSelectModal();
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
        await this.ensureMediaLoaded();

        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
        const currentFolder = this.state.mediaCurrentFolder || '';
        const searchTerm = this.state.mediaSearchTerm || '';

        let mediaItems = Array.isArray(this.state.media)
          ? this.state.media.filter((item) =>
            imageExtensions.includes((item.extension || '').toLowerCase())
          )
          : [];

        if (!mediaItems.length) {
          const params = new URLSearchParams();
          if (currentFolder) {
            params.set('folder', currentFolder);
          }
          if (searchTerm) {
            params.set('search', searchTerm);
          }

          const result = await this.fetchJson(
            `/cms/media${params.toString() ? `?${params.toString()}` : ''}`
          );
          const fetchedMedia = result.media || [];

          if (fetchedMedia.length) {
            this.state.media = fetchedMedia;
            this.state.mediaFolders = result.folders || this.state.mediaFolders;
            this.state.mediaTree = result.tree || this.state.mediaTree;
            this.state.mediaBreadcrumbs =
              result.breadcrumbs || this.state.mediaBreadcrumbs;
            if (result.currentFolder !== undefined) {
              this.state.mediaCurrentFolder = result.currentFolder;
            }

            mediaItems = fetchedMedia.filter((item) =>
              imageExtensions.includes((item.extension || '').toLowerCase())
            );
          }
        }

        if (!mediaItems.length) {
          this.showError('Seçilebilecek görsel bulunamadı. Önce bir görsel yükleyin.');
          return;
        }

        const folderLabel = currentFolder ? currentFolder : 'Tüm Dosyalar';
        this.buildArticleMediaSelectModal(mediaItems, folderLabel, searchTerm);
      } catch (error) {
        console.error('Article media select modal error:', error);
      }
    }

    buildArticleMediaSelectModal(mediaItems, folderLabel = '', searchTerm = '') {
      this.closeArticleMediaSelectModal();

      const overlay = document.createElement('div');
      overlay.className = 'article-media-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      const folderText = folderLabel ? folderLabel : 'Tüm Dosyalar';
      const searchText = searchTerm ? ` • Arama: ${this.escapeHtml(searchTerm)}` : '';

      overlay.innerHTML = `
        <div class="article-media-modal__backdrop" data-action="close-article-media-modal"></div>
        <div class="article-media-modal__dialog">
          <header class="article-media-modal__header">
            <div class="article-media-modal__title">
              <h3>Medya Kütüphanesi</h3>
              <p class="article-media-modal__meta">
                Klasör: ${this.escapeHtml(folderText)}${searchText}
              </p>
            </div>
            <button type="button" class="article-media-modal__close" data-action="close-article-media-modal" aria-label="Kapat">×</button>
          </header>
          <div class="article-media-modal__grid" data-article-media-modal-grid></div>
        </div>
      `;

      const grid = overlay.querySelector('[data-article-media-modal-grid]');

      mediaItems.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'article-media-modal__item';
        // Make the whole card selectable by setting action and data attributes
        card.dataset.action = 'article-media-select-item';
        card.dataset.mediaPath = item.path || item.filename;
        card.dataset.mediaUrl = item.url;
        card.dataset.mediaFilename = item.filename || '';
        card.dataset.mediaSize = item.size !== undefined ? item.size : '';
        card.dataset.mediaUploaded = item.uploadedAt || '';
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
            this.closeArticleMediaSelectModal();
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

    async ensureMediaLoaded() {
      if (this.mediaLoaded) return;
      if (this.mediaLoadingPromise) {
        await this.mediaLoadingPromise;
        return;
      }

      this.mediaLoadingPromise = this.loadMedia();
      try {
        await this.mediaLoadingPromise;
      } finally {
        this.mediaLoadingPromise = null;
      }
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
        this.mediaLoaded = true;
      } catch (error) {
        console.error('Media load error:', error);
        this.mediaLoaded = false;
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

    setSectionVisibility(section, isVisible) {
      if (!section) return;
      if (isVisible) {
        section.classList.add('active');
        section.removeAttribute('hidden');
        section.style.removeProperty('display');
      } else {
        section.classList.remove('active');
        section.setAttribute('hidden', '');
        section.style.display = 'none';
      }
    }

    switchToEditorView() {
      if (!this.editorSection) return;

      this.setSectionVisibility(this.editorSection, true);
      if (this.articleSection) {
        this.setSectionVisibility(this.articleSection, false);
      }

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

      this.setSectionVisibility(this.articleSection, true);
      if (this.editorSection) {
        this.setSectionVisibility(this.editorSection, false);
      }

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

    initializeLayoutManager() {
      this.layoutTable = document.querySelector('[data-cms="layout-table"]');
      this.saveLayoutBtn = document.querySelector('[data-action="save-layout"]');
      this.addWidgetBtn = document.querySelector('[data-action="add-widget"]');
      this.modalOverlay = document.querySelector('[data-modal="add-widget"]');
      this.modalCloseBtn = document.querySelector('[data-action="close-modal"]');
      this.widgetListContainer = document.querySelector('[data-cms="widget-list"]');

      this.draggedRow = null;
      this.currentDropTarget = null;

      // Available widgets configuration
      this.availableWidgets = [
        {
          type: 'hero-title',
          title: 'Manşet Başlığı',
          desc: 'Büyük puntolu ana başlık alanı.',
          defaultConfig: { title: 'Yeni Başlık' }
        },
        {
          type: 'carousel',
          title: 'Manşet Slider',
          desc: 'Öne çıkan haberlerin kayan listesi.',
          defaultConfig: { autoplay: true, interval: 5000 }
        },
        {
          type: 'ana-manset',
          title: 'Ana Manşet Slider',
          desc: 'En fazla 25 haberlik ana manşet slider alanı.',
          defaultConfig: { id: 'ana-manset', maxArticles: 25, autoPlay: true, autoPlayDelay: 5000 }
        },
        {
          type: 'featured-news-grid',
          title: 'Öne Çıkanlar Izgarası',
          desc: 'Seçilmiş haberlerin ızgara görünümü.',
          defaultConfig: { limit: 6 }
        },
        {
          type: 'four-article-band',
          title: '4\'lü Haber Bandı',
          desc: 'Hedeflenen 4 haberi tek satırda kart olarak gösterir.',
          defaultConfig: { title: 'Öne Çıkanlar', target: 'four-article-band', limit: 4 }
        },
        {
          type: 'category-feed',
          title: 'Kategori Akışı',
          desc: 'Belirli bir kategoriden son haberler.',
          defaultConfig: { categorySlug: '', limit: 5 }
        },
        {
          type: 'three-column-category-feed',
          title: '3 Kolon Kategori Akışı',
          desc: '3 farklı kategoriden (kolon kolon) haber akışı. Her kolonda 1 büyük + 3 küçük haber.',
          defaultConfig: {
            categorySlug1: '',
            categoryName1: '',
            categorySlug2: '',
            categoryName2: '',
            categorySlug3: '',
            categoryName3: '',
            showTitles: true
          }
        },
        {
          type: 'flash-news',
          title: 'Son Dakika Bandı',
          desc: 'Kayan son dakika haberleri şeridi.',
          defaultConfig: { limit: 10 }
        },
        {
          type: 'ad-placeholder',
          title: 'Reklam Alanı',
          desc: 'Reklam yerleşimi için boş alan.',
          defaultConfig: { size: 'standard' }
        }
      ];

      if (this.layoutTable) {
        // ... existing drag handlers ...
        // Make only drag handles draggable
        const dragHandles = this.layoutTable.querySelectorAll('.layout-drag-handle');
        dragHandles.forEach(handle => {
          const row = handle.closest('tr');
          if (row) {
            handle.addEventListener('mousedown', () => {
              row.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', () => {
              setTimeout(() => row.removeAttribute('draggable'), 100);
            });
          }
        });

        // Drag and drop events
        this.layoutTable.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.layoutTable.addEventListener('dragover', this.handleDragOver.bind(this));
        this.layoutTable.addEventListener('drop', this.handleDrop.bind(this));
        this.layoutTable.addEventListener('dragend', this.handleDragEnd.bind(this));
        this.layoutTable.addEventListener('dragleave', (e) => this.handleDragLeave(e)); // Keep existing dragleave

        // Remove widget event
        this.layoutTable.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('[data-action="remove-widget"]');
          if (removeBtn) {
            const index = parseInt(removeBtn.dataset.widgetIndex);
            this.removeWidget(index);
            return;
          }

          const statusBtn = e.target.closest('[data-action="toggle-status"]');
          if (statusBtn) {
            const index = parseInt(statusBtn.dataset.widgetIndex);
            this.toggleWidgetStatus(index, statusBtn);
          }
        });
      }

      if (this.saveLayoutBtn) {
        this.saveLayoutBtn.addEventListener('click', () => this.saveLayout());
      }

      // Modal Event Listeners
      if (this.addWidgetBtn && this.modalOverlay) {
        this.addWidgetBtn.addEventListener('click', () => this.openAddWidgetModal());

        if (this.modalCloseBtn) {
          this.modalCloseBtn.addEventListener('click', () => this.closeAddWidgetModal());
        }

        // Close on click outside
        this.modalOverlay.addEventListener('click', (e) => {
          if (e.target === this.modalOverlay) {
            this.closeAddWidgetModal();
          }
        });
      }

      // Add event listeners for configuration controls
      this.initializeConfigControls();
    }

    openAddWidgetModal() {
      if (!this.modalOverlay || !this.widgetListContainer) return;

      // Render widget list if empty
      if (!this.widgetListContainer.children.length) {
        this.widgetListContainer.innerHTML = this.availableWidgets.map(widget => `
          <div class="widget-item" data-widget-type="${widget.type}">
            <div class="widget-item__title">${widget.title}</div>
            <div class="widget-item__desc">${widget.desc}</div>
          </div>
        `).join('');

        // Add click listeners to items (currently does nothing as requested)
        this.widgetListContainer.querySelectorAll('.widget-item').forEach(item => {
          item.addEventListener('click', () => {
            this.addWidget(item.dataset.widgetType);
          });
        });
      }

      this.modalOverlay.classList.add('is-active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    closeAddWidgetModal() {
      if (!this.modalOverlay) return;
      this.modalOverlay.classList.remove('is-active');
      document.body.style.overflow = '';
    }

    initializeConfigControls() {
      if (!this.layoutTable) return;

      // Handle all config inputs, selects, and checkboxes
      this.layoutTable.addEventListener('change', (e) => {
        const target = e.target;
        const configKey = target.dataset.config;
        const widgetIndex = parseInt(target.dataset.widgetIndex);

        if (configKey !== undefined && widgetIndex !== undefined) {
          this.updateWidgetConfig(widgetIndex, configKey, target);
        }
      });

      // Handle number inputs on input (real-time update)
      this.layoutTable.addEventListener('input', (e) => {
        const target = e.target;
        if (target.type === 'number' || target.type === 'text') {
          const configKey = target.dataset.config;
          const widgetIndex = parseInt(target.dataset.widgetIndex);

          if (configKey !== undefined && widgetIndex !== undefined) {
            this.updateWidgetConfig(widgetIndex, configKey, target);
          }
        }
      });
    }

    updateWidgetConfig(widgetIndex, configKey, element) {
      if (!this.state.homepageLayout[widgetIndex]) return;

      let value;

      if (element.type === 'checkbox') {
        value = element.checked;
      } else if (element.type === 'number') {
        value = parseInt(element.value) || 0;
        // Special handling for interval (convert seconds to milliseconds)
        if (configKey === 'interval') {
          value = value * 1000;
        }
      } else {
        value = element.value;
      }

      // Update the config in state
      this.state.homepageLayout[widgetIndex].config[configKey] = value;

      // For category-feed, also update categoryName for display
      if (configKey === 'categorySlug') {
        const selectedOption = element.options[element.selectedIndex];
        this.state.homepageLayout[widgetIndex].config.categoryName = selectedOption.text;
      }

      // For three-column-category-feed, keep categoryName1/2/3 synced to selected option text
      if (configKey === 'categorySlug1' || configKey === 'categorySlug2' || configKey === 'categorySlug3') {
        const selectedOption = element.options[element.selectedIndex];
        const suffix = configKey.slice('categorySlug'.length); // "1" | "2" | "3"
        this.state.homepageLayout[widgetIndex].config[`categoryName${suffix}`] = selectedOption ? selectedOption.text : '';
      }

      console.log(`Updated widget ${widgetIndex} config: ${configKey} = ${value}`);
    }

    handleDragStart(e) {
      const row = e.target.closest('tr');
      if (!row) return;

      this.draggedRow = row;
      this.layoutTable.classList.add('dragging-active');
      e.dataTransfer.effectAllowed = 'move';

      // Create a custom drag image
      const dragImage = row.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.width = (row.offsetWidth * 0.5) + 'px'; // 50% width
      dragImage.style.height = '40px'; // Reduced height
      dragImage.style.opacity = '0.7'; // Transparent
      dragImage.style.backgroundColor = '#e3f2fd';
      dragImage.style.border = '2px solid #007bff';
      dragImage.style.borderRadius = '4px';
      dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
      dragImage.style.overflow = 'hidden';
      dragImage.style.display = 'table';
      dragImage.style.tableLayout = 'fixed';
      dragImage.style.fontSize = '12px'; // Smaller text
      dragImage.style.whiteSpace = 'nowrap';

      document.body.appendChild(dragImage);

      // Set the custom drag image (centered under cursor)
      e.dataTransfer.setDragImage(dragImage, (row.offsetWidth * 0.25), 20);

      // Remove the drag image after a short delay
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);

      // Add dragging class after a tiny delay for smooth animation
      setTimeout(() => {
        row.classList.add('cms-dragging');
      }, 0);
    }


    handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const row = e.target.closest('tr');
      if (!row || row === this.draggedRow || !this.draggedRow) return;

      // Remove previous drop indicators
      this.clearDropIndicators();

      // Calculate drop position
      const bounding = row.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      const isAfter = e.clientY - offset > 0;

      // Add visual indicator
      if (isAfter) {
        row.classList.add('drop-below');
      } else {
        row.classList.add('drop-above');
      }

      this.currentDropTarget = row;
    }

    handleDrop(e) {
      e.stopPropagation();
      e.preventDefault();

      if (!this.draggedRow || !this.currentDropTarget) return;

      // Perform the actual reorder
      const bounding = this.currentDropTarget.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      const isAfter = e.clientY - offset > 0;

      if (isAfter) {
        this.currentDropTarget.after(this.draggedRow);
      } else {
        this.currentDropTarget.before(this.draggedRow);
      }

      this.updateLayoutOrder();
      this.clearDropIndicators();

      return false;
    }

    handleDragEnd(e) {
      this.layoutTable.classList.remove('dragging-active');
      this.clearDropIndicators();

      if (this.draggedRow) {
        this.draggedRow.classList.remove('cms-dragging');
        this.draggedRow.removeAttribute('draggable');
        this.draggedRow = null;
      }

      this.currentDropTarget = null;
    }

    handleDragLeave(e) {
      const row = e.target.closest('tr');
      if (row) {
        row.classList.remove('drop-above', 'drop-below', 'drag-over');
      }
    }

    clearDropIndicators() {
      const rows = this.layoutTable.querySelectorAll('tbody tr');
      rows.forEach(row => {
        row.classList.remove('drop-above', 'drop-below', 'drag-over');
      });
    }

    updateLayoutOrder() {
      const rows = this.layoutTable.querySelectorAll('tbody tr');
      rows.forEach((row, index) => {
        const orderCell = row.querySelector('.layout-order');
        if (orderCell) {
          orderCell.textContent = index + 1;
        }
      });
    }

    renderLayoutRow(widget, index) {
      const tr = document.createElement('tr');
      tr.dataset.index = index;

      let configHtml = '';

      if (widget.type === 'carousel') {
        configHtml = `
          <div class="config-row">
            <label class="config-control">
              <span class="config-label">Limit:</span>
              <input type="number" 
                     data-config="maxArticles" 
                     data-widget-index="${index}"
                     value="${widget.config.maxArticles || 5}" 
                     min="1" 
                     max="10"
                     class="config-input-small"
                     title="Maksimum haber sayısı">
            </label>
            <label class="config-control">
              <input type="checkbox" 
                     data-config="autoPlay" 
                     data-widget-index="${index}"
                     ${widget.config.autoPlay ? 'checked' : ''}>
              Oto. Oynat
            </label>
            <label class="config-control">
              <span class="config-label">Süre (ms):</span>
              <input type="number" 
                     data-config="autoPlayDelay" 
                     data-widget-index="${index}"
                     value="${widget.config.autoPlayDelay || 5000}" 
                     min="1000" 
                     max="10000"
                     step="500"
                     class="config-input-small">
            </label>
          </div>
        `;
      } else if (widget.type === 'hero-title') {
        configHtml = `
          <label class="config-control">
            <span>Başlık:</span>
            <input type="text" 
                   data-config="title" 
                   data-widget-index="${index}"
                   value="${this.escapeHtml(widget.config.title || '')}" 
                   placeholder="Başlık girin"
                   class="config-input">
          </label>
        `;
      } else if (widget.type === 'featured-news-grid') {
        configHtml = `
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 6}" 
                   min="1" 
                   max="20"
                   class="config-input-small">
          </label>
        `;
      } else if (widget.type === 'four-article-band') {
        const targetOptions = this.state.targetOptions || [];
        const targetOptionsHtml = targetOptions.length
          ? targetOptions.map(option => {
            const value = option.value || '';
            const label = option.label || option.value || '';
            const selected = value === widget.config.target ? 'selected' : '';
            return `<option value="${this.escapeHtml(value)}" ${selected}>${this.escapeHtml(label)}</option>`;
          }).join('')
          : '';
        const targetControl = targetOptions.length
          ? `
            <select data-config="target" 
                    data-widget-index="${index}"
                    class="config-select">
              <option value="">Hedef seçin</option>
              ${targetOptionsHtml}
            </select>
          `
          : `
            <input type="text" 
                   data-config="target" 
                   data-widget-index="${index}"
                   value="${this.escapeHtml(widget.config.target || '')}" 
                   placeholder="Örn. spotlight-hero"
                   class="config-input">
          `;
        configHtml = `
          <label class="config-control">
            <span>Başlık:</span>
            <input type="text" 
                   data-config="title" 
                   data-widget-index="${index}"
                   value="${this.escapeHtml(widget.config.title || '')}" 
                   placeholder="Bant başlığı"
                   class="config-input">
          </label>
          <label class="config-control">
            <span>Hedef etiketi:</span>
            ${targetControl}
          </label>
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 4}" 
                   min="1" 
                   max="8"
                   class="config-input-small">
          </label>
        `;
      } else if (widget.type === 'category-feed') {
        const categories = this.state.categories || [];
        const options = categories.map(cat => {
          const currentSlug = widget.config.categorySlug || widget.config.slug;
          const selected = cat.slug === currentSlug ? 'selected' : '';
          return `<option value="${cat.slug}" ${selected}>${this.escapeHtml(cat.name)}</option>`;
        }).join('');

        configHtml = `
          <label class="config-control">
            <span>Kategori:</span>
            <select data-config="categorySlug" 
                    data-widget-index="${index}"
                    class="config-select">
              ${options || '<option value="">Kategori bulunamadı</option>'}
            </select>
          </label>
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 5}" 
                   min="1" 
                   max="20"
                   class="config-input-small">
          </label>
        `;
      } else if (widget.type === 'flash-news') {
        configHtml = `
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 10}" 
                   min="1" 
                   max="30"
                   class="config-input-small">
          </label>
        `;
      } else if (widget.type === 'ad-placeholder') {
        const sizes = [
          { value: 'standard', label: 'Standart' },
          { value: 'large', label: 'Büyük' },
          { value: 'banner', label: 'Banner' }
        ];
        const options = sizes.map(s =>
          `<option value="${s.value}" ${widget.config.size === s.value ? 'selected' : ''}>${s.label}</option>`
        ).join('');

        configHtml = `
          <label class="config-control">
            <span>Boyut:</span>
            <select data-config="size" 
                    data-widget-index="${index}"
                    class="config-select">
              ${options}
            </select>
          </label>
        `;
      } else {
        configHtml = '<span class="config-text">Özel yapılandırma</span>';
      }

      const widgetDef = this.availableWidgets.find(w => w.type === widget.type);
      const widgetTitle = widgetDef ? widgetDef.title : widget.type;
      const isHidden = widget.config.hidden ? 'is-passive' : '';
      const statusText = widget.config.hidden ? 'Pasif' : 'Aktif';

      tr.innerHTML = `
        <td class="layout-drag-handle" title="Sürükle">
          <span class="drag-icon">⋮⋮</span>
        </td>
        <td class="layout-order">${index + 1}</td>
        <td>
          <span class="cms-badge cms-badge--primary">${widgetTitle}</span>
        </td>
        <td>
          <div class="widget-config-controls">
            ${configHtml}
          </div>
        </td>
        <td>
          <div class="status-actions">
            <span class="cms-status ${isHidden}" data-action="toggle-status" data-widget-index="${index}" title="Durumu değiştirmek için tıklayın">${statusText}</span>
            <button type="button" class="btn-icon btn-delete" data-action="remove-widget" data-widget-index="${index}" title="Bileşeni Kaldır">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      `;

      // Add drag handle listeners
      const handle = tr.querySelector('.layout-drag-handle');
      if (handle) {
        handle.addEventListener('mousedown', () => {
          tr.setAttribute('draggable', 'true');
        });
        handle.addEventListener('mouseup', () => {
          setTimeout(() => tr.removeAttribute('draggable'), 100);
        });
      }

      return tr;
    }

    addWidget(type) {
      const widgetDef = this.availableWidgets.find(w => w.type === type);
      if (!widgetDef) return;

      const newWidget = {
        type: type,
        config: { ...widgetDef.defaultConfig }
      };

      // Add to state
      this.state.homepageLayout.push(newWidget);
      const newIndex = this.state.homepageLayout.length - 1;

      // Add to DOM
      const tbody = this.layoutTable.querySelector('tbody');

      // Remove empty state if present
      const emptyState = tbody.querySelector('.cms-empty-state');
      if (emptyState) {
        emptyState.closest('tr').remove();
      }

      const newRow = this.renderLayoutRow(newWidget, newIndex);
      tbody.appendChild(newRow);

      this.updateLayoutOrder();
      this.closeAddWidgetModal();
      this.showSuccess(`${widgetDef.title} eklendi.`);

      // Scroll to new row
      newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    removeWidget(index) {
      if (!confirm('Bu bileşeni kaldırmak istediğinizden emin misiniz?')) return;

      // Remove from state
      this.state.homepageLayout.splice(index, 1);

      // Remove from DOM
      const row = this.layoutTable.querySelector(`tr[data-index="${index}"]`);
      if (row) {
        row.remove();
      }

      // Re-index remaining rows
      const rows = this.layoutTable.querySelectorAll('tbody tr');
      rows.forEach((row, newIndex) => {
        row.dataset.index = newIndex;
        row.querySelector('.layout-order').textContent = newIndex + 1;

        // Update config inputs data-widget-index
        row.querySelectorAll('[data-widget-index]').forEach(el => {
          el.dataset.widgetIndex = newIndex;
        });
      });

      // Show empty state if needed
      if (this.state.homepageLayout.length === 0) {
        const tbody = this.layoutTable.querySelector('tbody');
        tbody.innerHTML = `
          <tr class="empty-state">
            <td colspan="5">
              <div class="empty-message">
                <span class="empty-icon">🧩</span>
                <p>Henüz bileşen eklenmemiş</p>
                <button class="btn btn-sm btn-primary" onclick="document.querySelector('[data-action=\\'add-widget\\']').click()">
                  Bileşen Ekle
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      this.showToast('Bileşen kaldırıldı', 'success');
    }

    toggleWidgetStatus(index, element) {
      const widget = this.state.homepageLayout[index];
      if (!widget.config) widget.config = {};

      // Toggle hidden state
      widget.config.hidden = !widget.config.hidden;

      // Update UI
      if (widget.config.hidden) {
        element.classList.add('is-passive');
        element.textContent = 'Pasif';
      } else {
        element.classList.remove('is-passive');
        element.textContent = 'Aktif';
      }
    }

    async saveLayout() {
      console.log('🔵 Save Layout button clicked!');
      try {
        const rows = this.layoutTable.querySelectorAll('tbody tr');
        console.log('🔵 Found rows:', rows.length);
        const newOrder = Array.from(rows).map(row => {
          const index = parseInt(row.dataset.index);
          return this.state.homepageLayout[index];
        });

        console.log('🔵 New order:', newOrder.map(w => w.type));

        // Re-assign indices to match new DOM order for subsequent saves
        rows.forEach((row, newIndex) => {
          row.dataset.index = newIndex;
        });

        // Update state
        this.state.homepageLayout = newOrder;

        console.log('🔵 Sending PUT request to /cms/layouts/homepage...');
        const response = await fetch('/cms/layouts/homepage', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ layout: newOrder })
        });

        console.log('🔵 Response status:', response.status);
        if (!response.ok) throw new Error('Failed to save layout');

        this.showToast('Sayfa düzeni başarıyla kaydedildi', 'success');
      } catch (error) {
        console.error('❌ Save layout error:', error);
        this.showToast('Sayfa düzeni kaydedilemedi', 'error');
      }
    }

    initializeArticleLayoutManager() {
      // Initialize article layout manager with similar functionality to homepage layout
      this.articleLayoutTable = document.querySelector('[data-cms="article-layout-table"]');
      this.saveArticleLayoutBtn = document.querySelector('[data-action="save-article-layout"]');
      this.addArticleWidgetBtn = document.querySelector('[data-action="add-article-widget"]');
      this.articleModalOverlay = document.querySelector('[data-modal="add-article-widget"]');
      this.articleModalCloseBtn = this.articleModalOverlay ? this.articleModalOverlay.querySelector('[data-action="close-modal"]') : null;
      this.articleWidgetListContainer = document.querySelector('[data-cms="article-widget-list"]');

      this.draggedArticleRow = null;
      this.currentArticleDropTarget = null;

      // Available article widgets
      this.availableArticleWidgets = [
        {
          type: 'article-hero-image',
          title: 'Ana Görsel',
          desc: 'Başlık öncesi ana görsel',
          defaultConfig: {}
        },
        {
          type: 'article-category',
          title: 'Kategori Adı',
          desc: 'Kategori rozeti',
          defaultConfig: {}
        },
        {
          type: 'article-header',
          title: 'Makale Başlığı',
          desc: 'Makale başlığı ve meta bilgileri',
          defaultConfig: {}
        },
        {
          type: 'article-meta',
          title: 'Makale Bilgileri',
          desc: 'Yazar, tarih, kategori bilgileri',
          defaultConfig: {}
        },
        {
          type: 'article-image',
          title: 'Görsel Galerisi',
          desc: 'Makale ana görseli',
          defaultConfig: { showCaption: true, skipFirst: false }
        },
        {
          type: 'article-content',
          title: 'Makale İçeriği',
          desc: 'Ana makale içeriği',
          defaultConfig: {}
        },
        {
          type: 'article-tags',
          title: 'Etiketler',
          desc: 'Makale etiketleri',
          defaultConfig: {}
        },
        {
          type: 'article-summary',
          title: 'Makale Özeti',
          desc: 'Başlık altında özet metni',
          defaultConfig: {}
        },
        {
          type: 'article-citation',
          title: 'Kaynakça',
          desc: 'Kaynak ve referans linkleri',
          defaultConfig: {}
        },
        {
          type: 'related-articles',
          title: 'İlgili Haberler',
          desc: 'Benzer veya ilgili haberler listesi',
          defaultConfig: { limit: 4, sameCategory: true }
        },
        {
          type: 'sidebar-widget',
          title: 'Yan Menü',
          desc: 'Yan menü widget alanı',
          defaultConfig: { widgetType: 'popular', limit: 5 }
        },
        {
          type: 'social-share',
          title: 'Sosyal Medya Paylaşım',
          desc: 'Sosyal medya paylaşım butonları',
          defaultConfig: { showFacebook: true, showTwitter: true, showWhatsapp: true }
        },
        {
          type: 'comment-section',
          title: 'Yorum Bölümü',
          desc: 'Kullanıcı yorumları alanı',
          defaultConfig: {}
        },
        {
          type: 'ad-placeholder',
          title: 'Reklam Alanı',
          desc: 'Reklam yerleşimi için boş alan',
          defaultConfig: { size: 'standard', position: 'inline' }
        }
      ];

      if (this.articleLayoutTable) {
        // Drag and drop handlers
        const dragHandles = this.articleLayoutTable.querySelectorAll('.layout-drag-handle');
        dragHandles.forEach(handle => {
          const row = handle.closest('tr');
          if (row) {
            handle.addEventListener('mousedown', () => {
              row.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', () => {
              setTimeout(() => row.removeAttribute('draggable'), 100);
            });
          }
        });

        this.articleLayoutTable.addEventListener('dragstart', this.handleArticleDragStart.bind(this));
        this.articleLayoutTable.addEventListener('dragover', this.handleArticleDragOver.bind(this));
        this.articleLayoutTable.addEventListener('drop', this.handleArticleDrop.bind(this));
        this.articleLayoutTable.addEventListener('dragend', this.handleArticleDragEnd.bind(this));
        this.articleLayoutTable.addEventListener('dragleave', (e) => this.handleArticleDragLeave(e));

        // Widget actions
        this.articleLayoutTable.addEventListener('click', (e) => {
          const removeBtn = e.target.closest('[data-action="remove-article-widget"]');
          if (removeBtn) {
            const index = parseInt(removeBtn.dataset.widgetIndex);
            this.removeArticleWidget(index);
            return;
          }

          const statusBtn = e.target.closest('[data-action="toggle-article-status"]');
          if (statusBtn) {
            const index = parseInt(statusBtn.dataset.widgetIndex);
            this.toggleArticleWidgetStatus(index, statusBtn);
          }
        });

        this.initializeArticleConfigControls();
      }

      if (this.saveArticleLayoutBtn) {
        this.saveArticleLayoutBtn.addEventListener('click', () => this.saveArticleLayout());
      }

      if (this.addArticleWidgetBtn && this.articleModalOverlay) {
        this.addArticleWidgetBtn.addEventListener('click', () => this.openAddArticleWidgetModal());

        if (this.articleModalCloseBtn) {
          this.articleModalCloseBtn.addEventListener('click', () => this.closeAddArticleWidgetModal());
        }

        this.articleModalOverlay.addEventListener('click', (e) => {
          if (e.target === this.articleModalOverlay) {
            this.closeAddArticleWidgetModal();
          }
        });
      }
    }

    openAddArticleWidgetModal() {
      if (!this.articleModalOverlay || !this.articleWidgetListContainer) return;

      if (!this.articleWidgetListContainer.children.length) {
        this.articleWidgetListContainer.innerHTML = this.availableArticleWidgets.map(widget => `
          <div class="widget-item" data-widget-type="${widget.type}">
            <div class="widget-item__title">${widget.title}</div>
            <div class="widget-item__desc">${widget.desc}</div>
          </div>
        `).join('');

        this.articleWidgetListContainer.querySelectorAll('.widget-item').forEach(item => {
          item.addEventListener('click', () => {
            this.addArticleWidget(item.dataset.widgetType);
          });
        });
      }

      this.articleModalOverlay.classList.add('is-active');
      document.body.style.overflow = 'hidden';
    }

    closeAddArticleWidgetModal() {
      if (!this.articleModalOverlay) return;
      this.articleModalOverlay.classList.remove('is-active');
      document.body.style.overflow = '';
    }

    addArticleWidget(type) {
      const widgetDef = this.availableArticleWidgets.find(w => w.type === type);
      if (!widgetDef) return;

      const newWidget = {
        type: type,
        config: { ...widgetDef.defaultConfig }
      };

      if (!this.state.articleLayout) {
        this.state.articleLayout = [];
      }

      this.state.articleLayout.push(newWidget);
      this.renderArticleLayoutTable();
      this.closeAddArticleWidgetModal();
      this.showSuccess(`${widgetDef.title} eklendi`);
    }

    removeArticleWidget(index) {
      if (!confirm('Bu bileşeni kaldırmak istediğinize emin misiniz?')) return;

      if (this.state.articleLayout && this.state.articleLayout[index]) {
        this.state.articleLayout.splice(index, 1);
        this.renderArticleLayoutTable();
        this.showSuccess('Bileşen kaldırıldı');
      }
    }

    toggleArticleWidgetStatus(index, button) {
      if (!this.state.articleLayout || !this.state.articleLayout[index]) return;

      const widget = this.state.articleLayout[index];
      widget.config.hidden = !widget.config.hidden;

      button.textContent = widget.config.hidden ? 'Pasif' : 'Aktif';
      button.classList.toggle('is-passive', widget.config.hidden);
    }

    initializeArticleConfigControls() {
      if (!this.articleLayoutTable) return;

      this.articleLayoutTable.addEventListener('change', (e) => {
        const target = e.target;
        const configKey = target.dataset.config;
        const widgetIndex = parseInt(target.dataset.widgetIndex);

        if (configKey !== undefined && widgetIndex !== undefined) {
          this.updateArticleWidgetConfig(widgetIndex, configKey, target);
        }
      });

      this.articleLayoutTable.addEventListener('input', (e) => {
        const target = e.target;
        if (target.type === 'number' || target.type === 'text') {
          const configKey = target.dataset.config;
          const widgetIndex = parseInt(target.dataset.widgetIndex);

          if (configKey !== undefined && widgetIndex !== undefined) {
            this.updateArticleWidgetConfig(widgetIndex, configKey, target);
          }
        }
      });
    }

    updateArticleWidgetConfig(widgetIndex, configKey, element) {
      if (!this.state.articleLayout[widgetIndex]) return;

      let value;

      if (element.type === 'checkbox') {
        value = element.checked;
      } else if (element.type === 'number') {
        // Handle empty number inputs - preserve empty/undefined for optional fields
        if (element.value === '' || element.value === null || element.value === undefined) {
          // For optional fields like maxHeight, remove from config if empty
          if (configKey === 'maxHeight') {
            delete this.state.articleLayout[widgetIndex].config[configKey];
            return;
          } else {
            value = 0;
          }
        } else {
          const parsed = parseInt(element.value);
          // Validate parsed value - must be a valid number
          if (isNaN(parsed) || parsed < 0) {
            // For optional fields, remove invalid values instead of setting to 0
            if (configKey === 'maxHeight') {
              delete this.state.articleLayout[widgetIndex].config[configKey];
              return;
            } else {
              value = 0;
            }
          } else {
            value = parsed;
          }
        }
      } else {
        value = element.value;
      }

      this.state.articleLayout[widgetIndex].config[configKey] = value;
    }

    handleArticleDragStart(e) {
      const row = e.target.closest('tr');
      if (!row) return;

      this.draggedArticleRow = row;
      this.articleLayoutTable.classList.add('dragging-active');
      e.dataTransfer.effectAllowed = 'move';

      const dragImage = row.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.width = (row.offsetWidth * 0.5) + 'px';
      dragImage.style.height = '40px';
      dragImage.style.opacity = '0.7';
      dragImage.style.backgroundColor = '#e3f2fd';
      dragImage.style.border = '2px solid #007bff';
      dragImage.style.borderRadius = '4px';
      dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
      dragImage.style.overflow = 'hidden';
      dragImage.style.display = 'table';
      dragImage.style.tableLayout = 'fixed';
      dragImage.style.fontSize = '12px';
      dragImage.style.whiteSpace = 'nowrap';

      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, (row.offsetWidth * 0.25), 20);

      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);

      setTimeout(() => {
        row.classList.add('cms-dragging');
      }, 0);
    }

    handleArticleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const row = e.target.closest('tr');
      if (!row || row === this.draggedArticleRow || !this.draggedArticleRow) return;

      this.clearArticleDropIndicators();

      const bounding = row.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      const isAfter = e.clientY - offset > 0;

      if (isAfter) {
        row.classList.add('drop-below');
      } else {
        row.classList.add('drop-above');
      }

      this.currentArticleDropTarget = row;
    }

    handleArticleDrop(e) {
      e.stopPropagation();
      e.preventDefault();

      if (!this.draggedArticleRow || !this.currentArticleDropTarget) return;

      const bounding = this.currentArticleDropTarget.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      const isAfter = e.clientY - offset > 0;

      if (isAfter) {
        this.currentArticleDropTarget.after(this.draggedArticleRow);
      } else {
        this.currentArticleDropTarget.before(this.draggedArticleRow);
      }

      // First, collect widgets in new DOM order using OLD data-index values
      const rows = this.articleLayoutTable.querySelectorAll('tbody tr');
      const newOrder = Array.from(rows).map(row => {
        const oldIndex = parseInt(row.dataset.index);
        return this.state.articleLayout[oldIndex];
      });

      // Update state array to match new DOM order
      this.state.articleLayout = newOrder;

      // Now update visual order numbers, data-index attributes, and config control indices
      // (using the updated state array)
      this.updateArticleLayoutOrder();

      this.clearArticleDropIndicators();

      return false;
    }

    handleArticleDragEnd(e) {
      this.articleLayoutTable.classList.remove('dragging-active');
      this.clearArticleDropIndicators();

      if (this.draggedArticleRow) {
        this.draggedArticleRow.classList.remove('cms-dragging');
        this.draggedArticleRow.removeAttribute('draggable');
        this.draggedArticleRow = null;
      }

      this.currentArticleDropTarget = null;
    }

    handleArticleDragLeave(e) {
      const row = e.target.closest('tr');
      if (row) {
        row.classList.remove('drop-above', 'drop-below', 'drag-over');
      }
    }

    clearArticleDropIndicators() {
      const rows = this.articleLayoutTable.querySelectorAll('tbody tr');
      rows.forEach(row => {
        row.classList.remove('drop-above', 'drop-below', 'drag-over');
      });
    }

    updateArticleLayoutOrder() {
      const rows = this.articleLayoutTable.querySelectorAll('tbody tr');
      rows.forEach((row, index) => {
        // Update visual order number
        const orderCell = row.querySelector('.layout-order');
        if (orderCell) {
          orderCell.textContent = index + 1;
        }

        // Update data-index attribute to match new DOM order
        row.dataset.index = index;

        // Update all data-widget-index attributes in config controls
        row.querySelectorAll('[data-widget-index]').forEach(el => {
          el.dataset.widgetIndex = index;
        });
      });
    }

    renderArticleLayoutTable() {
      if (!this.articleLayoutTable) return;

      const tbody = this.articleLayoutTable.querySelector('tbody');
      if (!tbody) return;

      tbody.innerHTML = '';

      if (!this.state.articleLayout || this.state.articleLayout.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="cms-empty-state">Bileşen bulunamadı.</td></tr>';
        return;
      }

      this.state.articleLayout.forEach((widget, index) => {
        const row = this.createArticleLayoutRow(widget, index);
        tbody.appendChild(row);
      });

      // Re-initialize drag handles
      const dragHandles = tbody.querySelectorAll('.layout-drag-handle');
      dragHandles.forEach(handle => {
        const row = handle.closest('tr');
        if (row) {
          handle.addEventListener('mousedown', () => {
            row.setAttribute('draggable', 'true');
          });
          handle.addEventListener('mouseup', () => {
            setTimeout(() => row.removeAttribute('draggable'), 100);
          });
        }
      });
    }

    createArticleLayoutRow(widget, index) {
      const tr = document.createElement('tr');
      tr.dataset.index = index;

      const widgetTitles = {
        'article-header': 'Makale Başlığı',
        'article-meta': 'Makale Bilgileri',
        'article-image': 'Görsel Galerisi',
        'article-content': 'Makale İçeriği',
        'article-tags': 'Etiketler',
        'article-summary': 'Özet Bloğu',
        'article-citation': 'Kaynakça',
        'related-articles': 'İlgili Haberler',
        'sidebar-widget': 'Yan Menü',
        'social-share': 'Sosyal Medya Paylaşım',
        'comment-section': 'Yorum Bölümü',
        'ad-placeholder': 'Reklam Alanı'
      };

      tr.innerHTML = `
        <td class="layout-drag-handle" title="Sürükle">
          <span class="drag-icon">⋮⋮</span>
        </td>
        <td class="layout-order">${index + 1}</td>
        <td>
          <span class="cms-badge cms-badge--primary">${widgetTitles[widget.type] || widget.type}</span>
        </td>
        <td>
          <div class="widget-config-controls">
            ${this.getArticleConfigHtml(widget, index)}
          </div>
        </td>
        <td>
          <div class="status-actions">
            <span class="cms-status ${widget.config.hidden ? 'is-passive' : ''}" 
                  data-action="toggle-article-status" 
                  data-widget-index="${index}"
                  title="Durumu değiştirmek için tıklayın">
              ${widget.config.hidden ? 'Pasif' : 'Aktif'}
            </span>
            <button type="button" class="btn-icon btn-delete" data-action="remove-article-widget" data-widget-index="${index}" title="Bileşeni Kaldır">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      `;

      return tr;
    }

    getArticleConfigHtml(widget, index) {
      if (widget.type === 'related-articles') {
        return `
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 4}" 
                   min="1" 
                   max="12"
                   class="config-input-small">
          </label>
          <label class="config-control">
            <input type="checkbox" 
                   data-config="sameCategory" 
                   data-widget-index="${index}"
                   ${widget.config.sameCategory ? 'checked' : ''}>
            Aynı kategoriden
          </label>
        `;
      } else if (widget.type === 'sidebar-widget') {
        return `
          <label class="config-control">
            <span>Widget Tipi:</span>
            <select data-config="widgetType" 
                    data-widget-index="${index}"
                    class="config-select">
              <option value="popular" ${widget.config.widgetType === 'popular' ? 'selected' : ''}>Popüler Haberler</option>
              <option value="recent" ${widget.config.widgetType === 'recent' ? 'selected' : ''}>Son Haberler</option>
              <option value="category" ${widget.config.widgetType === 'category' ? 'selected' : ''}>Kategori Akışı</option>
            </select>
          </label>
          <label class="config-control">
            <span>Haber sayısı:</span>
            <input type="number" 
                   data-config="limit" 
                   data-widget-index="${index}"
                   value="${widget.config.limit || 5}" 
                   min="1" 
                   max="10"
                   class="config-input-small">
          </label>
        `;
      } else if (widget.type === 'ad-placeholder') {
        return `
          <label class="config-control">
            <span>Boyut:</span>
            <select data-config="size" 
                    data-widget-index="${index}"
                    class="config-select">
              <option value="standard" ${widget.config.size === 'standard' ? 'selected' : ''}>Standart</option>
              <option value="large" ${widget.config.size === 'large' ? 'selected' : ''}>Büyük</option>
              <option value="banner" ${widget.config.size === 'banner' ? 'selected' : ''}>Banner</option>
            </select>
          </label>
          <label class="config-control">
            <span>Pozisyon:</span>
            <select data-config="position" 
                    data-widget-index="${index}"
                    class="config-select">
              <option value="inline" ${widget.config.position === 'inline' ? 'selected' : ''}>İçerik arası</option>
              <option value="sidebar" ${widget.config.position === 'sidebar' ? 'selected' : ''}>Yan menü</option>
            </select>
          </label>
        `;
      }

      return '<span class="config-text">Özel yapılandırma</span>';
    }

    async saveArticleLayout() {
      console.log('🔵 Save Article Layout button clicked!');
      try {
        // Ensure articleLayout is initialized
        if (!this.state.articleLayout) {
          console.log('🔵 Initializing articleLayout state');
          this.state.articleLayout = [];
        }

        const rows = this.articleLayoutTable.querySelectorAll('tbody tr');
        console.log('🔵 Found rows:', rows.length);
        console.log('🔵 Current state.articleLayout length:', this.state.articleLayout ? this.state.articleLayout.length : 0);

        // Filter out empty state rows
        const validRows = Array.from(rows).filter(row => {
          return row.dataset.index !== undefined && !row.classList.contains('empty-state') && !row.querySelector('.cms-empty-state');
        });

        console.log('🔵 Valid rows:', validRows.length);

        if (validRows.length === 0) {
          // No widgets to save, save empty array
          console.log('🔵 No widgets to save, saving empty array');
          this.state.articleLayout = [];

          const response = await fetch('/cms/layouts/article', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ layout: [] })
          });

          if (!response.ok) throw new Error('Failed to save article layout');
          this.showToast('Makale düzeni başarıyla kaydedildi', 'success');
          return;
        }

        // Collect widgets in DOM order using current data-index values
        const newOrder = validRows.map(row => {
          const index = parseInt(row.dataset.index);
          const widget = this.state.articleLayout && this.state.articleLayout[index];

          if (!widget) {
            console.error(`❌ Widget at index ${index} not found in state.articleLayout`);
            console.error(`   State array length: ${this.state.articleLayout ? this.state.articleLayout.length : 'undefined'}`);
            console.error(`   State array:`, this.state.articleLayout);
            return null;
          }

          return widget;
        }).filter(Boolean); // Remove any null/undefined widgets

        console.log('🔵 New order widgets:', newOrder.map(w => w.type));

        // Reassign indices to match new DOM order for subsequent operations
        validRows.forEach((row, newIndex) => {
          row.dataset.index = newIndex;

          // Update all data-widget-index attributes in config controls
          row.querySelectorAll('[data-widget-index]').forEach(el => {
            el.dataset.widgetIndex = newIndex;
          });
        });

        // Update state array (should already be in sync, but ensure consistency)
        this.state.articleLayout = newOrder;

        console.log('🔵 Sending PUT request to /cms/layouts/article...');
        console.log('🔵 Payload:', JSON.stringify({ layout: newOrder }, null, 2));

        const response = await fetch('/cms/layouts/article', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ layout: newOrder })
        });

        console.log('🔵 Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Save failed with status:', response.status);
          console.error('❌ Error response:', errorText);
          throw new Error(`Failed to save article layout: ${response.status} - ${errorText}`);
        }

        const responseData = await response.json();
        console.log('🔵 Save successful, response:', responseData);

        this.showToast('Makale düzeni başarıyla kaydedildi', 'success');
      } catch (error) {
        console.error('❌ Save article layout error:', error);
        console.error('❌ Error stack:', error.stack);
        this.showToast('Makale düzeni kaydedilemedi', 'error');
      }
    }

    initializeHeadlineLayoutManager() {
      this.headlineTable = document.querySelector('[data-cms="headline-layout-table"]');
      this.saveHeadlineBtn = document.querySelector('[data-action="save-carousel-layout"]');
      this.headlineCountBadge = document.querySelector('[data-cms="carousel-count"]');
      this.headlineLimitBadge = document.querySelector('[data-cms="carousel-limit"]');

      if (!this.headlineTable) return;

      // Event Listeners
      this.saveHeadlineBtn?.addEventListener('click', () => this.saveHeadlineLayout());

      // Table Actions (Remove)
      this.headlineTable.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="remove-carousel-article"]');
        if (removeBtn) {
          const row = removeBtn.closest('tr');
          this.removeHeadlineArticle(row, removeBtn);
        }
      });

      // Drag and Drop
      this.headlineTable.addEventListener('dragstart', this.handleHeadlineDragStart.bind(this));
      this.headlineTable.addEventListener('dragover', this.handleHeadlineDragOver.bind(this));
      this.headlineTable.addEventListener('drop', this.handleHeadlineDrop.bind(this));
      this.headlineTable.addEventListener('dragend', this.handleHeadlineDragEnd.bind(this));

      this.setCarouselLimit(this.state.carouselLimit || 5);
    }

    initializeAnaMansetLayoutManager() {
      this.anaMansetTable = document.querySelector('[data-cms="ana-manset-layout-table"]');
      this.saveAnaMansetBtn = document.querySelector('[data-action="save-ana-manset-layout"]');
      this.anaMansetCountBadge = document.querySelector('[data-cms="ana-manset-count"]');
      this.anaMansetLimitBadge = document.querySelector('[data-cms="ana-manset-limit"]');

      if (!this.anaMansetTable) return;

      this.saveAnaMansetBtn?.addEventListener('click', () => this.saveAnaMansetLayout());

      // Table Actions (Remove)
      this.anaMansetTable.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="remove-ana-manset-article"]');
        if (removeBtn) {
          const row = removeBtn.closest('tr');
          this.removeAnaMansetArticle(row, removeBtn);
        }
      });

      // Drag and Drop
      this.anaMansetTable.addEventListener('dragstart', this.handleAnaMansetDragStart.bind(this));
      this.anaMansetTable.addEventListener('dragover', this.handleAnaMansetDragOver.bind(this));
      this.anaMansetTable.addEventListener('drop', this.handleAnaMansetDrop.bind(this));
      this.anaMansetTable.addEventListener('dragend', this.handleAnaMansetDragEnd.bind(this));

      this.setAnaMansetLimit(this.state.anaMansetLimit || 25);
    }

    async removeHeadlineArticle(row, triggerButton) {
      if (!row) return;
      const articleId = row.dataset.articleId;
      if (!articleId) return;

      if (!window.confirm('Bu haberi manşetten kaldırmak istediğinize emin misiniz?')) {
        return;
      }

      const button = triggerButton || row.querySelector('[data-action="remove-carousel-article"]');
      if (button) {
        button.disabled = true;
      }

      try {
        await this.updateArticleTargets(articleId, { remove: ['carousel'] });
        row.remove();
        this.updateHeadlineOrder();
        this.showSuccess('Haber manşetten kaldırıldı.');
      } catch (error) {
        console.error('Headline removal failed:', error);
        this.showError('Haber manşetten kaldırılamadı.');
      } finally {
        if (button && row.isConnected) {
          button.disabled = false;
        }
        if (row.isConnected) {
          this.updateHeadlineCount();
        }
      }
    }

    setCarouselLimit(limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return;
      }
      this.state.carouselLimit = parsedLimit;
      this.updateHeadlineLimitBadge();
      this.applyHeadlineLimitStyles();
    }

    updateHeadlineLimitBadge() {
      if (this.headlineLimitBadge) {
        this.headlineLimitBadge.textContent = this.state.carouselLimit || 5;
      }
    }

    applyHeadlineLimitStyles() {
      if (!this.headlineTable) return;
      const limit = this.state.carouselLimit || 5;
      const rows = this.headlineTable.querySelectorAll('tbody tr[data-article-id]');
      rows.forEach((row, index) => {
        const isOverLimit = index >= limit;
        row.classList.toggle('is-over-limit', isOverLimit);
        row.setAttribute('draggable', (!isOverLimit).toString());
      });
    }

    updateHeadlineCount() {
      const count = this.headlineTable.querySelectorAll('tbody tr[data-article-id]').length;
      if (this.headlineCountBadge) {
        this.headlineCountBadge.textContent = count;
      }
      this.updateHeadlineLimitBadge();
    }

    updateHeadlineOrder() {
      const rows = this.headlineTable.querySelectorAll('tbody tr[data-article-id]');
      rows.forEach((row, index) => {
        const orderCell = row.querySelector('.layout-order');
        if (orderCell) orderCell.textContent = index + 1;
        row.dataset.index = index;
      });
      this.updateHeadlineCount();
      this.applyHeadlineLimitStyles();
    }

    async saveHeadlineLayout() {
      try {
        if (!this.headlineTable) return;

        const limit = this.state.carouselLimit || 5;
        const rows = Array.from(this.headlineTable.querySelectorAll('tbody tr[data-article-id]'));
        const allowedRows = limit > 0 ? rows.slice(0, limit) : rows;
        const overflowRows = limit > 0 ? rows.slice(limit) : [];

        const articles = allowedRows.map((row, index) => ({
          articleId: row.dataset.articleId,
          order: index
        }));

        const response = await fetch('/cms/carousel', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles })
        });

        if (!response.ok) throw new Error('Failed to save layout');

        if (overflowRows.length) {
          overflowRows.forEach(row => row.remove());
          this.showToast('Limit üzerindeki haberler otomatik kaldırıldı', 'warning');
        }

        this.updateHeadlineOrder();
        this.showToast('Manşet düzeni kaydedildi', 'success');
      } catch (error) {
        console.error('Save error:', error);
        this.showToast('Kaydetme başarısız', 'error');
      }
    }

    async loadHeadlineLayout() {
      try {
        const response = await fetch('/cms/carousel');
        if (!response.ok) throw new Error('Failed to load carousel data');

        const data = await response.json();
        const articles = data.populatedArticles || [];
        if (data && data.maxArticles) {
          this.setCarouselLimit(data.maxArticles);
        }

        if (!this.headlineTable) return;

        const tbody = this.headlineTable.querySelector('tbody');
        if (!tbody) return;

        if (!articles.length) {
          tbody.innerHTML = `
            <tr class="empty-state">
              <td colspan="7">
                <div class="cms-empty-state">
                  <p>Henüz manşet slider'ına eklenmiş haber bulunmuyor.</p>
                </div>
              </td>
            </tr>
          `;
          this.updateHeadlineCount();
          return;
        }

        const rowsHtml = articles
          .map((article, index) => {
            const title = this.escapeHtml(article.header || article.title || 'Başlık Yok');
            const isHidden = article.status === 'hidden';
            const statusClass = isHidden ? 'hidden' : 'visible';
            const statusLabel = isHidden ? 'Taslak' : 'Yayında';
            const category = this.escapeHtml(article.category || 'Genel');
            const formattedDate = this.formatDate(article.creationDate || article.publishedAt, '-');
            const imageUrl = article.images && article.images[0] ? article.images[0].url : null;
            const altText = this.escapeHtml(article.header || article.title || 'Manşet görseli');
            const imageMarkup = imageUrl
              ? `<img src="${this.escapeHtml(imageUrl)}" alt="${altText}" class="article-thumb">`
              : '';

            return `
              <tr data-article-id="${this.escapeHtml(String(article.id))}" data-index="${index}" draggable="true">
                <td class="layout-drag-handle" title="Sürükle">
                  <span class="drag-icon" aria-hidden="true">⋮⋮</span>
                </td>
                <td class="layout-order">${index + 1}</td>
                <td>
                  <div class="article-title-cell">
                    ${imageMarkup}
                    <div class="article-info">
                      <span class="article-title">${title}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="article-status ${statusClass}">${statusLabel}</span>
                </td>
                <td>
                  <span class="cms-badge">${category}</span>
                </td>
                <td>${formattedDate}</td>
                <td>
                  <button
                    type="button"
                    class="cms-btn-icon cms-btn-icon--danger"
                    data-action="remove-carousel-article"
                    title="Kaldır"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path d="M7.5 2a1 1 0 0 0-.964.736L6.28 4H4a1 1 0 1 0 0 2h.197l.757 10.193A2 2 0 0 0 6.95 18h6.1a2 2 0 0 0 1.996-1.807L15.803 6H16a1 1 0 1 0 0-2h-2.28l-.256-1.264A1 1 0 0 0 12.5 2h-5zm1.264 2h2.472l.2 1H8.564l.2-1zM8 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1z" fill="currentColor" />
                    </svg>
                  </button>
                </td>
              </tr>
            `;
          })
          .join('');

        tbody.innerHTML = rowsHtml;

        this.updateHeadlineCount();
        this.applyHeadlineLimitStyles();

        // Re-attach drag events to new rows
        const rows = tbody.querySelectorAll('tr[draggable="true"]');
        rows.forEach(row => {
          row.addEventListener('dragstart', (e) => this.handleHeadlineDragStart(e));
          row.addEventListener('dragover', (e) => this.handleHeadlineDragOver(e));
          row.addEventListener('drop', (e) => this.handleHeadlineDrop(e));
          row.addEventListener('dragend', (e) => this.handleHeadlineDragEnd(e));
        });

      } catch (error) {
        console.error('Load headline layout error:', error);
        this.showToast('Manşet verileri yüklenemedi', 'error');
      }
    }

    async removeAnaMansetArticle(row, triggerButton) {
      if (!row) return;
      const articleId = row.dataset.articleId;
      if (!articleId) return;

      if (!window.confirm('Bu haberi ana manşetten kaldırmak istediğinize emin misiniz?')) {
        return;
      }

      const button = triggerButton || row.querySelector('[data-action="remove-ana-manset-article"]');
      if (button) {
        button.disabled = true;
      }

      try {
        await this.updateArticleTargets(articleId, { remove: ['ana-manset'] });
        row.remove();
        this.updateAnaMansetOrder();
        this.showSuccess('Haber ana manşetten kaldırıldı.');
      } catch (error) {
        console.error('Ana Manşet removal failed:', error);
        this.showError('Haber ana manşetten kaldırılamadı.');
      } finally {
        if (button && row.isConnected) {
          button.disabled = false;
        }
        if (row.isConnected) {
          this.updateAnaMansetCount();
        }
      }
    }

    setAnaMansetLimit(limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return;
      }
      this.state.anaMansetLimit = parsedLimit;
      this.updateAnaMansetLimitBadge();
      this.applyAnaMansetLimitStyles();
    }

    updateAnaMansetLimitBadge() {
      if (this.anaMansetLimitBadge) {
        this.anaMansetLimitBadge.textContent = this.state.anaMansetLimit || 25;
      }
    }

    applyAnaMansetLimitStyles() {
      if (!this.anaMansetTable) return;
      const limit = this.state.anaMansetLimit || 25;
      const rows = this.anaMansetTable.querySelectorAll('tbody tr[data-article-id]');
      rows.forEach((row, index) => {
        const isOverLimit = index >= limit;
        row.classList.toggle('is-over-limit', isOverLimit);
        row.setAttribute('draggable', (!isOverLimit).toString());
      });
    }

    updateAnaMansetCount() {
      if (!this.anaMansetTable) return;
      const count = this.anaMansetTable.querySelectorAll('tbody tr[data-article-id]').length;
      if (this.anaMansetCountBadge) {
        this.anaMansetCountBadge.textContent = count;
      }
      this.updateAnaMansetLimitBadge();
    }

    updateAnaMansetOrder() {
      if (!this.anaMansetTable) return;
      const rows = this.anaMansetTable.querySelectorAll('tbody tr[data-article-id]');
      rows.forEach((row, index) => {
        const orderCell = row.querySelector('.layout-order');
        if (orderCell) orderCell.textContent = index + 1;
        row.dataset.index = index;
      });
      this.updateAnaMansetCount();
      this.applyAnaMansetLimitStyles();
    }

    async saveAnaMansetLayout() {
      try {
        if (!this.anaMansetTable) return;

        const limit = this.state.anaMansetLimit || 25;
        const rows = Array.from(this.anaMansetTable.querySelectorAll('tbody tr[data-article-id]'));
        const allowedRows = limit > 0 ? rows.slice(0, limit) : rows;
        const overflowRows = limit > 0 ? rows.slice(limit) : [];

        const articles = allowedRows.map((row, index) => ({
          articleId: row.dataset.articleId,
          order: index
        }));

        const response = await fetch('/cms/ana-manset', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles })
        });

        if (!response.ok) throw new Error('Failed to save layout');

        if (overflowRows.length) {
          overflowRows.forEach(row => row.remove());
          this.showToast('Limit üzerindeki haberler otomatik kaldırıldı', 'warning');
        }

        this.updateAnaMansetOrder();
        this.showToast('Ana Manşet düzeni kaydedildi', 'success');
      } catch (error) {
        console.error('Save ana-manset error:', error);
        this.showToast('Kaydetme başarısız', 'error');
      }
    }

    async loadAnaMansetLayout() {
      try {
        const response = await fetch('/cms/ana-manset');
        if (!response.ok) throw new Error('Failed to load ana-manset data');

        const data = await response.json();
        const articles = data.populatedArticles || [];
        if (data && data.maxArticles) {
          this.setAnaMansetLimit(data.maxArticles);
        }

        if (!this.anaMansetTable) return;

        const tbody = this.anaMansetTable.querySelector('tbody');
        if (!tbody) return;

        if (!articles.length) {
          tbody.innerHTML = `
            <tr class="empty-state">
              <td colspan="7">
                <div class="cms-empty-state">
                  <p>Henüz ana manşet slider'ına eklenmiş haber bulunmuyor.</p>
                </div>
              </td>
            </tr>
          `;
          this.updateAnaMansetCount();
          return;
        }

        const rowsHtml = articles
          .map((article, index) => {
            const title = this.escapeHtml(article.header || article.title || 'Başlık Yok');
            const isHidden = article.status === 'hidden';
            const statusClass = isHidden ? 'hidden' : 'visible';
            const statusLabel = isHidden ? 'Taslak' : 'Yayında';
            const category = this.escapeHtml(article.category || 'Genel');
            const formattedDate = this.formatDate(article.creationDate || article.publishedAt, '-');
            const imageUrl = article.images && article.images[0] ? article.images[0].url : null;
            const altText = this.escapeHtml(article.header || article.title || 'Ana manşet görseli');
            const imageMarkup = imageUrl
              ? `<img src="${this.escapeHtml(imageUrl)}" alt="${altText}" class="article-thumb">`
              : '';

            return `
              <tr data-article-id="${this.escapeHtml(String(article.id))}" data-index="${index}" draggable="true">
                <td class="layout-drag-handle" title="Sürükle">
                  <span class="drag-icon" aria-hidden="true">⋮⋮</span>
                </td>
                <td class="layout-order">${index + 1}</td>
                <td>
                  <div class="article-title-cell">
                    ${imageMarkup}
                    <div class="article-info">
                      <span class="article-title">${title}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="article-status ${statusClass}">${statusLabel}</span>
                </td>
                <td>
                  <span class="cms-badge">${category}</span>
                </td>
                <td>${formattedDate}</td>
                <td>
                  <button
                    type="button"
                    class="cms-btn-icon cms-btn-icon--danger"
                    data-action="remove-ana-manset-article"
                    title="Kaldır"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path d="M7.5 2a1 1 0 0 0-.964.736L6.28 4H4a1 1 0 1 0 0 2h.197l.757 10.193A2 2 0 0 0 6.95 18h6.1a2 2 0 0 0 1.996-1.807L15.803 6H16a1 1 0 1 0 0-2h-2.28l-.256-1.264A1 1 0 0 0 12.5 2h-5zm1.264 2h2.472l.2 1H8.564l.2-1zM8 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1zm4 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1z" fill="currentColor" />
                    </svg>
                  </button>
                </td>
              </tr>
            `;
          })
          .join('');

        tbody.innerHTML = rowsHtml;

        this.updateAnaMansetCount();
        this.applyAnaMansetLimitStyles();

        const rows = tbody.querySelectorAll('tr[draggable=\"true\"]');
        rows.forEach(row => {
          row.addEventListener('dragstart', (e) => this.handleAnaMansetDragStart(e));
          row.addEventListener('dragover', (e) => this.handleAnaMansetDragOver(e));
          row.addEventListener('drop', (e) => this.handleAnaMansetDrop(e));
          row.addEventListener('dragend', (e) => this.handleAnaMansetDragEnd(e));
        });
      } catch (error) {
        console.error('Load ana-manset layout error:', error);
        this.showToast('Ana Manşet verileri yüklenemedi', 'error');
      }
    }

    handleAnaMansetDragStart(e) {
      const row = e.target.closest('tr');
      if (!row || row.classList.contains('is-over-limit')) {
        e.preventDefault();
        return;
      }
      this.draggedAnaMansetRow = row;
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('cms-dragging');
    }

    handleAnaMansetDragOver(e) {
      e.preventDefault();
      const row = e.target.closest('tr');
      if (!row || row === this.draggedAnaMansetRow) return;

      const bounding = row.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      if (e.clientY - offset > 0) {
        row.after(this.draggedAnaMansetRow);
      } else {
        row.before(this.draggedAnaMansetRow);
      }
      this.updateAnaMansetOrder();
    }

    handleAnaMansetDrop(e) {
      e.preventDefault();
    }

    handleAnaMansetDragEnd(e) {
      this.draggedAnaMansetRow?.classList.remove('cms-dragging');
      this.draggedAnaMansetRow = null;
      this.updateAnaMansetOrder();
    }

    // Drag and Drop Handlers (Simplified version of LayoutManager)
    handleHeadlineDragStart(e) {
      const row = e.target.closest('tr');
      if (!row || row.classList.contains('is-over-limit')) {
        e.preventDefault();
        return;
      }
      this.draggedHeadlineRow = row;
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('cms-dragging');
    }

    handleHeadlineDragOver(e) {
      e.preventDefault();
      const row = e.target.closest('tr');
      if (!row || row === this.draggedHeadlineRow) return;

      const bounding = row.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      if (e.clientY - offset > 0) {
        row.after(this.draggedHeadlineRow);
      } else {
        row.before(this.draggedHeadlineRow);
      }
      this.updateHeadlineOrder();
    }

    handleHeadlineDrop(e) {
      e.preventDefault();
    }

    handleHeadlineDragEnd(e) {
      this.draggedHeadlineRow?.classList.remove('cms-dragging');
      this.draggedHeadlineRow = null;
      this.updateHeadlineOrder();
    }

    async logout() {
      if (!confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        return;
      }

      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Logout failed');
        }

        const data = await response.json();

        // Redirect to login page
        if (data.redirect) {
          window.location.href = data.redirect;
        } else {
          window.location.href = '/cms/login';
        }
      } catch (error) {
        console.error('Logout error:', error);
        this.showToast('Çıkış yapılırken bir hata oluştu', 'error');
      }
    }

    // Helper to show toast notifications (assuming it exists or adding a simple one)
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `cms-toast cms-toast--${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);

      // Simple styles for toast if not present
      if (!document.querySelector('#cms-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'cms-toast-styles';
        style.textContent = `
          .cms-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #333;
            color: white;
            border-radius: 4px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
          }
          .cms-toast--success { background: #48bb78; }
          .cms-toast--error { background: #f56565; }
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    new CMSDashboard(INITIAL_STATE);
  });
})();

