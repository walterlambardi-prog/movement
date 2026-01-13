import { useEffect, useMemo, useRef } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Confetti, type ConfettiMethods } from "react-native-fast-confetti";

import { useAppStore, type ExerciseKey } from "../state/useAppStore";
import { styles } from "./RoutineComplete.styles";
import { type RoutineCompleteParams, type RoutineSummary } from "./RoutineComplete.types";

const formatDuration = (ms: number) => {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const aggregateExerciseStats = (items: RoutineSummary["session"]["items"]) => {
	const acc: Partial<Record<ExerciseKey, { completed: number; target: number }>> = {};
	items.forEach((item) => {
		const current = acc[item.exercise] ?? { completed: 0, target: 0 };
		acc[item.exercise] = {
			completed: current.completed + item.completed,
			target: current.target + item.target,
		};
	});
	return acc;
};

const exerciseMeta: Record<ExerciseKey, { image: number; accent: string; labelKey: string }> = {
	hammerCurls: {
		image: require("../../assets/images/exercises/hammerCurls.png"),
		accent: "#F97316",
		labelKey: "index.hammerTitle",
	},
	lateralRaises: {
		image: require("../../assets/images/exercises/lateralRaisesWoman.png"),
		accent: "#22D3EE",
		labelKey: "index.lateralsTitle",
	},
	pushups: {
		image: require("../../assets/images/exercises/pushups.png"),
		accent: "#EF4444",
		labelKey: "index.pushupsTitle",
	},
	squats: {
		image: require("../../assets/images/exercises/squatsWoman.png"),
		accent: "#8B5CF6",
		labelKey: "index.squatsTitle",
	},
};

const getExerciseLabel = (
	exercise: ExerciseKey,
	t: (k: string, opts?: Record<string, unknown>) => string
) => t(exerciseMeta[exercise].labelKey);

type DetailTag = {
	key: string;
	label: string;
	icon: "target" | "check-circle" | "repeat" | "clock" | "bar-chart";
};

export default function RoutineComplete() {
	const { t } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { sessionId, mode } = useLocalSearchParams<RoutineCompleteParams>();
	const sessions = useAppStore((s) => s.routine.sessions);
	const startRoutineSession = useAppStore((s) => s.startRoutineSession);
	const username = useAppStore((s) => s.username);
	const confettiRef = useRef<ConfettiMethods | null>(null);
	const isReviewMode = mode === "review";
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");

	const summary = useMemo<RoutineSummary | null>(() => {
		const session = sessionId
			? sessions.find((s) => s.id === sessionId)
			: sessions.length > 0
				? sessions[0]
				: null;
		if (!session) return null;
		const durationMs = session.endedAt - session.startedAt;
		const aggregated = aggregateExerciseStats(session.items);
		const aggregatedEntries = Object.entries(aggregated).map(([exercise, stats]) => ({
			exercise: exercise as ExerciseKey,
			completed: stats?.completed ?? 0,
			target: stats?.target ?? 0,
		}));
		const avgRepsPerExercise = aggregatedEntries.length
			? session.totalReps / aggregatedEntries.length
			: 0;
		return {
			session,
			durationMs,
			avgRepsPerExercise,
			exerciseCount: session.items.length,
			aggregated: aggregatedEntries,
		};
	}, [sessionId, sessions]);

	const handleRepeat = () => {
		if (!summary) return;
		const { session } = summary;
		if (!session.items.length) return;
		const sequence = session.items.map((item) => item.exercise);
		const targets = session.items.map((item) => `${item.exercise}:${item.target}`).join(",");
		const first = sequence[0];
		const next = sequence[1];
		const plan = session.items.map((item) => ({ exercise: item.exercise, target: item.target }));
		const startedAt = Date.now();
		startRoutineSession(plan, startedAt);

		router.replace({
			pathname: "/[exercise]",
			params: {
				exercise: first,
				routine: "true",
				routineExercises: sequence.join(","),
				targets,
				targetReps: session.items[0].target.toString(),
				startAt: startedAt.toString(),
				stepIndex: "0",
				...(next ? { nextExercise: next } : {}),
			},
		});
	};

	useEffect(() => {
		if (!isReviewMode) {
			confettiRef.current?.restart();
		}
	}, [isReviewMode]);

	const exerciseBreakdown = useMemo(() => {
		if (!summary) return [];
		return summary.aggregated.map((item) => ({
			...item,
			meta: exerciseMeta[item.exercise as ExerciseKey],
			label: getExerciseLabel(item.exercise as ExerciseKey, t),
		}));
	}, [summary, t]);

	const detailTags = useMemo<DetailTag[]>(() => {
		if (!summary) return [];
		const { session, durationMs, exerciseCount } = summary;
		const tags: DetailTag[] = [
			{
				key: "planned",
				label: t("routineComplete.planned", { planned: session.plannedReps }),
				icon: "target" as const,
			},
			{
				key: "duration",
				label: t("routineComplete.durationLabel", { time: formatDuration(durationMs) }),
				icon: "clock" as const,
			},
			{
				key: "exercises",
				label: `${t("routineComplete.exercisesDone")}: ${exerciseCount}`,
				icon: "check-circle" as const,
			},
			{
				key: "rounds",
				label: t("routineComplete.roundsLabel", { rounds: session.rounds }),
				icon: "repeat" as const,
			},
		];
		return tags;
	}, [summary, t]);

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

	const { session } = summary;
	const headerTitle = isReviewMode
		? t("routineComplete.headerReviewTitle", { defaultValue: "Latest routine recap" })
		: t("routineComplete.headerTitle", { defaultValue: "Routine recap" });

	return (
		<>
			<Stack.Screen
				options={{
					headerShown: true,
					title: headerTitle,
					headerTintColor: "#E2E8F0",
					headerStyle: { backgroundColor: "#0A0F2C" },
					headerShadowVisible: false,
				}}
			/>

			<View style={styles.container}>
				{!isReviewMode && (
					<View pointerEvents="none" style={styles.confettiContainer}>
						<Confetti
							ref={confettiRef}
							autoplay={false}
							isInfinite={false}
							count={220}
							fadeOutOnEnd
							colors={["#A5B4FC", "#34D399", "#38BDF8", "#FBBF24", "#F97316"]}
						/>
					</View>
				)}
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.header}>
						<Text style={styles.title}>
							{t("routineComplete.greetingTitle", { name: displayName })}
						</Text>
						<Text style={styles.subtitle}>
							{isReviewMode ? t("routineComplete.lastSubtitle") : t("routineComplete.subtitle")}
						</Text>
					</View>

					<ImageBackground
						source={require("../../assets/images/exercises/last-session.png")}
						style={styles.heroCard}
						imageStyle={styles.heroImage}
					>
						<View style={styles.heroOverlay} />
						<View style={styles.heroContent}>
							<View style={styles.heroBadge}>
								<Feather name="award" size={16} color="#C7D2FE" />
								<Text style={styles.heroBadgeText}>{t("routineComplete.highlightTitle")}</Text>
							</View>
							<View style={styles.heroStats}>
								<View style={styles.heroMetric}>
									<Text style={styles.heroValue}>{session.totalReps}</Text>
									<Text style={styles.heroLabel}>{t("routineComplete.totalReps")}</Text>
								</View>
								<View style={styles.heroDivider} />
								<View style={styles.heroMetric}>
									<Text style={styles.heroValue}>{formatDuration(summary.durationMs)}</Text>
									<Text style={styles.heroLabel}>{t("routineComplete.duration")}</Text>
								</View>
								<View style={styles.heroDivider} />
								<View style={styles.heroMetric}>
									<Text style={styles.heroValue}>{summary.session.rounds}</Text>
									<Text style={styles.heroLabel}>{t("routineComplete.rounds")}</Text>
								</View>
							</View>
						</View>
					</ImageBackground>

					<View style={styles.card}>
						<Text style={styles.sectionTitle}>{t("routineComplete.exercisesDone")}</Text>
						<View style={styles.statsGrid}>
							{exerciseBreakdown.map((item) => (
								<View key={item.exercise} style={styles.statCard}>
									<ImageBackground
										source={item.meta.image}
										style={styles.statImage}
										imageStyle={styles.statImageRadius}
									>
										<View style={styles.statOverlay} />
										<View style={styles.statContent}>
											<Text style={styles.statLabel}>{item.label}</Text>
											<Text style={styles.statValue}>{item.completed}</Text>
										</View>
									</ImageBackground>
								</View>
							))}
						</View>
					</View>

					<ImageBackground
						source={require("../../assets/images/exercises/timer.png")}
						style={styles.detailCard}
						imageStyle={styles.detailImage}
					>
						<View style={styles.detailOverlay} />
						<View style={styles.detailContent}>
							<Text style={styles.sectionTitle}>{t("routineComplete.detailsTitle")}</Text>
							<View style={styles.pillRow}>
								{detailTags.map((pill) => (
									<View key={pill.key} style={styles.pill}>
										<Feather name={pill.icon} size={16} color="#C7D2FE" />
										<Text style={styles.pillText}>{pill.label}</Text>
									</View>
								))}
							</View>
						</View>
					</ImageBackground>

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

					<View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
						<TouchableOpacity style={styles.startButton} onPress={handleRepeat}>
							<Text style={styles.startText}>{t("routineComplete.repeatRoutine")}</Text>
						</TouchableOpacity>
					</View>
				</ScrollView>
			</View>
		</>
	);
}
