import { OPENUI_LIBRARY } from "./openui-library.js";
import {
	callArgsOf,
	linesById,
	parseDocument,
	reachableStatements,
} from "./parse-document.js";
import {
	isStatementNode,
	type StatementNode,
	type Vocabulary,
} from "./openui-model.js";

const text = (v: unknown) => typeof v === "string" && v.length <= 1200;
const oneOf = (v: unknown, allowed: string[]) =>
	typeof v === "string" && allowed.includes(v);
const optional = (v: unknown, check: (v: unknown) => boolean) =>
	v === undefined || v === null || check(v);
const color = (v: unknown) =>
	typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const children = (v: unknown) =>
	Array.isArray(v) && v.length <= 24 && v.every(isStatementNode);
export const propValidators: Record<
	string,
	(p: Record<string, unknown>) => boolean
> = {
	Screens: (p) =>
		children(p.screens) &&
		(p.screens as StatementNode[]).length <= 12 &&
		(p.screens as StatementNode[]).every((n) => n.name === "Screen") &&
		optional(
			p.cursor,
			(v) =>
				isStatementNode(v) &&
				(p.screens as StatementNode[]).some((s) => s.key === v.key),
		),
	Screen: (p) =>
		children(p.children) &&
		optional(p.seen, (v) => Array.isArray(v) && v.every(text)),
	Text: (p) =>
		text(p.text) &&
		optional(p.variant, (v) =>
			oneOf(v, ["title", "subtitle", "description", "body"]),
		) &&
		optional(p.color, color),
	Image: (p) =>
		typeof p.src === "string" &&
		/^\/images\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/.test(p.src) &&
		typeof p.alt === "string" &&
		p.alt.trim().length > 0 &&
		p.alt.length <= 300 &&
		optional(p.caption, (v) => typeof v === "string" && v.length <= 300),
	ChoiceButtons: (p) =>
		Array.isArray(p.options) &&
		p.options.length > 0 &&
		p.options.length <= 8 &&
		p.options.every(text) &&
		oneOf(p.group, ["goal", "training", "level", "limitations", "focus"]) &&
		oneOf(p.mode, ["single", "multiple"]) &&
		optional(p.disabledOptions, (v) => Array.isArray(v) && v.every(text) && v.every((x) => (p.options as string[]).includes(x))) &&
		optional(p.badges, (v) => Array.isArray(v) && v.length === (p.options as string[]).length && v.every(text)),
	WorkoutPlayer: (p) =>
		Array.isArray(p.exercises) && p.exercises.length > 0 && p.exercises.length <= 4 && p.exercises.every(text) &&
		Number.isInteger(p.index) && Number(p.index) >= 0 && Number(p.index) < p.exercises.length &&
		text(p.name) && text(p.target) && text(p.cue),
	Toggle: (p) => text(p.label) && text(p.description) && oneOf(p.stateKey, ["autoplay"]),
	WorkoutControls: (p) => text(p.timerId) && text(p.exerciseId) && typeof p.isLast === "boolean",
	RestControls: (p) => text(p.nextExercise),
	WorkoutLayout: (p) => children(p.children) && (p.children as StatementNode[]).length === 4 &&
		(p.children as StatementNode[]).map((n) => n.name).join(",") === "WorkoutPlayer,Timer,Toggle,WorkoutControls",
	WorkoutComplete: (p) => Array.isArray(p.exercises) && p.exercises.length > 0 && p.exercises.length <= 4 && p.exercises.every(text) && text(p.action),
	Keyword: (p) =>
		text(p.text) && optional(p.caption, text) && optional(p.color, color),
	List: (p) =>
		children(p.items) &&
		(p.items as StatementNode[]).every((n) => n.name === "ListItem"),
	ListItem: (p) =>
		text(p.text) &&
		optional(p.marker, (v) =>
			oneOf(v, ["bullet", "numbered", "plus", "minus"]),
		),
	Alert: (p) => oneOf(p.tone, ["info", "warning", "danger"]) && text(p.text),
	Timer: (p) =>
		text(p.label) &&
		Number.isInteger(p.seconds) &&
		Number(p.seconds) > 0 &&
		Number(p.seconds) <= 3600 &&
		(p.image === undefined || p.image === null) &&
		optional(p.mode, (v) => oneOf(v, ["controls", "display"])),
	Cue: (p) => text(p.text),
	FollowUps: (p) =>
		Array.isArray(p.prompts) &&
		p.prompts.length <= 6 &&
		p.prompts.every(text) &&
		optional(p.requiresGroup, (v) => oneOf(v, ["goal", "training", "level", "limitations", "focus"])) &&
		optional(p.requiresValue, text) &&
		(p.requiresValue === undefined || p.requiresGroup !== undefined),
};
export function validateProgram(
	code: string,
	library: Vocabulary = OPENUI_LIBRARY,
	validators = propValidators,
): StatementNode {
	if (code.length > 40000 || code.split("\n").length > 600)
		throw new Error("Screen program is full. Export and reset.");
	for (const line of code.split("\n").filter((s) => s.trim())) {
		const call = callArgsOf(line);
		const spec =
			call && Object.hasOwn(library, call.name)
				? library[call.name]
				: undefined;
		if (
			!call ||
			!spec ||
			call.args.length < spec.required ||
			call.args.length > spec.args.length
		)
			throw new Error(
				"Invalid or unsupported OpenUI statement. Check the component catalog.",
			);
	}
	const doc = parseDocument(code, library);
	if (
		doc.dropped ||
		doc.unknown.length ||
		!doc.root ||
		doc.root.name !== "Screens"
	)
		throw new Error("Screen needs a valid root = Screens([...]).");
	const lines = linesById(code);
	for (const name of reachableStatements(code) ?? [])
		if (!lines.has(name))
			throw new Error("A screen references a missing statement.");
	const visited = new Set<string>();
	function check(node: StatementNode, parent = "") {
		if (visited.has(node.key))
			throw new Error("A component has more than one parent.");
		visited.add(node.key);
		if (
			!Object.hasOwn(validators, node.name) ||
			!validators[node.name](node.props)
		)
			throw new Error(`Invalid ${node.name} props.`);
		if (node.name === "Screen" && parent !== "Screens")
			throw new Error("Screen must be inside Screens.");
		if (node.name === "Screens" && parent)
			throw new Error("Screens must be the root.");
		if (node.name === "ListItem" && parent !== "List")
			throw new Error("ListItem must be inside List.");
		const spec = library[node.name];
		if (spec.childArg)
			for (const child of node.props[spec.childArg] as StatementNode[])
				check(child, node.name);
	}
	check(doc.root);
	return doc.root;
}
