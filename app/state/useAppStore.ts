import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ExerciseKey = "hammerCurls" | "lateralRaises" | "pushups" | "squats";

export type ExerciseSession = {
	count: number;
	timestamp: number;
};

export type ExerciseStats = {
	total: number;
	sessions: ExerciseSession[];
};

type AppState = {
	username: string | null;
	language: string;
	exercises: Record<ExerciseKey, ExerciseStats>;
	hydrated: boolean;
	hasOnboarded: boolean;

	setUsername: (name: string) => void;
	setLanguage: (language: string) => void;
	setOnboarded: () => void;
	recordSession: (exercise: ExerciseKey, count: number, timestamp?: number) => void;
	resetExercise: (exercise: ExerciseKey) => void;
	resetAllExercises: () => void;
};
const createDefaultExercises = (): Record<ExerciseKey, ExerciseStats> => ({
	hammerCurls: { total: 0, sessions: [] },
	lateralRaises: { total: 0, sessions: [] },
	pushups: { total: 0, sessions: [] },
	squats: { total: 0, sessions: [] },
});

export const useAppStore = create<AppState>()(
	persist(
		(set, get) => ({
			username: null,
			language: "en",
			exercises: createDefaultExercises(),
			hydrated: false,
			hasOnboarded: false,

			setUsername: (name) => set({ username: name, hasOnboarded: true }),
			setLanguage: (language) => set({ language }),
			setOnboarded: () => set({ hasOnboarded: true }),
			recordSession: (exercise, count, timestamp = Date.now()) => {
				if (count <= 0) return;
				const current = get().exercises[exercise] ?? { total: 0, sessions: [] };
				const updated: ExerciseStats = {
					total: current.total + count,
					sessions: [...current.sessions, { count, timestamp }],
				};
				set({
					exercises: {
						...get().exercises,
						[exercise]: updated,
					},
				});
			},
			resetExercise: (exercise) => {
				set({
					exercises: {
						...get().exercises,
						[exercise]: { total: 0, sessions: [] },
					},
				});
			},
			resetAllExercises: () => {
				set({ exercises: createDefaultExercises() });
			},
		}),
		{
			name: "movement-app-store",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: (state) => ({
				username: state.username,
				language: state.language,
				exercises: state.exercises,
				hasOnboarded: state.hasOnboarded,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) state.hydrated = true;
			},
		}
	)
);
