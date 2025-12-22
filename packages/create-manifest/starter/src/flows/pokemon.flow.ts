import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readFileSync } from "node:fs"

export interface Pokemon {
  id: number
  name: string
  image: string
  types: string[]
  height: number
  weight: number
}

export function renderHtml(): string {
  return readFileSync("./dist/web/pokemon-list/pokemon-list.html", "utf-8")
}

async function fetchPokemons(limit: number = 12): Promise<Pokemon[]> {
  const response = await fetch(
    `https://pokeapi.co/api/v2/pokemon?limit=${limit}`
  )
  const data = await response.json()

  const pokemons = await Promise.all(
    data.results.map(async (pokemon: { name: string; url: string }) => {
      const detailResponse = await fetch(pokemon.url)
      const detail = await detailResponse.json()

      return {
        id: detail.id,
        name: detail.name,
        image:
          detail.sprites.other["official-artwork"].front_default ||
          detail.sprites.front_default,
        types: detail.types.map(
          (t: { type: { name: string } }) => t.type.name
        ),
        height: detail.height,
        weight: detail.weight
      }
    })
  )

  return pokemons
}

/**
 * Registers the Pokemon List flow with the MCP server.
 */
export function registerPokemonFlow(server: McpServer): void {
  const uiVersion = "v1"
  const resourceUri = `ui://pokemon-list.html?${uiVersion}`

  server.registerResource("pokemon-list", resourceUri, {}, async () => ({
    contents: [
      {
        uri: resourceUri,
        mimeType: "text/html+skybridge",
        text: renderHtml(),
        _meta: { "openai/widgetPrefersBorder": false }
      }
    ]
  }))

  server.registerTool(
    "listPokemons",
    {
      title: "Pokemon List",
      description: `Display a list of Pokemon in an interactive carousel.

WHEN TO USE:
- When the user asks to see a list of Pokemon
- When the user wants to browse Pokemon
- When the user asks "show me some Pokemon"

The tool fetches Pokemon data from the PokeAPI and displays them in a beautiful carousel format.`,
      inputSchema: z.object({
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(12)
          .describe("Number of Pokemon to fetch (1-50, default: 12)")
      }),
      _meta: {
        "openai/outputTemplate": resourceUri,
        "openai/toolInvocation/invoking": "Fetching Pokemon...",
        "openai/toolInvocation/invoked": "Pokemon list ready!"
      }
    },
    async (args: { limit?: number }) => {
      const limit = args.limit ?? 12

      try {
        const pokemons = await fetchPokemons(limit)

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${pokemons.length} Pokemon! Browse through the carousel to see them all.`
            }
          ],
          structuredContent: {
            pokemons
          }
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to fetch Pokemon: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
