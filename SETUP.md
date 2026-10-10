# Project Overview

This is an **AiRA workout starter** - a local browser harness for building an AI-guided, fictional workout experience. It's derived from AiRA API and client code, designed to help you create an interactive workout application without physical exercise or production integration.

## What You Need to Do

Your assignment is to:
1. **Build an AI-guided workout experience** - Decide the interaction, guidance, and presentation yourself
2. **Modify or add components** - You can change existing components or create your own
3. **Use AI coding tools** - Leverage your preferred AI tools for development
4. **Keep it runnable locally** - Use simulated actions only
5. **Submit source ZIP** - Include a short explanation of what you built and which runtime modes you tested

## Quick Start (Development)

### Prerequisites
- Node.js 22.18 or later
- npm

### Run the Application

```sh
npm ci --ignore-scripts
npm start
```

Open http://127.0.0.1:4319 in your browser. Stop with Ctrl+C.

### Initial State
- The app starts in **Mock mode** (no account or API key needed)
- Click **"Load wiring sample"** to see generic component examples
- Mock accepts: `/demo`, `next`, `back`, and `change value to 6`
- It does NOT interpret the skill or arbitrary messages yet

### Development Workflow
- Edit `skills/workout.md` to define your interaction instructions
- Prompt/skill edits load on the next request
- Source changes need a restart and browser reload
- Use your editor to modify files

### Check Your Work

```sh
npm run check
npx playwright install chromium
npm run test:ui
npm run package
```

### Key Files to Know
- `skills/workout.md` - Your interaction instructions (edit this!)
- `prompts/` - Output protocol and context
- `src/shared/openui/` - Parser, component registry, validation
- `src/web/` - Browser renderers
- `src/server/` - HTTP server, mock and model adapters
- `examples/wiring.openui` - Generic offline fixture

## Important Notes

- **Keep credentials local** - Store in `.env`, never in source or exports
- **Mock mode** - Works without any API configuration
- **Optional model adapters** - See `docs/RUNTIMES.md` for real AI integration
- **Packaging** - Creates `output/workout-source.zip` locally (no auto-submission)
