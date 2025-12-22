import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { readFileSync } from "node:fs"

const uploadSchema = z.object({
  download_url: z.string(),
  file_id: z.string()
})

export function renderHtml(): string {
  return readFileSync("./dist/web/gameboy-player/gameboy-player.html", "utf-8")
}

/**
 * Registers the GameBoy Player flow with the MCP server.
 */
export function registerGameboyFlow(server: McpServer): void {
  // Version for cache busting - increment when making UI changes
  const uiVersion = "v6"
  const resourceUri = `ui://gameboy-player.html?${uiVersion}`

  server.registerResource("gameboy-player", resourceUri, {}, async () => ({
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
    "playGameboy",
    {
      title: "GameBoy Player",
      description: `Play a GameBoy game in an interactive emulator using keyboard controls.

IMPORTANT: The ROM file MUST be uploaded by the user through the chat interface. This tool requires the file's download_url provided by the file upload system - it cannot accept file paths or URLs to external sites.

WHEN TO USE:
- When the user uploads a .gb or .gbc ROM file and wants to play it
- When the user asks to play a GameBoy game (prompt them to upload a ROM file first)

DO NOT USE if the user only provides a file path or external URL - ask them to upload the file directly to the chat instead.`,
      inputSchema: z.object({
        rom: uploadSchema
          .optional()
          .describe("The uploaded GameBoy ROM file (.gb or .gbc)")
      }),
      _meta: {
        "openai/fileParams": ["rom"],
        "openai/outputTemplate": resourceUri,
        "openai/toolInvocation/invoking": "Loading GameBoy ROM",
        "openai/toolInvocation/invoked": "GameBoy ready to play"
      }
    },
    async (args: { rom?: z.infer<typeof uploadSchema> | undefined }) => {
      if (!args.rom) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No ROM file provided. Please upload a GameBoy ROM file (.gb or .gbc)."
            }
          ],
          isError: true
        }
      }

      console.log("Received ROM upload:", args.rom)

      const keyboardInstructions = `IMPORTANT: You MUST display the following keyboard controls to the user - they cannot play without this information:

🎮 **GameBoy Keyboard Controls:**

| GameBoy Button | Keyboard Key |
|----------------|--------------|
| **A** | G |
| **B** | B |
| **START** | H |
| **SELECT** | N |
| **D-Pad** | Arrow Keys (↑ ↓ ← →) |

⚠️ **Instructions:** Click on the game screen to focus it, then use the keyboard keys listed above to play.

The emulator is now ready!`

      return {
        content: [
          {
            type: "text" as const,
            text: keyboardInstructions
          }
        ],
        structuredContent: {
          romUrl: args.rom.download_url,
          fileId: args.rom.file_id
        }
      }
    }
  )
}
