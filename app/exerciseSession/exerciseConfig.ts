import { ExerciseTheme } from "./ExerciseSession.types";
import { EXERCISE_KEYS, ExerciseKey } from "../state/useAppStore";

export const EXERCISE_THEMES: Record<ExerciseKey, ExerciseTheme> = {
	[EXERCISE_KEYS.HAMMER_CURLS]: {
		accent: "#F97316",
		lineColor: "#6C63FF",
		circleColor: "#FFC107",
		lineWidth: 12,
	},
	[EXERCISE_KEYS.LATERAL_RAISES]: {
		accent: "#22D3EE",
		lineColor: "#00B8D4",
		circleColor: "#FFC107",
		lineWidth: 12,
	},
	[EXERCISE_KEYS.PUSHUPS]: {
		accent: "#FF6B6B",
		lineColor: "#FF6B6B",
		circleColor: "#FFC107",
		lineWidth: 22,
	},
	[EXERCISE_KEYS.SQUATS]: {
		accent: "#4CAF50",
		lineColor: "#4CAF50",
		circleColor: "#FFC107",
		lineWidth: 12,
	},
};
