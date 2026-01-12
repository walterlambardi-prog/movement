import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ExerciseKey, RoutinePreference, useAppStore } from "../state/useAppStore";
import { DEFAULT_ROUTINE_TARGET } from "./config";
import { styles } from "./Routine.styles";
import { RoutineExerciseConfig } from "./Routine.types";

const EXERCISES: RoutineExerciseConfig[] = [
	{
		key: "squats",
		icon: "barbell-outline",
		accent: "#8B5CF6",
		defaultReps: 10,
		image: require("../../assets/images/exercises/squats.png"),
	},
	{
		key: "pushups",
		icon: "fitness-outline",
		accent: "#FF6B6B",
		defaultReps: 10,
		image: require("../../assets/images/exercises/pushups.png"),
	},
	{
		key: "hammerCurls",
		icon: "hand-right-outline",
		accent: "#F97316",
		defaultReps: 10,
		image: require("../../assets/images/exercises/hammerCurls.png"),
	},
	{
		key: "lateralRaises",
		icon: "body-outline",
		accent: "#22D3EE",
		defaultReps: 10,
		image: require("../../assets/images/exercises/lateralRaises.png"),
	},
];

const clampReps = (value: number) => Math.max(1, Math.min(200, value));
const clampRounds = (value: number) => Math.max(1, Math.min(10, value));

type ExerciseState = Record<ExerciseKey, { selected: boolean; reps: number }>;

const fromPreferences = (
	prefs: Record<ExerciseKey, RoutinePreference> | null,
	fallBack?: ExerciseState
): ExerciseState => {
	if (!prefs && fallBack) return fallBack;
	return EXERCISES.reduce((acc, item) => {
		const pref = prefs?.[item.key];
		acc[item.key] = {
			selected: pref?.selected ?? true,
			reps: pref?.reps ?? item.defaultReps,
		};
		return acc;
	}, {} as ExerciseState);
};

