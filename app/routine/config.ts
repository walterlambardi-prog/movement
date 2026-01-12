import { EXERCISE_KEYS, ExerciseKey } from "../state/useAppStore";

export const ROUTINE_SEQUENCE: ExerciseKey[] = [
	EXERCISE_KEYS.SQUATS,
	EXERCISE_KEYS.PUSHUPS,
	EXERCISE_KEYS.HAMMER_CURLS,
	EXERCISE_KEYS.LATERAL_RAISES,
];

export const DEFAULT_ROUTINE_TARGET = 10;

export function isRoutineExercise(value?: string | null): value is ExerciseKey {
	return typeof value === "string" && (ROUTINE_SEQUENCE as readonly string[]).includes(value);
}

export function getNextRoutineExercise(current: ExerciseKey): ExerciseKey | null {
	const index = ROUTINE_SEQUENCE.indexOf(current);
	if (index === -1 || index >= ROUTINE_SEQUENCE.length - 1) return null;
	return ROUTINE_SEQUENCE[index + 1];
}
