import { useCallback, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import i18n from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { styles } from "./Onboarding.styles";
import { type OnboardingProps } from "./Onboarding.types";

export default function Onboarding({ initialName = "" }: Readonly<OnboardingProps>) {
	const { t } = useTranslation();
	const setUsername = useAppStore((state) => state.setUsername);
	const setLanguage = useAppStore((state) => state.setLanguage);
	const [name, setName] = useState(initialName);
	const [error, setError] = useState<string | null>(null);

	const handleContinue = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed) {
			setError(t("onboarding.error"));
			return;
		}
		const targetLanguage = i18n.language || "en";
		setLanguage(targetLanguage);
		setUsername(trimmed);
	}, [name, setLanguage, setUsername, t]);

	const handleChangeName = useCallback((text: string) => {
		setError(null);
		setName(text);
	}, []);

	return (
		<View style={styles.container}>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />
			<View style={styles.card}>
				<Ionicons name="fitness-outline" size={44} color="#22D3EE" style={styles.heroIcon} />
				<Text style={styles.heading}>{t("onboarding.title")}</Text>
				<Text style={styles.subheading}>{t("onboarding.subtitle")}</Text>
				<View style={styles.pill}>
					<Ionicons name="sparkles-outline" size={16} color="#A855F7" />
					<Text style={styles.pillText}>{t("onboarding.heroTag")}</Text>
				</View>
				<TextInput
					value={name}
					onChangeText={handleChangeName}
					placeholder={t("onboarding.placeholder")}
					placeholderTextColor="#64748B"
					style={[styles.input, { borderColor: error ? "#EF4444" : "#1E293B" }]}
					returnKeyType="done"
					autoFocus
					onSubmitEditing={handleContinue}
				/>
				{error ? <Text style={styles.errorText}>{error}</Text> : null}
				<TouchableOpacity onPress={handleContinue} style={styles.button}>
					<Text style={styles.buttonText}>{t("onboarding.cta")}</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}
