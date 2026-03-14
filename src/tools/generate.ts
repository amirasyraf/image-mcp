/**
 * Image generation tool - gemini_generate_image.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GenerateImageSchema, type GenerateImageInput } from "../schemas/index.js";
import { generateImage } from "../services/gemini.js";

export function registerGenerateImageTool(server: McpServer): void {
  server.registerTool(
    "gemini_generate_image",
    {
      title: "Generate Image with Gemini",
      description: `Generate an image from a text description using Google Gemini's image generation model.

This tool creates new images from scratch based on your text prompt. Ideal for frontend development workflows:
- Icons and UI elements (app icons, button graphics, avatars)
- Hero images and banners for landing pages
- Placeholder images for mockups and prototypes
- Diagrams and infographics
- Marketing and social media assets
- Illustrations and decorative graphics

The model uses "thinking" to reason through complex prompts for maximum accuracy. Output resolution is 1K.

Args:
  - prompt (string): Detailed text description of the image to generate
  - output_path (string): File path to save the image (e.g., './public/icons/settings.png')
  - aspect_ratio (string): Image aspect ratio (default: '1:1'). Options: 1:1, 16:9, 9:16, 4:3, 3:4, 5:4, 4:5
  - thinking_level (string): Model reasoning depth (default: 'High'). Options: None, Low, Medium, High

Returns:
  JSON with: output_path (absolute path to saved image), text (model commentary), mimeType, fileSizeBytes

Examples:
  - Generate icon: prompt="A minimal flat-design gear icon, white on transparent background, 64px style" with aspect_ratio="1:1"
  - Generate hero: prompt="Modern SaaS dashboard hero image with gradient background and floating UI cards" with aspect_ratio="16:9"
  - Generate placeholder: prompt="Neutral gray placeholder image with centered text 'Image Coming Soon'" with aspect_ratio="4:3"

Error Handling:
  - If the model refuses due to safety filters, try rephrasing the prompt
  - If no image is generated, the model's text response is included in the error for diagnostics`,
      inputSchema: GenerateImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: GenerateImageInput) => {
      try {
        const result = await generateImage({
          prompt: params.prompt,
          outputPath: params.output_path,
          aspectRatio: params.aspect_ratio,
          thinkingLevel: params.thinking_level,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
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
              text: `Error generating image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
