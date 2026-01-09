import { memo, useMemo } from "react";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useAppStore } from "../state/useAppStore";
import { styles } from "./Home.styles";
import { CardProps } from "./Home.types";

const ExerciseCard = memo(function ExerciseCard({
	href,
	title,
	subtitle,
	accent,
	image,
}: CardProps) {
	return (
		<Link href={href} asChild>
			{/* <TouchableOpacity style={[styles.card, { borderColor: accent }]}> */}
			<TouchableOpacity
				style={{
					backgroundColor: "#0F172A",
					borderRadius: 18,
					paddingHorizontal: 18,
					paddingVertical: 18,
					borderWidth: 1,
					borderColor: accent,
					shadowColor: "#000",
					shadowOpacity: 0.25,
					shadowRadius: 8,
					elevation: 3,
					width: "100%",
				}}
			>
				<Image source={image} style={styles.cardImage} resizeMode="cover" />
				<Text style={styles.cardTitle}>{title}</Text>
				<Text style={styles.cardSubtitle}>{subtitle}</Text>
			</TouchableOpacity>
		</Link>
	);
});

export default function Home() {
	const { t } = useTranslation();
	const username = useAppStore((state) => state.username);
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");

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
				href: "/history" as const,
				title: t("common.history", { defaultValue: "History" }),
				subtitle: t("index.historySubtitle", { defaultValue: "Revisa tus sesiones" }),
				accent: "#22D3EE",
			},
			{
				href: "/profile" as const,
				title: t("common.profile", { defaultValue: "Profile" }),
				subtitle: t("index.profileSubtitle", { defaultValue: "Ajusta idioma y nombre" }),
				accent: "#F97316",
			},
		],
		[t]
	);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<View style={styles.heroCard}>
				<Text style={styles.heroGreeting}>{t("index.welcomeTitle")}</Text>
				<Text style={styles.heroName}>{displayName}</Text>
				<Text style={styles.heroSubtitle}>{t("index.subtitle")}</Text>
			</View>

			<View style={styles.quickActionsRow}>
				{quickActions.map((action) => (
					<Link key={action.href} href={action.href} asChild>
						<TouchableOpacity style={[styles.quickAction, { borderColor: action.accent }]}>
							<Text style={styles.quickActionTitle}>{action.title}</Text>
							<Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
						</TouchableOpacity>
					</Link>
				))}
			</View>

			<ScrollView
				contentContainerStyle={styles.cardsContainer}
				showsVerticalScrollIndicator={false}
			>
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
			</ScrollView>
		</View>
	);
}
