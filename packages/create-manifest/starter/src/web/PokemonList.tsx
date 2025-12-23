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
    // Get structured content from OpenAI
    if (window.openai?.content?.structuredContent) {
      const content = window.openai.content
        .structuredContent as StructuredContent
      if (content.pokemons) {
        setPosts(content.pokemons.map(pokemonToBlogPost))
      }
    }
    setLoading(false)
  }, [])

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

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">
          No data provided. Use the listPokemons tool.
        </div>
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
