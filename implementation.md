# AiRA workout implementation

## Overview

This project implements a local, browser-based workout prototype on top of the AiRA OpenUI harness. The workout flow is generated as declarative OpenUI statements by the deterministic local Mock. The browser validates those statements against the component registry and renders them with trusted TypeScript and DOM code. Workout timers and progression are local simulations; they do not measure physical activity.

The implemented experience covers welcome and preference collection, workout-area selection, a plan overview, exercise playback, optional autoplay rests, timer controls, timed coach cues, and a session summary. Plans are generated from the local exercise library in `src/server/workout-data.ts`.

## Run and development

The starter requires Node.js 22.18 or later and npm. Setup, runtime adapters, browser checks, and packaging are documented in [README.md](README.md), [docs/HARNESS.md](docs/HARNESS.md), and [docs/RUNTIMES.md](docs/RUNTIMES.md).

The application server is started by the developer when needed. The documented browser checks run their own mock server on port 4320. Do not start the app server as part of this implementation guide.

Useful project commands are:

```sh
npm run check
npm run test:ui
npm run package
```

The supplied automated transports are fake/local. Live OpenAI and Claude requests have not been verified.

## Project structure

- `skills/workout.md`: workout interaction instructions loaded by the prompt system.
- `prompts/`: system protocol and per-turn context.
- `src/server/mock.ts`: deterministic local onboarding, workout, navigation, and rest flow.
- `src/server/workout-data.ts`: supported workout areas, exercise library, level scaling, and plan metadata.
- `src/shared/openui/openui-library.ts`: component names, argument signatures, and child relationships.
- `src/shared/openui/validate.ts`: OpenUI statement and prop validation.
- `src/shared/openui/`: parser, document state, navigation, timer ledger, serialization, and client event helpers.
- `src/web/components.ts`: trusted browser renderers for registered components.
- `src/web/app.ts`: UI state, local timer actions, cue scheduling, navigation, and browser event handling.
- `src/web/styles.css`: presentation for the harness and workout screens.
- `tests/`: unit, HTTP, CLI, packaging, and Playwright browser checks.

## Workout flow

### 1. Start and welcome

