import { useCallback, useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
	const router = useRouter();
	const storedName = useAppStore((state) => state.username) ?? "";
	const setUsername = useAppStore((state) => state.setUsername);
	const language = useAppStore((state) => state.language);
	const setLanguage = useAppStore((state) => state.setLanguage);
	const resetAllExercises = useAppStore((state) => state.resetAllExercises);
	const resetAllRoutines = useAppStore((state) => state.resetAllRoutines);
	const resetAccount = useAppStore((state) => state.resetAccount);

	const [name, setName] = useState(storedName);
	const [isNameOpen, setIsNameOpen] = useState(false);
	const [isLanguageOpen, setIsLanguageOpen] = useState(false);
	const [isResetOpen, setIsResetOpen] = useState(false);

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

	const handleResetProgress = useCallback(() => {
		Alert.alert(t("profile.resetProgressConfirmTitle"), t("profile.resetProgressConfirmBody"), [
			{ text: t("profile.resetConfirmNo"), style: "cancel" },
			{
				text: t("profile.resetProgressConfirmYes"),
				style: "destructive",
				onPress: () => {
					resetAllExercises();
					resetAllRoutines();
				},
			},
		]);
	}, [resetAllExercises, resetAllRoutines, t]);

	const handleResetAccount = useCallback(() => {
		Alert.alert(t("profile.resetAccountConfirmTitle"), t("profile.resetAccountConfirmBody"), [
			{ text: t("profile.resetConfirmNo"), style: "cancel" },
			{
				text: t("profile.resetAccountConfirmYes"),
				style: "destructive",
				onPress: async () => {
					try {
						await resetAccount();
						router.replace("/");
					} catch (err) {
						console.warn("Failed to reset account", err);
					}
				},
			},
		]);
	}, [resetAccount, router, t]);

	const displayName = (name || t("profile.emptyName")).trim();

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: t("common.profile", { defaultValue: "Profile" }) }} />
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.heroCard}>
					<View style={styles.heroBadge}>
						<Ionicons name="settings-outline" size={16} color="#22D3EE" />
						<Text style={styles.heroBadgeText}>{t("common.profile")}</Text>
					</View>
					<Text style={styles.heroName}>{t("profile.greeting", { name: displayName })}</Text>
					<Text style={styles.heroSubtitle}>{t("profile.subtitle")}</Text>
					<View style={styles.heroMetaRow}>
						<View style={styles.heroMetaPill}>
							<Ionicons name="language-outline" size={14} color="#A5B4FC" />
							<Text style={styles.heroMetaText}>{language.toUpperCase()}</Text>
						</View>
						<View style={styles.heroMetaPill}>
							<Ionicons name="shield-checkmark-outline" size={14} color="#34D399" />
							<Text style={styles.heroMetaText}>{t("profile.cta")}</Text>
						</View>
					</View>
				</View>

				<View style={styles.sectionCard}>
					<TouchableOpacity
						style={styles.sectionHeader}
						onPress={() => setIsNameOpen((prev) => !prev)}
					>
						<View style={styles.sectionTitleRow}>
							<Ionicons name="person-circle-outline" size={24} color="#22D3EE" />
							<View style={styles.sectionTitleWrapper}>
								<Text style={styles.sectionTitle}>{t("profile.changeNameTitle")}</Text>
								<Text style={styles.sectionSubtitle}>{t("profile.changeNameSubtitle")}</Text>
							</View>
						</View>
						<Ionicons name={isNameOpen ? "chevron-up" : "chevron-down"} size={20} color="#E2E8F0" />
					</TouchableOpacity>
					{isNameOpen && (
						<View style={styles.sectionBody}>
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
						</View>
					)}
				</View>

				<View style={styles.sectionCard}>
					<TouchableOpacity
						style={styles.sectionHeader}
						onPress={() => setIsLanguageOpen((prev) => !prev)}
					>
						<View style={styles.sectionTitleRow}>
							<Ionicons name="language-outline" size={22} color="#A78BFA" />
							<View style={styles.sectionTitleWrapper}>
								<Text style={styles.sectionTitle}>{t("profile.changeLanguageTitle")}</Text>
								<Text style={styles.sectionSubtitle}>{t("profile.changeLanguageSubtitle")}</Text>
							</View>
						</View>
						<Ionicons
							name={isLanguageOpen ? "chevron-up" : "chevron-down"}
							size={20}
							color="#E2E8F0"
						/>
					</TouchableOpacity>
					{isLanguageOpen && (
						<View style={styles.sectionBody}>
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
					)}
				</View>

				<View style={styles.sectionCard}>
					<TouchableOpacity
						style={styles.sectionHeader}
						onPress={() => setIsResetOpen((prev) => !prev)}
					>
						<View style={styles.sectionTitleRow}>
							<Ionicons name="refresh-outline" size={22} color="#F97316" />
							<View style={styles.sectionTitleWrapper}>
								<Text style={styles.sectionTitle}>{t("profile.resetTitle")}</Text>
								<Text style={styles.sectionSubtitle}>{t("profile.resetSubtitle")}</Text>
							</View>
						</View>
						<Ionicons
							name={isResetOpen ? "chevron-up" : "chevron-down"}
							size={20}
							color="#E2E8F0"
						/>
					</TouchableOpacity>
					{isResetOpen && (
						<View style={styles.sectionBody}>
							<View style={styles.resetCard}>
								<View style={styles.resetHeaderRow}>
									<View style={[styles.resetIcon, styles.resetIconSafe]}>
										<Ionicons name="barbell-outline" size={18} color="#22D3EE" />
									</View>
									<View style={styles.resetTextBlock}>
										<Text style={styles.resetTitle}>{t("profile.resetProgressTitle")}</Text>
										<Text style={styles.resetSubtitle}>{t("profile.resetProgressSubtitle")}</Text>
									</View>
								</View>
								<TouchableOpacity
									style={[styles.resetActionButton, styles.resetActionSecondary]}
									onPress={handleResetProgress}
								>
									<Text style={styles.resetActionText}>{t("profile.resetProgressCta")}</Text>
								</TouchableOpacity>
							</View>

							<View style={[styles.resetCard, styles.resetCardDanger]}>
								<View style={styles.resetHeaderRow}>
									<View style={[styles.resetIcon, styles.resetIconDanger]}>
										<Ionicons name="trash-bin-outline" size={18} color="#F43F5E" />
									</View>
									<View style={styles.resetTextBlock}>
										<Text style={styles.resetTitle}>{t("profile.resetAccountTitle")}</Text>
										<Text style={styles.resetSubtitle}>{t("profile.resetAccountSubtitle")}</Text>
									</View>
								</View>
								<TouchableOpacity
									style={[styles.resetActionButton, styles.resetActionDanger]}
									onPress={handleResetAccount}
								>
									<Text style={styles.resetActionTextDanger}>{t("profile.resetAccountCta")}</Text>
								</TouchableOpacity>
							</View>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}
