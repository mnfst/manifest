import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";

import type { McpServer } from "skybridge/server";

export const mcp =
  (server: McpServer) =>
  async (req: Request, res: Response, next: NextFunction) => {
    // Only handle requests to the /mcp path
    if (req.path !== "/mcp") {
      return next();
    }

    if (req.method === "POST") {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        res.on("close", () => {
          transport.close();
        });

        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    } else if (req.method === "GET" || req.method === "DELETE") {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Method not allowed.",
          },
          id: null,
        }),
      );
    } else {
      next();
    }
  };
