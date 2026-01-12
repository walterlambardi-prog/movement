import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0A0F2C",
		paddingHorizontal: 20,
		paddingBottom: 24,
	},
	scrollContent: {
		paddingTop: 24,
		paddingBottom: 40,
	},
	header: {
		gap: 6,
		marginBottom: 16,
	},
	title: {
		fontSize: 28,
		fontWeight: "800",
		color: "#E2E8F0",
	},
	subtitle: {
		fontSize: 16,
		color: "#CBD5E1",
		lineHeight: 22,
	},
	card: {
		backgroundColor: "#111735",
		borderRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: "#1F2A4D",
		marginBottom: 16,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
	},
	label: {
		color: "#94A3B8",
		fontSize: 15,
		fontWeight: "600",
	},
	value: {
		color: "#E2E8F0",
		fontSize: 17,
		fontWeight: "700",
	},
	pillRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	pill: {
		backgroundColor: "#152044",
		borderColor: "#1F2A4D",
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	pillText: {
		color: "#E2E8F0",
		fontWeight: "700",
		fontSize: 13,
	},
	buttonRow: {
		flexDirection: "row",
		gap: 12,
		marginTop: 8,
	},
	button: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#1F2A4D",
		backgroundColor: "#16254D",
	},
	buttonSecondary: {
		backgroundColor: "#0A0F2C",
	},
	buttonText: {
		color: "#E2E8F0",
		fontWeight: "800",
		fontSize: 15,
	},
	sectionTitle: {
		color: "#A5B4FC",
		fontSize: 14,
		fontWeight: "700",
		marginBottom: 6,
		letterSpacing: 0.4,
		textTransform: "uppercase",
	},
	statHighlight: {
		fontSize: 24,
		fontWeight: "800",
		color: "#34D399",
	},
	statLabel: {
		color: "#94A3B8",
		fontSize: 14,
		marginTop: 4,
	},
});
