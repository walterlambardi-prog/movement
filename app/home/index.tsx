import { memo, useCallback, useMemo } from "react";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import i18n from "../i18n";
import { styles } from "./Home.styles";
import { CardProps, Language } from "./Home.types";

const languages: Language[] = [
	{ code: "en", label: "EN" },
	{ code: "es", label: "ES" },
];

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

function LanguageButton({
	lang,
	isActive,
	onPress,
}: {
	readonly lang: Language;
	readonly isActive: boolean;
	readonly onPress: (code: string) => void;
}) {
	const handlePress = useCallback(() => onPress(lang.code), [lang.code, onPress]);

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[styles.languageButton, isActive && styles.languageButtonActive]}
		>
			<Text>{lang.label}</Text>
		</TouchableOpacity>
	);
}

export default function Home() {
	const { t } = useTranslation();
	const currentLang = i18n.language;

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

	const handleChangeLanguage = useCallback((code: string) => {
		i18n.changeLanguage(code).catch((err) => console.warn("Failed to change language", err));
	}, []);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<View style={styles.header}>
				<Text style={styles.headerTitle}>{t("index.welcomeTitle")}</Text>
				<Text style={styles.headerSubtitle}>{t("index.subtitle")}</Text>

				<View style={styles.languageRow}>
					<Text style={styles.languageLabel}>{t("index.languageToggle")}</Text>
					{languages.map((lang) => (
						<LanguageButton
							key={lang.code}
							lang={lang}
							isActive={currentLang === lang.code}
							onPress={handleChangeLanguage}
						/>
					))}
				</View>
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
