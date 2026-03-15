/**
 * TypeScript type definitions for Gemini Image MCP Server.
 */

import type { ThinkingLevel, AspectRatio, SupportedModel } from "./constants.js";

/** Configuration loaded from environment variables */
export interface ServerConfig {
  apiKey: string;
  model: SupportedModel;
  apiBaseUrl?: string;
}

/** Result from an image generation or editing operation */
export interface ImageResult {
  /** File path where the image was saved */
  outputPath: string;
  /** Text description or commentary from the model */
  text?: string;
  /** MIME type of the saved image */
  mimeType: string;
  /** File size in bytes */
  fileSizeBytes: number;
}

/** An active multi-turn editing session */
export interface EditSession {
  /** Unique session identifier */
  id: string;
  /** Timestamp when session was created */
  createdAt: Date;
  /** Number of messages exchanged */
  messageCount: number;
  /** Description of the session */
  description: string;
  /** The underlying chat instance (opaque, stored internally) */
  chat: unknown;
  /** Path to the last generated image */
  lastImagePath?: string;
}

/** Metadata about a session (returned to the agent, no chat object) */
export interface SessionInfo {
  id: string;
  createdAt: string;
  messageCount: number;
  description: string;
  lastImagePath?: string;
}

/** A part of the Gemini API response */
export interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

/** Result from a local image manipulation operation */
export interface LocalImageResult {
  /** File path where the image was saved */
  outputPath: string;
  /** MIME type of the saved image */
  mimeType: string;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}
