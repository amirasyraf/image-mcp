/**
 * Zod validation schemas for all MCP tools.
 */

import { z } from "zod";
import { ASPECT_RATIOS, THINKING_LEVELS, MAX_REFERENCE_IMAGES, FIT_MODES, GRAVITY_OPTIONS, LOCAL_OUTPUT_FORMATS } from "../constants.js";

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

// --- Local image manipulation schemas ---

const localInputPathField = z
  .string()
  .min(1, "Input path cannot be empty")
  .describe(
    "File path to the source image. Supports PNG, JPG, JPEG, WebP, GIF, TIFF, AVIF. " +
    "Example: './src/assets/photo.png'"
  );

const localOutputPathField = z
  .string()
  .min(1, "Output path cannot be empty")
  .describe(
    "File path where the processed image will be saved. Output format is determined by file extension. " +
    `Supported: ${Object.keys(LOCAL_OUTPUT_FORMATS).join(", ")}. ` +
    "Parent directories will be created automatically. Example: './public/images/photo-resized.png'"
  );

/**
 * Schema for image_resize tool.
 */
export const ResizeImageSchema = z.object({
  input_path: localInputPathField,
  output_path: localOutputPathField,
  width: z
    .number()
    .int()
    .positive("Width must be a positive integer")
    .optional()
    .describe(
      "Target width in pixels. If only width is provided, height is calculated to maintain aspect ratio. " +
      "Example: 800"
    ),
  height: z
    .number()
    .int()
    .positive("Height must be a positive integer")
    .optional()
    .describe(
      "Target height in pixels. If only height is provided, width is calculated to maintain aspect ratio. " +
      "Example: 600"
    ),
  fit: z
    .enum(FIT_MODES)
    .default("cover")
    .describe(
      "How the image should fit the target dimensions when both width and height are provided. " +
      "'cover' (default): Crop to fill the exact dimensions. " +
      "'contain': Fit within dimensions, preserving aspect ratio (may add padding). " +
      "'fill': Stretch to fill exact dimensions (may distort). " +
      "'inside': Resize to fit inside dimensions, never enlarging. " +
      "'outside': Resize to cover dimensions, never shrinking."
    ),
  position: z
    .enum(GRAVITY_OPTIONS)
    .default("center")
    .describe(
      "Crop position when using 'cover' fit. Controls which part of the image is kept. " +
      "'center' (default), 'north', 'south', 'east', 'west', and corner variants. " +
      "'entropy': Focus on the region with highest Shannon entropy. " +
      "'attention': Focus on the region with the most interesting features."
    ),
  background: z
    .string()
    .default("#000000")
    .describe(
      "Background color for 'contain' fit padding. Hex color string. Default: '#000000' (black). " +
      "Example: '#ffffff' for white, '#00000000' for transparent (PNG/WebP only)."
    ),
}).strict().refine(
  (data) => data.width !== undefined || data.height !== undefined,
  { message: "At least one of 'width' or 'height' must be provided" }
);

export type ResizeImageInput = z.infer<typeof ResizeImageSchema>;

/**
 * Schema for image_rotate tool.
 */
export const RotateImageSchema = z.object({
  input_path: localInputPathField,
  output_path: localOutputPathField,
  angle: z
    .number()
    .default(0)
    .describe(
      "Rotation angle in degrees (clockwise). Can be any value — common values: 90, 180, 270. " +
      "Non-right-angle rotations will enlarge the canvas to contain the rotated image. Default: 0"
    ),
  flip: z
    .boolean()
    .default(false)
    .describe("Flip the image vertically (mirror over x-axis). Default: false"),
  flop: z
    .boolean()
    .default(false)
    .describe("Flop the image horizontally (mirror over y-axis). Default: false"),
  background: z
    .string()
    .default("#000000")
    .describe(
      "Background color for areas exposed by non-right-angle rotation. Hex color string. " +
      "Default: '#000000'. Use '#00000000' for transparent (PNG/WebP only)."
    ),
}).strict().refine(
  (data) => data.angle !== 0 || data.flip || data.flop,
  { message: "At least one of 'angle' (non-zero), 'flip', or 'flop' must be specified" }
);

export type RotateImageInput = z.infer<typeof RotateImageSchema>;

/**
 * Schema for image_compress tool.
 */
export const CompressImageSchema = z.object({
  input_path: localInputPathField,
  output_path: localOutputPathField,
  quality: z
    .number()
    .int()
    .min(1, "Quality must be between 1 and 100")
    .max(100, "Quality must be between 1 and 100")
    .default(80)
    .describe(
      "Output quality from 1 (smallest file, lowest quality) to 100 (largest file, highest quality). " +
      "Default: 80. For JPEG, 60-80 is usually a good balance. For WebP, 75-85 works well. " +
      "For PNG, this controls zlib compression level (lower = smaller file, no quality loss)."
    ),
  progressive: z
    .boolean()
    .default(false)
    .describe(
      "Enable progressive/interlaced output. For JPEG: progressive scan. For PNG: interlaced. " +
      "Progressive images render gradually (good for web). Default: false"
    ),
  mozjpeg: z
    .boolean()
    .default(false)
    .describe(
      "Use mozjpeg for JPEG output for potentially smaller files at the same quality. " +
      "Slightly slower encoding. Only applies when output is JPEG. Default: false"
    ),
}).strict();

export type CompressImageInput = z.infer<typeof CompressImageSchema>;

/**
 * Schema for image_convert tool.
 */
export const ConvertImageSchema = z.object({
  input_path: localInputPathField,
  output_path: localOutputPathField,
  quality: z
    .number()
    .int()
    .min(1, "Quality must be between 1 and 100")
    .max(100, "Quality must be between 1 and 100")
    .default(90)
    .describe(
      "Output quality for lossy formats (JPEG, WebP, AVIF). 1-100. Default: 90. " +
      "Ignored for lossless formats (PNG, GIF, TIFF)."
    ),
}).strict();

export type ConvertImageInput = z.infer<typeof ConvertImageSchema>;
