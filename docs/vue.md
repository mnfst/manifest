[< Connect with the JS SDK](connect.md)

# Quick start with Vue

Give a proper backend to your Vue.js app.

> [!Tip]

> This quick start guide focuses exclusively on the **front-end**. To ensure the functionality of this code, your CASE backend must be [installed and served](../install.md) at `http://localhost:4000`.

# 1. Create a Vue app

If you already have a Vue app running, you can skip this step.

We are using Vue.js v3 in this tutorial. You can replace `my-client` by the name of your front-end app

```
npm create vue@latest
cd my-client // If you called your app "my-client" when asked in the previous step
npm install
npm run dev
```

# 2. Install CASE SDK

Install the JS SDK from the root of your Vue app.

```
npm i @casejs/case-client
```

# 3. Use it in your app

In that example we are using a Pokemon entity [created previously](../entities.md). Replace it by your own entity. This example uses TypeScript, you can remove the typing to have plain JS.

```js
<script lang="ts">
import CaseClient from "@casejs/case-client";

interface Pokemon {
  id: number;
  name: string;
  type: string;
  image: string;
}

export default {
  data() {
    return {
      pokemons: [] as Pokemon[],
    };
  },
  mounted() {
    this.fetchPokemon();
  },
  methods: {
    async fetchPokemon() {

      // Init SDK
      const cs = new CaseClient();

      // Fetch Pokemons from the backend.
      cs.from("pokemon")
        .find<Pokemon>()
        .then((res) => {
          // Store the response in the "pokemons" array
          this.pokemons = res;
        });
    },
  },
};
</script>

<template>
    <ul>
        <li v-for="pokemon of pokemons">{{ pokemon.name}}</li>
    </ul>
</template>


```

Checkout the [SDK doc](connect.md) to see more usages of the SDK: CRUD operations, file upload, authentication,

> [!Tip]

> Otherwise you can start from our [Vue + CASE example repository](https://github.com/casejs/front-end-starters)