export default function RoutineBuilder() {
	const { t } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const routinePrefs = useAppStore((s) => s.routine.preferences);
	const routineRounds = useAppStore((s) => s.routine.rounds);
	const saveRoutinePreferences = useAppStore((s) => s.saveRoutinePreferences);
	const setRoutineRounds = useAppStore((s) => s.setRoutineRounds);
	const startRoutineSession = useAppStore((s) => s.startRoutineSession);
	const [state, setState] = useState<ExerciseState>(fromPreferences(routinePrefs));
	const [rounds, setRounds] = useState(routineRounds || 1);
	const pendingPrefsRef = useRef<Partial<Record<ExerciseKey, RoutinePreference>>>({});

	useEffect(() => {
		setState((prev) => fromPreferences(routinePrefs, prev));
	}, [routinePrefs]);

	useEffect(() => {
		if (routineRounds && routineRounds !== rounds) {
			setRounds(routineRounds);
		}
	}, [routineRounds, rounds]);

	const selectedExercises = useMemo(
		() => EXERCISES.filter((item) => state[item.key]?.selected),
		[state]
	);

	const selectedCount = selectedExercises.length;
	const totalTargetsSingle = selectedExercises.reduce((sum, item) => sum + state[item.key].reps, 0);
	const totalTargets = totalTargetsSingle * rounds;

	const toggleSelect = (key: ExerciseKey) => {
		setState((prev) => {
			const nextSelected = !prev[key].selected;
			pendingPrefsRef.current = {
				...pendingPrefsRef.current,
				[key]: { selected: nextSelected, reps: prev[key].reps },
			};
			return {
				...prev,
				[key]: {
					...prev[key],
					selected: nextSelected,
				},
			};
		});
	};

	const changeReps = (key: ExerciseKey, delta: number) => {
		setState((prev) => {
			const nextReps = clampReps(prev[key].reps + delta);
			pendingPrefsRef.current = {
				...pendingPrefsRef.current,
				[key]: { selected: prev[key].selected, reps: nextReps },
			};
			return {
				...prev,
				[key]: {
					...prev[key],
					reps: nextReps,
				},
			};
		});
	};

	const changeRounds = (delta: number) => {
		setRounds((prev) => {
			const next = clampRounds(prev + delta);
			setRoutineRounds(next);
			return next;
		});
	};

	useEffect(() => {
		const pending = pendingPrefsRef.current;
		if (Object.keys(pending).length > 0) {
			saveRoutinePreferences(pending);
			pendingPrefsRef.current = {};
		}
	}, [state, saveRoutinePreferences]);

	const handleStart = () => {
		if (selectedExercises.length === 0) return;

		const repeated = Array.from({ length: rounds }).flatMap(() => selectedExercises);
		const sequence = repeated.map((item) => item.key);
		const first = sequence[0];
		const next = sequence[1];
		const routineExercises = sequence.join(",");
		const targets = selectedExercises
			.map((item) => `${item.key}:${state[item.key].reps}`)
			.join(",");
		const plan = repeated.map((item) => ({
			exercise: item.key,
			target: state[item.key].reps,
		}));
		const startedAt = Date.now();
		startRoutineSession(plan, startedAt);

		router.push({
			pathname: `/${first}`,
			params: {
				routine: "true",
				routineExercises,
				targets,
				targetReps: state[first].reps.toString(),
				startAt: startedAt.toString(),
				...(next ? { nextExercise: next } : {}),
			},
		});
	};

	const isDisabled = selectedExercises.length === 0;

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					title: t("routineBuilder.title"),
					headerTintColor: "#E2E8F0",
					headerStyle: { backgroundColor: "#0A0F2C" },
				}}
			/>

			<ScrollView
				contentContainerStyle={[styles.screenContent, { paddingBottom: 140 + insets.bottom }]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<Text style={styles.title}>{t("routineBuilder.title")}</Text>
					<Text style={styles.subtitle}>{t("routineBuilder.subtitle")}</Text>
				</View>

				<View style={styles.roundsRow}>
					<View>
						<Text style={styles.roundsLabel}>{t("routineBuilder.roundsLabel")}</Text>
						<Text style={styles.roundsHint}>{t("routineBuilder.roundsHint")}</Text>
					</View>
					<View style={styles.cardFooter}>
						<TouchableOpacity style={styles.circleButton} onPress={() => changeRounds(-1)}>
							<Text style={styles.circleButtonText}>-</Text>
						</TouchableOpacity>
						<Text style={styles.roundsValue}>{rounds}</Text>
						<TouchableOpacity style={styles.circleButton} onPress={() => changeRounds(1)}>
							<Text style={styles.circleButtonText}>+</Text>
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.list}>
					{EXERCISES.map((item) => {
						const exerciseState = state[item.key];
						const isSelected = exerciseState.selected;
						return (
							<View key={item.key} style={styles.card}>
								<ImageBackground
									source={item.image}
									style={styles.cardBackground}
									imageStyle={styles.cardImage}
								>
									<View style={[styles.cardOverlay, !isSelected && styles.cardOverlayDisabled]} />
									<View style={styles.selectButtonContainer}>
										<TouchableOpacity
											style={[styles.selectButton, !isSelected && styles.selectButtonOff]}
											onPress={() => toggleSelect(item.key)}
										>
											<Ionicons
												name={(isSelected ? "checkmark-circle" : "ellipse-outline") as never}
												size={18}
												color={isSelected ? "#10B981" : "#E2E8F0"}
											/>
											<Text style={styles.selectButtonText}>
												{isSelected ? t("routineBuilder.deselect") : t("routineBuilder.select")}
											</Text>
										</TouchableOpacity>
									</View>

									<View style={styles.cardContent}>
										<View style={styles.cardBody}>
											<Text style={styles.cardTitle}>{t(`${item.key}.title` as const)}</Text>
										</View>

										<View style={styles.cardFooter}>
											<TouchableOpacity
												style={[styles.circleButton, !isSelected && styles.disabled]}
												onPress={() => changeReps(item.key, -1)}
												disabled={!isSelected}
											>
												<Text style={styles.circleButtonText}>-</Text>
											</TouchableOpacity>
											<Text style={styles.count}>{exerciseState.reps}</Text>
											<TouchableOpacity
												style={[styles.circleButton, !isSelected && styles.disabled]}
												onPress={() => changeReps(item.key, 1)}
												disabled={!isSelected}
											>
												<Text style={styles.circleButtonText}>+</Text>
											</TouchableOpacity>
										</View>
									</View>
								</ImageBackground>
							</View>
						);
					})}
				</View>
			</ScrollView>

			<View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
				<View style={styles.bottomMeta}>
					<Text style={styles.selectionText}>
						{t("routineBuilder.selection", { count: selectedCount, total: EXERCISES.length })}
					</Text>
					<Text style={styles.selectionText}>
						{t("routineBuilder.totalReps", { count: totalTargets || DEFAULT_ROUTINE_TARGET })}
					</Text>
				</View>
				<TouchableOpacity
					style={[styles.startButton, isDisabled && styles.disabled]}
					onPress={handleStart}
					disabled={isDisabled}
				>
					<Text style={styles.startText}>{t("routineBuilder.start")}</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
