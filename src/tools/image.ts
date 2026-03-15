/**
 * Local image manipulation tools — resize, rotate, compress, convert.
 *
 * These tools run entirely locally using sharp. No API key or network required.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ResizeImageSchema,
  type ResizeImageInput,
  RotateImageSchema,
  type RotateImageInput,
  CompressImageSchema,
  type CompressImageInput,
  ConvertImageSchema,
  type ConvertImageInput,
} from "../schemas/index.js";
import {
  resizeImage,
  rotateImage,
  compressImage,
  convertImage,
} from "../services/image.js";

export function registerImageTools(server: McpServer): void {

  // --- image_resize ---
  server.registerTool(
    "image_resize",
    {
      title: "Resize / Crop Image",
      description: `Resize and/or crop an image locally using sharp. No API key needed.

Supports multiple fit modes for flexible resizing:
- 'cover': Crop to fill exact dimensions (default)
- 'contain': Fit inside dimensions with padding
- 'fill': Stretch to exact dimensions
- 'inside': Shrink to fit, never enlarge
- 'outside': Enlarge to cover, never shrink

Args:
  - input_path (string, required): Path to the source image
  - output_path (string, required): Where to save the result. Format determined by extension (.png, .jpg, .webp, etc.)
  - width (number, optional): Target width in pixels
  - height (number, optional): Target height in pixels
  - fit (string): Resize strategy. Default: 'cover'
  - position (string): Crop anchor when using 'cover'. Default: 'center'. Options: north, south, east, west, center, entropy, attention
  - background (string): Padding color for 'contain' fit. Hex string. Default: '#000000'

At least one of width or height must be provided. If only one is given, aspect ratio is preserved.

Returns:
  JSON with: output_path, mime_type, file_size_bytes, width, height

Examples:
  - Resize to 800px wide: width=800 (height auto-calculated)
  - Crop to 200x200 thumbnail: width=200, height=200, fit="cover", position="attention"
  - Fit in 1920x1080 with white padding: width=1920, height=1080, fit="contain", background="#ffffff"

Error Handling:
  - Returns error if input file not found
  - Returns error if output format unsupported`,
      inputSchema: ResizeImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ResizeImageInput) => {
      try {
        const result = await resizeImage({
          inputPath: params.input_path,
          outputPath: params.output_path,
          width: params.width,
          height: params.height,
          fit: params.fit,
          position: params.position,
          background: params.background,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          width: result.width,
          height: result.height,
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
              text: `Error resizing image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- image_rotate ---
  server.registerTool(
    "image_rotate",
    {
      title: "Rotate / Flip Image",
      description: `Rotate an image by any angle and/or flip/mirror it. Runs locally with sharp — no API key needed.

Args:
  - input_path (string, required): Path to the source image
  - output_path (string, required): Where to save the result
  - angle (number): Clockwise rotation in degrees. Default: 0. Common: 90, 180, 270
  - flip (boolean): Flip vertically (mirror over x-axis). Default: false
  - flop (boolean): Flop horizontally (mirror over y-axis). Default: false
  - background (string): Fill color for areas exposed by non-90° rotation. Hex string. Default: '#000000'

At least one of angle (non-zero), flip, or flop must be specified.

Returns:
  JSON with: output_path, mime_type, file_size_bytes, width, height

Examples:
  - Rotate 90° clockwise: angle=90
  - Mirror horizontally: flop=true
  - Rotate 45° with transparent bg: angle=45, background="#00000000"
  - Flip + rotate: angle=180, flip=true

Error Handling:
  - Returns error if input file not found
  - Returns error if no transformation specified`,
      inputSchema: RotateImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: RotateImageInput) => {
      try {
        const result = await rotateImage({
          inputPath: params.input_path,
          outputPath: params.output_path,
          angle: params.angle,
          flip: params.flip,
          flop: params.flop,
          background: params.background,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          width: result.width,
          height: result.height,
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
              text: `Error rotating image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- image_compress ---
  server.registerTool(
    "image_compress",
    {
      title: "Compress / Optimize Image",
      description: `Compress an image to reduce file size with fine-grained quality control. Runs locally with sharp — no API key needed.

Useful for optimizing images for web delivery, reducing asset bundle size, or preparing images for production.

Args:
  - input_path (string, required): Path to the source image
  - output_path (string, required): Where to save the result. Format determined by extension
  - quality (number): Output quality 1-100. Default: 80. Lower = smaller file. JPEG/WebP: affects visual quality. PNG: affects compression level (lossless)
  - progressive (boolean): Progressive/interlaced output. Default: false. Good for web images
  - mozjpeg (boolean): Use mozjpeg encoder for JPEG (smaller files, slower). Default: false

Returns:
  JSON with: output_path, mime_type, file_size_bytes, width, height, original_file_size_bytes, savings_percent

Examples:
  - Web-optimize JPEG: quality=75, progressive=true, mozjpeg=true
  - Aggressive WebP: quality=60
  - Optimize PNG: quality=70 (adjusts compression level, still lossless)

Error Handling:
  - Returns error if input file not found
  - Returns error if output format unsupported`,
      inputSchema: CompressImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: CompressImageInput) => {
      try {
        const result = await compressImage({
          inputPath: params.input_path,
          outputPath: params.output_path,
          quality: params.quality,
          progressive: params.progressive,
          mozjpeg: params.mozjpeg,
        });

        const savingsPercent =
          result.originalFileSizeBytes > 0
            ? Math.round(
                ((result.originalFileSizeBytes - result.fileSizeBytes) /
                  result.originalFileSizeBytes) *
                  100
              )
            : 0;

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          width: result.width,
          height: result.height,
          original_file_size_bytes: result.originalFileSizeBytes,
          savings_percent: savingsPercent,
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
              text: `Error compressing image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // --- image_convert ---
  server.registerTool(
    "image_convert",
    {
      title: "Convert Image Format",
      description: `Convert an image from one format to another. Runs locally with sharp — no API key needed.

The output format is determined by the file extension of output_path.

Supported formats: PNG, JPEG, WebP, GIF, TIFF, AVIF

Args:
  - input_path (string, required): Path to the source image
  - output_path (string, required): Where to save the result. Extension determines format (.png, .jpg, .webp, .gif, .tiff, .avif)
  - quality (number): Quality for lossy formats (JPEG, WebP, AVIF). 1-100. Default: 90. Ignored for lossless formats

Returns:
  JSON with: output_path, mime_type, file_size_bytes, width, height, original_format

Examples:
  - PNG to JPEG: input_path="./logo.png", output_path="./logo.jpg"
  - JPEG to WebP: input_path="./photo.jpg", output_path="./photo.webp", quality=85
  - PNG to AVIF: input_path="./hero.png", output_path="./hero.avif", quality=80

Error Handling:
  - Returns error if input file not found
  - Returns error if output format unsupported`,
      inputSchema: ConvertImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: ConvertImageInput) => {
      try {
        const result = await convertImage({
          inputPath: params.input_path,
          outputPath: params.output_path,
          quality: params.quality,
        });

        const response = {
          status: "success",
          output_path: result.outputPath,
          mime_type: result.mimeType,
          file_size_bytes: result.fileSizeBytes,
          width: result.width,
          height: result.height,
          original_format: result.originalFormat,
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
              text: `Error converting image: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
