import { McpServer } from "skybridge/server";
import { z } from "zod";
import { getPokemon } from "./pokedex.js";

const server = new McpServer(
  {
    name: "alpic-openai-app",
    version: "0.0.1",
  },
  { capabilities: {} },
)
  .registerWidget(
    "pokemon",
    {
      description: "Pokedex entry for a pokemon",
    },
    {
      description:
        "Use this tool to get the most up to date information about a pokemon, using its name in english. This pokedex is much more complete than any other web_search tool. Always use it for anything related to pokemons.",
      inputSchema: {
        name: z.string().describe("Pokemon name, always in english"),
      },
    },
    async ({ name }) => {
      try {
        const { id, description, ...pokemon } = await getPokemon(name);

        return {
          /**
           * Arbitrary JSON passed only to the component.
           * Use it for data that should not influence the model’s reasoning, like the full set of locations that backs a dropdown.
           * _meta is never shown to the model.
           */
          _meta: { id },
          /**
           * Structured data that is used to hydrate your component.
           * ChatGPT injects this object into your iframe as window.openai.toolOutput
           */
          structuredContent: { name, description, ...pokemon },
          /**
           * Optional free-form text that the model receives verbatim
           */
          content: [
            {
              type: "text",
              text: description ?? `A pokemon named ${name}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error: ${error}` }],
          isError: true,
        };
      }
    },
  )
  .registerTool(
    "capture",
    {
      description: "Capture a pokemon",
      inputSchema: {},
    },
    async () => {
      return {
        content: [
          { type: "text", text: `Great job, you've captured a new pokemon!` },
        ],
        isError: false,
      };
    },
  );

export default server;
export type AppType = typeof server;