The normal entry is `/start-workout`. Area-specific commands are recognized for Upper Body, Lower Body, Core, and Full Body. They show the welcome screen and store a preselected area in the current UI state. The current skill text and Mock implementation do not behave consistently here: see [Known behavior and limitations](#known-behavior-and-limitations).

The welcome screen presents a `Tailor your workout` action. Choosing it opens the preference screen.

### 2. Preferences

The preference screen collects:

- One fitness goal: Lose weight, Build muscle, Improve strength, Build endurance, or Improve mobility.
- One training style: Gym, Home, Calisthenics, or Rehab & mobility.
- One fitness level: Beginner, Intermediate, or Advanced.
- Zero or more limitation selections, including None, example limitations, or an Other option with a short text description.

The local flow requires a goal, training style, and level before it accepts the request to generate a preview. If Other is selected, it asks for a description. Limitation entries are stored as preferences and are not used to diagnose or recommend treatment.

### 3. Preference summary and workout area

The summary screen displays the selected goal, training style, level, limitations, and any preselected workout area. Users can return to preferences. In the normal flow, `Choose workout focus` opens a screen with all four supported areas. The chosen focus and level select a plan from the local exercise library.

### 4. Workout overview

The overview shows the plan title, fitness level, workout focus, estimated duration, and a short list of plan themes. `Start workout` opens the first exercise. Exercise lists and durations come from `getWorkout`; the level scales exercise durations and determines rest duration and point metadata.

### 5. Exercise player

Each exercise screen is composed from a `WorkoutLayout` containing the player, timer, autoplay toggle, and workout controls. The player shows the exercise name and target, a progress stepper, and a small generated SVG movement illustration. Coaching copy is also supplied as a `Cue` statement; the browser app can add timed motivational messages to the coach panel.

The timer ledger is the source of truth for exercise and rest countdowns. Controls support starting, pausing, resuming, resetting, and finishing the current timer/exercise. Completion status is tracked per exercise in browser state and is reflected in the progress display and completion summary.

### 6. Rest and progression

The plan document includes a 15-second Rest & Recover screen between exercises, with a next-exercise preview and `Skip Rest` control. The app starts rest timers and advances when they expire. Autoplay state is controlled by a toggle on exercise screens. With autoplay disabled, rest screens are skipped during direct navigation. The final exercise leads to the finish screen rather than a rest screen.

### 7. Workout completion

The finish screen presents a session summary with exercise statuses, simulated active time, an estimated calorie value, and an explicit note that calories and form are not measured. Its action can begin another workout flow.

## OpenUI components

Component signatures are declared in `src/shared/openui/openui-library.ts`, props are checked in `src/shared/openui/validate.ts`, and browser renderers live in `src/web/components.ts`. OpenUI is data: the browser executes only trusted local renderer code, not generated component code.

### Existing harness components used by the workout

- `Screens` and `Screen`: define the screen sequence and current cursor.
- `Text`, `Keyword`, `List`, and `ListItem`: present headings, metadata, and plan details.
- `ChoiceButtons`: collect single or multiple selections.
- `Timer`: render a simulated countdown.
- `Cue`: provide coach or contextual copy.
- `FollowUps`: expose selectable actions.

### Workout-specific components

- `WorkoutPlayer(exercises, index, name, target, cue)`: shows the current exercise, target, progress steps, and a generated movement illustration.
- `Toggle(label, description, stateKey)`: controls autoplay and displays its current state.
- `WorkoutControls(timerId, exerciseId, isLast)`: connects Play/Pause/Resume, Restart, and finish actions to the local timer and exercise state.
- `RestControls(nextExercise)`: provides Skip Rest navigation.
- `WorkoutLayout(children)`: composes the player, timer, toggle, and controls in a consistent layout.
- `WorkoutComplete(exercises, action)`: summarizes exercise completion and simulated session metrics.

The registry and validators constrain component names, argument counts, child structure, and prop values before rendering. Renderers create ordinary DOM elements and attach trusted local event handlers.

## State, timers, and coaching

`src/web/app.ts` owns timer orchestration and browser-side exercise status. The shared `TimerLedger` stores remaining time and timer status. Screen changes synchronize timer entries with the current document; navigation pauses an active exercise timer and cleans up that exercise's cue state.

Timed motivational cues use elapsed time from the active timer state, with thresholds at 25%, 60%, and 85% of the exercise duration. Cue text is selected from local predefined templates. Cue scheduling is separate from plan generation and server model calls.

Rest periods use a 15-second timer in the generated session. Rest and exercise transitions are handled locally by the browser app. The final exercise routes to the completion screen.

## Runtime and privacy

The default Mock runtime is local and deterministic. Optional providers are configured through the runtime setup described in `docs/RUNTIMES.md`; provider credentials belong in local environment configuration and must not be committed or included in exports. A model request requires a configured provider and user usage consent. Nothing in this implementation guide implies that live provider calls have been tested.

The browser harness omits production accounts, databases, native mobile UI, audio, media workers, and production workout integrations. It does not assess exercise form or physical activity.

## Checks and packaging

Run `npm run check` for type, lint, and supplied automated checks. Run `npm run test:ui` for browser checks; they launch a local mock server on port 4320. The browser checks can use installed Chrome through `PLAYWRIGHT_CHROME_PATH`.

Run `npm run package` to create `output/workout-source.zip`. Packaging excludes `.env`, dependencies, build output, and repository history. It does not submit the assignment. Runtime modes should be reported according to those actually exercised; the supplied tests use fake transports and do not verify live OpenAI or Claude requests.

## Known behavior and limitations

- `skills/workout.md` currently says area-specific commands skip focus and preview and go directly to the first exercise. The Mock's actual area-command path stores a preselection, continues through welcome and preferences, then offers a `Generate workout` action that starts a workout directly. The normal flow exposes focus selection and an overview. This differs from the desired behavior described in the assignment README supplied for this project.
- Full Body plans exist in the data library and the Mock recognizes `/start-full-body`.
- `WorkoutLayout` includes an autoplay toggle, and rest screens are present in the generated OpenUI plan. The actual progression behavior is implemented across both the Mock and browser app, so the local browser checks are the right place to validate interactions.
- The exercise visual is an inline generated SVG illustration, not exercise photography or video.
- The current workout overview actions do not implement the requested Edit Plan / Generate New Plan behavior. The overview currently exposes a Start workout action.
- There is no separate AI chat component in the workout component registry. Timed motivational cues are shown through the existing coach/context panel behavior in the browser harness.
- Automated tests and local Mock behavior do not establish production readiness or live model-provider behavior.
