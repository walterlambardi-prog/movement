import { Stack } from "expo-router";
import { I18nextProvider, useTranslation } from "react-i18next";

import i18n from "./i18n";

export default function RootLayout() {
	const { t } = useTranslation();

	return (
		<I18nextProvider i18n={i18n}>
			<Stack>
				<Stack.Screen name="index" options={{ headerShown: false }} />
				<Stack.Screen name="squats" options={{ title: t("squats.title") }} />
				<Stack.Screen name="pushups" options={{ title: t("pushups.title") }} />
				<Stack.Screen name="hammerCurls" options={{ title: t("hammerCurls.title") }} />
				<Stack.Screen name="lateralRaises" options={{ title: t("lateralRaises.title") }} />
			</Stack>
		</I18nextProvider>
	);
}
