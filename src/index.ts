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
import { registerImageTools } from "./tools/image.js";
import { ENV, DEFAULT_MODEL, SUPPORTED_MODELS, type SupportedModel } from "./constants.js";
import type { ServerConfig } from "./types.js";
import { logger, fmtError } from "./logger.js";

/**
 * Load and validate configuration from environment variables.
 */
function loadConfig(): ServerConfig {
  const apiKey = process.env[ENV.API_KEY];
  if (!apiKey) {
    logger.error(
      `${ENV.API_KEY} environment variable is required. ` +
      `Get your API key from https://aistudio.google.com/apikey and set it in your MCP client config.`
    );
    process.exit(1);
  }

  const modelEnv = process.env[ENV.IMAGE_MODEL];
  let model: SupportedModel = DEFAULT_MODEL;
  if (modelEnv) {
    if (!SUPPORTED_MODELS.includes(modelEnv as SupportedModel)) {
      logger.warn("Unknown IMAGE_MODEL — proceeding anyway (forward compatibility)", {
        model: modelEnv,
        knownModels: SUPPORTED_MODELS,
      });
      model = modelEnv as SupportedModel;
    } else {
      model = modelEnv as SupportedModel;
    }
  }

  const apiBaseUrl = process.env[ENV.API_BASE_URL] || undefined;

  logger.info("Config loaded", {
    model,
    apiBaseUrl: apiBaseUrl ?? null,
    apiKeyPrefix: apiKey.slice(0, 6) + "…",
  });

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
    name: "image-mcp",
    version: "1.0.0",
  });

  // Register all tools
  registerGenerateImageTool(server);
  registerEditImageTool(server);
  registerSessionTools(server);
  registerImageTools(server);

  logger.info("Tools registered", {
    tools: [
      "gemini_generate_image",
      "gemini_edit_image",
      "gemini_start_edit_session",
      "gemini_send_edit_message",
      "gemini_list_sessions",
      "gemini_end_session",
      "image_resize",
      "image_rotate",
      "image_compress",
      "image_convert",
    ],
  });

  // Create stdio transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info(`Gemini Image MCP Server running`, { model: config.model, transport: "stdio" });
}

// Run the server
main().catch((error: unknown) => {
  logger.error("Fatal server error — shutting down", fmtError(error));
  process.exit(1);
});
