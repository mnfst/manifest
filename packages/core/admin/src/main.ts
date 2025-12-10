import { platformBrowserDynamic } from '@angular/platform-browser-dynamic'

import { AppModule } from './app/app.module'

import { Buffer } from 'buffer'

;(window as any).process = {
  env: {},
  version: '',
  platform: 'browser'
}
;(window as any).Buffer = Buffer

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err))
