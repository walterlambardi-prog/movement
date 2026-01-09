import { Link, type LinkProps } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";
import { useCallback, memo } from "react";

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
};

const ExerciseCard = memo(function ExerciseCard({ href, title, subtitle }: CardProps) {
	return (
		<Link href={href} asChild>
			<TouchableOpacity
				style={{
					borderColor: "black",
					borderWidth: 1,
					borderRadius: 5,
					paddingHorizontal: 40,
					paddingVertical: 10,
					margin: 10,
					backgroundColor: "#f0f0f0",
				}}
			>
				<Text style={{ fontSize: 16, textAlign: "center" }}>{title}</Text>
				<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>{subtitle}</Text>
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

	const handleChangeLanguage = useCallback((code: string) => {
		i18n.changeLanguage(code).catch((err) => console.warn("Failed to change language", err));
	}, []);

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<Text style={{ fontSize: 22 }}>{t("index.welcomeTitle")}</Text>
			<Text style={{ fontSize: 16 }}>{t("index.subtitle")}</Text>

			<View style={{ flexDirection: "row", marginTop: 12, marginBottom: 8 }}>
				<Text style={{ marginRight: 8 }}>{t("index.languageToggle")}</Text>
				{languages.map((lang) => (
					<LanguageButton
						key={lang.code}
						lang={lang}
						isActive={currentLang === lang.code}
						onPress={handleChangeLanguage}
					/>
				))}
			</View>

			<ExerciseCard
				href="/exercise"
				title={t("index.exerciseTitle")}
				subtitle={t("index.exerciseSubtitle")}
			/>
			<ExerciseCard
				href="/squats"
				title={t("index.squatsTitle")}
				subtitle={t("index.squatsSubtitle")}
			/>
			<ExerciseCard
				href="/pushups"
				title={t("index.pushupsTitle")}
				subtitle={t("index.pushupsSubtitle")}
			/>
			<ExerciseCard
				href="/hands"
				title={t("index.handsTitle")}
				subtitle={t("index.handsSubtitle")}
			/>
			<ExerciseCard
				href="/hammerCurls"
				title={t("index.hammerTitle")}
				subtitle={t("index.hammerSubtitle")}
			/>
			<ExerciseCard
				href="/lateralRaises"
				title={t("index.lateralsTitle")}
				subtitle={t("index.lateralsSubtitle")}
			/>
		</View>
	);
}
