/**
 * Gemini API service wrapper.
 * Handles all interactions with the Google Gemini API for image generation and editing.
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ServerConfig, ImageResult, EditSession, GeminiResponsePart } from "../types.js";
import {
  IMAGE_SIZE,
  SUPPORTED_IMAGE_TYPES,
  type AspectRatio,
  type ThinkingLevel,
} from "../constants.js";

// In-memory session store for multi-turn editing
const sessions = new Map<string, EditSession>();

let genAI: GoogleGenAI;
let currentConfig: ServerConfig;

/**
 * Initialize the Gemini API client.
 */
export function initGeminiClient(config: ServerConfig): void {
  const options: Record<string, string> = { apiKey: config.apiKey };
  if (config.apiBaseUrl) {
    options.baseUrl = config.apiBaseUrl;
  }
  genAI = new GoogleGenAI(options);
  currentConfig = config;
}

/**
 * Read an image file and return its base64 data and MIME type.
 */
function readImageFile(imagePath: string): { data: string; mimeType: string } {
  const absolutePath = path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = SUPPORTED_IMAGE_TYPES[ext];
  if (!mimeType) {
    throw new Error(
      `Unsupported image format '${ext}'. Supported formats: ${Object.keys(SUPPORTED_IMAGE_TYPES).join(", ")}`
    );
  }

  const imageData = fs.readFileSync(absolutePath);
  return {
    data: imageData.toString("base64"),
    mimeType,
  };
}

/**
 * Save base64 image data to a file, creating directories if needed.
 */
