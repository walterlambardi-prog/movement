import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0A0F2C",
		padding: 24,
		justifyContent: "center",
	},
	heading: {
		color: "#E2E8F0",
		fontSize: 26,
		fontWeight: "800",
		marginBottom: 12,
	},
	subheading: {
		color: "#94A3B8",
		fontSize: 14,
		marginBottom: 24,
		lineHeight: 20,
	},
	input: {
		backgroundColor: "#0F172A",
		color: "#E2E8F0",
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderWidth: 1,
		marginBottom: 10,
	},
	button: {
		backgroundColor: "#6366F1",
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: "center",
	},
	buttonText: {
		color: "white",
		fontWeight: "800",
	},
	errorText: {
		color: "#EF4444",
		marginBottom: 10,
	},
});
