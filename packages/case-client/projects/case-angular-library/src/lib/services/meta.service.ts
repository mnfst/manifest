import { Inject, Injectable } from '@angular/core'
import { Title, Meta } from '@angular/platform-browser'
import { CaseConfig } from '../interfaces/case-config.interface'
import { MetaObject } from '../interfaces/meta-object.interface'

@Injectable({
  providedIn: 'root'
})
export class MetaService {
  constructor(
    private title: Title,
    private meta: Meta,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  defaultMeta: MetaObject = {
    title: this.config.appName,
    description: `Application de gestion d'activité`,
    path: '',
    ogImage: 'assets/images/logo.png'
  }

  setTags(metaObject: MetaObject): void {
    this.title.setTitle(
      `${metaObject.title || this.defaultMeta.title} | ${this.config.appName}`
    )
    this.meta.addTags([
      {
        name: 'description',
        content: metaObject.description || this.defaultMeta.description
      },
      {
        name: 'og:description',
        content: metaObject.description || this.defaultMeta.description
      },
      {
        name: 'og:title',
        content: metaObject.title || this.defaultMeta.title
      },
      {
        name: 'og:url',
        content: this.config.baseUrl + metaObject.path
      },
      {
        name: 'og:image',
        content:
          this.config.baseUrl + (metaObject.ogImage || this.defaultMeta.ogImage)
      }
    ])
  }
}
