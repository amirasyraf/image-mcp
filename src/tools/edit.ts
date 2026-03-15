/**
 * Image editing tool - gemini_edit_image.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EditImageSchema, type EditImageInput } from "../schemas/index.js";
import { editImage } from "../services/gemini.js";
import { logger, fmtError } from "../logger.js";

export function registerEditImageTool(server: McpServer): void {
  server.registerTool(
    "gemini_edit_image",
    {
      title: "Edit Image with Gemini",
      description: `Edit one or more existing images using text instructions and Google Gemini's image editing model.

This tool modifies existing images based on your text instructions. Supports up to 14 reference images. Ideal for:
- Modifying colors, styles, or themes of existing assets
- Adding or removing elements from images
- Combining multiple reference images into a new composition
- Restyling images (e.g., "make this look like pixel art")
- Adding text overlays, badges, or watermarks
- Adjusting backgrounds, lighting, or visual effects
- Creating variations of existing designs

The model uses "thinking" to reason through complex edit requests for maximum accuracy. Output resolution is 1K.

Args:
  - prompt (string): Text instructions describing the edit to apply
  - image_paths (string[]): Array of paths to source image(s) to edit (1-14 images)
  - output_path (string): File path to save the edited image
  - aspect_ratio (string): Output aspect ratio (default: '1:1')
  - thinking_level (string): Model reasoning depth (default: 'High')

Returns:
  JSON with: output_path (absolute path to saved image), text (model commentary), mimeType, fileSizeBytes

Examples:
  - Edit colors: prompt="Change the primary color from blue to purple" with image_paths=["./src/assets/logo.png"]
  - Add shadow: prompt="Add a subtle drop shadow behind this icon" with image_paths=["./public/icon.png"]
  - Combine: prompt="Create a group photo composition with these portraits" with image_paths=["./img1.png", "./img2.png"]
  - Restyle: prompt="Convert this screenshot into a clean, minimal wireframe" with image_paths=["./screenshot.png"]

Error Handling:
  - If an image file is not found, the error includes the resolved absolute path
  - Unsupported image formats return a list of supported formats
  - If the model refuses, try rephrasing or simplifying the edit request`,
      inputSchema: EditImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: EditImageInput) => {
      logger.info("tool: gemini_edit_image", {
        imageCount: params.image_paths.length,
        imagePaths: params.image_paths,
        outputPath: params.output_path,
        aspectRatio: params.aspect_ratio,
        thinkingLevel: params.thinking_level,
        promptLen: params.prompt.length,
      });
      try {
        const result = await editImage({
          prompt: params.prompt,
          imagePaths: params.image_paths,
          outputPath: params.output_path,
          aspectRatio: params.aspect_ratio,
          thinkingLevel: params.thinking_level,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          source_images: params.image_paths.length,
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
        logger.error("tool: gemini_edit_image failed", fmtError(error));
        return {
          content: [
            {
              type: "text" as const,
              text: `Error editing image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
