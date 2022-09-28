# CASE Angular Library

Angular library version of the CASE application for the client. Made by [Buddyweb](https://buddyweb.fr)

## Installation

NPM

```bash
npm i case-angular-library
```

Import module in `app.module.ts` :

```typescript
import { CaseModule } from 'case-angular-library'
import { ReactiveFormsModule } from '@angular/forms'

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    CaseModule.forRoot({
      baseUrl: environment.baseUrl,
      apiBaseUrl: environment.apiBaseUrl,
      storagePath: environment.storagePath,
      appName: environment.appName,
      tokenName: environment.tokenName,
      tokenAllowedDomains: environment.tokenAllowedDomains,
      production: environment.production,
    }),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
```

Add CASE routes in `app-routing.module.ts`

```typescript
const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [AuthGuard]
  }
]

routes.push(...(caseRoutes as Route[]))
```

Import CASE styles in your main styles.scss file :

```scss
@import 'case-angular-library/styles/main';
```
