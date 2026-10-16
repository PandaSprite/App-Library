
import {
  Observable,
  ObservableArray,
  ApplicationSettings,
  Dialogs
} from '@nativescript/core';

const SUPABASE_URL =
  'https://msmqfrichopnlhwtdqiv.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_C-lNg3wPi9SESHR4BqI9cA_dIftHpKK';

const REQUEST_TIMEOUT_MS = 12000;

class LudoraViewModel extends Observable {
  constructor() {
    super();

    this.apps = [];
    this.filteredApps = new ObservableArray();
    this.searchText = '';

    this.loadPromise = null;
    this.hasLoaded = false;
    this.hasShownError = false;
  }

  showApps(data) {
    this.apps = data;

    const query = String(this.searchText || '')
      .trim()
      .toLowerCase();

    const results = this.apps.filter(app => {
      const name = String(app.name || '').toLowerCase();
      const category = String(app.category || '').toLowerCase();

      return name.includes(query) || category.includes(query);
    });

    this.filteredApps.splice(
      0,
      this.filteredApps.length,
      ...results
    );
  }

  loadCachedApps() {
    try {
      const cached = JSON.parse(
        ApplicationSettings.getString('ludora_cached_apps', '[]')
      );

      if (Array.isArray(cached)) {
        this.showApps(cached);
        return cached.length > 0;
      }
    } catch (error) {
      console.log('Ludora cache error:', error);
    }

    this.showApps([]);
    return false;
  }

  async loadApps() {
    // Reuse an active request instead of starting another.
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Do not repeatedly download the same catalog on navigation.
    if (this.hasLoaded) {
      return;
    }

    this.loadPromise = this.fetchCatalog();

    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  async fetchCatalog() {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/apps?select=*&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          },
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`Supabase HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Unexpected catalog response');
      }

      this.showApps(data);

      ApplicationSettings.setString(
        'ludora_cached_apps',
        JSON.stringify(data)
      );

      this.hasLoaded = true;
    } catch (error) {
      console.log(
        'Ludora catalog request failed:',
        String(error)
      );

      // Keep saved apps visible when the network fails.
      const hasCachedApps = this.apps.length > 0 ||
        this.loadCachedApps();

      // Avoid repeatedly interrupting the user with alerts.
      if (!hasCachedApps && !this.hasShownError) {
        this.hasShownError = true;

        Dialogs.alert({
          title: 'Ludora',
          message:
            'Could not load apps. Check your connection and try reopening Ludora.',
          okButtonText: 'OK'
        });
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  filterApps() {
    this.showApps(this.apps);
  }
}

export function onNavigatingTo(args) {
  const page = args.object;

  // Keep the existing model when returning to this page.
  if (page.bindingContext instanceof LudoraViewModel) {
    viewModel = page.bindingContext;
  } else {
    viewModel = new LudoraViewModel();
    page.bindingContext = viewModel;
    viewModel.loadCachedApps();
  }

  viewModel.loadApps();
}

export function onSearchChange(args) {
  if (!viewModel) return;

  viewModel.set('searchText', args.object.text || '');
  viewModel.filterApps();
}

export function onAppTap(args) {
  if (!viewModel) return;

  const app = viewModel.filteredApps.getItem(args.index);
  if (!app) return;

  Dialogs.alert({
    title: String(app.name || 'App details'),
    message: String(app.description || 'No description available.'),
    okButtonText: 'Close'
  });
}
	
