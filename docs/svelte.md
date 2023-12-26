[< Connect with the JS SDK](connect.md)

# Quick start with Svelte

Give a proper backend to your Svelte app.

> [!Tip]

> This quick start guide focuses exclusively on the **front-end**. To ensure the functionality of this code, your CASE backend must be [installed and served](../install.md) at `http://localhost:4000`.

# 1. Create a Svelte app

If you already have a Svelte app running, you can skip this step.

There is several ways to do that. In our example we use [SvelteKit](https://kit.svelte.dev/) to generate a pre-configured Svelte app, you . You can replace `my-client` by the name of your front-end app.

```
npm create svelte@latest my-client
cd my-client
npm install
npm run dev -- --open
```

# 2. Install CASE SDK

Install the JS SDK from the root of your Svelte app.

```
npm i @casejs/case-client
```

# 3. Use it in your app

In that example we are using a Pokemon entity [created previously](../entities.md). Replace it by your own entity. This example uses TypeScript, you can remove the typing to have plain JS.

```js
// src/routes/+page.svelte

<script lang="ts">
  import "bulma/css/bulma.min.css";

  import CaseClient from "@casejs/case-client";
  import { onMount } from "svelte";

  interface Pokemon {
    id: number;
    name: string;
    type: string;
    image: string;
  }

  let pokemons: Pokemon[] = [];

  onMount(async () => {
    const cs = new CaseClient();
    pokemons = await cs.from("pokemon").find<Pokemon>();
  });
</script>

<div class="main">
  <ul>
    {#each pokemons as pokemon}
      <li>{pokemon.name}</li>
    {/each}
  </ul>
</div>

```

Checkout the [SDK doc](connect.md) to see more usages of the SDK: CRUD operations, file upload, authentication,

> [!Tip]

> Otherwise you can start from our [Svelte + CASE example repository](https://github.com/casejs/front-end-starters)
