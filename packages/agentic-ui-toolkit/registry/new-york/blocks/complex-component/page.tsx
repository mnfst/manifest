import { cache } from "react"
import { PokemonCard } from "@/registry/new-york/blocks/complex-component/components/pokemon-card"
import { getPokemonList } from "@/registry/new-york/blocks/complex-component/lib/pokemon"
const getCachedPokemonList = cache(getPokemonList)

export default async function Page() {
  const pokemons = await getCachedPokemonList({ limit: 12 })

  if (!pokemons) {
    return null
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4">
      <div className="grid grid-cols-2 gap-4 py-10 sm:grid-cols-3 md:grid-cols-4">
        {pokemons.results.map((p) => (
          <PokemonCard key={p.name} name={p.name} />
        ))}
      </div>
    </div>
  )
}
