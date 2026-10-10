import { serializeStatement } from "../shared/openui/serialize.js";
import type { RequestData, Turn } from "../shared/contracts.js";
import { ScreenDocument } from "../shared/openui/document.js";
import { callArgsOf } from "../shared/openui/parse-document.js";
import {
	getWorkout,
	workoutFocuses,
	workoutLevels,
	type Workout,
	type WorkoutFocus,
	type WorkoutLevel,
} from "./workout-data.js";

const fence = (code: string) => "```openui\n" + code + "\n```";
type OpenUiRef = { ref: string };
const ref = (id: string): OpenUiRef => ({ ref: id });
function valueOf(item: unknown): string {
	if (item && typeof item === "object" && "ref" in item)
		return (item as OpenUiRef).ref;
	if (Array.isArray(item)) return `[${item.map(valueOf).join(", ")}]`;
	return JSON.stringify(item);
}
const line = (id: string, name: string, ...provided: unknown[]) => {
	const args =
		provided.length === 1 &&
		Array.isArray(provided[0]) &&
		!["Screen", "List", "FollowUps"].includes(name)
			? provided[0]
			: provided;
	return `${id} = ${name}(${args.map(valueOf).join(", ")})`;
};
const clear = () => fence("root = Screens([])");

/* ---------- keyword matching ---------- */

const focusAliases: [RegExp, WorkoutFocus][] = [
	[/full[\s-]?body|\bfull\b/, "Full Body"],
	[/upper|\barms?\b/, "Upper Body"],
	[/lower|\blegs?\b/, "Lower Body"],
	[/\bcore\b|\babs\b/, "Core"],
];
const findFocus = (t: string) => focusAliases.find(([re]) => re.test(t))?.[1];
const normalizedAction = (t: string) =>
	t.replace(/\s+/g, " ").trim().toLowerCase();
const findLevel = (t: string) =>
	workoutLevels.find((l) => t.includes(l.toLowerCase()));
const isStart = (t: string) =>
	/^\/start-workout\b/.test(t) ||
	/^\/start-(full-body|upper-body|lower-body|core)\b/.test(t) ||
	[
		"start another workout",
		"start over",
		"restart",
		"generate new plan",
	].includes(t);

const getPreselectedFocus = (t: string): WorkoutFocus | null => {
	const match = t.match(/^\/start-(full-body|upper-body|lower-body|core)\b/);
	if (!match) return null;
	const focusMap: Record<string, WorkoutFocus> = {
		"full-body": "Full Body",
		"upper-body": "Upper Body",
		"lower-body": "Lower Body",
		"core": "Core",
	};
	return focusMap[match[1]] ?? null;
};

/* ---------- screens ---------- */

function welcomeProgram(preselectedFocus: WorkoutFocus | null = null): string {
	return [
		"root = Screens([welcome, personalize, summary], welcome)",
		line(
			"welcome",
			"Screen",
			["welcomeTitle", "welcomeCopy", "welcomeActions"].map(ref),
		),
		line("welcomeTitle", "Text", ["Your workout starts here.", "title"]),
		line("welcomeCopy", "Text", [
			"Tell me your goal, fitness level and preferred training style. I'll help you build a workout tailored to your needs.",
			"description",
		]),
		line("welcomeActions", "FollowUps", ["Tailor your workout"]),
		...personalizeStatements(),
		...summaryStatements(preselectedFocus),
	].join("\n");
}

const goals = [
	"Lose weight",
	"Build muscle",
	"Improve strength",
	"Build endurance",
	"Improve mobility",
];
const trainingStyles = ["Gym", "Home", "Calisthenics", "Rehab & mobility"];
const limitationChoices = [
	"None",
	"Lower-back limitations",
	"Shoulder impingement",
	"Knee limitations",
	"Other — describe your limitation",
];

