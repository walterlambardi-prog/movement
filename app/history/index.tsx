import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, ListRenderItem, Text, View } from "react-native";
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
			<View style={styles.content}>
				<Text style={styles.headerTitle}>{t("history.header")}</Text>
				<View style={styles.statsGrid}>
					{(Object.keys(exercises) as ExerciseKey[]).map((key) => (
						<View key={key} style={styles.statCard}>
							<Text style={styles.statLabel}>{labels[key]}</Text>
							<Text style={styles.statValue}>{exercises[key]?.total ?? 0}</Text>
						</View>
					))}
				</View>
				<FlatList
					data={sessionList}
					keyExtractor={keyExtractor}
					contentContainerStyle={styles.listContent}
					renderItem={renderItem}
				/>
			</View>
		</View>
	);
}
