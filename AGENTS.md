# AGENTS.md — Gemini Image MCP Server

> This file is for AI agents working on and maintaining this codebase.

## Project Overview

This is an MCP (Model Context Protocol) server written in TypeScript that wraps Google's Gemini API for image generation and editing. It runs as a stdio-based MCP server consumed by AI coding assistants (Claude Desktop, Cursor, VS Code Copilot, etc.).

**Purpose:** Give AI coding agents the ability to generate and edit images during frontend development workflows.

## Architecture

```
src/
├── index.ts              # Entry point — loads config, inits Gemini client, registers tools, starts stdio server
├── constants.ts          # All configuration constants, supported models, aspect ratios, env var names
├── types.ts              # TypeScript interfaces (ServerConfig, ImageResult, EditSession, LocalImageResult, etc.)
├── services/
│   ├── gemini.ts         # Core Gemini API wrapper — all API calls go through here
│   └── image.ts          # Local image processing with sharp (resize, rotate, compress, convert)
├── schemas/
│   └── index.ts          # Zod validation schemas for all tool inputs
└── tools/
    ├── generate.ts       # gemini_generate_image tool registration
    ├── edit.ts           # gemini_edit_image tool registration
    ├── session.ts        # Multi-turn session tools (start, send, list, end)
    └── image.ts          # Local image manipulation tools (resize, rotate, compress, convert)
```

### Key Design Decisions

- **MCP SDK v1.x** (`@modelcontextprotocol/sdk`): Used for server setup, tool registration, and stdio transport. v2 is pre-alpha and not recommended.
- **`@google/genai` SDK**: Official Google Gen AI SDK for all Gemini API calls.
- **In-memory sessions**: Multi-turn chat sessions are stored in a `Map` in `services/gemini.ts`. They do NOT persist across server restarts.
- **File-based I/O**: Images are read from and written to disk. Base64 data is never returned in MCP responses (too large for agent context windows).
- **Thinking mode**: Enabled by default at "High" level. Controlled per-request via `thinking_level` parameter.
- **1K resolution**: All images are generated at 1K resolution (`imageSize: "1K"`). Hardcoded in `constants.ts`.

### Data Flow

1. Agent calls a tool (e.g., `gemini_generate_image`) via MCP protocol
2. MCP SDK validates input against Zod schema
3. Tool handler in `tools/` calls the appropriate function in `services/gemini.ts`
4. `services/gemini.ts` calls Gemini API via `@google/genai` SDK
5. Response is parsed — images are saved to disk, metadata is returned as JSON text

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `API_KEY` | Yes | — | Gemini API key |
| `IMAGE_MODEL` | No | `gemini-3.1-flash-image-preview` | Model to use |
| `API_BASE_URL` | No | — | Override API base URL |

Config is loaded once at startup in `index.ts:loadConfig()`.

## Tools (10 total)

| Tool | File | Purpose |
|------|------|---------|
| `gemini_generate_image` | `tools/generate.ts` | Text → Image (API) |
| `gemini_edit_image` | `tools/edit.ts` | Text + Image(s) → Image (API) |
| `gemini_start_edit_session` | `tools/session.ts` | Create multi-turn chat session (API) |
| `gemini_send_edit_message` | `tools/session.ts` | Send message to session (API) |
| `gemini_list_sessions` | `tools/session.ts` | List active sessions |
| `gemini_end_session` | `tools/session.ts` | End and clean up session |
| `image_resize` | `tools/image.ts` | Resize/crop images (local) |
| `image_rotate` | `tools/image.ts` | Rotate/flip images (local) |
| `image_compress` | `tools/image.ts` | Compress/optimize images (local) |
| `image_convert` | `tools/image.ts` | Convert image formats (local) |

## Build & Run

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm run dev          # Watch mode (tsx)
node dist/index.js   # Run (requires env vars)
```

Build output goes to `dist/`. Entry point is `dist/index.js`.

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework (v1.x) |
| `@google/genai` | Google Gemini API client |
| `sharp` | Local image processing (resize, rotate, compress, convert) |
| `zod` | Runtime input validation schemas |
| `typescript` | Build toolchain (dev) |
| `tsx` | TypeScript execution for dev mode (dev) |
| `@types/node` | Node.js type definitions (dev) |

## Adding a New Tool

1. Define Zod schema in `src/schemas/index.ts`
2. Create tool file in `src/tools/` (or add to existing file if related)
3. If the tool needs new API calls, add them to `src/services/gemini.ts`
4. Register the tool in the new file using `server.registerTool()`
5. Import and call the registration function in `src/index.ts`
6. Update README.md tools reference

Follow existing patterns:
- Snake_case tool names with `gemini_` prefix
- Comprehensive `description` with Args, Returns, Examples, Error Handling sections
- Zod `.strict()` schemas with `.describe()` on every field
- Return JSON responses as `{ type: "text", text: JSON.stringify(...) }`
- Wrap handlers in try/catch, return `isError: true` on failure
- Add tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)

## Common Modifications

### Add a new supported model
Edit `SUPPORTED_MODELS` array in `src/constants.ts`.

### Change default resolution
Edit `IMAGE_SIZE` in `src/constants.ts`. Valid values: `"1K"`, `"2K"`, `"4K"` (uppercase K required).

### Add a new aspect ratio
Add to `ASPECT_RATIOS` array in `src/constants.ts`.

### Add a new image format
Add to `SUPPORTED_IMAGE_TYPES` map in `src/constants.ts`.

### Modify thinking behavior
Thinking config is built in `services/gemini.ts:buildConfig()`. The `includeThoughts` flag controls whether thought parts appear in responses (currently `false`).

## Testing

This MCP server communicates over stdio. Running `node dist/index.js` directly will hang waiting for MCP protocol messages.

To test:
- Use an MCP client (Claude Desktop, MCP Inspector, etc.)
- Use `timeout 5s node dist/index.js` for quick startup validation
- Use the MCP evaluation harness if available

## Error Handling Patterns

- **Missing API key**: Hard exit with clear message at startup
- **Unknown model**: Warning to stderr, proceeds anyway (forward compatibility)
- **File not found**: Error includes resolved absolute path
- **Unsupported format**: Error lists all supported formats
- **API errors**: Caught and returned as `isError: true` MCP responses with descriptive messages
- **No image in response**: Error includes model's text response for diagnostics
- **Invalid session ID**: Error suggests using `gemini_list_sessions`

### Local Image Tools
- **File not found**: Error includes resolved absolute path
- **Unsupported format**: Error lists all supported extensions
- **Invalid parameters**: Zod schema refinements catch missing width/height (resize) and no-op transforms (rotate)