function personalizeStatements(): string[] {
	return [
		line(
			"personalize",
			"Screen",
			[
				"personalizeTitle",
				"personalizeCopy",
				"goalHeading",
				"goalHint",
				"goalChoices",
				"trainingHeading",
				"trainingHint",
				"trainingChoices",
				"levelHeading",
				"levelHint",
				"levelChoices",
				"limitationsHeading",
				"limitationsHint",
				"limitationChoices",
				"generatePreview",
			].map(ref),
		),
		line("personalizeTitle", "Text", [
			"Let's build your workout.",
			"title",
		]),
		line("personalizeCopy", "Text", [
			"Tell me a little about yourself so I can tailor your session.",
			"description",
		]),
		line("goalHeading", "Text", [
			"What's your primary fitness goal?",
			"subtitle",
		]),
		line("goalHint", "Text", ["Select one.", "body"]),
		line("goalChoices", "ChoiceButtons", [goals, "goal", "single"]),
		line("trainingHeading", "Text", [
			"Where or how do you prefer to train?",
			"subtitle",
		]),
		line("trainingHint", "Text", ["Select one.", "body"]),
		line("trainingChoices", "ChoiceButtons", [
			trainingStyles,
			"training",
			"single",
		]),
		line("levelHeading", "Text", [
			"What's your current fitness level?",
			"subtitle",
		]),
		line("levelHint", "Text", ["Select one.", "body"]),
		line("levelChoices", "ChoiceButtons", [
			[...workoutLevels],
			"level",
			"single",
		]),
		line("limitationsHeading", "Text", [
			"Any injuries, restrictions or physical limitations?",
			"subtitle",
		]),
		line("limitationsHint", "Text", [
			"Select any that apply, or describe your own.",
			"body",
		]),
		line("limitationChoices", "ChoiceButtons", [
			limitationChoices,
			"limitations",
			"multiple",
		]),
		line("generatePreview", "FollowUps", ["Generate workout preview"]),
	];
}

function summaryStatements(preselectedFocus: WorkoutFocus | null = null): string[] {
	const actions = preselectedFocus
		? ["Back to preferences", "Generate workout"]
		: ["Back to preferences", "Choose workout focus"];
	const children = [
		"summaryTitle",
		"summaryGoal",
		"summaryTraining",
		"summaryLevel",
		"summaryLimitations",
		"summaryActions",
	];
	if (preselectedFocus) {
		children.push("summaryPreselectedFocus");
	}
	return [
		line(
			"summary",
			"Screen",
			children.map(ref),
		),
		line("summaryTitle", "Text", ["Your workout preferences", "title"]),
		line("summaryGoal", "Keyword", ["Not selected", "Goal"]),
		line("summaryTraining", "Keyword", ["Not selected", "Training style"]),
		line("summaryLevel", "Keyword", ["Not selected", "Fitness level"]),
		line("summaryLimitations", "Keyword", ["None", "Limitations"]),
		line("summaryActions", "FollowUps", actions),
		...(preselectedFocus ? [line("summaryPreselectedFocus", "Text", [preselectedFocus])] : []),
	];
}

function focusProgram(level: WorkoutLevel, preselectedFocus: WorkoutFocus | null = null): string {
	const badges = workoutFocuses.map(focus =>
		focus === preselectedFocus ? "Preselected" : ""
	);
	return [
		"root = Screens([welcome, personalize, summary, focus], focus)",
		line(
			"focus",
			"Screen",
			[
				"focusTitle",
				"focusCopy",
				"focusLevel",
				"focusChoices",
				"focusNote",
				"focusActions",
			].map(ref),
		),
		line("focusTitle", "Text", [
			"What would you like to train today?",
			"title",
		]),
		line("focusCopy", "Text", [
			"Choose the area you want to focus on, and I'll tailor your session around it.",
			"description",
		]),
		line("focusLevel", "Keyword", [level, "Fitness level"]),
		line("focusChoices", "ChoiceButtons", [
			workoutFocuses,
			"focus",
			"single",
			[],
			badges,
		]),
		line("focusNote", "Text", [
			"All four workout areas are available in this local demo. Choose one to get a session matched to your fitness level.",
			"body",
		]),
		line(
			"focusActions",
			"FollowUps",
			["Start workout"],
			"focus",
		),
	].join("\n");
}

