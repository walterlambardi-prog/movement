import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";

import i18n from "./i18n";

export default function RootLayout() {
	return (
		<I18nextProvider i18n={i18n}>
			<StatusBar style="light" translucent backgroundColor="transparent" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: "#0A0F2C" },
					headerTintColor: "#E2E8F0",
					headerTitleStyle: { fontWeight: "800" },
					headerShadowVisible: true,
					contentStyle: { backgroundColor: "#0A0F2C" },
				}}
			>
				<Stack.Screen name="index" options={{ headerShown: false }} />
			</Stack>
		</I18nextProvider>
	);
}
