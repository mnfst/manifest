[< Connect with the JS SDK](connect.md)

# Quick start with React

Give a proper backend to your React app.

> [!Tip]

> This quick start guide focuses exclusively on the **front-end**. To ensure the functionality of this code, your CASE backend must be [installed and served](../install.md) at `http://localhost:4000`.

# 1. Create a React app

If you already have a React app, you can skip this step.

There is several ways to do that. We will use the easiest one: **create-react-app**. You can replace `my-client` by the name of your front-end app.

```
npx create-react-app my-client
cd my-client
npm start
```

# 2. Install CASE SDK

Install the JS SDK from the root of your React app.

```
npm i @casejs/case-client
```

# 3. Use it in your app

In that example we are using a Pokemon entity [created previously](../entities.md). Replace it by your own entity. This example uses TypeScript, you can remove the typing to have plain JS.

```js
// App.tsx

function App() {
  interface Pokemon {
    id: number;
    name: string;
  }

  const [pokemons, setPokemon] = useState<Pokemon[]>([]);

  useEffect(() => {
    // Init SDK.
    const cs = new CaseClient();

    // Fetch the list of Pokemons.
    cs.from("pokemon")
      .find<Pokemon>()
      .then((res) => {
        setPokemon(res);
      });
  }, []);

  // Display a list of Pokemons.
  return (
    <ul>
      {pokemons.map((pokemon) => (
        <li>{pokemon.name}</li>
      ))}
    </ul>
  );
}

export default App;
```

Checkout the [SDK doc](connect.md) to see more usages of the SDK: CRUD operations, file upload, authentication,

> [!Tip]

> Otherwise you can start from our [React + CASE example repository](https://github.com/casejs/front-end-starters)
