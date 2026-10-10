export type WorkoutFocus = "Full Body" | "Upper Body" | "Lower Body" | "Core";
export type WorkoutLevel = "Beginner" | "Intermediate" | "Advanced";
export type BaseExercise = { name: string; duration: number; cue: string };
export type WorkoutExercise = BaseExercise & { target: string };
export type Workout = {
	title: string;
	focus: WorkoutFocus;
	level: WorkoutLevel;
	duration: number;
	restSeconds: number;
	pointsPerExercise: number;
	preview: readonly string[];
	exercises: readonly WorkoutExercise[];
};
type BaseWorkout = {
	focus: WorkoutFocus;
	preview: readonly string[];
	exercises: readonly BaseExercise[];
};

export const workoutFocuses: readonly WorkoutFocus[] = [
	"Full Body",
	"Upper Body",
	"Lower Body",
	"Core",
];
export const workoutLevels: readonly WorkoutLevel[] = [
	"Beginner",
	"Intermediate",
	"Advanced",
];

// Each exercise has its own base duration (Beginner). Levels scale it.
const levelSettings: Record<
	WorkoutLevel,
	{ scale: number; rest: number; points: number }
> = {
	Beginner: { scale: 1, rest: 20, points: 10 },
	Intermediate: { scale: 1.33, rest: 15, points: 15 },
	Advanced: { scale: 1.5, rest: 10, points: 20 },
};

const workouts: Record<WorkoutFocus, BaseWorkout> = {
	"Full Body": {
		focus: "Full Body",
		preview: ["Mobility", "Strength", "Breathing"],
		exercises: [
			{
				name: "Bodyweight Squats",
				duration: 30,
				cue: "Keep your chest tall and move slowly.",
			},
			{
				name: "Push-ups",
				duration: 30,
				cue: "Keep your core steady and move with control.",
			},
			{
				name: "Plank",
				duration: 45,
				cue: "Keep your body long and breathe steadily.",
			},
		],
	},
	"Upper Body": {
		focus: "Upper Body",
		preview: ["Mobility", "Strength", "Control"],
		exercises: [
			{
				name: "Wall Push-ups",
				duration: 30,
				cue: "Keep your hands steady and move at an easy pace.",
			},
			{
				name: "Arm Circles",
				duration: 40,
				cue: "Make small, smooth circles and keep your shoulders relaxed.",
			},
			{
				name: "Seated Reach",
				duration: 30,
				cue: "Reach forward gently, then return with control.",
			},
		],
	},
	"Lower Body": {
		focus: "Lower Body",
		preview: ["Mobility", "Strength", "Balance"],
		exercises: [
			{
				name: "Seated Leg Extensions",
				duration: 30,
				cue: "Extend one leg at a time with an easy, controlled motion.",
			},
			{
				name: "Standing Calf Raises",
				duration: 40,
				cue: "Rise and lower smoothly, using support if you want it.",
			},
			{
				name: "Gentle March",
				duration: 45,
				cue: "Lift each foot a little and keep a relaxed rhythm.",
			},
		],
	},
	Core: {
		focus: "Core",
		preview: ["Balance", "Control", "Breathing"],
		exercises: [
			{
				name: "Seated March",
				duration: 30,
				cue: "Sit comfortably and lift one foot at a time.",
			},
			{
				name: "Standing Side Reach",
				duration: 40,
				cue: "Reach gently to one side, then return to center.",
			},
			{
				name: "Bird Dog Hold",
				duration: 45,
				cue: "Stay balanced and breathe steadily through the hold.",
			},
		],
	},
};

export function getWorkout(
	focus: WorkoutFocus,
	level: WorkoutLevel = "Beginner",
): Workout {
	const base = workouts[focus];
	const s = levelSettings[level];
	const exercises = base.exercises.map((e) => {
		const duration = Math.round((e.duration * s.scale) / 5) * 5;
		return { ...e, duration, target: `${duration} seconds` };
	});
	const total =
		exercises.reduce((sum, e) => sum + e.duration, 0) +
		(exercises.length - 1) * s.rest;
	return {
		...base,
		title: `${level} ${focus} Reset`,
		level,
		exercises,
		restSeconds: s.rest,
		pointsPerExercise: s.points,
		duration: Math.max(1, Math.ceil(total / 60)),
	};
}
