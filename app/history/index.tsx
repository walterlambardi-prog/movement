import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, ImageBackground, ListRenderItem, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useAppStore, type ExerciseKey } from "../state/useAppStore";
import { styles } from "./History.styles";
import { type SessionItem } from "./History.types";

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
		image: require("../../assets/images/exercises/lateralRaises.png"),
		accent: "#22D3EE",
	},
	pushups: {
		image: require("../../assets/images/exercises/pushups.png"),
		accent: "#EF4444",
	},
	squats: {
		image: require("../../assets/images/exercises/squats.png"),
		accent: "#8B5CF6",
	},
};

const SESSION_MERGE_WINDOW_MS = 5 * 60 * 1000; // Merge entries within 5 minutes as one session

function formatDate(ts: number, locale: string) {
	const date = new Date(ts);
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default function History() {
	const { t, i18n } = useTranslation();
	const exercises = useAppStore((state) => state.exercises);
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
			const last = merged[merged.length - 1];
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

	console.log("SESSION LIST", sessionList);

	const totalSessions = mergedSessions.length;

	const todayStart = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}, []);

	const todaySessions = useMemo(
		() => mergedSessions.filter((item) => item.session.timestamp >= todayStart),
		[mergedSessions, todayStart]
	);

	const todaySessionsCount = todaySessions.length;

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

	const avgPerSession = totalSessions > 0 ? Math.round(totalReps / totalSessions) : 0;
	const lastSessionTs = mergedSessions[0]?.session.timestamp;

	const highlights = useMemo(
		() => [
			{
				key: "totalReps",
				label: t("history.highlights.totalReps"),
				value: totalReps.toString(),
				subtitle: t("history.highlights.allExercises"),
			},
			{
				key: "sessions",
				label: t("history.highlights.sessions"),
				value: todaySessionsCount.toString(),
				subtitle: t("history.highlights.sessionsSub"),
			},
			{
				key: "topExercise",
				label: t("history.highlights.topExercise"),
				value: topExerciseKey ? labels[topExerciseKey] : t("history.highlights.none"),
				subtitle: topExerciseKey
					? t("history.highlights.repsCount", { count: exercises[topExerciseKey]?.total ?? 0 })
					: t("history.highlights.noData"),
			},
			{
				key: "avgPerSession",
				label: t("history.highlights.avgPerSession"),
				value: avgPerSession.toString(),
				subtitle: t("history.highlights.avgPerSessionSub"),
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
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			avgPerSession,
			exercises,
			i18n.language,
			labels,
			lastSessionTs,
			t,
			topExerciseKey,
			totalReps,
			totalSessions,
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
				<View style={styles.heroCard}>
					<View style={styles.heroBadge}>
						<Ionicons name="time-outline" size={16} color="#22D3EE" />
						<Text style={styles.heroBadgeText}>{t("history.badge")}</Text>
					</View>
					<Text style={styles.heroTitle}>{t("history.title")}</Text>
					<Text style={styles.heroSubtitle}>{t("history.subtitle")}</Text>
				</View>
				<View style={styles.statsGrid}>
					{(Object.keys(exercises) as ExerciseKey[]).map((key) => (
						<View key={key} style={[styles.statCard, { borderColor: exerciseMeta[key].accent }]}>
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

				<View style={styles.summaryGrid}>
					{highlights.map((item) => (
						<View key={item.key} style={styles.summaryCard}>
							<View style={styles.summaryHeader}>
								<Text style={styles.summaryLabel}>{item.label}</Text>
							</View>
							<Text style={styles.summaryValue}>{item.value}</Text>
							<Text style={styles.summarySubtext}>{item.subtitle}</Text>
						</View>
					))}
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
