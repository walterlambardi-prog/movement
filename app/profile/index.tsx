import { useCallback, useMemo, useState } from "react";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

import i18n from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { styles } from "./Profile.styles";
import { type LanguageOption } from "./Profile.types";

const languages: LanguageOption[] = [
	{ code: "en", label: "English" },
	{ code: "es", label: "Español" },
];

type LanguageHandlers = Record<LanguageOption["code"], () => void>;

export default function Profile() {
	const { t } = useTranslation();
	const storedName = useAppStore((state) => state.username) ?? "";
	const setUsername = useAppStore((state) => state.setUsername);
	const language = useAppStore((state) => state.language);
	const setLanguage = useAppStore((state) => state.setLanguage);
	const [name, setName] = useState(storedName);

	const isDirty = useMemo(() => name.trim() !== storedName, [name, storedName]);

	const handleSaveName = useCallback(() => {
		const trimmed = name.trim();
		if (trimmed.length === 0) return;
		setUsername(trimmed);
	}, [name, setUsername]);

	const handleLanguage = useCallback(
		(code: LanguageOption["code"]) => {
			setLanguage(code);
			i18n.changeLanguage(code).catch((err) => console.warn("Failed to change language", err));
		},
		[setLanguage]
	);

	const languageHandlers = useMemo<LanguageHandlers>(
		() => ({
			en: () => handleLanguage("en"),
			es: () => handleLanguage("es"),
		}),
		[handleLanguage]
	);

	const displayName = (name || t("profile.emptyName")).trim();

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: t("common.profile", { defaultValue: "Profile" }) }} />
			<View style={styles.content}>
				<View style={styles.heroCard}>
					<Text style={styles.heroGreeting}>{t("profile.title")}</Text>
					<Text style={styles.heroName}>{t("profile.greeting", { name: displayName })}</Text>
					<Text style={styles.heroSubtitle}>{t("profile.cta")}</Text>
				</View>

				<Text style={styles.headerTitle}>{t("profile.title")}</Text>
				<Text style={styles.headerSubtitle}>{t("profile.subtitle")}</Text>

				<Text style={styles.label}>{t("profile.username")}</Text>
				<TextInput
					value={name}
					onChangeText={setName}
					placeholder={t("profile.usernamePlaceholder")}
					placeholderTextColor="#64748B"
					style={styles.input}
					returnKeyType="done"
					onSubmitEditing={handleSaveName}
				/>
				<TouchableOpacity
					onPress={handleSaveName}
					disabled={!isDirty}
					style={[
						styles.saveButton,
						isDirty ? styles.saveButtonEnabled : styles.saveButtonDisabled,
					]}
				>
					<Text style={styles.saveButtonText}>{t("common.save")}</Text>
				</TouchableOpacity>

				<Text style={styles.label}>{t("profile.language")}</Text>
				<View style={styles.languageRow}>
					{languages.map((lang) => {
						const active = language === lang.code;
						return (
							<TouchableOpacity
								key={lang.code}
								onPress={languageHandlers[lang.code]}
								style={[
									styles.languageButton,
									active ? styles.languageButtonActive : styles.languageButtonInactive,
								]}
							>
								<Text style={styles.languageButtonText}>{lang.label}</Text>
								<Text style={styles.languageButtonText}>{lang.code.toUpperCase()}</Text>
							</TouchableOpacity>
						);
					})}
				</View>
			</View>
		</View>
	);
}
