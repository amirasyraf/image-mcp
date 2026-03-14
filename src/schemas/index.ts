/**
 * Zod validation schemas for all MCP tools.
 */

import { z } from "zod";
import { ASPECT_RATIOS, THINKING_LEVELS, MAX_REFERENCE_IMAGES } from "../constants.js";

/**
 * Schema for gemini_generate_image tool.
 */
export const GenerateImageSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe(
      "Text description of the image to generate. Be specific about style, composition, colors, and content. " +
      "Examples: 'A flat-design settings gear icon with a blue gradient, 64x64px style', " +
      "'A hero image for a SaaS landing page showing a modern dashboard with data visualizations'"
    ),
  output_path: z
    .string()
    .min(1, "Output path cannot be empty")
    .describe(
      "File path where the generated image will be saved. Include file extension (.png, .jpg, .jpeg, .webp). " +
      "Parent directories will be created automatically. Example: './public/images/hero.png'"
    ),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("1:1")
    .describe(
      "Aspect ratio of the generated image. Options: 1:1 (square, icons), 16:9 (widescreen, hero images), " +
      "9:16 (portrait, mobile), 4:3 (standard), 3:4 (portrait), 5:4 (landscape), 4:5 (portrait). Default: 1:1"
    ),
  thinking_level: z
    .enum(THINKING_LEVELS)
    .default("High")
    .describe(
      "Thinking level for the model to reason through the prompt before generating. " +
      "'High' (default) produces the most accurate results. 'None' disables thinking for faster generation."
    ),
}).strict();

export type GenerateImageInput = z.infer<typeof GenerateImageSchema>;

/**
 * Schema for gemini_edit_image tool.
 */
export const EditImageSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe(
      "Text instructions describing how to edit the image(s). Be specific about what to change. " +
      "Examples: 'Add a drop shadow behind the logo', 'Change the background color to #1a1a2e', " +
      "'Remove the text and replace with a gradient overlay'"
    ),
  image_paths: z
    .array(z.string().min(1))
    .min(1, "At least one image path is required")
    .max(MAX_REFERENCE_IMAGES, `Maximum ${MAX_REFERENCE_IMAGES} reference images allowed`)
    .describe(
      "Array of file paths to the source image(s) to edit. Supports PNG, JPG, JPEG, WebP, GIF. " +
      "You can provide up to 14 reference images. Example: ['./src/assets/logo.png']"
    ),
  output_path: z
    .string()
    .min(1, "Output path cannot be empty")
    .describe(
      "File path where the edited image will be saved. Include file extension (.png, .jpg, .jpeg, .webp). " +
      "Parent directories will be created automatically. Example: './public/images/logo-edited.png'"
    ),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("1:1")
    .describe(
      "Aspect ratio of the output image. Default: 1:1. Use 16:9 for banners, 9:16 for mobile assets."
    ),
  thinking_level: z
    .enum(THINKING_LEVELS)
    .default("High")
    .describe(
      "Thinking level for accuracy. 'High' (default) for best results with complex edits."
    ),
}).strict();

export type EditImageInput = z.infer<typeof EditImageSchema>;

/**
 * Schema for gemini_start_edit_session tool.
 */
export const StartEditSessionSchema = z.object({
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .default("Image editing session")
    .describe(
      "A short description of what this editing session is for. Helps track multiple sessions. " +
      "Example: 'Iterating on the homepage hero banner design'"
    ),
  initial_image_path: z
    .string()
    .optional()
    .describe(
      "Optional path to an initial image to start editing from. If not provided, the first message " +
      "should include a generation prompt or an image attachment."
    ),
  thinking_level: z
    .enum(THINKING_LEVELS)
    .default("High")
    .describe(
      "Thinking level for the session. Applies to all messages in this session."
    ),
}).strict();

export type StartEditSessionInput = z.infer<typeof StartEditSessionSchema>;

/**
 * Schema for gemini_send_edit_message tool.
 */
export const SendEditMessageSchema = z.object({
  session_id: z
    .string()
    .min(1, "Session ID cannot be empty")
    .describe(
      "The session ID returned by gemini_start_edit_session. Use gemini_list_sessions to see active sessions."
    ),
  prompt: z
    .string()
    .min(1, "Prompt cannot be empty")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe(
      "Text instructions for this editing step. The model remembers the full conversation history. " +
      "Examples: 'Make the text larger', 'Change the color scheme to dark mode', 'Add a subtle grid pattern to the background'"
    ),
  image_path: z
    .string()
    .optional()
    .describe(
      "Optional path to a new image to include with this message. Useful when you want to reference " +
      "a different image in the conversation."
    ),
  output_path: z
    .string()
    .min(1, "Output path cannot be empty")
    .describe(
      "File path where the generated image from this step will be saved. Use a different path for each " +
      "step to preserve the editing history. Example: './output/step-2.png'"
    ),
}).strict();

export type SendEditMessageInput = z.infer<typeof SendEditMessageSchema>;

/**
 * Schema for gemini_end_session tool.
 */
export const EndSessionSchema = z.object({
  session_id: z
    .string()
    .min(1, "Session ID cannot be empty")
    .describe(
      "The session ID to end. Use gemini_list_sessions to see active sessions."
    ),
}).strict();

export type EndSessionInput = z.infer<typeof EndSessionSchema>;
