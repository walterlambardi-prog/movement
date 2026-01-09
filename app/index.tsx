import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";

import i18n from "./i18n";

const languages = [
	{ code: "en", label: "EN" },
	{ code: "es", label: "ES" },
];

export default function Page() {
	const { t } = useTranslation();
	const currentLang = i18n.language;

	const handleChangeLanguage = (code: string) => {
		i18n.changeLanguage(code).catch((err) => console.warn("Failed to change language", err));
	};

	const renderCard = (href: string, title: string, subtitle: string) => (
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
					<TouchableOpacity
						key={lang.code}
						onPress={() => handleChangeLanguage(lang.code)}
						style={{
							paddingHorizontal: 10,
							paddingVertical: 6,
							marginHorizontal: 4,
							borderWidth: 1,
							borderColor: currentLang === lang.code ? "black" : "gray",
							borderRadius: 6,
							backgroundColor: currentLang === lang.code ? "#e0e0e0" : "white",
						}}
					>
						<Text>{lang.label}</Text>
					</TouchableOpacity>
				))}
			</View>

			{renderCard("/exercise", t("index.exerciseTitle"), t("index.exerciseSubtitle"))}
			{renderCard("/squats", t("index.squatsTitle"), t("index.squatsSubtitle"))}
			{renderCard("/pushups", t("index.pushupsTitle"), t("index.pushupsSubtitle"))}
			{renderCard("/hands", t("index.handsTitle"), t("index.handsSubtitle"))}
			{renderCard("/hammerCurls", t("index.hammerTitle"), t("index.hammerSubtitle"))}
			{renderCard("/lateralRaises", t("index.lateralsTitle"), t("index.lateralsSubtitle"))}
		</View>
	);
}
