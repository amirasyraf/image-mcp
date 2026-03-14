#!/usr/bin/env node
/**
 * Gemini Image MCP Server
 *
 * MCP server for AI-powered image generation and editing using Google Gemini API.
 * Designed for frontend development workflows: generating icons, placeholders,
 * hero images, diagrams, and editing existing assets.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initGeminiClient } from "./services/gemini.js";
import { registerGenerateImageTool } from "./tools/generate.js";
import { registerEditImageTool } from "./tools/edit.js";
import { registerSessionTools } from "./tools/session.js";
import { ENV, DEFAULT_MODEL, SUPPORTED_MODELS, type SupportedModel } from "./constants.js";
import type { ServerConfig } from "./types.js";

/**
 * Load and validate configuration from environment variables.
 */
function loadConfig(): ServerConfig {
  const apiKey = process.env[ENV.API_KEY];
  if (!apiKey) {
    console.error(
      `ERROR: ${ENV.API_KEY} environment variable is required.\n` +
      `Get your API key from https://aistudio.google.com/apikey\n` +
      `Set it in your MCP client config under "env".`
    );
    process.exit(1);
  }

  const modelEnv = process.env[ENV.IMAGE_MODEL];
  let model: SupportedModel = DEFAULT_MODEL;
  if (modelEnv) {
    if (!SUPPORTED_MODELS.includes(modelEnv as SupportedModel)) {
      console.error(
        `WARNING: IMAGE_MODEL="${modelEnv}" is not a known model. ` +
        `Supported models: ${SUPPORTED_MODELS.join(", ")}. ` +
        `Proceeding with the provided value anyway.`
      );
      // Allow unknown models for forward compatibility
      model = modelEnv as SupportedModel;
    } else {
      model = modelEnv as SupportedModel;
    }
  }

  const apiBaseUrl = process.env[ENV.API_BASE_URL] || undefined;

  return { apiKey, model, apiBaseUrl };
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Load configuration
  const config = loadConfig();

  // Initialize Gemini client
  initGeminiClient(config);

  // Create MCP server
  const server = new McpServer({
    name: "gemini-image-mcp-server",
    version: "1.0.0",
  });

  // Register all tools
  registerGenerateImageTool(server);
  registerEditImageTool(server);
  registerSessionTools(server);

  // Create stdio transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Gemini Image MCP Server running (model: ${config.model})`);
}

// Run the server
main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
