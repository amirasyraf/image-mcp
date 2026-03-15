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
import { logger, fmtError, trunc } from "../logger.js";

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
  logger.info("Gemini client initialized", {
    model: config.model,
    baseUrl: config.apiBaseUrl ?? null,
  });
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
  logger.info("generateImage: start", {
    model: currentConfig.model,
    promptLen: params.prompt.length,
    promptPreview: trunc(params.prompt, 80),
    outputPath: params.outputPath,
    aspectRatio: params.aspectRatio ?? "1:1",
    thinkingLevel: params.thinkingLevel ?? "High",
  });

  const config = buildConfig({
    aspectRatio: params.aspectRatio,
    thinkingLevel: params.thinkingLevel,
  });

  const t0 = Date.now();
  let response;
  try {
    response = await genAI.models.generateContent({
      model: currentConfig.model,
      contents: params.prompt,
      config,
    });
  } catch (err) {
    logger.error("generateImage: API call failed", { ...fmtError(err), model: currentConfig.model });
    throw err;
  }
  const apiDurationMs = Date.now() - t0;

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    logger.error("generateImage: no candidates in API response", { apiDurationMs });
    throw new Error("No response received from Gemini API. The model may have refused the request due to safety filters.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    logger.warn("generateImage: no image in response (text-only)", {
      apiDurationMs,
      textPreview: trunc(textParts, 200),
    });
    throw new Error(
      `No image was generated. The model returned text only${textParts ? `: "${textParts.slice(0, 500)}"` : ". Try rephrasing your prompt or check safety filter restrictions."}`
    );
  }

  logger.info("generateImage: success", {
    apiDurationMs,
    outputPath: result.outputPath,
    mimeType: result.mimeType,
    fileSizeBytes: result.fileSizeBytes,
    hasModelCommentary: !!result.text,
  });

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
  logger.info("editImage: start", {
    model: currentConfig.model,
    promptLen: params.prompt.length,
    promptPreview: trunc(params.prompt, 80),
    imageCount: params.imagePaths.length,
    imagePaths: params.imagePaths,
    outputPath: params.outputPath,
    aspectRatio: params.aspectRatio ?? "1:1",
    thinkingLevel: params.thinkingLevel ?? "High",
  });

  // Build content parts: text + images
  const contentParts: Array<Record<string, unknown>> = [
    { text: params.prompt },
  ];

  for (const imgPath of params.imagePaths) {
    const { data, mimeType } = readImageFile(imgPath);
    logger.debug("editImage: read source image", { path: imgPath, mimeType, base64Len: data.length });
    contentParts.push({
      inlineData: { mimeType, data },
    });
  }

  const config = buildConfig({
    aspectRatio: params.aspectRatio,
    thinkingLevel: params.thinkingLevel,
  });

  const t0 = Date.now();
  let response;
  try {
    response = await genAI.models.generateContent({
      model: currentConfig.model,
      contents: contentParts,
      config,
    });
  } catch (err) {
    logger.error("editImage: API call failed", { ...fmtError(err), model: currentConfig.model });
    throw err;
  }
  const apiDurationMs = Date.now() - t0;

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    logger.error("editImage: no candidates in API response", { apiDurationMs });
    throw new Error("No response received from Gemini API. The model may have refused the request due to safety filters.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    logger.warn("editImage: no image in response (text-only)", {
      apiDurationMs,
      textPreview: trunc(textParts, 200),
    });
    throw new Error(
      `No edited image was generated. The model returned text only${textParts ? `: "${textParts.slice(0, 500)}"` : ". Try rephrasing your prompt."}`
    );
  }

  logger.info("editImage: success", {
    apiDurationMs,
    outputPath: result.outputPath,
    mimeType: result.mimeType,
    fileSizeBytes: result.fileSizeBytes,
    hasModelCommentary: !!result.text,
  });

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
  const description = params.description ?? "Image editing session";

  logger.info("startEditSession", {
    sessionId,
    description,
    initialImagePath: params.initialImagePath ?? null,
    thinkingLevel: params.thinkingLevel ?? "High",
  });

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
    logger.warn("sendEditMessage: session not found", { sessionId: params.sessionId });
    throw new Error(
      `Session '${params.sessionId}' not found. Use gemini_list_sessions to see active sessions, or gemini_start_edit_session to create a new one.`
    );
  }

  logger.info("sendEditMessage: start", {
    sessionId: params.sessionId,
    messageCount: session.messageCount + 1,
    promptLen: params.prompt.length,
    promptPreview: trunc(params.prompt, 80),
    hasImageAttachment: !!params.imagePath,
    imagePath: params.imagePath ?? null,
    outputPath: params.outputPath,
  });

  // Build message content
  let message: string | Array<Record<string, unknown>>;
  if (params.imagePath) {
    const { data, mimeType } = readImageFile(params.imagePath);
    logger.debug("sendEditMessage: read image attachment", { path: params.imagePath, mimeType });
    message = [
      { text: params.prompt },
      { inlineData: { mimeType, data } },
    ];
  } else {
    message = params.prompt;
  }

  // The chat object is the return value of genAI.chats.create()
  const chat = session.chat as Awaited<ReturnType<typeof genAI.chats.create>>;
  const t0 = Date.now();
  let response;
  try {
    response = await chat.sendMessage({ message });
  } catch (err) {
    logger.error("sendEditMessage: API call failed", { ...fmtError(err), sessionId: params.sessionId });
    throw err;
  }
  const apiDurationMs = Date.now() - t0;

  const parts = response.candidates?.[0]?.content?.parts as GeminiResponsePart[] | undefined;
  if (!parts) {
    logger.error("sendEditMessage: no candidates in API response", { sessionId: params.sessionId, apiDurationMs });
    throw new Error("No response received from Gemini API in session. The model may have refused the request.");
  }

  const result = extractImageFromParts(parts, params.outputPath);
  if (!result) {
    const textParts = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("\n");
    logger.warn("sendEditMessage: no image in response (text-only)", {
      sessionId: params.sessionId,
      apiDurationMs,
      textPreview: trunc(textParts, 200),
    });
    throw new Error(
      `No image was generated in session. Model response${textParts ? `: "${textParts.slice(0, 500)}"` : " was empty. Try a different prompt."}`
    );
  }

  session.messageCount++;
  session.lastImagePath = result.outputPath;

  logger.info("sendEditMessage: success", {
    sessionId: params.sessionId,
    apiDurationMs,
    messageCount: session.messageCount,
    outputPath: result.outputPath,
    mimeType: result.mimeType,
    fileSizeBytes: result.fileSizeBytes,
  });

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
  logger.info("endSession", { sessionId, existed, remainingSessions: sessions.size });
  return existed;
}
