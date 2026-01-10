import { memo, useMemo } from "react";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAppStore } from "../state/useAppStore";
import { styles } from "./Home.styles";
import { CardProps } from "./Home.types";

const withAlpha = (hex: string, alphaHex: string) => `${hex}${alphaHex}`;

const isSameDay = (timestamp: number, now: number) => {
	const a = new Date(timestamp);
	const b = new Date(now);
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
};

const ExerciseCard = memo(function ExerciseCard({ href, title, subtitle, image }: CardProps) {
	return (
		<Link href={href} asChild>
			<TouchableOpacity style={styles.card}>
				<ImageBackground
					source={image}
					style={styles.cardImage}
					imageStyle={styles.cardImageRadius}
				>
					<View style={styles.cardOverlay} />
					<View style={styles.cardContent}>
						<Text style={styles.cardTitle}>{title}</Text>
						<Text style={styles.cardSubtitle}>{subtitle}</Text>
					</View>
				</ImageBackground>
			</TouchableOpacity>
		</Link>
	);
});

export default function Home() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const username = useAppStore((state) => state.username);
	const exercisesState = useAppStore((state) => state.exercises);
	const routineSessions = useAppStore((state) => state.routine.sessions);
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");
	const now = Date.now();

	const { totalRepsAllTime, repsToday, routinesToday, routinesAllTime } = useMemo(() => {
		const totalRepsAllTimeCalc = Object.values(exercisesState).reduce(
			(sum, stat) => sum + (stat?.total ?? 0),
			0
		);
		const repsTodayCalc = Object.values(exercisesState).reduce((sum, stat) => {
			const dayCount = stat?.sessions?.reduce((acc, session) => {
				return isSameDay(session.timestamp, now) ? acc + session.count : acc;
			}, 0);
			return sum + (dayCount ?? 0);
		}, 0);
		const routinesTodayCalc = routineSessions.filter((session) =>
			isSameDay(session.endedAt ?? session.startedAt, now)
		).length;
		const routinesAllTimeCalc = routineSessions.length;
		return {
			totalRepsAllTime: totalRepsAllTimeCalc,
			repsToday: repsTodayCalc,
			routinesToday: routinesTodayCalc,
			routinesAllTime: routinesAllTimeCalc,
		};
	}, [exercisesState, now, routineSessions]);

	const exercises = useMemo(
		() => [
			{
				href: "/hammerCurls" as const,
				title: t("index.hammerTitle"),
				subtitle: t("index.hammerSubtitle"),
				accent: "#F97316",
				image: require("../../assets/images/exercises/hammerCurls.png"),
			},
			{
				href: "/lateralRaises" as const,
				title: t("index.lateralsTitle"),
				subtitle: t("index.lateralsSubtitle"),
				accent: "#22D3EE",
				image: require("../../assets/images/exercises/lateralRaises.png"),
			},
			{
				href: "/pushups" as const,
				title: t("index.pushupsTitle"),
				subtitle: t("index.pushupsSubtitle"),
				accent: "#EF4444",
				image: require("../../assets/images/exercises/pushups.png"),
			},
			{
				href: "/squats" as const,
				title: t("index.squatsTitle"),
				subtitle: t("index.squatsSubtitle"),
				accent: "#8B5CF6",
				image: require("../../assets/images/exercises/squats.png"),
			},
		],
		[t]
	);

	const quickActions = useMemo(
		() => [
			{
				href: "/routine" as const,
				title: t("common.routine", { defaultValue: "Routine" }),
				subtitle: t("routineBuilder.quickSubtitle", {
					defaultValue: "Configure your routine",
				}),
				accent: "#22D3EE",
				icon: "barbell-outline" as const,
			},
			{
				href: "/history" as const,
				title: t("common.history", { defaultValue: "History" }),
				subtitle: t("index.historySubtitle", { defaultValue: "Review your sessions" }),
				accent: "#EF4444",
				icon: "stats-chart-outline" as const,
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

	const heroTags = useMemo(
		() => [
			{
				icon: "flash-outline" as const,
				accent: "#F97316",
				text: t("index.heroTagToday", { count: repsToday }),
			},
			{
				icon: "checkmark-done-outline" as const,
				accent: "#A855F7",
				text: t("index.heroTagRoutines", { count: routinesToday }),
			},
			{
				icon: "trophy-outline" as const,
				accent: "#22D3EE",
				text: t("index.heroTagAllTime", { count: totalRepsAllTime }),
			},
			{
				icon: "ribbon-outline" as const,
				accent: "#22C55E",
				text: t("index.heroTagRoutinesAllTime", { count: routinesAllTime }),
			},
		],
		[t, repsToday, routinesAllTime, routinesToday, totalRepsAllTime]
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
							<Ionicons name="sparkles-outline" size={26} color="#22D3EE" />
						</View>
						<View>
							<Text style={styles.heroGreeting}>{t("index.heroGreeting")}</Text>
							<Text style={styles.heroName}>{displayName}</Text>
						</View>
					</View>
					<Text style={styles.heroSubtitle}>{t("index.heroMessage")}</Text>
					<View style={styles.heroPillsRow}>
						{heroTags.map((tag) => (
							<View
								key={tag.icon}
								style={[
									styles.heroPill,
									{
										backgroundColor: withAlpha(tag.accent, "1A"),
										borderColor: withAlpha(tag.accent, "33"),
									},
								]}
							>
								<Ionicons name={tag.icon} size={16} color={tag.accent} />
								<Text style={styles.heroPillText}>{tag.text}</Text>
							</View>
						))}
					</View>
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

				<View style={styles.cardsContainer}>
					{exercises.map((exercise) => (
						<ExerciseCard
							key={exercise.href}
							href={exercise.href}
							title={exercise.title}
							subtitle={exercise.subtitle}
							accent={exercise.accent}
							image={exercise.image}
						/>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
