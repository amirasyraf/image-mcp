/**
 * Local image processing service using sharp.
 *
 * Handles resize, rotate, flip, compress, and format conversion
 * operations entirely on the local machine — no API calls needed.
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { LOCAL_OUTPUT_FORMATS } from "../constants.js";
import type { LocalImageResult } from "../types.js";

/**
 * Parse a hex color string into an RGBA object for sharp.
 */
function parseHexColor(hex: string): { r: number; g: number; b: number; alpha: number } {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      alpha: 1,
    };
  }
  if (clean.length === 8) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      alpha: parseInt(clean.slice(6, 8), 16) / 255,
    };
  }
  throw new Error(`Invalid hex color: "${hex}". Use format '#RRGGBB' or '#RRGGBBAA'.`);
}

/**
 * Validate the input file exists and resolve the absolute path.
 */
function validateInputPath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input image not found: ${resolved}`);
  }
  return resolved;
}

/**
 * Validate the output path has a supported extension and ensure parent dirs exist.
 */
function validateOutputPath(outputPath: string): string {
  const resolved = path.resolve(outputPath);
  const ext = path.extname(resolved).toLowerCase();
  if (!LOCAL_OUTPUT_FORMATS[ext]) {
    throw new Error(
      `Unsupported output format: "${ext}". Supported: ${Object.keys(LOCAL_OUTPUT_FORMATS).join(", ")}`
    );
  }
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
}

/**
 * Get the MIME type from a file extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LOCAL_OUTPUT_FORMATS[ext] || "application/octet-stream";
}

/**
 * Build a LocalImageResult from the output file.
 */
async function buildResult(outputPath: string): Promise<LocalImageResult> {
  const metadata = await sharp(outputPath).metadata();
  const stats = fs.statSync(outputPath);
  return {
    outputPath,
    mimeType: getMimeType(outputPath),
    fileSizeBytes: stats.size,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Resize and/or crop an image.
 */
export async function resizeImage(params: {
  inputPath: string;
  outputPath: string;
  width?: number;
  height?: number;
  fit: string;
  position: string;
  background: string;
}): Promise<LocalImageResult> {
  const input = validateInputPath(params.inputPath);
  const output = validateOutputPath(params.outputPath);

  const bg = parseHexColor(params.background);

  await sharp(input)
    .resize({
      width: params.width,
      height: params.height,
      fit: params.fit as keyof sharp.FitEnum,
      position: params.position,
      background: bg,
    })
    .toFile(output);

  return buildResult(output);
}

/**
 * Rotate and/or flip an image.
 */
export async function rotateImage(params: {
  inputPath: string;
  outputPath: string;
  angle: number;
  flip: boolean;
  flop: boolean;
  background: string;
}): Promise<LocalImageResult> {
  const input = validateInputPath(params.inputPath);
  const output = validateOutputPath(params.outputPath);

  const bg = parseHexColor(params.background);

  let pipeline = sharp(input);

  if (params.angle !== 0) {
    pipeline = pipeline.rotate(params.angle, { background: bg });
  }
  if (params.flip) {
    pipeline = pipeline.flip();
  }
  if (params.flop) {
    pipeline = pipeline.flop();
  }

  await pipeline.toFile(output);

  return buildResult(output);
}

/**
 * Compress an image with quality controls.
 */
export async function compressImage(params: {
  inputPath: string;
  outputPath: string;
  quality: number;
  progressive: boolean;
  mozjpeg: boolean;
}): Promise<LocalImageResult & { originalFileSizeBytes: number }> {
  const input = validateInputPath(params.inputPath);
  const output = validateOutputPath(params.outputPath);

  const originalStats = fs.statSync(input);
  const ext = path.extname(output).toLowerCase();

  let pipeline = sharp(input);

  switch (ext) {
    case ".jpg":
    case ".jpeg":
      pipeline = pipeline.jpeg({
        quality: params.quality,
        progressive: params.progressive,
        mozjpeg: params.mozjpeg,
      });
      break;
    case ".png":
      pipeline = pipeline.png({
        compressionLevel: Math.round(9 - (params.quality / 100) * 9),
        progressive: params.progressive,
      });
      break;
    case ".webp":
      pipeline = pipeline.webp({
        quality: params.quality,
      });
      break;
    case ".avif":
      pipeline = pipeline.avif({
        quality: params.quality,
      });
      break;
    case ".tiff":
    case ".tif":
      pipeline = pipeline.tiff({
        quality: params.quality,
      });
      break;
    case ".gif":
      pipeline = pipeline.gif();
      break;
    default:
      throw new Error(`Cannot set compression options for format: "${ext}"`);
  }

  await pipeline.toFile(output);

  const result = await buildResult(output);
  return { ...result, originalFileSizeBytes: originalStats.size };
}

/**
 * Convert an image to a different format.
 */
export async function convertImage(params: {
  inputPath: string;
  outputPath: string;
  quality: number;
}): Promise<LocalImageResult & { originalFormat: string }> {
  const input = validateInputPath(params.inputPath);
  const output = validateOutputPath(params.outputPath);

  const inputExt = path.extname(input).toLowerCase();
  const outputExt = path.extname(output).toLowerCase();

  let pipeline = sharp(input);

  // Apply format-specific quality settings for lossy formats
  switch (outputExt) {
    case ".jpg":
    case ".jpeg":
      pipeline = pipeline.jpeg({ quality: params.quality });
      break;
    case ".png":
      pipeline = pipeline.png();
      break;
    case ".webp":
      pipeline = pipeline.webp({ quality: params.quality });
      break;
    case ".avif":
      pipeline = pipeline.avif({ quality: params.quality });
      break;
    case ".tiff":
    case ".tif":
      pipeline = pipeline.tiff({ quality: params.quality });
      break;
    case ".gif":
      pipeline = pipeline.gif();
      break;
  }

  await pipeline.toFile(output);

  const result = await buildResult(output);
  return {
    ...result,
    originalFormat: LOCAL_OUTPUT_FORMATS[inputExt] || `unknown (${inputExt})`,
  };
}
