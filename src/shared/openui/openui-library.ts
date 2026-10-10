// Adapted from selected AiRA code; see docs/HARNESS.md.
import type { StatementSpec } from "./openui-model.js";
export const OPENUI_LIBRARY = {
	Screens: { args: ["screens", "cursor"], required: 1, childArg: "screens" },
	Screen: { args: ["children", "seen"], required: 1, childArg: "children" },
	Text: { args: ["text", "variant", "color"], required: 1 },
	Keyword: { args: ["text", "caption", "color"], required: 1 },
	Image: { args: ["src", "alt", "caption"], required: 2 },
	ChoiceButtons: { args: ["options", "group", "mode", "disabledOptions", "badges"], required: 3 },
	WorkoutPlayer: { args: ["exercises", "index", "name", "target", "cue"], required: 5 },
	Toggle: { args: ["label", "description", "stateKey"], required: 3 },
	WorkoutControls: { args: ["timerId", "exerciseId", "isLast"], required: 3 },
	RestControls: { args: ["nextExercise"], required: 1 },
	WorkoutLayout: { args: ["children"], required: 1, childArg: "children" },
	WorkoutComplete: { args: ["exercises", "action"], required: 2 },
	List: { args: ["items"], required: 1, childArg: "items" },
	ListItem: { args: ["text", "marker"], required: 1 },
	Alert: { args: ["tone", "text"], required: 2 },
	Timer: { args: ["label", "seconds", "image", "mode"], required: 2 },
	Cue: { args: ["text"], required: 1 },
	FollowUps: { args: ["prompts", "requiresGroup", "requiresValue"], required: 1 },
} as const satisfies Record<string, StatementSpec>;