function screenKeys(w: Workout, includeOverview = true): string[] {
	return [
		...(includeOverview ? ["overview"] : []),
		...w.exercises.flatMap((_, i) => [
			`exercise${i + 1}`,
			...(i < w.exercises.length - 1 ? [`rest${i + 1}`] : []),
		]),
		"finish",
	];
}
const rootLine = (w: Workout, cursor: string, includeOverview = true) =>
	`root = Screens([${screenKeys(w, includeOverview).join(", ")}], ${cursor})`;

function sessionProgram(
	w: Workout,
	initialCursor = "overview",
	includeOverview = true,
): string {
	const n = w.exercises.length;
	const lines = [
		rootLine(w, initialCursor, includeOverview),
		line(
			"overview",
			"Screen",
			[
				"overviewTitle",
				"overviewLevel",
				"overviewFocus",
				"overviewLength",
				"preview",
				"overviewCue",
				"begin",
			].map(ref),
		),
		line("overviewTitle", "Text", [w.title, "title"]),
		line("overviewLevel", "Keyword", [w.level, "Level"]),
		line("overviewFocus", "Keyword", [w.focus, "Focus"]),
		line("overviewLength", "Keyword", [
			`${w.duration} min`,
			`${n} exercises`,
		]),
		line(
			"preview",
			"List",
			w.preview.map((_, i) => `preview${i + 1}`).map(ref),
		),
		...w.preview.map((item, i) =>
			line(`preview${i + 1}`, "ListItem", [item]),
		),
		line("overviewCue", "Cue", [
			"Here's your plan. Say start when you're ready.",
		]),
		line("begin", "FollowUps", ["Start workout"]),
	];
	w.exercises.forEach((e, i) => {
		const k = i + 1;
		lines.push(
			line(
				`exercise${k}`,
				"Screen",
				[`exerciseLayout${k}`, `exerciseCue${k}`].map(ref),
			),
			line(`exerciseLayout${k}`, "WorkoutLayout", [
				[
					`exercisePlayer${k}`,
					`exerciseTimer${k}`,
					`autoplayToggle${k}`,
					`exerciseControls${k}`,
				].map(ref),
			]),
			line(`exercisePlayer${k}`, "WorkoutPlayer", [
				w.exercises.map((exercise) => exercise.name),
				k - 1,
				e.name,
				e.target ?? `${e.duration} seconds`,
				e.cue,
			]),
			line(`exerciseTimer${k}`, "Timer", [
				e.name,
				e.duration,
				null,
				"display",
			]),
			line(`autoplayToggle${k}`, "Toggle", [
				"Autoplay",
				"Advance when the timer ends.",
				"autoplay",
			]),
			line(`exerciseControls${k}`, "WorkoutControls", [
				`exerciseTimer${k}`,
				`exercise${k}`,
				k === n,
			]),
			line(`exerciseCue${k}`, "Cue", [e.cue]),
		);
	});
	w.exercises.slice(0, -1).forEach((_, i) => {
		const k = i + 1;
		const next = w.exercises[k];
		lines.push(
			line(
				`rest${k}`,
				"Screen",
				[`restTitle${k}`, `restCopy${k}`, `restNext${k}`, `restTimer${k}`, `restControls${k}`].map(ref),
			),
			line(`restTitle${k}`, "Text", ["Rest & Recover", "title"]),
			line(`restCopy${k}`, "Text", ["Take a short breather. Next up:", "description"]),
			line(`restNext${k}`, "Keyword", [`${next.name} · ${next.target}`, "Next exercise"]),
			line(`restTimer${k}`, "Timer", ["Rest & Recover", 15, null, "display"]),
			line(`restControls${k}`, "RestControls", [`exercise${k + 1}`]),
		);
	});
	lines.push(
		line(
			"finish",
			"Screen",
			["finishTitle", "finishSummary", "finishCue"].map(ref),
		),
		line("finishTitle", "Text", ["Workout complete!", "title"]),
		line("finishSummary", "WorkoutComplete", [
			w.exercises.map((e) => e.name),
			"Generate new plan",
		]),
		line("finishCue", "Cue", [
			"Great work today. Rest up and come back soon.",
		]),
	);
	return lines.join("\n");
}

