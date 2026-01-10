import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, ImageBackground, ListRenderItem, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useAppStore, type ExerciseKey } from "../state/useAppStore";
import { styles } from "./History.styles";
import { type SessionItem } from "./History.types";

type HighlightKey =
	| "totalReps"
	| "sessions"
	| "topExercise"
	| "avgPerSession"
	| "lastSession"
	| "routines"
	| "avgRoutineReps"
	| "avgRoutineTime";

type HighlightItem = {
	key: HighlightKey;
	label: string;
	value: string;
	subtitle: string;
};

const isExerciseKey = (key: ExerciseKey | null): key is ExerciseKey => key !== null;

const exerciseLabels = (t: (k: string) => string): Record<ExerciseKey, string> => ({
	hammerCurls: t("index.hammerTitle"),
	lateralRaises: t("index.lateralsTitle"),
	pushups: t("index.pushupsTitle"),
	squats: t("index.squatsTitle"),
});

const exerciseMeta: Record<ExerciseKey, { image: number; accent: string }> = {
	hammerCurls: {
		image: require("../../assets/images/exercises/hammerCurls.png"),
		accent: "#F97316",
	},
	lateralRaises: {
		image: require("../../assets/images/exercises/lateralRaisesWoman.png"),
		accent: "#22D3EE",
	},
	squats: {
		image: require("../../assets/images/exercises/squatsWoman.png"),
		accent: "#8B5CF6",
	},
	pushups: {
		image: require("../../assets/images/exercises/pushups.png"),
		accent: "#EF4444",
	},
};

const highlightBackgrounds: Partial<Record<HighlightKey, number>> = {
	totalReps: require("../../assets/images/exercises/total-reps.png"),
	sessions: require("../../assets/images/exercises/hammerCurlsWoman.png"),
	routines: require("../../assets/images/exercises/avg-per-routine.png"),
	avgRoutineReps: require("../../assets/images/exercises/avg-reps-routine.png"),
	avgRoutineTime: require("../../assets/images/exercises/squatsWoman.png"),
	avgPerSession: require("../../assets/images/exercises/avg-per-session.png"),
	lastSession: require("../../assets/images/exercises/last-session.png"),
};

const SESSION_MERGE_WINDOW_MS = 5 * 60 * 1000; // Merge entries within 5 minutes as one session

