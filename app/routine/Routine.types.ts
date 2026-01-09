import { ExerciseKey } from "../state/useAppStore";

export type RoutineExerciseConfig = {
	key: ExerciseKey;
	icon: string;
	accent: string;
	defaultReps: number;
};
