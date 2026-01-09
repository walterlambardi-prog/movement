import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ExerciseKey } from "../state/useAppStore";
import { DEFAULT_ROUTINE_TARGET } from "./config";
import { styles } from "./Routine.styles";
import { RoutineExerciseConfig } from "./Routine.types";

const EXERCISES: RoutineExerciseConfig[] = [
	{ key: "squats", icon: "barbell-outline", accent: "#8B5CF6", defaultReps: 10 },
	{ key: "pushups", icon: "fitness-outline", accent: "#FF6B6B", defaultReps: 10 },
	{ key: "hammerCurls", icon: "hand-right-outline", accent: "#F97316", defaultReps: 10 },
	{ key: "lateralRaises", icon: "body-outline", accent: "#22D3EE", defaultReps: 10 },
];

const clampReps = (value: number) => Math.max(1, Math.min(200, value));

type ExerciseState = Record<ExerciseKey, { selected: boolean; reps: number }>;

const createInitialState = (): ExerciseState =>
	EXERCISES.reduce((acc, item) => {
		acc[item.key] = { selected: true, reps: item.defaultReps };
		return acc;
	}, {} as ExerciseState);

export default function RoutineBuilder() {
	const { t } = useTranslation();
	const router = useRouter();
	const [state, setState] = useState<ExerciseState>(createInitialState);

	const selectedExercises = useMemo(
		() => EXERCISES.filter((item) => state[item.key]?.selected),
		[state]
	);

	const selectedCount = selectedExercises.length;
	const totalTargets = selectedExercises.reduce((sum, item) => sum + state[item.key].reps, 0);

	const toggleSelect = (key: ExerciseKey) => {
		setState((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				selected: !prev[key].selected,
			},
		}));
	};

	const changeReps = (key: ExerciseKey, delta: number) => {
		setState((prev) => ({
			...prev,
			[key]: {
				...prev[key],
				reps: clampReps(prev[key].reps + delta),
			},
		}));
	};

	const handleStart = () => {
		if (selectedExercises.length === 0) return;

		const sequence = selectedExercises.map((item) => item.key);
		const first = sequence[0];
		const next = sequence[1];
		const routineExercises = sequence.join(",");
		const targets = selectedExercises
			.map((item) => `${item.key}:${state[item.key].reps}`)
			.join(",");

		router.push({
			pathname: `/${first}`,
			params: {
				routine: "true",
				routineExercises,
				targets,
				targetReps: state[first].reps.toString(),
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

			<ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					<Text style={styles.title}>{t("routineBuilder.title")}</Text>
					<Text style={styles.subtitle}>{t("routineBuilder.subtitle")}</Text>
				</View>

				<View style={styles.list}>
					{EXERCISES.map((item) => {
						const exerciseState = state[item.key];
						const isSelected = exerciseState.selected;
						return (
							<View key={item.key} style={styles.card}>
								<View style={[styles.iconWrap, { backgroundColor: `${item.accent}22` }]}>
									<Ionicons name={item.icon as never} size={22} color={item.accent} />
								</View>
								<View style={styles.cardText}>
									<Text style={styles.cardTitle}>{t(`${item.key}.title` as const)}</Text>
									<Text style={styles.cardSubtitle}>
										{t("routineBuilder.repsLabel", { count: exerciseState.reps })}
									</Text>
								</View>
								<View style={styles.counterRow}>
									<TouchableOpacity
										style={styles.button}
										onPress={() => changeReps(item.key, -1)}
										disabled={!isSelected}
									>
										<Text style={styles.buttonText}>-</Text>
									</TouchableOpacity>
									<Text style={styles.count}>{exerciseState.reps}</Text>
									<TouchableOpacity
										style={styles.button}
										onPress={() => changeReps(item.key, 1)}
										disabled={!isSelected}
									>
										<Text style={styles.buttonText}>+</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.button, !isSelected && styles.disabled]}
										onPress={() => toggleSelect(item.key)}
									>
										<Text style={styles.buttonText}>
											{isSelected ? t("routineBuilder.deselect") : t("routineBuilder.select")}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						);
					})}
				</View>

				<View style={styles.footer}>
					<Text style={styles.selectionText}>
						{t("routineBuilder.selection", { count: selectedCount, total: EXERCISES.length })}
					</Text>
					<Text style={styles.selectionText}>
						{t("routineBuilder.totalReps", { count: totalTargets || DEFAULT_ROUTINE_TARGET })}
					</Text>
					<TouchableOpacity
						style={[styles.startButton, isDisabled && styles.disabled]}
						onPress={handleStart}
						disabled={isDisabled}
					>
						<Text style={styles.startText}>{t("routineBuilder.start")}</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
}
