# AiRA Workout Experience

AiRA is a locally runnable browser prototype of an AI-guided workout experience. It demonstrates onboarding, workout planning, exercise playback, timer controls, rest/autoplay, and contextual coaching. This is a harness, not the production AiRA application; workout activity and AI responses may be simulated.

## Experience

The intended flow keeps onboarding consistent for every start command: welcome, workout preferences and health screening, workout-area selection, plan preview, exercise player, optional autoplay rest, then workout completion. Area-specific commands preselect an area without skipping onboarding. Users can edit preferences or area before starting their plan.

The exercise experience includes play, pause, resume, restart, finish, and next controls; a timer and progress indicator; timed coach cues; and a rest countdown with a next-exercise preview when autoplay is on. The final exercise goes directly to completion. See [implementation.md](implementation.md) for the component map, state flow, setup, and current implementation notes.

## Setup and checks

Requires Node.js 22.18 or later and npm. Install dependencies with:

```sh
npm ci --ignore-scripts
```

Run the checks with:

```sh
npm run check
npm run test:ui
npm run package
```

Browser checks use a mock server on port 4320. Set `PLAYWRIGHT_CHROME_PATH` to use an installed Chrome. Packaging writes `output/workout-source.zip`; it excludes `.env`, dependencies, build output, and repository history, and does not submit the assignment.

The user manages application server startup; do not run `npm start` as part of project checks. The default runtime is Mock. Provider credentials belong in local environment configuration, and model requests require a configured provider and user consent. Supplied tests use fake transports; live OpenAI and Claude requests have not been verified. This prototype does not assess physical activity or exercise form.
