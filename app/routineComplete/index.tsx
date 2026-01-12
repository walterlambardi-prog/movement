import { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppStore } from "../state/useAppStore";
import { styles } from "./RoutineComplete.styles";
import { type RoutineCompleteParams, type RoutineSummary } from "./RoutineComplete.types";

const formatDuration = (ms: number) => {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function RoutineComplete() {
	const { t } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { sessionId } = useLocalSearchParams<RoutineCompleteParams>();
	const sessions = useAppStore((s) => s.routine.sessions);

	const summary = useMemo<RoutineSummary | null>(() => {
		const session = sessionId
			? sessions.find((s) => s.id === sessionId)
			: sessions.length > 0
				? sessions[0]
				: null;
		if (!session) return null;
		const durationMs = session.endedAt - session.startedAt;
		const exerciseCount = session.items.length;
		const avgRepsPerExercise = exerciseCount > 0 ? session.totalReps / exerciseCount : 0;
		const minutes = Math.max(1 / 60, durationMs / 60000);
		const repsPerMinute = session.totalReps / minutes;
		const bestItem = session.items.reduce<{
			completed: number;
			target: number;
			exercise: string;
		} | null>((acc, item) => {
			if (!acc || item.completed > acc.completed) return { ...item };
			return acc;
		}, null);
		return {
			session,
			durationMs,
			avgRepsPerExercise,
			exerciseCount,
			repsPerMinute,
			bestExercise: bestItem
				? {
						exercise: bestItem.exercise,
						completed: bestItem.completed,
						target: bestItem.target,
					}
				: undefined,
		};
	}, [sessionId, sessions]);

	if (!summary) {
		return (
			<View style={[styles.container, { paddingTop: insets.top + 40 }]}>
				<Text style={styles.title}>{t("routineComplete.emptyTitle")}</Text>
				<Text style={styles.subtitle}>{t("routineComplete.emptySubtitle")}</Text>
				<View style={styles.buttonRow}>
					<TouchableOpacity style={styles.button} onPress={() => router.replace("/")}>
						<Text style={styles.buttonText}>{t("routineComplete.backHome")}</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	const { session, durationMs, avgRepsPerExercise, exerciseCount, repsPerMinute, bestExercise } =
		summary;

	return (
		<View style={[styles.container, { paddingTop: insets.top + 12 }]}>
			<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
				<View style={styles.header}>
					<Text style={styles.title}>{t("routineComplete.title")}</Text>
					<Text style={styles.subtitle}>{t("routineComplete.subtitle")}</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>{t("routineComplete.highlightTitle")}</Text>
					<Text style={styles.statHighlight}>{session.totalReps}</Text>
					<Text style={styles.statLabel}>{t("routineComplete.totalReps")}</Text>
				</View>

				<View style={styles.card}>
					<View style={styles.row}>
						<Text style={styles.label}>{t("routineComplete.exercisesDone")}</Text>
						<Text style={styles.value}>{exerciseCount}</Text>
					</View>
					<View style={styles.row}>
						<Text style={styles.label}>{t("routineComplete.rounds")}</Text>
						<Text style={styles.value}>{session.rounds}</Text>
					</View>
					<View style={styles.row}>
						<Text style={styles.label}>{t("routineComplete.duration")}</Text>
						<Text style={styles.value}>{formatDuration(durationMs)}</Text>
					</View>
					<View style={styles.row}>
						<Text style={styles.label}>{t("routineComplete.avgPerExercise")}</Text>
						<Text style={styles.value}>{avgRepsPerExercise.toFixed(1)}</Text>
					</View>
					<View style={styles.row}>
						<Text style={styles.label}>{t("routineComplete.repsPerMinute")}</Text>
						<Text style={styles.value}>{Math.round(repsPerMinute)}</Text>
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>{t("routineComplete.detailsTitle")}</Text>
					<View style={styles.pillRow}>
						<View style={styles.pill}>
							<Text style={styles.pillText}>
								{t("routineComplete.planned", { planned: session.plannedReps })}
							</Text>
						</View>
						<View style={styles.pill}>
							<Text style={styles.pillText}>
								{t("routineComplete.durationLabel", { time: formatDuration(durationMs) })}
							</Text>
						</View>
						<View style={styles.pill}>
							<Text style={styles.pillText}>
								{t("routineComplete.roundsLabel", { rounds: session.rounds })}
							</Text>
						</View>
					</View>
					{bestExercise ? (
						<View style={styles.row}>
							<Text style={styles.label}>{t("routineComplete.bestExercise")}</Text>
							<Text style={styles.value}>
								{bestExercise.exercise} • {bestExercise.completed}/{bestExercise.target}
							</Text>
						</View>
					) : null}
				</View>

				<View style={styles.buttonRow}>
					<TouchableOpacity style={styles.button} onPress={() => router.replace("/history")}>
						<Text style={styles.buttonText}>{t("routineComplete.viewHistory")}</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.button, styles.buttonSecondary]}
						onPress={() => router.replace("/")}
					>
						<Text style={styles.buttonText}>{t("routineComplete.backHome")}</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	);
}
