import { Conversation } from "../shared/controller.js";
import {
	APP_VERSION,
	SCHEMA_VERSION,
	type Provider,
	type ProviderStatus,
	type RequestData,
	type Result,
} from "../shared/contracts.js";
import {
	TimerLedger,
	type TimerListEntry,
} from "../shared/openui/timer-store.js";
import {
	activityClientEvents,
	timerTransitionEvent,
} from "../shared/openui/activity-client-events.js";
import { createRunNav } from "../shared/openui/run-nav.js";
import { splitReply } from "../shared/openui/document.js";
import { serializeStatement } from "../shared/openui/serialize.js";
import type { StatementNode } from "../shared/openui/openui-model.js";
import { redactValue } from "../shared/redact.js";
import {
	renderComponent,
	type ChoiceGroup,
	type ChoiceMode,
	type ExerciseStatus,
} from "./components.js";
import { byId, el } from "./dom.js";

type Config = { providers: ProviderStatus[]; token: string };
let config: Config | undefined;
const timers = new TimerLedger();
let previousTimers = new Map<string, TimerListEntry>(),
	updates: (() => void)[] = [],
	paused = false,
	pausedTimers: string[] = [],
	selections: Record<ChoiceGroup, string[]> = {
		goal: [],
		training: [],
		level: [],
		limitations: ["None"],
		focus: [],
	},
	exerciseStatuses: Record<string, ExerciseStatus> = {},
	calorieEstimate: number | undefined,
	autoplay = false,
	renderKey = "",
	lastClear = 0;
// Cue scheduling state: tracks which cues have fired for each exercise
type CueState = {
	firedCues: Set<number>; // indices 0, 1, 2 for the three cues
	exerciseDuration: number;
	exerciseName: string;
	startTime: number | null;
	accumulatedElapsed: number; // Track elapsed time during running periods
	lastTickTime: number | null; // Track last tick time for pause calculation
	goal?: string;
	level?: string;
};
const cueStates = new Map<string, CueState>();
const CUE_PERCENTAGES = [0.25, 0.6, 0.85]; // 25%, 60%, 85%

// Predefined motivational cue templates
function getCueMessage(
	cueIndex: number,
	exerciseName: string,
	goal?: string,
	level?: string,
): string {
	const goalText = goal ? ` for ${goal.toLowerCase()}` : "";
	const levelText = level ? ` at ${level.toLowerCase()} level` : "";
	const messages: Record<number, string[]> = {
		0: [
			`Great start on ${exerciseName}${goalText}! Keep that form steady.`,
			`You're doing well with ${exerciseName}. Focus on your breathing.`,
			`Nice beginning! ${exerciseName} helps build${goalText || ' strength'}.`,
		],
		1: [
			`Keep going with ${exerciseName}. You're past the halfway point${levelText}!`,
			`Steady rhythm on ${exerciseName}. You've got this${goalText}!`,
			`Stay focused on ${exerciseName}. Your form looks great.`,
		],
		2: [
			`Almost there with ${exerciseName}! Finish strong${goalText}!`,
			`Last push on ${exerciseName}. You're making progress${levelText}!`,
			`Great work on ${exerciseName}. Nearly done with this set.`,
		],
	};
	const cueMessages = messages[cueIndex] || messages[0];
	return cueMessages[Math.floor(Math.random() * cueMessages.length)];
}

// Initialize cue state for an exercise
function initializeCueState(
	exerciseId: string,
	exerciseName: string,
	duration: number,
	goal?: string,
	level?: string,
) {
	cueStates.set(exerciseId, {
		firedCues: new Set<number>(),
		exerciseDuration: duration,
		exerciseName,
		startTime: null,
		accumulatedElapsed: 0,
		lastTickTime: null,
		goal,
		level,
	});
}

// Clean up cue state for an exercise
function cleanupCueState(exerciseId: string) {
	cueStates.delete(exerciseId);
}

