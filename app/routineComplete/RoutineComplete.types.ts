import { RoutineSession } from "../state/useAppStore";

export type RoutineCompleteParams = {
	sessionId?: string;
};

export type RoutineSummary = {
	session: RoutineSession;
	durationMs: number;
	avgRepsPerExercise: number;
	exerciseCount: number;
	repsPerMinute: number;
	bestExercise?: {
		exercise: string;
		completed: number;
		target: number;
	};
};
