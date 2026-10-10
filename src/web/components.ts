import { el, button } from "./dom.js";
import type { StatementNode } from "../shared/openui/openui-model.js";
import type { TimerLedger } from "../shared/openui/timer-store.js";
export type ChoiceGroup =
	| "goal"
	| "training"
	| "level"
	| "limitations"
	| "focus";
export type ChoiceMode = "single" | "multiple";
export type ExerciseStatus = "completed" | "skipped" | "active";
export type Context = {
	send: (text: string) => void;
	timers: TimerLedger;
	timerAction: (
		id: string,
		action: "start" | "pause" | "reset" | "finish",
	) => void;
	finishExercise: (id: string, isLast: boolean) => void;
	skipRest: (nextExercise: string) => void;
	updates: (() => void)[];
	paused: boolean;
	selections: Record<ChoiceGroup, string[]>;
	selectChoice: (group: ChoiceGroup, value: string, mode: ChoiceMode) => void;
	exerciseStatuses: Record<string, ExerciseStatus>;
	getCalorieEstimate: () => number;
	setExerciseStatus: (id: string, status: ExerciseStatus) => void;
	autoplay: boolean;
	setAutoplay: (value: boolean) => void;
};

const SVG = "http://www.w3.org/2000/svg";
function svgEl(tag: string, attrs: Record<string, string>) {
	const node = document.createElementNS(SVG, tag);
	for (const [name, value] of Object.entries(attrs))
		node.setAttribute(name, value);
	return node;
}
function stat(value: string, label: string) {
	const item = el("div", "", "card wk-stat");
	item.append(el("strong", value), el("span", label));
	return item;
}

// Trusted DOM ports of the source component signatures; no model-generated code.
export const renderers: Record<
	string,
	(node: StatementNode, context: Context) => HTMLElement