// Check and fire cues based on elapsed time
function checkAndFireCues(exerciseId: string, timerId: string) {
	const cueState = cueStates.get(exerciseId);
	if (!cueState) return;

	const timer = timers.list().find((t) => t.id === timerId);
	if (!timer) return;

	const now = Date.now();

	// Handle timer state transitions
	if (timer.status === "running") {
		if (cueState.lastTickTime === null) {
			// Timer just started running
			cueState.lastTickTime = now;
		} else {
			// Timer continues running, accumulate elapsed time
			const delta = (now - cueState.lastTickTime) / 1000;
			cueState.accumulatedElapsed += delta;
			cueState.lastTickTime = now;
		}
	} else {
		// Timer is paused or stopped, just update last tick time
		cueState.lastTickTime = null;
		return;
	}

	const elapsed = cueState.accumulatedElapsed;

	// Check each cue percentage
	for (let i = 0; i < CUE_PERCENTAGES.length; i++) {
		if (cueState.firedCues.has(i)) continue; // Already fired

		const cueTime = cueState.exerciseDuration * CUE_PERCENTAGES[i];
		if (elapsed >= cueTime) {
			cueState.firedCues.add(i);
			const message = getCueMessage(
				i,
				cueState.exerciseName,
				cueState.goal,
				cueState.level,
			);
			c.localEvent(message, true, false);
		}
	}
}
const draft = byId<HTMLTextAreaElement>("message");
const c = new Conversation(
	async (request: RequestData, signal: AbortSignal): Promise<Result> => {
		const controller = new AbortController(),
			abort = () => controller.abort();
		signal.addEventListener("abort", abort, { once: true });
		const timeout = setTimeout(
			abort,
			request.provider === "claude-cli" ? 85000 : 48000,
		);
		try {
			const response = await fetch("/api/turn", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Local-Token": config!.token,
				},
				body: JSON.stringify(request),
				signal: controller.signal,
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Request failed.");
			return data;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError")
				throw new Error(
					"Request cancelled or timed out. Retry when ready.",
				);
			throw error;
		} finally {
			clearTimeout(timeout);
			signal.removeEventListener("abort", abort);
		}
	},
	render,
	() => [
		...(paused ? ["Preview is currently paused."] : []),
		...timers
			.list()
			.map(
				(t) =>
					`Simulated timer ${t.id} (${t.label}): ${t.status}, ${Math.ceil(t.remaining)} of ${t.seconds} seconds remaining.`,
			),
	],
);
function makeNav() {
	return createRunNav(
		{
			index: () =>
				c.document.screens.findIndex(
					(s) => s.key === c.document.cursor,
				),
			stepCount: () => c.document.screens.length,
			isConsumed: (index) =>
				c.document.screens[index]?.key.startsWith("rest") ?? false,
			awaiting: () => false,
			leave: (from) => {
				if (c.pending) c.cancel("interrupted");
				const fromKey = c.document.screens[from]?.key ?? "";
				if (/^exercise\d+$/.test(fromKey)) {
					const timerId = `exerciseTimer${fromKey.replace("exercise", "")}`;
					if (timers.list().find((timer) => timer.id === timerId)?.status === "running") {
						timers.pause(timerId);
						previousTimers.set(timerId, timers.list().find((timer) => timer.id === timerId)!);
					}
					// Clean up cue state when leaving an exercise
					cleanupCueState(fromKey);
				}
			},
			land: (from, to) => {
				c.document.move(to);
				c.localEvent(
					to < from
						? activityClientEvents.wentBack(
								`step ${from + 1}`,
								`step ${to + 1}`,
							)
						: activityClientEvents.nowOnStep(
								`step ${to + 1} of ${c.document.screens.length}`,
							),
				);
			},
			phase: () => {},
			finish: () =>
				c.localEvent(
					"Reached the final screen. This is not evidence of physical completion.",
				),
		},
		{ outMs: 30, inMs: 30 },
	);
}
let nav = makeNav();
function send(text: string) {
	if (!config) return;
	const provider = config.providers.find((p) => p.id === c.provider)!;
	if (!provider.enabled || (c.provider !== "mock" && !c.consent)) {
		c.error = "Set up this provider and agree to usage, or select Mock.";
		render();
		return;
	}
	if (paused) {
		c.error = "Resume the preview before sending.";
		render();
		return;
	}
	const f = byId<HTMLSelectElement>("fault");
	const fault = f.value as RequestData["fault"];
	f.value = "none";
	void c.send(text, fault);
}
function syncTimers() {
	if (lastClear !== c.document.clearVersion) {
		nav.dispose();
		nav = makeNav();
		timers.forget();
		previousTimers.clear();
		selections = {
			goal: [],
			training: [],
			level: [],
			limitations: ["None"],
			focus: [],
		};
		exerciseStatuses = {};
		calorieEstimate = undefined;
		autoplay = false;
		lastClear = c.document.clearVersion;
		// Clean up all cue states on clear
		cueStates.clear();
	}
	const ids = new Set<string>();
	const visit = (node: StatementNode) => {
		if (node.name === "Timer") {
			ids.add(node.key);
			timers.ensure(node.key, {
				label: String(node.props.label),
				seconds: Number(node.props.seconds),
			});
		}
		const children = node.props.children ?? node.props.items;
		if (Array.isArray(children))
			for (const child of children as StatementNode[]) visit(child);
	};
	for (const s of c.document.screens)
		for (const node of s.props.children as StatementNode[]) visit(node);
	for (const t of timers.list())
		if (!ids.has(t.id)) {
			timers.forget(t.id);
			previousTimers.delete(t.id);
			// Clean up cue state for removed timers
			const exerciseId = t.id.replace("Timer", "");
			cleanupCueState(exerciseId);
		}
}
function finishExercise(id: string, isLast: boolean, message?: string) {
	const timerId = `exerciseTimer${id.replace("exercise", "")}`;
	const timer = timers.list().find((entry) => entry.id === timerId);
	if (timer?.status === "running") {
		timers.pause(timerId);
		previousTimers.set(
			timerId,
			timers.list().find((entry) => entry.id === timerId)!,
		);
	}
	// Don't mark timer as done - just pause it to preserve remaining time
	setExerciseStatus(id, "completed");
	// Clean up cue state when exercise is finished
	cleanupCueState(id);
	if (isLast) {
		const finishIndex = c.document.screens.findIndex(
			(screen) => screen.key === "finish",
		);
		if (finishIndex >= 0) c.document.move(finishIndex);
	} else if (autoplay) {
		const restIndex = c.document.screens.findIndex(
			(screen) => screen.key === `rest${id.replace("exercise", "")}`,
		);
		if (restIndex >= 0) c.document.move(restIndex);
	}
	c.localEvent(
		message ??
			(isLast
				? "Workout complete. Your session summary is ready."
			: autoplay
				? "Exercise complete. Take 15 seconds to rest and recover."
				: "Exercise complete. Press Next when you're ready for the next exercise."),
		true,
		false,
	);
}
function tick() {
	const snapshot = timers.list();
	for (const entry of snapshot) {
		const before = previousTimers.get(entry.id);
		previousTimers.set(entry.id, { ...entry });
		if (before && before.status !== "done" && entry.status === "done") {
			if (/^exerciseTimer\d+$/.test(entry.id)) {
				const id = entry.id.replace("Timer", "");
				const exerciseCount = c.document.screens.filter((screen) =>
					/^exercise\d+$/.test(screen.key),
				).length;
				if (c.document.cursor === id && autoplay) {
					finishExercise(
						id,
						id === `exercise${exerciseCount}`,
						`${activityClientEvents.finishedTimer(entry.label)} ${id === `exercise${exerciseCount}` ? "Workout complete." : "Rest & Recover for 15 seconds."}`,
					);
				} else {
					setExerciseStatus(id, "completed");
					c.localEvent(
						`${activityClientEvents.finishedTimer(entry.label)}${c.document.cursor === id ? " Press Next when you're ready to continue." : ""}`,
						true,
					false,
					);
				}
			} else if (
				/^restTimer\d+$/.test(entry.id) &&
				c.document.cursor === entry.id.replace("Timer", "")
			) {
				const restNumber = Number(c.document.cursor.replace("rest", ""));
				const nextIndex = c.document.screens.findIndex(
					(screen) => screen.key === `exercise${restNumber + 1}`,
				);
				if (nextIndex >= 0) c.document.move(nextIndex);
				c.localEvent("Rest complete. Starting the next exercise.", true, false);
			} else
				c.localEvent(
					activityClientEvents.finishedTimer(entry.label),
					true,
					false,
				);
		}
		// Handle timer reset: if timer goes from done back to stopped, reset exercise status
		if (before && before.status === "done" && entry.status === "stopped") {
			if (/^exerciseTimer\d+$/.test(entry.id)) {
				const exerciseId = entry.id.replace("Timer", "");
				setExerciseStatus(exerciseId, "active");
			}
		}
		// Check and fire motivational cues for running exercise timers
		if (/^exerciseTimer\d+$/.test(entry.id) && entry.status === "running") {
			const exerciseId = entry.id.replace("Timer", "");
			checkAndFireCues(exerciseId, entry.id);
		}
	}
	updates.forEach((fn) => fn());
}
function timerAction(
	id: string,
	action: "start" | "pause" | "reset" | "finish",
) {
	const before = timers.list().find((t) => t.id === id);
	if (!before || paused) return;
	if (action === "start") timers.start(id);
	if (action === "pause") timers.pause(id);
	if (action === "reset") {
		timers.reset(id);
		// When restart is clicked, reset the exercise status to allow finishing again
		if (/^exerciseTimer\d+$/.test(id)) {
			const exerciseId = id.replace("Timer", "");
			setExerciseStatus(exerciseId, "active");
			// Reset cue state so cues can fire again
			cleanupCueState(exerciseId);
		}
	}
	if (action === "finish") timers.finish(id);
	const after = timers.list().find((t) => t.id === id)!;
	previousTimers.set(id, { ...after });
	const event =
		action === "reset"
			? activityClientEvents.resetTimer(after.label, after.seconds)
			: action === "start" && before.status === "stopped"
				? activityClientEvents.startedTimer(after.label, after.seconds)
				: timerTransitionEvent(before, after);
	c.localEvent(event ?? `Simulated ${action} for ${after.label}.`);
	tick();
}
function selectChoice(group: ChoiceGroup, value: string, mode: ChoiceMode) {
	const selected = selections[group];
	if (mode === "single") selections[group] = [value];
	else if (value === "None") selections[group] = ["None"];
	else {
		const withoutNone = selected.filter((item) => item !== "None");
		selections[group] = withoutNone.includes(value)
			? withoutNone.filter((item) => item !== value)
			: [...withoutNone, value];
		if (!selections[group].length) selections[group] = ["None"];
	}
	const display = (key: ChoiceGroup) =>
		selections[key].length
			? selections[key].join(", ")
			: key === "limitations"
				? "None"
				: "Not selected";
	c.document.apply(
		"```openui\n" +
			[
				serializeStatement("summaryGoal", "Keyword", [
					display("goal"),
					"Goal",
				]),
				serializeStatement("summaryTraining", "Keyword", [
					display("training"),
					"Training style",
				]),
				serializeStatement("summaryLevel", "Keyword", [
					display("level"),
					"Fitness level",
				]),
				serializeStatement("summaryLimitations", "Keyword", [
					display("limitations"),
					"Limitations",
				]),
				...(group === "focus"
					? [
							serializeStatement("summaryFocus", "Keyword", [
								display("focus"),
								"Workout focus",
							]),
						]
					: []),
			].join("\n") +
			"\n```",
	);
	const label = group === "training" ? "training style" : group;
	updates.forEach((update) => update());
	c.localEvent(
		value.startsWith("Other —")
			? "Type a short description of this limitation in the message box."
			: `Selected ${value} for ${label}.`,
		false,
	);
}
function setExerciseStatus(id: string, status: ExerciseStatus) {
	exerciseStatuses[id] = status;
	updates.forEach((update) => update());
}
function setAutoplay(value: boolean) {
	autoplay = value;
	updates.forEach((update) => update());
	if (value && /^exercise\d+$/.test(c.document.cursor)) {
		if (exerciseStatuses[c.document.cursor] === "completed") {
			const count = c.document.screens.filter((screen) =>
				/^exercise\d+$/.test(screen.key),
			).length;
			finishExercise(c.document.cursor, c.document.cursor === `exercise${count}`);
			return;
		}
		const timerId = `exerciseTimer${c.document.cursor.replace("exercise", "")}`;
		if (
			timers.list().find((timer) => timer.id === timerId)?.status ===
			"stopped"
		)
			timerAction(timerId, "start");
	}
}
function render() {
	if (config) {
		const selected = config.providers.find((p) => p.id === c.provider)!;
		byId("mode").textContent =
			c.provider === "mock"
				? "MOCK · NO MODEL CALLS"
				: selected.enabled
					? "LIVE WHEN SENT"
					: "SETUP / BLOCKED";
		byId("provider-description").textContent = selected.message;
		byId("consent-wrap").hidden =
			c.provider === "mock" || !selected.enabled;
		byId("consent-label").textContent =
			c.provider === "claude-cli"
				? "Use my subscription quota on Send/Retry; I reviewed the host-policy limits."
				: "Use my API budget on Send/Retry.";
		byId<HTMLInputElement>("consent").checked = c.consent;
		byId<HTMLButtonElement>("send").disabled =
			!selected.enabled ||
			(c.provider !== "mock" && !c.consent) ||
			paused;
		byId("mock-controls").hidden = c.provider !== "mock";
		byId("sample").hidden = c.provider !== "mock";
	}
	byId("send").textContent = c.pending ? "Send update ↗" : "Send ↗";
	byId<HTMLButtonElement>("cancel").disabled = !c.pending;
	byId("pending").hidden = !c.pending;
	byId("status").textContent = c.pending
		? "Thinking… type an update to interrupt"
		: c.error
			? "Needs attention"
			: "Ready when you are";
	byId("error").hidden = !c.error;
	byId("error-message").textContent = c.error;
	const transcript = byId("transcript");
	transcript.replaceChildren();
	if (!c.events.length)
		transcript.append(
			el(
				"p",
				"Start with the wiring fixture, or configure a model after editing your skill. The workout experience is yours to build.",
				"micro",
			),
		);
	for (const event of c.events) {
		if (event.kind === "input" || event.kind === "response") {
			const n = el(
				"div",
				"",
				"message " + (event.kind === "input" ? "user" : "assistant"),
			);
			n.append(
				el("span", event.kind === "input" ? "You" : "Reply", "who"),
				el(
					"p",
					event.text ??
						splitReply(event.result!.turn.reply).prose ??
						"",
				),
			);
			transcript.append(n);
		} else if (event.text) transcript.append(el("p", event.text, "event"));
		else if (event.kind === "interrupted" || event.kind === "cancelled")
			transcript.append(
				el(
					"p",
					event.kind === "interrupted"
						? "Previous reply interrupted. Your messages are kept."
						: "Reply cancelled.",
					"event",
				),
			);
	}
	transcript.scrollTop = transcript.scrollHeight;
	syncTimers();
	const screens = c.document.screens;
	const key = c.document.echo() + String(paused);
	if (autoplay && /^exercise\d+$/.test(c.document.cursor)) {
		const timerId = `exerciseTimer${c.document.cursor.replace("exercise", "")}`;
		if (
			timers.list().find((timer) => timer.id === timerId)?.status ===
			"stopped"
		)
			timerAction(timerId, "start");
	}
	if (/^rest\d+$/.test(c.document.cursor)) {
		const timerId = `restTimer${c.document.cursor.replace("rest", "")}`;
		const timer = timers.list().find((entry) => entry.id === timerId);
		if (timer && timer.status !== "running" && timer.status !== "paused") {
			timers.start(timerId);
			previousTimers.set(timerId, timers.list().find((entry) => entry.id === timerId)!);
		}
	}
	// Initialize cue state when entering an exercise screen
	if (/^exercise\d+$/.test(c.document.cursor)) {
		const exerciseId = c.document.cursor;
		const timerId = `exerciseTimer${exerciseId.replace("exercise", "")}`;
		const timer = timers.list().find((t) => t.id === timerId);
		if (timer && !cueStates.has(exerciseId)) {
			const exerciseName = timer.label;
			const goal = selections.goal[0];
			const level = selections.level[0];
			initializeCueState(exerciseId, exerciseName, timer.seconds, goal, level);
		}
	}
	if (key !== renderKey || !byId("screen").childNodes.length) {
		renderKey = key;
		updates = [];
		const surface = byId("screen");
		surface.replaceChildren();
		const current = c.document.current;
		if (!current) {
			const n = el("div", "", "empty");
			n.append(
				el("p", "AI WORKOUT COACH", "eyebrow"),
				el("h3", "Your workout starts here."),
				el("p", "Type /start-workout to begin your session."),
			);
			surface.append(n);
		} else
			for (const node of current.props.children as StatementNode[])
				if (node.name !== "Cue")
					surface.append(
						renderComponent(node, {
							send,
							timers,
							timerAction,
							finishExercise,
							skipRest: (nextExercise) => {
								const restNumber = c.document.cursor.replace("rest", "");
								const timerId = `restTimer${restNumber}`;
								timers.forget(timerId);
								previousTimers.delete(timerId);
								const nextIndex = c.document.screens.findIndex(
									(screen) => screen.key === nextExercise,
								);
								if (nextIndex >= 0) c.document.move(nextIndex);
								c.localEvent("Rest skipped. Starting the next exercise.", true, false);
							},
							updates,
							paused,
							selections,
							selectChoice,
							exerciseStatuses,
							getCalorieEstimate: () => {
								if (calorieEstimate === undefined)
									calorieEstimate =
										180 + Math.floor(Math.random() * 41);
								return calorieEstimate;
							},
							setExerciseStatus,
							// Live getter: a plain `autoplay,` copies the value at render
							// time, so the toggle read a stale `false` and flipped back.
							get autoplay() {
								return autoplay;
							},
							setAutoplay,
						}),
					);
	}
	byId("navigation").hidden =
		screens.length < 2 ||
		screens.some((screen) =>
			["personalize", "summary"].includes(screen.key),
		);
	const visibleScreens = screens.filter(
		(screen) => autoplay || !screen.key.startsWith("rest"),
	);
	const visibleIndex = visibleScreens.findIndex(
		(screen) => screen.key === c.document.cursor,
	);
	const isFinalScreen = visibleIndex === visibleScreens.length - 1;
	byId("position").textContent = `${visibleIndex + 1} / ${visibleScreens.length}`;
	byId<HTMLButtonElement>("back").disabled = paused || visibleIndex <= 0;
	byId<HTMLButtonElement>("back").hidden = isFinalScreen;
	byId<HTMLButtonElement>("next").disabled = paused;
	byId("next").textContent = isFinalScreen ? "Finish preview" : "Next →";
	byId<HTMLButtonElement>("next").hidden = isFinalScreen;
	byId<HTMLButtonElement>("pause").disabled = !screens.length;
	byId("pause").textContent = paused ? "Resume preview" : "Pause preview";
	byId("paused").hidden = !paused;
	const cues = ((c.document.current?.props.children as StatementNode[]) ?? [])
		.filter((n) => n.name === "Cue")
		.map((n) => String(n.props.text));
	const spoken = byId("spoken");
	spoken.textContent =
		cues.join(" ") ||
		c.document.prose ||
		"Current-screen Cues appear here as text. No audio is produced.";
	spoken.classList.toggle(
		"is-exercise",
		/^exercise\d+$/.test(c.document.cursor),
	);
	byId("state-json").textContent = JSON.stringify(
		{
			ui_state: c.document.echo(),
			client_events: c.clientEvents,
			timers: timers.list(),
		},
		null,
		2,
	);
	byId<HTMLButtonElement>("export").disabled = c.pending || !c.events.length;
}
byId<HTMLFormElement>("composer").addEventListener("submit", (event) => {
	event.preventDefault();
	const text = draft.value.trim();
	if (text) {
		draft.value = "";
		send(text);
	}
});
draft.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
		event.preventDefault();
		byId<HTMLFormElement>("composer").requestSubmit();
	}
});
byId("sample").addEventListener("click", () => send("Load wiring sample"));
byId("cancel").addEventListener("click", () => c.cancel());
byId("retry").addEventListener("click", () => {
	if (!paused) void c.retry();
});
byId("reset").addEventListener("click", () => {
	nav.dispose();
	paused = false;
	pausedTimers = [];
	timers.forget();
	previousTimers.clear();
	draft.value = "";
	c.reset();
});
byId("back").addEventListener("click", () => nav.back());
byId("next").addEventListener("click", () => nav.next());
byId("pause").addEventListener("click", () => {
	paused = !paused;
	if (paused) {
		pausedTimers = timers
			.list()
			.filter((t) => t.status === "running")
			.map((t) => t.id);
		for (const id of pausedTimers) timers.pause(id);
	} else {
		for (const id of pausedTimers) timers.start(id);
		pausedTimers = [];
	}
	c.localEvent(
		paused ? "User paused the preview." : "User resumed the preview.",
	);
	tick();
});
byId<HTMLSelectElement>("provider").addEventListener("change", (event) =>
	c.selectProvider((event.target as HTMLSelectElement).value as Provider),
);
byId<HTMLInputElement>("consent").addEventListener("change", (event) => {
	c.consent = (event.target as HTMLInputElement).checked;
	if (!c.consent) c.cancel();
	render();
});
byId("apply-patch").addEventListener("click", () => {
	try {
		const raw = byId<HTMLTextAreaElement>("patch").value;
		c.document.apply(
			raw.includes("```") ? raw : "```openui\n" + raw + "\n```",
		);
		c.localEvent("Builder applied local OpenUI data: " + raw);
		byId("patch-status").textContent =
			"Patch accepted. This is local fixture evidence, not a model run.";
	} catch {
		byId("patch-status").textContent =
			"Invalid patch. Previous screen kept. Check names, arguments and catalog.";
	}
});
byId("export").addEventListener("click", () => {
	const label = byId<HTMLSelectElement>("run-label").value;
	const payload = {
		format: "aira-workout-run-v1",
		label,
		appVersion: APP_VERSION,
		schemaVersion: SCHEMA_VERSION,
		selectedProvider: c.provider,
		note: byId<HTMLTextAreaElement>("note").value,
		events: c.events,
		state: { ui_state: c.document.echo(), client_events: c.clientEvents },
		timers: timers.list(),
	};
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(redactValue(payload), null, 2)], {
			type: "application/json",
		}),
	);
	const link = el("a");
	link.href = url;
	link.download = label + ".json";
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	byId("export-status").textContent =
		`Downloaded ${label}.json. Review and move it into runs/.`;
});
async function start() {
	render();
	try {
		const response = await fetch("/api/config");
		if (!response.ok) throw new Error();
		config = await response.json();
		const select = byId<HTMLSelectElement>("provider");
		select.replaceChildren();
		for (const p of config!.providers) {
			const option = el(
				"option",
				p.label + (p.enabled ? "" : " · setup / blocked"),
			);
			option.value = p.id;
			select.append(option);
		}
		select.value = "mock";
		select.disabled = false;
		render();
	} catch {
		byId("status").textContent =
			"Could not connect. Restart the local server and reload.";
	}
}
setInterval(tick, 250);
void start();
