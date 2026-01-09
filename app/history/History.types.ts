import { ExerciseKey, ExerciseSession } from "../state/useAppStore";

export type SessionItem = {
	exercise: ExerciseKey;
	session: ExerciseSession;
};
