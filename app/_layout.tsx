import { Stack } from "expo-router";

export default function RootLayout() {
	return (
		<Stack>
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="squats" options={{ title: "Squats" }} />
			<Stack.Screen name="pushups" options={{ title: "Push-ups" }} />
			<Stack.Screen name="hammerCurls" options={{ title: "Hammer Curls" }} />
			<Stack.Screen name="lateralRaises" options={{ title: "Lateral Raises" }} />
		</Stack>
	);
}
