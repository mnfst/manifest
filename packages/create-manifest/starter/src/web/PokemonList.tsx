import { useEffect, useState } from 'react'
import { BlogPostList } from '@/components/blog-post-list'
import type { BlogPost } from '@/components/blog-post-card'
import { PaymentMethods } from './components/payment-methods'

interface Pokemon {
  id: number
  name: string
  image: string
  types: string[]
  height: number
  weight: number
}

interface StructuredContent {
  pokemons: Pokemon[]
}

function pokemonToBlogPost(pokemon: Pokemon): BlogPost {
  const capitalizedName =
    pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)

  return {
    id: String(pokemon.id),
    title: capitalizedName,
    excerpt: `Height: ${pokemon.height / 10}m | Weight: ${pokemon.weight / 10}kg`,
    coverImage: pokemon.image,
    author: {
      name: `#${String(pokemon.id).padStart(3, '0')}`,
      avatar: pokemon.image
    },
    publishedAt: new Date().toISOString(),
    readTime: pokemon.types.join(', '),
    tags: pokemon.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
    category: pokemon.types[0]
      ? pokemon.types[0].charAt(0).toUpperCase() + pokemon.types[0].slice(1)
      : 'Normal'
  }
}

export default function PokemonList() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('window.openai:', window.openai)
    console.log('structuredContent:', window.openai?.content?.structuredContent)

    // Get structured content from OpenAI
    if (window.openai?.content?.structuredContent) {
      const content = window.openai.content
        .structuredContent as StructuredContent
      console.log(
        'Using structuredContent, pokemons count:',
        content.pokemons?.length
      )
      if (content.pokemons) {
        setPosts(content.pokemons.map(pokemonToBlogPost))
      }
      setLoading(false)
    } else {
      // Fallback: fetch directly if not in OpenAI context
      console.log('No structuredContent, falling back to direct fetch')
      fetchPokemons()
    }
  }, [])

  async function fetchPokemons() {
    try {
      const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=12')
      const data = await response.json()

      const pokemons = await Promise.all(
        data.results.map(async (pokemon: { name: string; url: string }) => {
          const detailResponse = await fetch(pokemon.url)
          const detail = await detailResponse.json()

          return {
            id: detail.id,
            name: detail.name,
            image:
              detail.sprites.other['official-artwork'].front_default ||
              detail.sprites.front_default,
            types: detail.types.map(
              (t: { type: { name: string } }) => t.type.name
            ),
            height: detail.height,
            weight: detail.weight
          }
        })
      )

      setPosts(pokemons.map(pokemonToBlogPost))
    } catch (error) {
      console.error('Failed to fetch Pokemon:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReadMore = (post: BlogPost) => {
    const pokemonName = post.title.toLowerCase()
    window.openai?.sendFollowUpMessage?.(`Tell me more about ${pokemonName}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading Pokemon...</div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <PaymentMethods />
      <BlogPostList
        posts={posts}
        variant="carousel"
        showAuthor={true}
        showCategory={true}
        onReadMore={handleReadMore}
      />
    </div>
  )
}
