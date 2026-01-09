import { Link, type LinkProps } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { useCallback, memo, useMemo } from "react";

import i18n from "./i18n";

type Language = {
	readonly code: string;
	readonly label: string;
};

const languages: Language[] = [
	{ code: "en", label: "EN" },
	{ code: "es", label: "ES" },
];

type CardProps = {
	readonly href: LinkProps["href"];
	readonly title: string;
	readonly subtitle: string;
	readonly accent: string;
};

const ExerciseCard = memo(function ExerciseCard({ href, title, subtitle, accent }: CardProps) {
	return (
		<Link href={href} asChild>
			<TouchableOpacity
				style={{
					backgroundColor: "#0F172A",
					borderRadius: 18,
					paddingHorizontal: 18,
					paddingVertical: 18,
					margin: 10,
					borderWidth: 1,
					borderColor: accent,
					shadowColor: "#000",
					shadowOpacity: 0.25,
					shadowRadius: 8,
					elevation: 3,
					width: "100%",
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<Text
						style={{
							fontSize: 18,
							fontWeight: "800",
							color: "white",
						}}
					>
						{title}
					</Text>
					<View
						style={{
							width: 10,
							height: 10,
							borderRadius: 5,
							backgroundColor: accent,
						}}
					/>
				</View>
				<Text
					style={{
						fontSize: 13,
						color: "#CBD5E1",
						marginTop: 8,
						lineHeight: 18,
					}}
				>
					{subtitle}
				</Text>
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
			style={{
				paddingHorizontal: 10,
				paddingVertical: 6,
				marginHorizontal: 4,
				borderWidth: 1,
				borderColor: isActive ? "black" : "gray",
				borderRadius: 6,
				backgroundColor: isActive ? "#e0e0e0" : "white",
			}}
		>
			<Text>{lang.label}</Text>
		</TouchableOpacity>
	);
}

export default function Page() {
	const { t } = useTranslation();
	const currentLang = i18n.language;

	const exercises = useMemo(
		() => [
			{
				href: "/hammerCurls" as const,
				title: t("index.hammerTitle"),
				subtitle: t("index.hammerSubtitle"),
				accent: "#F97316",
			},
			{
				href: "/lateralRaises" as const,
				title: t("index.lateralsTitle"),
				subtitle: t("index.lateralsSubtitle"),
				accent: "#22D3EE",
			},
			{
				href: "/pushups" as const,
				title: t("index.pushupsTitle"),
				subtitle: t("index.pushupsSubtitle"),
				accent: "#EF4444",
			},
			{
				href: "/squats" as const,
				title: t("index.squatsTitle"),
				subtitle: t("index.squatsSubtitle"),
				accent: "#8B5CF6",
			},
		],
		[t]
	);

	const handleChangeLanguage = useCallback((code: string) => {
		i18n.changeLanguage(code).catch((err) => console.warn("Failed to change language", err));
	}, []);

	return (
		<View style={{ flex: 1, backgroundColor: "#010a30ff" }}>
			<View
				style={{
					position: "absolute",
					top: -120,
					right: -100,
					width: 280,
					height: 280,
					borderRadius: 140,
					backgroundColor: "#0EA5E9",
					opacity: 0.15,
				}}
			/>
			<View
				style={{
					position: "absolute",
					bottom: -140,
					left: -120,
					width: 320,
					height: 320,
					borderRadius: 160,
					backgroundColor: "#22D3EE",
					opacity: 0.1,
				}}
			/>

			<View style={{ paddingTop: 64, paddingHorizontal: 20 }}>
				<Text
					style={{
						color: "#E2E8F0",
						fontSize: 28,
						fontWeight: "900",
						letterSpacing: 0.5,
					}}
				>
					{t("index.welcomeTitle")}
				</Text>
				<Text
					style={{
						color: "#94A3B8",
						fontSize: 15,
						marginTop: 6,
						lineHeight: 20,
					}}
				>
					{t("index.subtitle")}
				</Text>

				<View style={{ flexDirection: "row", alignItems: "center", marginTop: 20 }}>
					<Text style={{ color: "#CBD5E1", marginRight: 8 }}>{t("index.languageToggle")}</Text>
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

			<View
				style={{
					flex: 1,
					flexDirection: "row",
					flexWrap: "wrap",
					paddingHorizontal: 20,
					paddingTop: 20,
					paddingBottom: 32,
					justifyContent: "center",
				}}
			>
				{exercises.map((exercise) => (
					<ExerciseCard
						key={exercise.href}
						href={exercise.href}
						title={exercise.title}
						subtitle={exercise.subtitle}
						accent={exercise.accent}
					/>
				))}
			</View>
		</View>
	);
}