/* ---------- state recovered from the current screen document ---------- */

function sessionFrom(program: string): Workout | undefined {
	const title = program.match(/overviewTitle\s*=\s*Text\(\s*"([^"]+)"/)?.[1];
	const lines = program.split("\n");
	for (const level of workoutLevels)
		for (const focus of workoutFocuses) {
			const w = getWorkout(focus, level);
			if (title && w.title === title) return w;
			const player = lines
				.map(callArgsOf)
				.find((call) => call?.name === "WorkoutPlayer");
			const names = player?.args[0];
			if (names?.k !== "list") continue;
			const exerciseNames = names.v.map((item) =>
				item.k === "str" ? item.v : "",
			);
			const durationLine = lines
				.map(callArgsOf)
				.find((call) => call?.name === "Timer");
			const seconds = durationLine?.args[1];
			if (
				exerciseNames.length === w.exercises.length &&
				exerciseNames.every(
					(name, i) => name === w.exercises[i]?.name,
				) &&
				(seconds?.k !== "num" || seconds.v === w.exercises[0]?.duration)
			)
				return w;
		}
	return undefined;
}
const nodeValue = (doc: ScreenDocument, id: string, fallback = "") => {
	for (const screen of doc.screens) {
		const node = (
			screen.props.children as {
				key: string;
				props: Record<string, unknown>;
			}[]
		).find((child) => child.key === id);
		if (node) return String(node.props.text ?? fallback);
	}
	return fallback;
};

function preferencesTurn(doc: ScreenDocument, text: string): Turn {
	const action = normalizedAction(text);
	const limitations = nodeValue(doc, "summaryLimitations", "None");
	if (action === "generate workout preview") {
		const required = ["summaryGoal", "summaryTraining", "summaryLevel"].map(
			(id) => nodeValue(doc, id, "Not selected"),
		);
		if (required.includes("Not selected"))
			return say(
				"Select a goal, training style and fitness level before continuing.",
			);
		if (limitations.includes("Other — describe your limitation"))
			return say(
				"Type a short description for Other, or deselect it before continuing.",
			);
		return say(
			"Here are the preferences you selected.\n" +
				fence(
					"root = Screens([welcome, personalize, summary], summary)",
				),
		);
	}
	if (
		limitations.includes("Other — describe your limitation") &&
		text.trim()
	) {
		const detail = text.trim().slice(0, 240);
		return say(
			"Thanks. I'll keep that as a preference and won't try to diagnose it.\n" +
				fence(
					serializeStatement("summaryLimitations", "Keyword", [
						`Other: ${detail}`,
						"Limitations",
					]),
				),
		);
	}
	return say("Choose your options, then select Generate workout preview.");
}

/* ---------- turns ---------- */

const welcomeTurn = (): Turn => ({
	reply:
		"Welcome! Choose Tailor your workout to set your preferences.\n" +
		clear() +
		"\n" +
		fence(welcomeProgram()),
});

const welcomeTurnWithPreselection = (preselectedFocus: WorkoutFocus): Turn => ({
	reply:
		`Welcome! I've preselected "${preselectedFocus}" for you. Choose Tailor your workout to set your preferences.\n` +
		clear() +
		"\n" +
		fence(welcomeProgram(preselectedFocus)) +
		"\n" +
		fence(serializeStatement("summaryPreselectedFocus", "Text", [preselectedFocus])),
});
const overviewTurn = (level: WorkoutLevel, focus: WorkoutFocus): Turn => ({
	reply:
		`Great choice: ${level} ${focus}. Here's your plan.\n` +
		clear() +
		"\n" +
		fence(sessionProgram(getWorkout(focus, level))),
});
const say = (reply: string): Turn => ({ reply });

