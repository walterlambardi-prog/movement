import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import Home from "../home";
import Onboarding from "../onboarding";
import i18n from "../i18n";
import { useAppStore } from "../state/useAppStore";
import { styles } from "./Page.styles";
import { type PageProps } from "./Page.types";

export default function Page(_props: Readonly<PageProps>) {
	const hydrated = useAppStore((state) => state.hydrated);
	const username = useAppStore((state) => state.username);
	const language = useAppStore((state) => state.language);
	const hasOnboarded = useAppStore((state) => state.hasOnboarded);

	useEffect(() => {
		if (hydrated && language) {
			i18n.changeLanguage(language).catch((err) => console.warn("Failed to sync language", err));
		}
	}, [hydrated, language]);

	if (!hydrated) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#22D3EE" />
				<Text style={styles.loadingText}>{i18n.t("onboarding.loading")}</Text>
			</View>
		);
	}

	if (!username && !hasOnboarded) {
		return <Onboarding initialName={username ?? ""} />;
	}

	return <Home />;
}
