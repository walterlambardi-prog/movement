import { memo, useMemo } from "react";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppStore } from "../state/useAppStore";
import { styles } from "./Exercises.styles";
import { type ExerciseCardProps } from "./Exercises.types";

const ExerciseCard = memo(function ExerciseCard({
	href,
	title,
	subtitle,
	image,
}: ExerciseCardProps) {
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

export default function ExercisesScreen() {
	const { t } = useTranslation();
	const username = useAppStore((state) => state.username);
	const displayName = username?.trim().length ? username : t("index.welcomeTitle");

	const exercises: ExerciseCardProps[] = useMemo(
		() => [
			{
				href: "/hammerCurls",
				title: t("index.hammerTitle"),
				subtitle: t("index.hammerSubtitle"),
				image: require("../../assets/images/exercises/hammerCurls.png"),
			},
			{
				href: "/lateralRaises",
				title: t("index.lateralsTitle"),
				subtitle: t("index.lateralsSubtitle"),
				image: require("../../assets/images/exercises/lateralRaises.png"),
			},
			{
				href: "/pushups",
				title: t("index.pushupsTitle"),
				subtitle: t("index.pushupsSubtitle"),
				image: require("../../assets/images/exercises/pushups.png"),
			},
			{
				href: "/squats",
				title: t("index.squatsTitle"),
				subtitle: t("index.squatsSubtitle"),
				image: require("../../assets/images/exercises/squats.png"),
			},
		],
		[t]
	);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<ScrollView contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
				<View style={styles.heroCard}>
					<View style={styles.heroHeaderRow}>
						<View style={styles.heroAvatar}>
							<Ionicons name="body-outline" size={32} color="#38BDF8" />
						</View>
						<View>
							<Text style={styles.heroGreeting}>{t("exercises.heroGreeting")}</Text>
							<Text style={styles.heroName}>{displayName}</Text>
						</View>
					</View>
					<Text style={styles.heroSubtitle}>{t("exercises.heroMessage")}</Text>
				</View>

				<View style={styles.cardsContainer}>
					{exercises.map((exercise) => (
						<ExerciseCard
							key={exercise.href}
							href={exercise.href}
							title={exercise.title}
							subtitle={exercise.subtitle}
							image={exercise.image}
						/>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
