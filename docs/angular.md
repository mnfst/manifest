[< Connect with the JS SDK](connect.md)

# Quick start with Angular

Give a proper backend to your Angular app.

> [!Tip]

> This quick start guide focuses exclusively on the **front-end**. To ensure the functionality of this code, your CASE backend must be [installed and served](../install.md) at `http://localhost:4000`.

# 1. Create a Angular app

If you already have your Angular app up and running, skip this step.

We will use the [Angular CLI](https://angular.io/cli) to create a new Angular project. You can replace `my-client` by the name of your front-end app.

```
ng new my-client
cd my-client
ng serve
```

# 2. Install CASE SDK

Install the JS SDK from the root of your Angular app.

```
npm i @casejs/case-client
```

# 3. Use it in your app

In that example we are using a Pokemon entity [created previously](../entities.md). Replace it by your own entity.

```js
// app.component.ts

import { Component } from '@angular/core'
import CaseClient from '@casejs/case-client'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'angular'
  pokemons: { id: number, name: string }[] = []

  async ngOnInit() {
    // Init SDK.
    const cs = new CaseClient()

    // Fetch the list of Pokemons.
    this.pokemons = await cs.from('pokemon').find()
  }
}
```

And in the template:

```html
<ul>
  <li *ngFor="let pokemon of pokemons">{{ pokemon.name}}</li>
</ul>
```

Checkout the [SDK doc](connect.md) to see more usages of the SDK: CRUD operations, file upload, authentication,

> [!Tip]

> Otherwise you can start from our [Angular + CASE example repository](https://github.com/casejs/front-end-starters)
