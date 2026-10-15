import {
  Observable,
  ObservableArray,
  ApplicationSettings,
  Dialogs
} from '@nativescript/core'

const SUPABASE_URL =
  'https://msmqfrichopnlhwtdqiv.supabase.co'

const SUPABASE_KEY =
  'sb_publishable_C-lNg3wPi9SESHR4BqI9cA_dIftHpKK'

let viewModel

class LudoraViewModel extends Observable {
  constructor() {
    super()

    this.apps = []
    this.filteredApps = new ObservableArray()
    this.searchText = ''
  }

  async loadApps() {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/apps?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Supabase HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error('Unexpected catalog response')
      }

      this.apps = data

      ApplicationSettings.setString(
        'ludora_cached_apps',
        JSON.stringify(data)
      )

      this.filterApps()
    } catch (error) {
      console.log('Ludora catalog error:', error)

      try {
        this.apps = JSON.parse(
          ApplicationSettings.getString(
            'ludora_cached_apps',
            '[]'
          )
        )
      } catch (_) {
        this.apps = []
      }

      this.filterApps()

      Dialogs.alert({
        title: 'Ludora',
        message: this.apps.length
          ? 'Could not connect. Showing saved apps.'
          : 'Could not load apps. Check your connection and Supabase permissions.',
        okButtonText: 'OK'
      })
    }
  }

  filterApps() {
    const query = String(this.searchText || '')
      .trim()
      .toLowerCase()

    const results = this.apps.filter(app => {
      const name = String(app.name || '').toLowerCase()
      const category = String(app.category || '').toLowerCase()

      return name.includes(query) || category.includes(query)
    })

    this.filteredApps.splice(
      0,
      this.filteredApps.length,
      ...results
    )
  }
}

export function onNavigatingTo(args) {
  const page = args.object

  viewModel = new LudoraViewModel()
  page.bindingContext = viewModel

  viewModel.loadApps()
}

export function onSearchChange(args) {
  if (!viewModel) return

  viewModel.set('searchText', args.object.text || '')
  viewModel.filterApps()
}

export function onAppTap(args) {
  if (!viewModel) return

  const app = viewModel.filteredApps.getItem(args.index)
  if (!app) return

  Dialogs.alert({
    title: String(app.name || 'App details'),
    message: String(app.description || 'No description available.'),
    okButtonText: 'Close'
  })
}
