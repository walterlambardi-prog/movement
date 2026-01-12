import { RoutineSession, type ExerciseKey } from "../state/useAppStore";

export type RoutineCompleteParams = {
	sessionId?: string;
	mode?: "review";
};

export type RoutineSummary = {
	session: RoutineSession;
	durationMs: number;
	avgRepsPerExercise: number;
	exerciseCount: number;
	bestExercise?: {
		exercise: ExerciseKey;
		completed: number;
		target: number;
	};
	aggregated: Array<{
		exercise: ExerciseKey;
		completed: number;
		target: number;
	}>;
};
