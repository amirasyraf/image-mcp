# Gemini Image MCP Server

An MCP (Model Context Protocol) server that gives AI coding agents the ability to generate and edit images using Google's Gemini API. Built for frontend development workflows.

## What It Does

This MCP server provides 6 tools that AI agents can use to:

- **Generate images** from text descriptions (icons, hero images, placeholders, diagrams)
- **Edit existing images** with text instructions (recolor, restyle, add/remove elements)
- **Iteratively refine images** through multi-turn editing sessions with conversation memory

All images are generated at **1K resolution** using Gemini's image generation models with optional "thinking" mode for maximum accuracy.

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
git clone https://github.com/amirasyraf/gemini-image-mcp-server.git
cd gemini-image-mcp-server
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
      "args": ["/absolute/path/to/gemini-image-mcp-server/dist/index.js"],
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

## Supported Image Formats

**Input:** PNG, JPG/JPEG, WebP, GIF
**Output:** PNG, JPG/JPEG, WebP (determined by `output_path` file extension)

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