function saveImage(base64Data: string, outputPath: string, mimeType: string): { fileSizeBytes: number } {
  const absolutePath = path.resolve(outputPath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(absolutePath, buffer);

  return { fileSizeBytes: buffer.length };
}

/**
 * Determine output MIME type from file extension.
 */
function getOutputMimeType(outputPath: string): string {
  const ext = path.extname(outputPath).toLowerCase();
  return SUPPORTED_IMAGE_TYPES[ext] ?? "image/png";
}

/**
 * Extract image result from Gemini API response parts.
 */
function extractImageFromParts(
  parts: GeminiResponsePart[],
  outputPath: string
): ImageResult | null {
  let text = "";
  let imageData: { data: string; mimeType: string } | null = null;

  for (const part of parts) {
    if (part.thought) continue;
    if (part.text) {
      text += part.text;
    } else if (part.inlineData) {
      imageData = {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  if (!imageData) {
    return null;
  }

  const { fileSizeBytes } = saveImage(imageData.data, outputPath, imageData.mimeType);

  return {
    outputPath: path.resolve(outputPath),
    text: text || undefined,
    mimeType: imageData.mimeType,
    fileSizeBytes,
  };
}

/**
 * Build generation config for image requests.
 */
function buildConfig(options: {
  aspectRatio?: AspectRatio;
  thinkingLevel?: ThinkingLevel;
  includeText?: boolean;
}): Record<string, unknown> {
  const config: Record<string, unknown> = {
    responseModalities: options.includeText !== false ? ["TEXT", "IMAGE"] : ["IMAGE"],
    imageConfig: {
      aspectRatio: options.aspectRatio ?? "1:1",
      imageSize: IMAGE_SIZE,
    },
  };

  if (options.thinkingLevel && options.thinkingLevel !== "None") {
    config.thinkingConfig = {
      thinkingLevel: options.thinkingLevel,
      includeThoughts: false,
    };
  }

  return config;
}

/**
 * Generate an image from a text prompt.
 */
export async function generateImage(params: {
  prompt: string;
  outputPath: string;
  aspectRatio?: AspectRatio;
  thinkingLevel?: ThinkingLevel;
}): Promise<ImageResult> {
  const config = buildConfig({
    aspectRatio: params.aspectRatio,
    thinkingLevel: params.thinkingLevel,
  });

  const response = await genAI.models.generateContent({
    model: currentConfig.model,
    contents: params.prompt,
    config,
  });

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    throw new Error("No response received from Gemini API. The model may have refused the request due to safety filters.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    // Collect any text for diagnostics
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    throw new Error(
      `No image was generated. The model returned text only${textParts ? `: "${textParts.slice(0, 500)}"` : ". Try rephrasing your prompt or check safety filter restrictions."}`
    );
  }

  return result;
}

/**
 * Edit one or more images using a text prompt.
 */
export async function editImage(params: {
  prompt: string;
  imagePaths: string[];
  outputPath: string;
  aspectRatio?: AspectRatio;
  thinkingLevel?: ThinkingLevel;
}): Promise<ImageResult> {
  // Build content parts: text + images
  const contentParts: Array<Record<string, unknown>> = [
    { text: params.prompt },
  ];

  for (const imgPath of params.imagePaths) {
    const { data, mimeType } = readImageFile(imgPath);
    contentParts.push({
      inlineData: { mimeType, data },
    });
  }

  const config = buildConfig({
    aspectRatio: params.aspectRatio,
    thinkingLevel: params.thinkingLevel,
  });

  const response = await genAI.models.generateContent({
    model: currentConfig.model,
    contents: contentParts,
    config,
  });

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    throw new Error("No response received from Gemini API. The model may have refused the request due to safety filters.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    throw new Error(
      `No edited image was generated. The model returned text only${textParts ? `: "${textParts.slice(0, 500)}"` : ". Try rephrasing your prompt."}`
    );
  }

  return result;
}

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Start a new multi-turn editing session.
 */
export async function startEditSession(params: {
  description?: string;
  initialImagePath?: string;
  thinkingLevel?: ThinkingLevel;
}): Promise<{ sessionId: string; description: string }> {
  const sessionId = generateSessionId();

  const config: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      imageSize: IMAGE_SIZE,
    },
  };

  if (params.thinkingLevel && params.thinkingLevel !== "None") {
    config.thinkingConfig = {
      thinkingLevel: params.thinkingLevel,
      includeThoughts: false,
    };
  }

  const chat = genAI.chats.create({
    model: currentConfig.model,
    config,
  });

  const description = params.description ?? "Image editing session";

  const session: EditSession = {
    id: sessionId,
    createdAt: new Date(),
    messageCount: 0,
    description,
    chat,
    lastImagePath: params.initialImagePath,
  };

  sessions.set(sessionId, session);

  return { sessionId, description };
}

/**
 * Send a message to an existing editing session.
 */
export async function sendEditMessage(params: {
  sessionId: string;
  prompt: string;
  imagePath?: string;
  outputPath: string;
}): Promise<ImageResult & { messageCount: number }> {
  const session = sessions.get(params.sessionId);
  if (!session) {
    throw new Error(
      `Session '${params.sessionId}' not found. Use gemini_list_sessions to see active sessions, or gemini_start_edit_session to create a new one.`
    );
  }

  // Build message content
  let message: string | Array<Record<string, unknown>>;
  if (params.imagePath) {
    const { data, mimeType } = readImageFile(params.imagePath);
    message = [
      { text: params.prompt },
      { inlineData: { mimeType, data } },
    ];
  } else {
    message = params.prompt;
  }

  // The chat object is the return value of genAI.chats.create()
  const chat = session.chat as Awaited<ReturnType<typeof genAI.chats.create>>;
  const response = await chat.sendMessage({ message });

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    throw new Error("No response received from Gemini API in session. The model may have refused the request.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    throw new Error(
      `No image was generated in session. Model response${textParts ? `: "${textParts.slice(0, 500)}"` : " was empty. Try a different prompt."}`
    );
  }

  session.messageCount++;
  session.lastImagePath = result.outputPath;

  return { ...result, messageCount: session.messageCount };
}

/**
 * List all active editing sessions.
 */
export function listSessions(): Array<{
  id: string;
  createdAt: string;
  messageCount: number;
  description: string;
  lastImagePath?: string;
}> {
  const result: Array<{
    id: string;
    createdAt: string;
    messageCount: number;
    description: string;
    lastImagePath?: string;
  }> = [];

  for (const session of sessions.values()) {
    result.push({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      messageCount: session.messageCount,
      description: session.description,
      lastImagePath: session.lastImagePath,
    });
  }

  return result;
}

/**
 * End an editing session and clean up resources.
 */
export function endSession(sessionId: string): boolean {
  const existed = sessions.has(sessionId);
  sessions.delete(sessionId);
  return existed;
}
