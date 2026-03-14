/**
 * Multi-turn editing session tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StartEditSessionSchema,
  SendEditMessageSchema,
  EndSessionSchema,
  type StartEditSessionInput,
  type SendEditMessageInput,
  type EndSessionInput,
} from "../schemas/index.js";
import {
  startEditSession,
  sendEditMessage,
  listSessions,
  endSession,
} from "../services/gemini.js";

export function registerSessionTools(server: McpServer): void {
  // --- gemini_start_edit_session ---
  server.registerTool(
    "gemini_start_edit_session",
    {
      title: "Start Image Editing Session",
      description: `Start a new multi-turn image editing session for iterative image creation and refinement.

Use this when you need to make multiple sequential edits to an image, where each edit builds on the previous result. The model maintains full conversation history within the session, so you can refer back to previous instructions.

Workflow:
  1. Call gemini_start_edit_session to create a session
  2. Call gemini_send_edit_message repeatedly to iterate on the image
  3. Call gemini_end_session when done

Ideal for:
  - Iteratively designing an icon or logo through multiple refinement steps
  - Building up a complex image piece by piece
  - Trying different variations while maintaining context
  - Progressive refinement of colors, layout, and composition

Args:
  - description (string): What this session is for (helps track multiple sessions)
  - initial_image_path (string, optional): Path to an image to start editing from
  - thinking_level (string): Model reasoning depth for the session (default: 'High')

Returns:
  JSON with: session_id (use this ID for subsequent messages), description

Examples:
  - New design: description="Designing app icon for todo list app"
  - Refine existing: description="Refining hero banner" with initial_image_path="./hero-v1.png"

Notes:
  - Sessions are stored in memory and lost when the MCP server restarts
  - Use gemini_list_sessions to see all active sessions
  - Use gemini_end_session to clean up when done`,
      inputSchema: StartEditSessionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: StartEditSessionInput) => {
      try {
        const result = await startEditSession({
          description: params.description,
          initialImagePath: params.initial_image_path,
          thinkingLevel: params.thinking_level,
        });

        const response = {
          status: "success",
          session_id: result.sessionId,
          description: result.description,
          message: `Session created. Use gemini_send_edit_message with session_id="${result.sessionId}" to start editing.`,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error starting session: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- gemini_send_edit_message ---
  server.registerTool(
    "gemini_send_edit_message",
    {
      title: "Send Message to Editing Session",
      description: `Send a message to an active multi-turn image editing session. The model remembers all previous messages in the session, so you can refer to earlier instructions and build iteratively.

Each call generates a new image based on the cumulative conversation history. Save each step to a different output_path to preserve editing history.

Args:
  - session_id (string): The session ID from gemini_start_edit_session
  - prompt (string): Text instructions for this editing step
  - image_path (string, optional): Path to a new reference image for this step
  - output_path (string): Where to save the generated image from this step

Returns:
  JSON with: output_path, mimeType, fileSizeBytes, messageCount, model_commentary

Examples:
  - First step: prompt="Create a minimalist logo for 'Acme Corp' using blue and white" with output_path="./output/logo-v1.png"
  - Refine: prompt="Make the font bolder and add a subtle shadow" with output_path="./output/logo-v2.png"
  - Iterate: prompt="Now try it with a dark background variant" with output_path="./output/logo-v3-dark.png"

Error Handling:
  - If session_id is invalid, error suggests using gemini_list_sessions
  - If no image is generated, the model's text response is included for diagnostics`,
      inputSchema: SendEditMessageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: SendEditMessageInput) => {
      try {
        const result = await sendEditMessage({
          sessionId: params.session_id,
          prompt: params.prompt,
          imagePath: params.image_path,
          outputPath: params.output_path,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          message_count: result.messageCount,
          ...(result.text ? { model_commentary: result.text } : {}),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error in editing session: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- gemini_list_sessions ---
  server.registerTool(
    "gemini_list_sessions",
    {
      title: "List Image Editing Sessions",
      description: `List all active multi-turn image editing sessions.

Returns information about each session including its ID, description, message count, and the path to the last generated image. Use this to find session IDs for gemini_send_edit_message or gemini_end_session.

Returns:
  JSON with: sessions array (id, createdAt, messageCount, description, lastImagePath), total_sessions count

Notes:
  - Sessions are stored in memory and do not persist across server restarts
  - End sessions you no longer need with gemini_end_session to free memory`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const sessions = listSessions();

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No active editing sessions. Use gemini_start_edit_session to create one.",
            },
          ],
        };
      }

      const response = {
        total_sessions: sessions.length,
        sessions: sessions.map((s) => ({
          session_id: s.id,
          description: s.description,
          created_at: s.createdAt,
          message_count: s.messageCount,
          last_image_path: s.lastImagePath ?? null,
        })),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // --- gemini_end_session ---
  server.registerTool(
    "gemini_end_session",
    {
      title: "End Image Editing Session",
      description: `End an active multi-turn image editing session and free its resources.

Call this when you are done iterating on an image. Previously generated images remain on disk; only the in-memory conversation history is cleared.

Args:
  - session_id (string): The session ID to end

Returns:
  Confirmation message

Notes:
  - Generated image files are NOT deleted - they remain at their output paths
  - The session cannot be resumed after ending
  - If you need to continue editing, start a new session with the last generated image`,
      inputSchema: EndSessionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: EndSessionInput) => {
      const existed = endSession(params.session_id);

      if (!existed) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Session '${params.session_id}' not found. It may have already been ended. Use gemini_list_sessions to see active sessions.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Session '${params.session_id}' ended successfully. Generated images remain on disk.`,
          },
        ],
      };
    }
  );
}