> = {
	Text: ({ props: p }) =>
		el(
			p.variant === "title"
				? "h3"
				: p.variant === "subtitle"
					? "h4"
					: "p",
			String(p.text),
			"block block-" + String(p.variant ?? "body"),
		),
	Image: ({ props: p }) => {
		const figure = el("figure", "", "block");
		const image = document.createElement("img");
		image.src = String(p.src);
		image.alt = String(p.alt);
		image.loading = "lazy";
		figure.append(image);
		if (p.caption) figure.append(el("figcaption", String(p.caption)));
		return figure;
	},
	ChoiceButtons: ({ props: p }, c) => {
		const group = p.group as ChoiceGroup;
		const mode = p.mode as ChoiceMode;
		const row = el("div", "", "row");
		for (const [index, option] of (p.options as string[]).entries()) {
			const badge = (p.badges as string[] | undefined)?.[index];
			const choice = button(badge ? `${option} · ${badge}` : option, () =>
				c.selectChoice(group, option, mode),
			);
			choice.disabled = ((p.disabledOptions ?? []) as string[]).includes(
				option,
			);
			if (badge) choice.setAttribute("aria-label", `${option}, ${badge}`);
			const update = () =>
				choice.setAttribute(
					"aria-pressed",
					String(c.selections[group].includes(option)),
				);
			c.updates.push(update);
			update();
			row.append(choice);
		}
		return row;
	},
	WorkoutPlayer: ({ props: p }, c) => {
		const exercises = p.exercises as string[];
		const index = Number(p.index);
		const n = el("section", "", "block wk-player");

		const header = el("div", "", "wk-header");
		header.append(
			el("span", "WORKOUT PROGRESS", "eyebrow mono"),
			el("span", `${index + 1} OF ${exercises.length}`, "eyebrow mono"),
		);

		const progress = el("div", "", "wk-progress");
		progress.style.setProperty("--steps", String(exercises.length));
		progress.setAttribute("role", "img");
		progress.setAttribute(
			"aria-label",
			`Exercise ${index + 1} of ${exercises.length}`,
		);
		const progressSteps = exercises.map((_, stepIndex) => {
			const step = el("span");
			progress.append(step);
			return { step, stepIndex };
		});
		const updateProgress = () => {
			for (const { step, stepIndex } of progressSteps) {
				const done = c.exerciseStatuses[`exercise${stepIndex + 1}`] === "completed";
				step.className = stepIndex === index ? "is-active" : done ? "is-done" : "";
			}
		};
		c.updates.push(updateProgress);
		updateProgress();

		const heading = el("div", "", "wk-heading");
		heading.append(
			el(
				"p",
				`TARGET · ${String(p.target).toUpperCase()}`,
				"eyebrow mono wk-meta",
			),
			el("h2", String(p.name), "wk-title"),
		);

		const movement = el("div", "", "card wk-movement");
		movement.setAttribute(
			"aria-label",
			`Movement preview for ${String(p.name)}`,
		);
		const svg = svgEl("svg", {
			viewBox: "0 0 240 160",
			width: "224",
			height: "150",
			"aria-hidden": "true",
		});
		svg.append(
			svgEl("line", {
				x1: "18",
				y1: "142",
				x2: "222",
				y2: "142",
				stroke: "#d4d4cc",
				"stroke-width": "2",
				"stroke-dasharray": "4 5",
			}),
		);
		const figure = svgEl("g", {
			stroke: "#18181b",
			"stroke-width": "5",
			"stroke-linecap": "round",
			fill: "none",
		});
		figure.append(
			svgEl("circle", { cx: "120", cy: "38", r: "10", fill: "#18181b" }),
			svgEl("line", { x1: "120", y1: "49", x2: "120", y2: "98" }),
			svgEl("path", {
				d: "M120 60 L91 78 L83 105 M120 60 L149 78 L157 105",
			}),
			svgEl("path", {
				d: "M120 98 L99 121 L98 140 M120 98 L141 121 L142 140",
			}),
			svgEl("animateTransform", {
				attributeName: "transform",
				type: "rotate",
				values: "-2 120 90;2 120 90;-2 120 90",
				dur: "2.4s",
				repeatCount: "indefinite",
			}),
		);
		svg.append(figure);
		movement.append(
			el("span", "● KINEMATIC LOOP", "micro wk-loop-label"),
			svg,
		);

		// The coaching cue is shown once, in the coach panel below the preview.
		n.append(header, progress, heading, movement);
		return n;
	},
	Toggle: ({ props: p }, c) => {
		const group = el("div", "", "toggle");
		const label = el("label", "", "toggle-label");
		const state = el("span");
		const input = el("input", "", "toggle-input");
		input.type = "checkbox";
		input.setAttribute("role", "switch");
		input.addEventListener("change", () => {
			state.textContent = `${String(p.label)}: ${input.checked ? "ON" : "OFF"}`;
			c.setAutoplay(input.checked);
		});
		const update = () => {
			state.textContent = `${String(p.label)}: ${c.autoplay ? "ON" : "OFF"}`;
			input.checked = c.autoplay;
		};
		c.updates.push(update);
		update();
		label.append(input, state);
		group.append(label, el("span", String(p.description), "micro"));
		return group;
	},
	WorkoutControls: ({ props: p }, c) => {
		const row = el("div", "", "wk-controls");
		const timerId = String(p.timerId);
		const current = () =>
			c.timers.list().find((timer) => timer.id === timerId);
		const playPause = button("Play", () =>
			c.timerAction(
				timerId,
				current()?.status === "running" ? "pause" : "start",
			),
		);
		playPause.classList.add("primary");
		const restart = button("Restart", () =>
			c.timerAction(timerId, "reset"),
		);
		const finish = button(p.isLast ? "Finish workout" : "Finish step", () =>
			c.finishExercise(String(p.exerciseId), Boolean(p.isLast)),
		);
		finish.classList.add("success");
		const update = () => {
			const status = current()?.status;
			const exerciseStatus = c.exerciseStatuses[String(p.exerciseId)];
			playPause.textContent =
				status === "running"
					? "Pause"
					: status === "paused"
						? "Resume"
						: "Play";
			// Disable play/pause when exercise is completed
			playPause.disabled = exerciseStatus === "completed";
			const completed = exerciseStatus === "completed";
			finish.textContent = completed && !p.isLast ? "Exercise complete" : p.isLast ? "Finish workout" : "Finish step";
			finish.disabled = completed && !p.isLast;
		};
		c.updates.push(update);
		update();
		const main = el("div", "", "wk-controls-main");
		main.append(playPause, restart);
		row.append(main, finish);
		return row;
	},
	RestControls: ({ props: p }, c) => {
		const row = el("div", "", "row");
		const skip = button("Skip Rest", () =>
			c.skipRest(String(p.nextExercise)),
			"primary",
		);
		row.append(skip);
		return row;
	},
	WorkoutComplete: ({ props: p }, c) => {
		const card = el("section", "", "block card wk-complete");
		const exercises = p.exercises as string[];
		const elapsed = c.timers
			.list()
			.filter((timer) => /^exerciseTimer\d+$/.test(timer.id))
			.reduce(
				(total, timer) => total + timer.seconds - timer.remaining,
				0,
			);
		const minutes = Math.floor(elapsed / 60);
		const seconds = Math.floor(elapsed % 60);

		const stats = el("div", "", "wk-stats");
		stats.append(
			stat(
				`${minutes}:${String(seconds).padStart(2, "0")}`,
				"ACTIVE TIME",
			),
			stat(`~${c.getCalorieEstimate()} kcal`, "CALORIE ESTIMATE"),
			stat("—", "FORM SCORE · NOT MEASURED"),
		);

		const list = el("ol", "", "wk-list");
		for (const [index, name] of exercises.entries()) {
			const status = c.exerciseStatuses[`exercise${index + 1}`];
			const item = el("li", "");
			item.append(
				el("span", `${String(index + 1).padStart(2, "0")}  ${name}`),
				el(
					"span",
					status === "completed"
						? "✓ COMPLETE"
						: status === "skipped"
							? "SKIPPED"
							: "NOT COMPLETED",
					"wk-status" + (status === "completed" ? " is-done" : ""),
				),
			);
			list.append(item);
		}

		const action = button(String(p.action), () => c.send(String(p.action)));
		action.classList.add("primary");
		card.append(
			el("p", "SESSION COMPLETE", "eyebrow mono wk-eyebrow"),
			el("h2", "Workout complete!", "wk-complete-title"),
			el(
				"p",
				"You showed up and moved with intention. Here’s your session summary.",
				"wk-intro",
			),
			stats,
			el("p", "SESSION MOVEMENTS", "eyebrow mono"),
			list,
			el(
				"p",
				"Simulated workout summary. Calories are an estimate; no activity or form assessment is measured.",
				"micro wk-note",
			),
			action,
		);
		return card;
	},
	WorkoutLayout: ({ props: p }, c) => {
		// children order from mock.ts: player, timer, autoplay toggle, controls
		const [player, timer, toggle, controls] = p.children as StatementNode[];
		const layout = el("div", "", "workout-layout");
		layout.append(
			renderComponent(player, c),
			renderComponent(timer, c),
			renderComponent(controls, c),
			renderComponent(toggle, c),
		);
		return layout;
	},
	Keyword: ({ props: p }) => {
		const n = el("div", "", "keyword");
		n.append(el("strong", String(p.text)));
		if (p.caption) n.append(el("p", String(p.caption)));
		return n;
	},
	Alert: ({ props: p }) => el("aside", String(p.text), "block alert"),
	List: ({ props: p }, c) => {
		const n = el("ul", "", "block");
		for (const row of p.items as StatementNode[])
			n.append(renderComponent(row, c));
		return n;
	},
	ListItem: ({ props: p }) => el("li", String(p.text)),
	FollowUps: ({ props: p }, c) => {
		const n = el("div", "", "row");
		for (const text of p.prompts as string[]) {
			const action = button(text, () => c.send(text));
			const update = () => {
				if (p.requiresGroup !== undefined) {
					const selected = c.selections[
						String(p.requiresGroup) as ChoiceGroup
					];
					action.disabled = p.requiresValue === undefined
						? selected.length === 0
						: !selected.includes(String(p.requiresValue));
				}
			};
			if (p.requiresGroup !== undefined) {
				c.updates.push(update);
				update();
			}
			n.append(action);
		}
		return n;
	},
	Timer: ({ key, props: p }, c) => {
		const n = el("section", "", "timer card");
		n.setAttribute("aria-label", String(p.label));
		const value = el("strong", "", "timer-value"),
			status = el("span", "", "micro timer-status"),
			track = el("div", "", "timer-track"),
			bar = el("div", "", "timer-progress");
		const controls = el("div", "", "row");
		const start = button("Start simulation", () =>
			c.timerAction(key, "start"),
		);
		const pause = button("Pause timer", () => c.timerAction(key, "pause"));
		const reset = button("Reset timer", () => c.timerAction(key, "reset"));
		const finish = button("Simulate finish", () =>
			c.timerAction(key, "finish"),
		);
		controls.append(start, pause, reset, finish);
		track.append(bar);
		n.append(value, status, track);
		if (p.mode !== "display")
			n.append(
				controls,
				el("p", "Finishing records a local timer event.", "micro"),
			);
		const update = () => {
			const entry = c.timers.list().find((t) => t.id === key);
			if (!entry) return;
			const seconds = Math.ceil(entry.remaining);
			value.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
			status.textContent =
				entry.status === "running"
					? "RUNNING"
					: entry.status === "paused"
						? "PAUSED"
						: entry.status === "done"
							? "COMPLETE"
							: "READY";
			bar.style.width = `${Math.max(0, Math.min(100, (1 - entry.remaining / entry.seconds) * 100))}%`;
			track.setAttribute("role", "progressbar");
			track.setAttribute("aria-valuemin", "0");
			track.setAttribute("aria-valuemax", String(entry.seconds));
			track.setAttribute(
				"aria-valuenow",
				String(entry.seconds - seconds),
			);
			start.hidden =
				entry.status === "running" || entry.status === "paused";
			start.textContent =
				entry.status === "done"
					? "Restart simulation"
					: "Start simulation";
			pause.hidden =
				entry.status === "stopped" || entry.status === "done";
			pause.textContent =
				entry.status === "paused" ? "Resume timer" : "Pause timer";
			for (const action of [start, pause, reset, finish])
				action.disabled = c.paused;
		};
		c.updates.push(update);
		update();
		return n;
	},
};
export function renderComponent(
	node: StatementNode,
	context: Context,
): HTMLElement {
	if (!Object.hasOwn(renderers, node.name))
		throw new Error("No renderer for " + node.name);
	const n = renderers[node.name](node, context);
	n.dataset.statement = node.key;
	if (
		typeof node.props.color === "string" &&
		/^#[0-9a-fA-F]{6}$/.test(node.props.color)
	)
		n.style.color = node.props.color;
	return n;
}
