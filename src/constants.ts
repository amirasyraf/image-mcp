/**
 * Configuration constants for Gemini Image MCP Server.
 */

// Supported Gemini image models
export const SUPPORTED_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

// Default model
export const DEFAULT_MODEL: SupportedModel = "gemini-3.1-flash-image-preview";

// Environment variable names
export const ENV = {
  API_KEY: "API_KEY",
  IMAGE_MODEL: "IMAGE_MODEL",
  API_BASE_URL: "API_BASE_URL",
} as const;

// Valid aspect ratios for Gemini image generation
export const ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// Valid thinking levels
export const THINKING_LEVELS = ["None", "Low", "Medium", "High"] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// Image resolution - fixed at 1K as specified
export const IMAGE_SIZE = "1K";

// Maximum character limit for responses
export const CHARACTER_LIMIT = 25000;

// Maximum number of reference images for editing
export const MAX_REFERENCE_IMAGES = 14;

// Supported input image MIME types
export const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// --- Local image manipulation constants ---

// Fit modes for resizing (sharp's fit options)
export const FIT_MODES = [
  "cover",
  "contain",
  "fill",
  "inside",
  "outside",
] as const;

export type FitMode = (typeof FIT_MODES)[number];

// Gravity/position options for cropping during resize
export const GRAVITY_OPTIONS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
  "center",
  "entropy",
  "attention",
] as const;

export type GravityOption = (typeof GRAVITY_OPTIONS)[number];

// Supported output formats for local image processing
export const LOCAL_OUTPUT_FORMATS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".avif": "image/avif",
};