function moveTurn(
	w: Workout,
	cursor: string,
	delta: 1 | -1,
	includeOverview = true,
): Turn {
	const keys = screenKeys(w, includeOverview);
	const i = keys.indexOf(cursor);
	let targetIndex = Math.max(0, Math.min(keys.length - 1, i + delta));
	while (keys[targetIndex]?.startsWith("rest"))
		targetIndex = Math.max(0, Math.min(keys.length - 1, targetIndex + delta));
	const target = keys[targetIndex];
	if (target === cursor)
		return say("That's as far as we can go in that direction.");
	const n = Number(target.replace(/\D/g, ""));
	const text = target.startsWith("exercise")
		? `Let's go: ${w.exercises[n - 1].name}.`
		: target.startsWith("rest")
			? "Nice work. Take a breather."
			: target === "finish"
				? "That's the session. Great work."
				: "Back to your plan.";
	return say(text + "\n" + fence(rootLine(w, target, includeOverview)));
}

function workoutTurn(request: RequestData, text: string): Turn {
	const doc = new ScreenDocument();
	if (request.state.ui_state) doc.apply(fence(request.state.ui_state));
	const cursor = doc.cursor;
	const level = findLevel(text);
	const focus = findFocus(text);
	const preselectedFocus = getPreselectedFocus(text);

	if (isStart(text)) {
		if (level && focus) return overviewTurn(level, focus);
		if (preselectedFocus) {
			return welcomeTurnWithPreselection(preselectedFocus);
		}
		return welcomeTurn();
	}
	if (cursor === "welcome") {
		if (normalizedAction(text) === "tailor your workout")
			return say(
				"Let's build your workout.\n" +
					fence(
						"root = Screens([welcome, personalize, summary], personalize)",
					),
			);
		return say("Choose Tailor your workout to set your preferences.");
	}
	if (cursor === "personalize") return preferencesTurn(doc, text);
	if (cursor === "summary") {
		if (normalizedAction(text) === "back to preferences")
			return say(
				"Update any choice, then continue again.\n" +
					fence(
						"root = Screens([welcome, personalize, summary], personalize)",
					),
			);
		if (normalizedAction(text) === "choose workout focus") {
			const level = workoutLevels.find(
				(item) => item === nodeValue(doc, "summaryLevel"),
			);
			if (!level)
				return say("Choose your fitness level before continuing.");
			const preselectedFocusText = nodeValue(doc, "summaryPreselectedFocus", "");
			const preselectedFocus = preselectedFocusText && workoutFocuses.includes(preselectedFocusText as WorkoutFocus)
				? (preselectedFocusText as WorkoutFocus)
				: null;
			return say(
				"Choose the area you want to train.\n" +
					fence(focusProgram(level, preselectedFocus)),
			);
		}
		// If user selects "Generate workout" and there's a preselected focus, skip the focus screen and overview
		if (normalizedAction(text) === "generate workout") {
			const level = workoutLevels.find(
				(item) => item === nodeValue(doc, "summaryLevel"),
			);
			const preselectedFocusText = nodeValue(doc, "summaryPreselectedFocus", "");
			const preselectedFocus = preselectedFocusText && workoutFocuses.includes(preselectedFocusText as WorkoutFocus)
				? (preselectedFocusText as WorkoutFocus)
				: null;
			if (level && preselectedFocus) {
				const w = getWorkout(preselectedFocus, level);
				return say(
					`Let's begin with ${w.exercises[0].name}.\n` +
					clear() +
					"\n" +
					fence(sessionProgram(w, "exercise1", false)),
				);
			}
		}
		return say(
			"These are the preferences you selected. Choose Back to preferences to edit them.",
		);
	}
	if (cursor === "focus") {
		if (normalizedAction(text) === "start workout") {
			const selectedByEvent = request.state.client_events
				.slice()
				.reverse()
				.find(
					(event) =>
						event.startsWith("Selected ") &&
						event.endsWith(" for focus."),
				)
				?.slice("Selected ".length, -" for focus.".length);
			const selected = nodeValue(doc, "summaryFocus", selectedByEvent);
			const saved = workoutLevels.find(
				(item) => item === nodeValue(doc, "summaryLevel"),
			);
			const chosenFocus = workoutFocuses.find((item) => item === selected);
			if (!chosenFocus)
				return say("Select a workout focus before continuing.");
			if (!saved) return welcomeTurn();
			const w = getWorkout(chosenFocus, saved);
			return say(
				`Let's begin with ${w.exercises[0].name}.\n` +
					clear() +
					"\n" +
					fence(sessionProgram(w, "exercise1", false)),
			);
		}
		return say("Select a workout focus, then choose Start workout.");
	}
	const w = sessionFrom(doc.program);
	if (!w) return say("Type /start-workout to begin a workout.");
	const includeOverview = doc.screens.some(
		(screen) => screen.key === "overview",
	);

	if (cursor === "overview") {
		if (/\b(start|begin|go|next|ready)\b/.test(text))
			return say(
				`Let's begin with ${w.exercises[0].name}.\n` +
					fence(rootLine(w, "exercise1")),
			);
		return say(
			"Your plan is ready. Choose Start workout when you want to begin.",
		);
	}
	if (cursor === "finish" && isStart(normalizedAction(text)))
		return welcomeTurn();
	if (cursor === "finish")
		return say(
			"Nice work completing the session. Generate a new plan when you’re ready.",
		);
	if (normalizedAction(text) === "finish step")
		return moveTurn(w, cursor, 1, includeOverview);

	if (/\brepeat\b/.test(text))
		return say(
			"Again. Reset the timer and go once more.\n" +
				fence(rootLine(w, cursor, includeOverview)),
		);
	if (/\bpause\b/.test(text))
		return say(
			"Paused. Use Pause preview to freeze the timer, and say resume when you're ready.",
		);
	if (/\bresume\b/.test(text))
		return say("Welcome back. Pick up where you left off.");
	if (/\b(stop|quit|end|finish)\b/.test(text))
		return say(
			"Okay, we'll wrap up here. Nice effort.\n" +
				fence(rootLine(w, "finish", includeOverview)),
		);
	if (/\b(back|previous)\b/.test(text))
		return moveTurn(w, cursor, -1, includeOverview);
	if (/\b(next|skip|continue|ready|done)\b/.test(text))
		return moveTurn(w, cursor, 1, includeOverview);
	return say("Say next, skip, back, repeat, pause or stop.");
}

