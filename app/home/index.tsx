import { useMemo } from "react";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppStore } from "../state/useAppStore";
import { styles } from "./Home.styles";
import { QuickAction } from "./Home.types";

const withAlpha = (hex: string, alphaHex: string) => `${hex}${alphaHex}`;

export default function Home() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const username = useAppStore((state) => state.username);
	const sessions = useAppStore((state) => state.routine.sessions);
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");
	const latestRoutine = useMemo(() => (sessions.length ? sessions[0] : null), [sessions]);

	const quickActions: QuickAction[] = useMemo(
		() =>
			[
				latestRoutine
					? {
							href: `/routineComplete?sessionId=${latestRoutine.id}&mode=review` as const,
							title: t("index.lastRoutineTitle", { defaultValue: "Last routine" }),
							subtitle: t("index.lastRoutineSubtitle", {
								defaultValue: "See your most recent session",
							}),
							accent: "#A5B4FC",
							icon: "time-outline" as const,
						}
					: null,
				{
					href: "/exercises" as const,
					title: t("index.exercisesActionTitle", { defaultValue: "Exercises" }),
					subtitle: t("index.exercisesActionSubtitle", {
						defaultValue: "Browse guided counters",
					}),
					accent: "#22C55E",
					icon: "body-outline" as const,
				},
				{
					href: "/aiCoach" as const,
					title: t("index.aiCoachTitle", { defaultValue: "AI Coach" }),
					subtitle: t("index.aiCoachSubtitle", {
						defaultValue: "Ask an AI coach for a safe routine",
					}),
					accent: "#F59E0B",
					icon: "chatbubbles-outline" as const,
				},
				{
					href: "/routine" as const,
					title: t("common.routine", { defaultValue: "Routine" }),
					subtitle: t("routineBuilder.quickSubtitle", {
						defaultValue: "Configure your routine",
					}),
					accent: "#38BDF8",
					icon: "fitness" as const,
				},
				{
					href: "/history" as const,
					title: t("common.history", { defaultValue: "History" }),
					subtitle: t("index.historySubtitle", { defaultValue: "Review your sessions" }),
					accent: "#A855F7",
					icon: "stats-chart-outline" as const,
				},
				{
					href: "/profile" as const,
					title: t("common.profile", { defaultValue: "Settings" }),
					subtitle: t("index.profileSubtitle", { defaultValue: "Adjust language and name" }),
					accent: "#F97316",
					icon: "settings-outline" as const,
				},
			].filter(Boolean) as QuickAction[],
		[t, latestRoutine]
	);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<ScrollView
				contentContainerStyle={[
					styles.screenContent,
					{ paddingTop: insets.top, paddingBottom: 80 + insets.bottom },
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.heroCard}>
					<View style={styles.heroHeaderRow}>
						<View style={styles.heroAvatar}>
							<Ionicons name="sparkles" size={32} color="#22D3EE" />
						</View>
						<View>
							<Text style={styles.heroGreeting}>{t("index.heroGreeting")}</Text>
							<Text style={styles.heroName}>{displayName}</Text>
						</View>
					</View>
					<Text style={styles.heroSubtitle}>{t("index.heroMessage")}</Text>
				</View>
				<View style={styles.quickActionsRow}>
					{quickActions.map((action) => (
						<Link key={action.href} href={action.href} asChild>
							<TouchableOpacity style={styles.quickAction}>
								<View
									style={[
										styles.quickActionIconWrap,
										{ backgroundColor: withAlpha(action.accent, "18") },
									]}
								>
									<Ionicons name={action.icon} size={42} color={action.accent} />
								</View>
								<View style={styles.quickActionTextWrap}>
									<Text style={styles.quickActionTitle}>{action.title}</Text>
									<Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
								</View>
							</TouchableOpacity>
						</Link>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
