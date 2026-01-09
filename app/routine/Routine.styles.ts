import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#010a30ff",
	},
	screenContent: {
		paddingHorizontal: 20,
		paddingBottom: 32,
	},
	header: {
		marginTop: 20,
		marginBottom: 16,
		gap: 6,
	},
	title: {
		color: "#E2E8F0",
		fontSize: 28,
		fontWeight: "900",
	},
	subtitle: {
		color: "#94A3B8",
		fontSize: 14,
		lineHeight: 20,
	},
	list: {
		gap: 12,
		marginTop: 6,
	},
	card: {
		backgroundColor: "#0F172A",
		borderRadius: 16,
		padding: 14,
		borderWidth: 1,
		borderColor: "rgba(34, 211, 238, 0.16)",
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		shadowColor: "#0EA5E9",
		shadowOpacity: 0.2,
		shadowRadius: 8,
		elevation: 4,
	},
	iconWrap: {
		width: 44,
		height: 44,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(34, 211, 238, 0.12)",
	},
	cardText: {
		flex: 1,
		gap: 2,
	},
	cardTitle: {
		color: "#E2E8F0",
		fontSize: 17,
		fontWeight: "800",
	},
	cardSubtitle: {
		color: "#94A3B8",
		fontSize: 13,
		lineHeight: 18,
	},
	counterRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	chip: {
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 6,
		color: "#E2E8F0",
		fontWeight: "700",
	},
	count: {
		color: "#E2E8F0",
		fontSize: 16,
		fontWeight: "800",
		minWidth: 36,
		textAlign: "center",
	},
	button: {
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderWidth: 1,
		borderColor: "rgba(34, 211, 238, 0.3)",
		backgroundColor: "rgba(34, 211, 238, 0.12)",
	},
	buttonText: {
		color: "#22D3EE",
		fontWeight: "800",
		fontSize: 16,
	},
	footer: {
		marginTop: 18,
		gap: 10,
	},
	selectionText: {
		color: "#CBD5E1",
		fontSize: 13,
	},
	startButton: {
		marginTop: 6,
		backgroundColor: "#22D3EE",
		borderRadius: 16,
		paddingVertical: 14,
		alignItems: "center",
		shadowColor: "#22D3EE",
		shadowOpacity: 0.25,
		shadowRadius: 10,
		elevation: 4,
	},
	startText: {
		color: "#0B122F",
		fontSize: 16,
		fontWeight: "900",
	},
	disabled: {
		opacity: 0.35,
	},
});
