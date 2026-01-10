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
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");

	const quickActions: QuickAction[] = useMemo(
		() => [
			{
				href: "/exercises" as const,
				title: t("index.exercisesActionTitle", { defaultValue: "Exercises" }),
				subtitle: t("index.exercisesActionSubtitle", {
					defaultValue: "Browse guided counters",
				}),
				accent: "#A855F7",
				icon: "body-outline" as const,
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
				accent: "#22C55E",
				icon: "stats-chart" as const,
			},
			{
				href: "/profile" as const,
				title: t("common.profile", { defaultValue: "Settings" }),
				subtitle: t("index.profileSubtitle", { defaultValue: "Adjust language and name" }),
				accent: "#F97316",
				icon: "settings-outline" as const,
			},
		],
		[t]
	);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<ScrollView
				contentContainerStyle={[styles.screenContent, { paddingTop: insets.top }]}
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
