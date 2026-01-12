import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import i18n, { initialLanguage } from "../i18n";
import reactotron from "../ReactotronConfig";

export const EXERCISE_KEYS = {
	SQUATS: "squats",
	PUSHUPS: "pushups",
	HAMMER_CURLS: "hammerCurls",
	LATERAL_RAISES: "lateralRaises",
} as const;

export type ExerciseKey = (typeof EXERCISE_KEYS)[keyof typeof EXERCISE_KEYS];

export type ExerciseSession = {
	count: number;
	timestamp: number;
};

export type ExerciseStats = {
	total: number;
	sessions: ExerciseSession[];
};

export type RoutinePreference = {
	selected: boolean;
	reps: number;
};

export type RoutinePlanItem = {
	exercise: ExerciseKey;
	target: number;
};

export type RoutineSessionItem = {
	exercise: ExerciseKey;
	target: number;
	completed: number;
};

export type RoutineSession = {
	id: string;
	startedAt: number;
	endedAt: number;
	rounds: number;
	plannedReps: number;
	items: RoutineSessionItem[];
	totalReps: number;
};

export type RoutineState = {
	preferences: Record<ExerciseKey, RoutinePreference>;
	rounds: number;
	currentSession: {
		id: string;
		startedAt: number;
		plan: RoutinePlanItem[];
		items: RoutineSessionItem[];
	} | null;
	sessions: RoutineSession[];
};

type AppState = {
	username: string | null;
	language: string;
	exercises: Record<ExerciseKey, ExerciseStats>;
	hydrated: boolean;
	hasOnboarded: boolean;
	routine: RoutineState;

	setUsername: (name: string) => void;
	setLanguage: (language: string) => void;
	setOnboarded: () => void;
	recordSession: (exercise: ExerciseKey, count: number, timestamp?: number) => void;
	resetExercise: (exercise: ExerciseKey) => void;
	resetAllExercises: () => void;
	resetAllRoutines: () => void;
	saveRoutinePreferences: (prefs: Partial<Record<ExerciseKey, RoutinePreference>>) => void;
	setRoutineRounds: (rounds: number) => void;
	startRoutineSession: (plan: RoutinePlanItem[], startedAt?: number) => void;
	completeRoutineExercise: (exercise: ExerciseKey, completed: number, target: number) => void;
	finishRoutineSession: (endedAt?: number) => string | null;
};
const createDefaultExercises = (): Record<ExerciseKey, ExerciseStats> => ({
	[EXERCISE_KEYS.HAMMER_CURLS]: { total: 0, sessions: [] },
	[EXERCISE_KEYS.LATERAL_RAISES]: { total: 0, sessions: [] },
	[EXERCISE_KEYS.PUSHUPS]: { total: 0, sessions: [] },
	[EXERCISE_KEYS.SQUATS]: { total: 0, sessions: [] },
});

const createDefaultRoutineState = (): RoutineState => ({
	preferences: {
		[EXERCISE_KEYS.HAMMER_CURLS]: { selected: true, reps: 10 },
		[EXERCISE_KEYS.LATERAL_RAISES]: { selected: true, reps: 10 },
		[EXERCISE_KEYS.PUSHUPS]: { selected: true, reps: 10 },
		[EXERCISE_KEYS.SQUATS]: { selected: true, reps: 10 },
	},
	rounds: 1,
	currentSession: null,
	sessions: [],
});

let markHydrated: (() => void) | null = null;

const store = create<AppState>()(
	persist(
		(set, get) => {
			markHydrated = () => set({ hydrated: true });

			return {
				username: null,
				language: initialLanguage,
				exercises: createDefaultExercises(),
				hydrated: false,
				hasOnboarded: false,
				routine: createDefaultRoutineState(),

				setUsername: (name) => set({ username: name, hasOnboarded: true }),
				setLanguage: (language) => {
					i18n.changeLanguage(language);
					set({ language });
				},
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
				resetAllRoutines: () => {
					set({
						routine: {
							...createDefaultRoutineState(),
							preferences: get().routine.preferences,
							rounds: get().routine.rounds,
						},
					});
				},
				saveRoutinePreferences: (prefs) => {
					const next = { ...get().routine.preferences };
					(Object.keys(prefs) as ExerciseKey[]).forEach((key) => {
						const current = next[key];
						next[key] = {
							selected: prefs[key]?.selected ?? current.selected,
							reps: prefs[key]?.reps ?? current.reps,
						};
					});
					set({ routine: { ...get().routine, preferences: next } });
				},
				setRoutineRounds: (rounds) => {
					const normalized = Math.max(1, Math.min(rounds, 10));
					set({ routine: { ...get().routine, rounds: normalized } });
				},
				startRoutineSession: (plan, startedAt = Date.now()) => {
					const id = `${startedAt}`;
					set({
						routine: {
							...get().routine,
							currentSession: {
								id,
								startedAt,
								plan,
								items: [],
							},
						},
					});
				},
				completeRoutineExercise: (exercise, completed, target) => {
					const current = get().routine.currentSession;
					if (!current) return;
					const clampedCompleted = Math.max(0, Math.min(target, completed));
					const items = [...current.items, { exercise, target, completed: clampedCompleted }];
					set({
						routine: {
							...get().routine,
							currentSession: { ...current, items },
						},
					});
				},
				finishRoutineSession: (endedAt = Date.now()) => {
					const routineState = get().routine;
					const current = routineState.currentSession;
					if (!current) return null;
					const totalReps = current.items.reduce((sum, item) => sum + item.completed, 0);
					const plannedReps = current.plan.reduce((sum, item) => sum + item.target, 0);
					const rounds = routineState.rounds ?? 1;
					const session: RoutineSession = {
						id: current.id,
						startedAt: current.startedAt,
						endedAt,
						rounds,
						plannedReps,
						items: current.items,
						totalReps,
					};
					set({
						routine: {
							preferences: routineState.preferences,
							rounds: routineState.rounds,
							currentSession: null,
							sessions: [session, ...routineState.sessions],
						},
					});
					return session.id;
				},
			};
		},
		{
			name: "movement-app-store",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: (state) => ({
				username: state.username,
				language: state.language,
				exercises: state.exercises,
				hasOnboarded: state.hasOnboarded,
				routine: state.routine,
			}),
			onRehydrateStorage: () => {
				return (state, error) => {
					if (error) {
						console.warn("persist rehydrate error", error);
					} else {
						console.log("persist rehydrate ok", state);
					}
					if (state?.language) {
						i18n.changeLanguage(state.language);
					}
					markHydrated?.();
				};
			},
		}
	)
);

if (__DEV__ && reactotron) {
	store.subscribe((state) => {
		reactotron?.display?.({
			name: "useAppStore",
			value: state,
			preview: `user=${state.username ?? "-"} lang=${state.language}`,
		});
	});
}

export const useAppStore = store;
