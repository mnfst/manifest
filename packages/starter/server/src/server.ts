import { McpServer } from "skybridge/server";

const server = new McpServer(
  {
    name: "alpic-openai-app",
    version: "0.0.1",
  },
  { capabilities: {} },
).registerWidget(
  "canvas", // Must match the filename: my-widget.tsx
  {},
  {
    description: "Canvas widget",
    inputSchema: {
      message: { type: "string" },
    },
  },
  async ({ message }) => {
    // Your widget logic here
    return {
      content: [
        {
          type: "text",
          text: message || "Hello World",
        },
      ],
    };
  },
);

export default server;
export type AppType = typeof server;
