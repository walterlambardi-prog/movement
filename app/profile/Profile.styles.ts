import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0A0F2C",
	},
	content: {
		padding: 20,
		flex: 1,
	},
	heroCard: {
		padding: 18,
		borderRadius: 16,
		backgroundColor: "#0F172A",
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.08)",
		marginBottom: 20,
		shadowColor: "#000",
		shadowOpacity: 0.3,
		shadowRadius: 10,
		elevation: 4,
	},
	heroGreeting: {
		color: "#94A3B8",
		fontSize: 13,
		letterSpacing: 0.5,
		textTransform: "uppercase",
	},
	heroName: {
		color: "#E2E8F0",
		fontSize: 26,
		fontWeight: "900",
		marginTop: 4,
	},
	heroSubtitle: {
		color: "#CBD5E1",
		fontSize: 14,
		marginTop: 8,
		lineHeight: 20,
	},
	headerTitle: {
		color: "#E2E8F0",
		fontSize: 22,
		fontWeight: "800",
		marginBottom: 8,
	},
	headerSubtitle: {
		color: "#94A3B8",
		fontSize: 14,
		marginBottom: 16,
		lineHeight: 20,
	},
	label: {
		color: "#CBD5E1",
		marginBottom: 6,
	},
	input: {
		backgroundColor: "#0F172A",
		color: "#E2E8F0",
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: "#1E293B",
		marginBottom: 10,
	},
	saveButton: {
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
		marginBottom: 24,
	},
	saveButtonEnabled: {
		backgroundColor: "#22D3EE",
	},
	saveButtonDisabled: {
		backgroundColor: "#1F2A44",
	},
	saveButtonText: {
		color: "white",
		fontWeight: "700",
	},
	languageRow: {
		flexDirection: "row",
		gap: 8,
	},
	languageButton: {
		flex: 1,
		paddingVertical: 12,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
		gap: 8,
	},
	languageButtonActive: {
		borderColor: "#22D3EE",
		backgroundColor: "#0F172A",
	},
	languageButtonInactive: {
		borderColor: "#1E293B",
		backgroundColor: "#0C142C",
	},
	languageButtonText: {
		color: "#E2E8F0",
		fontWeight: "700",
	},
});