function formatDate(ts: number, locale: string) {
	const date = new Date(ts);
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes === 0) return `${seconds}s`;
	return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function History() {
	const { t, i18n } = useTranslation();
	const exercises = useAppStore((state) => state.exercises);
	const routineSessions = useAppStore((state) => state.routine.sessions);
	const labels = exerciseLabels(t);

	const sessionList = useMemo<SessionItem[]>(() => {
		const items: SessionItem[] = [];
		(Object.keys(exercises) as ExerciseKey[]).forEach((key) => {
			const stats = exercises[key];
			stats.sessions.forEach((session) => items.push({ exercise: key, session }));
		});
		return items.sort((a, b) => b.session.timestamp - a.session.timestamp);
	}, [exercises]);

	const mergedSessions = useMemo<SessionItem[]>(() => {
		const sortedAsc = [...sessionList].sort((a, b) => a.session.timestamp - b.session.timestamp);
		const merged: SessionItem[] = [];

		sortedAsc.forEach((item) => {
			const last = merged.at(-1);
			if (
				last &&
				last.exercise === item.exercise &&
				item.session.timestamp - last.session.timestamp <= SESSION_MERGE_WINDOW_MS
			) {
				last.session = {
					count: last.session.count + item.session.count,
					timestamp: item.session.timestamp,
				};
				return;
			}

			merged.push({ exercise: item.exercise, session: { ...item.session } });
		});

		return merged.sort((a, b) => b.session.timestamp - a.session.timestamp);
	}, [sessionList]);

	const totalReps = useMemo(
		() => mergedSessions.reduce((sum, item) => sum + item.session.count, 0),
		[mergedSessions]
	);

	const totalSessions = mergedSessions.length;
	const totalRoutines = routineSessions.length;

	const avgRoutineReps = useMemo(() => {
		if (routineSessions.length === 0) return 0;
		const total = routineSessions.reduce((sum, r) => sum + r.totalReps, 0);
		return Math.round(total / routineSessions.length);
	}, [routineSessions]);

	const avgRoutineTimeMs = useMemo(() => {
		if (routineSessions.length === 0) return 0;
		const total = routineSessions.reduce((sum, r) => sum + (r.endedAt - r.startedAt), 0);
		return Math.round(total / routineSessions.length);
	}, [routineSessions]);

	const topExerciseKey = useMemo(() => {
		let best: ExerciseKey | null = null;
		let bestTotal = -1;
		(Object.keys(exercises) as ExerciseKey[]).forEach((key) => {
			const total = exercises[key]?.total ?? 0;
			if (total > bestTotal) {
				bestTotal = total;
				best = key;
			}
		});
		return best;
	}, [exercises]);

	let topExerciseMeta: { image: number; accent: string } | null = null;
	let topExerciseTotal = 0;
	if (isExerciseKey(topExerciseKey)) {
		const stats = exercises[topExerciseKey as ExerciseKey];
		topExerciseTotal = stats?.total ?? 0;
		topExerciseMeta = exerciseMeta[topExerciseKey];
	}

	const avgPerSession = totalSessions > 0 ? Math.round(totalReps / totalSessions) : 0;
	const lastSessionTs = mergedSessions[0]?.session.timestamp;

	const highlights = useMemo<HighlightItem[]>(
		() => [
			{
				key: "totalReps",
				label: t("history.highlights.totalReps"),
				value: totalReps.toString(),
				subtitle: t("history.highlights.allExercises"),
			},
			{
				key: "topExercise",
				label: t("history.highlights.topExercise"),
				value: topExerciseKey ? labels[topExerciseKey] : t("history.highlights.none"),
				subtitle: topExerciseKey
					? t("history.highlights.repsCount", { count: topExerciseTotal })
					: t("history.highlights.noData"),
			},
			{
				key: "sessions",
				label: t("history.highlights.sessions"),
				value: totalSessions.toString(),
				subtitle: t("history.highlights.sessionsSub"),
			},
			{
				key: "lastSession",
				label: t("history.highlights.lastSession"),
				value: lastSessionTs
					? formatDate(lastSessionTs, i18n.language)
					: t("history.highlights.none"),
				subtitle: lastSessionTs
					? t("history.highlights.lastSessionSub")
					: t("history.highlights.noData"),
			},
			{
				key: "routines",
				label: t("history.highlights.routines"),
				value: totalRoutines.toString(),
				subtitle: t("history.highlights.routinesSub"),
			},
			{
				key: "avgRoutineReps",
				label: t("history.highlights.avgRoutineReps"),
				value: avgRoutineReps.toString(),
				subtitle: t("history.highlights.avgRoutineRepsSub"),
			},
			{
				key: "avgRoutineTime",
				label: t("history.highlights.avgRoutineTime"),
				value:
					avgRoutineTimeMs > 0 ? formatDuration(avgRoutineTimeMs) : t("history.highlights.none"),
				subtitle: t("history.highlights.avgRoutineTimeSub"),
			},
			{
				key: "avgPerSession",
				label: t("history.highlights.avgPerSession"),
				value: avgPerSession.toString(),
				subtitle: t("history.highlights.avgPerSessionSub"),
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			avgPerSession,
			exercises,
			i18n.language,
			labels,
			lastSessionTs,
			avgRoutineReps,
			avgRoutineTimeMs,
			totalSessions,
			totalRoutines,
			t,
			topExerciseKey,
			totalReps,
		]
	);

	const keyExtractor = useCallback(
		(item: SessionItem, index: number) => `${item.exercise}-${item.session.timestamp}-${index}`,
		[]
	);

	const renderItem = useCallback<ListRenderItem<SessionItem>>(
		({ item }) => (
			<View style={styles.itemCard}>
				<Text style={styles.itemTitle}>{labels[item.exercise]}</Text>
				<Text style={styles.itemText}>
					{t("history.reps", { defaultValue: "Reps" })}: {item.session.count}
				</Text>
				<Text style={styles.itemTimestamp}>
					{formatDate(item.session.timestamp, i18n.language)}
				</Text>
			</View>
		),
		[labels, t, i18n.language]
	);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: t("history.title") }} />
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.exercisesHeading}>
					<Text style={styles.summaryTitle}>{t("history.exercisesHeading.title")}</Text>
					<Text style={styles.summarySubtitle}>{t("history.exercisesHeading.subtitle")}</Text>
				</View>
				<View style={styles.statsGrid}>
					{(Object.keys(exercises) as ExerciseKey[]).map((key) => (
						<View key={key} style={styles.statCard}>
							<ImageBackground
								source={exerciseMeta[key].image}
								style={styles.statImage}
								imageStyle={styles.statImageRadius}
							>
								<View style={styles.statOverlay} />
								<View style={styles.statContent}>
									<Text style={styles.statLabel}>{labels[key]}</Text>
									<Text style={styles.statValue}>{exercises[key]?.total ?? 0}</Text>
								</View>
							</ImageBackground>
						</View>
					))}
				</View>

				<View style={styles.summaryHeading}>
					<Text style={styles.summaryTitle}>{t("history.highlights.sectionTitle")}</Text>
					<Text style={styles.summarySubtitle}>{t("history.highlights.sectionSubtitle")}</Text>
				</View>

				<View style={styles.summaryGrid}>
					{highlights.map((item) => {
						const isTopExercise = item.key === "topExercise";
						const commonStyle = [styles.summaryCard];

						const content = (
							<View style={styles.summaryContent}>
								<View style={styles.summaryHeader}>
									<Text style={styles.summaryLabel}>{item.label}</Text>
								</View>
								<Text style={styles.summaryValue}>{item.value}</Text>
								<Text style={styles.summarySubtext}>{item.subtitle}</Text>
							</View>
						);

						const backgroundImage = !isTopExercise ? highlightBackgrounds[item.key] : undefined;

						if (isTopExercise && topExerciseMeta) {
							const meta = topExerciseMeta as { image: number; accent: string };
							return (
								<ImageBackground
									key={item.key}
									source={meta.image}
									style={commonStyle}
									imageStyle={styles.summaryImageRadius}
								>
									<View style={styles.summaryOverlay} />
									{content}
								</ImageBackground>
							);
						}

						if (backgroundImage) {
							return (
								<ImageBackground
									key={item.key}
									source={backgroundImage}
									style={commonStyle}
									imageStyle={styles.summaryImageRadius}
								>
									<View style={styles.summaryOverlay} />
									{content}
								</ImageBackground>
							);
						}

						return (
							<View key={item.key} style={commonStyle}>
								{content}
							</View>
						);
					})}
				</View>

				<View style={styles.listHeading}>
					<Text style={styles.summaryTitle}>{t("history.combinedHeading.title")}</Text>
					<Text style={styles.summarySubtitle}>{t("history.combinedHeading.subtitle")}</Text>
				</View>
				<FlatList
					data={mergedSessions}
					keyExtractor={keyExtractor}
					contentContainerStyle={styles.listContent}
					renderItem={renderItem}
					scrollEnabled={false}
				/>
			</ScrollView>
		</View>
	);
}
