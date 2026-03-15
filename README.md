# Gemini Image MCP Server

An MCP (Model Context Protocol) server that gives AI coding agents the ability to generate and edit images using Google's Gemini API. Built for frontend development workflows.

## What It Does

This MCP server provides **10 tools** that AI agents can use to:

- **Generate images** from text descriptions (icons, hero images, placeholders, diagrams)
- **Edit existing images** with text instructions (recolor, restyle, add/remove elements)
- **Iteratively refine images** through multi-turn editing sessions with conversation memory
- **Manipulate images locally** — resize, crop, rotate, flip, compress, and convert formats

AI-powered tools use Gemini's image generation models at **1K resolution** with optional "thinking" mode.
Local manipulation tools use [sharp](https://sharp.pixelplumbing.com/) for fast, offline processing — no API key needed.

## Supported Models

| Model | Best For |
|-------|----------|
| `gemini-3.1-flash-image-preview` | Fast generation, good quality (default) |
| `gemini-3-pro-image-preview` | Highest quality, complex compositions, advanced text rendering |

## Quick Setup

### 1. Get a Gemini API Key

Get your free API key from [Google AI Studio](https://aistudio.google.com/apikey).

### 2. Install

```bash
git clone git@github.com:amirasyraf/image-mcp.git
cd image-mcp
npm install
npm run build
```

### 3. Configure Your MCP Client

Add to your MCP client configuration (e.g., Claude Desktop, Cursor, VS Code Copilot):

```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "node",
      "args": ["/absolute/path/to/image-mcp/dist/index.js"],
      "env": {
        "API_KEY": "your-gemini-api-key-here",
        "IMAGE_MODEL": "gemini-3.1-flash-image-preview"
      }
    }
  }
}
```

## Configuration

All configuration is done through environment variables set in your MCP client config:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_KEY` | **Yes** | — | Your Google Gemini API key |
| `IMAGE_MODEL` | No | `gemini-3.1-flash-image-preview` | Which Gemini model to use |
| `API_BASE_URL` | No | — | Custom API base URL (for proxies or alternative endpoints) |

## Tools Reference

### `gemini_generate_image`

Generate a new image from a text prompt.

**When to use:** Creating new images from scratch — icons, hero banners, placeholders, illustrations, diagrams.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | — | Text description of the image |
| `output_path` | string | Yes | — | Where to save the image (e.g., `./public/icon.png`) |
| `aspect_ratio` | string | No | `1:1` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `5:4`, `4:5` |
| `thinking_level` | string | No | `High` | `None`, `Low`, `Medium`, `High` |

---

### `gemini_edit_image`

Edit one or more existing images using text instructions.

**When to use:** Modifying existing assets — changing colors, adding effects, combining images, restyling.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | — | Edit instructions |
| `image_paths` | string[] | Yes | — | Paths to source images (1–14) |
| `output_path` | string | Yes | — | Where to save the result |
| `aspect_ratio` | string | No | `1:1` | Output aspect ratio |
| `thinking_level` | string | No | `High` | Model reasoning depth |

---

### `gemini_start_edit_session`

Start a multi-turn editing session for iterative refinement.

**When to use:** When you need multiple rounds of edits, building on each previous result.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `description` | string | No | `Image editing session` | What this session is for |
| `initial_image_path` | string | No | — | Image to start editing from |
| `thinking_level` | string | No | `High` | Reasoning depth for the session |

**Returns:** A `session_id` to use with `gemini_send_edit_message`.

---

### `gemini_send_edit_message`

Send an editing instruction to an active session. The model remembers all previous messages.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `session_id` | string | Yes | — | From `gemini_start_edit_session` |
| `prompt` | string | Yes | — | Edit instructions for this step |
| `image_path` | string | No | — | Optional new reference image |
| `output_path` | string | Yes | — | Where to save this step's output |

---

### `gemini_list_sessions`

List all active editing sessions. No parameters.

---

### `gemini_end_session`

End an editing session and free memory. Generated images remain on disk.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | The session to end |

## Typical Workflows

### Generate an Icon

```
Agent → gemini_generate_image
  prompt: "A flat-design settings gear icon, white on transparent, 64px style"
  output_path: "./public/icons/settings.png"
  aspect_ratio: "1:1"
```

### Edit an Existing Asset

```
Agent → gemini_edit_image
  prompt: "Change the background from white to a dark navy gradient"
  image_paths: ["./src/assets/hero.png"]
  output_path: "./src/assets/hero-dark.png"
  aspect_ratio: "16:9"
```

### Iterative Design (Multi-Turn)

```
Agent → gemini_start_edit_session
  description: "Designing app logo"
  → Returns session_id: "session_abc123"

Agent → gemini_send_edit_message
  session_id: "session_abc123"
  prompt: "Create a modern logo for 'TaskFlow' using blue and white, minimal style"
  output_path: "./output/logo-v1.png"

Agent → gemini_send_edit_message
  session_id: "session_abc123"
  prompt: "Make the font bolder and add a subtle checkmark icon"
  output_path: "./output/logo-v2.png"

Agent → gemini_send_edit_message
  session_id: "session_abc123"
  prompt: "Create a dark mode variant with white text on dark background"
  output_path: "./output/logo-v3-dark.png"

Agent → gemini_end_session
  session_id: "session_abc123"
```

### Optimize Images for Web (Local)

```
Agent → image_resize
  input_path: "./src/assets/hero.png"
  output_path: "./public/hero-1920.webp"
  width: 1920

Agent → image_compress
  input_path: "./public/hero-1920.webp"
  output_path: "./public/hero-1920-opt.webp"
  quality: 75
```

### Create Thumbnails (Local)

```
Agent → image_resize
  input_path: "./uploads/photo.jpg"
  output_path: "./public/thumbs/photo-200.jpg"
  width: 200
  height: 200
  fit: "cover"
  position: "attention"
```

### Convert Format (Local)

```
Agent → image_convert
  input_path: "./src/assets/logo.png"
  output_path: "./dist/logo.webp"
  quality: 90
```

### `image_resize`

Resize and/or crop an image locally. No API key needed.

**When to use:** Resizing assets for different breakpoints, creating thumbnails, cropping to specific dimensions.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Path to the source image |
| `output_path` | string | Yes | — | Where to save the result |
| `width` | number | No* | — | Target width in pixels |
| `height` | number | No* | — | Target height in pixels |
| `fit` | string | No | `cover` | `cover`, `contain`, `fill`, `inside`, `outside` |
| `position` | string | No | `center` | Crop anchor for `cover` fit |
| `background` | string | No | `#000000` | Padding color for `contain` fit |

*At least one of `width` or `height` must be provided.

---

### `image_rotate`

Rotate an image by any angle and/or flip/mirror it. No API key needed.

**When to use:** Fixing orientation, creating mirrored variants, rotating for design layouts.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Path to the source image |
| `output_path` | string | Yes | — | Where to save the result |
| `angle` | number | No | `0` | Clockwise rotation in degrees |
| `flip` | boolean | No | `false` | Flip vertically |
| `flop` | boolean | No | `false` | Flop horizontally (mirror) |
| `background` | string | No | `#000000` | Fill color for rotation padding |

At least one of `angle` (non-zero), `flip`, or `flop` must be specified.

---

### `image_compress`

Compress an image to reduce file size. No API key needed.

**When to use:** Optimizing images for web delivery, reducing bundle size, preparing assets for production.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Path to the source image |
| `output_path` | string | Yes | — | Where to save the result |
| `quality` | number | No | `80` | Quality 1–100 (lower = smaller file) |
| `progressive` | boolean | No | `false` | Progressive/interlaced output |
| `mozjpeg` | boolean | No | `false` | Use mozjpeg for smaller JPEGs |

**Returns** additional fields: `original_file_size_bytes`, `savings_percent`.

---

### `image_convert`

Convert an image between formats. No API key needed.

**When to use:** Converting PNG to WebP for web, JPEG to PNG for transparency, bulk format migration.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input_path` | string | Yes | — | Path to the source image |
| `output_path` | string | Yes | — | Where to save (extension = format) |
| `quality` | number | No | `90` | Quality for lossy formats (JPEG, WebP, AVIF) |

Supported formats: PNG, JPEG, WebP, GIF, TIFF, AVIF.

## Supported Image Formats

**Gemini tools input:** PNG, JPG/JPEG, WebP, GIF
**Gemini tools output:** PNG, JPG/JPEG, WebP (determined by `output_path` file extension)

**Local tools input/output:** PNG, JPG/JPEG, WebP, GIF, TIFF, AVIF

## Aspect Ratios

| Ratio | Use Case |
|-------|----------|
| `1:1` | Icons, avatars, social media posts |
| `16:9` | Hero images, banners, YouTube thumbnails |
| `9:16` | Mobile wallpapers, Instagram stories |
| `4:3` | Standard photos, blog images |
| `3:4` | Portrait photos, Pinterest pins |
| `5:4` | Landscape photos |
| `4:5` | Instagram posts, portrait content |

## Troubleshooting

### "API_KEY environment variable is required"
Set your Gemini API key in the MCP client's `env` configuration. Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

### "No image was generated"
- The model may have refused due to safety filters. Try rephrasing your prompt.
- Check the error message — it includes any text the model returned.

### "Image file not found"
- Verify the file path is correct (relative to where the MCP server process runs, or use absolute paths).
- The error shows the resolved absolute path for debugging.

### "Unsupported image format"
- Only PNG, JPG, JPEG, WebP, and GIF are supported as input.
- Output format is determined by the file extension in `output_path`.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev

# Clean build artifacts
npm run clean
```

## License

MIT
