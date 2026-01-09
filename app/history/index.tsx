import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { FlatList, ImageBackground, ListRenderItem, Text, View } from "react-native";
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