/* ---------- entry point ---------- */

export function mockTurn(request: RequestData, fixture: string): Turn {
	const last =
		request.messages
			.at(-1)
			?.content.trim()
			.replace(/\s+/g, " ")
			.toLowerCase() ?? "";
	if (
		isStart(last) ||
		/^(welcome = Screen|focusLevel =|overview = Screen|exercise1 = Screen)/m.test(
			request.state.ui_state,
		)
	)
		return workoutTurn(request, last);
	if (last === "load wiring sample" || last === "/demo")
		return {
			reply:
				"Wiring fixture loaded. This is deterministic, not a model interpreting your skill.\n" +
				clear() +
				"\n" +
				fence(fixture),
		};
	const doc = new ScreenDocument();
	if (request.state.ui_state) doc.apply(fence(request.state.ui_state));
	const screens = doc.screens;
	const index = screens.findIndex((s) => s.key === doc.cursor);
	if (["next", "back"].includes(last) && screens.length) {
		const target =
			screens[
				Math.max(
					0,
					Math.min(
						screens.length - 1,
						index + (last === "back" ? -1 : 1),
					),
				)
			];
		return {
			reply:
				"Fixture cursor moved.\n" +
				fence(
					`root = Screens([${screens.map((s) => s.key).join(", ")}], ${target.key})`,
				),
		};
	}
	if (
		/^change value to (\d{1,2})$/.test(last) &&
		doc.program.includes("count1 =")
	) {
		const value = Number(last.match(/\d+/)![0]);
		return {
			reply:
				"Fixture values patched under their existing names.\n" +
				fence(
					serializeStatement("count1", "Keyword", [
						String(value),
						"Sample value",
					]) +
						"\n" +
						serializeStatement("count2", "Keyword", [
							String(value),
							"Second sample value",
						]),
				),
		};
	}
	return {
		reply: "Type /start-workout, /start-lower-body, /start-upper-body, /start-full-body, or /start-core to begin your workout, or /demo for the wiring sample.",
	};
}
