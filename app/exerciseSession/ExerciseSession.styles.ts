import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	camera: {
		...StyleSheet.absoluteFillObject,
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		zIndex: 1,
	},
	safeArea: {
		flex: 1,
	},
	topBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingTop: 18,
	},
	counterContainer: {
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.28)",
		backgroundColor: "rgba(15, 23, 42, 0.45)",
	},
	counterValue: {
		color: "#E2E8F0",
		fontSize: 42,
		fontWeight: "800",
		textAlign: "center",
	},
	counterLabel: {
		color: "#CBD5E1",
		fontSize: 13,
		textAlign: "center",
		marginTop: 4,
	},
	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 20,
	},
	feedback: {
		color: "#E2E8F0",
		fontSize: 18,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: 12,
	},
	statRow: {
		flexDirection: "row",
		gap: 12,
		justifyContent: "center",
		flexWrap: "wrap",
	},
	stat: {
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.28)",
		minWidth: 120,
		backgroundColor: "rgba(15, 23, 42, 0.5)",
	},
	statLabel: {
		color: "#CBD5E1",
		fontSize: 13,
		marginBottom: 4,
	},
	statValue: {
		color: "#E2E8F0",
		fontSize: 17,
		fontWeight: "700",
	},
	statMuted: {
		color: "#94A3B8",
	},
	badge: {
		marginTop: 10,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		alignSelf: "center",
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.28)",
	},
	badgeText: {
		color: "#0A0F2C",
		fontWeight: "700",
		fontSize: 14,
	},
	progressContainer: {
		paddingHorizontal: 20,
		paddingTop: 12,
	},
	progressBackground: {
		height: 14,
		borderRadius: 999,
		backgroundColor: "rgba(226, 232, 240, 0.16)",
		overflow: "hidden",
	},
	progressFill: {
		height: "100%",
		borderRadius: 999,
	},
	progressText: {
		marginTop: 6,
		textAlign: "center",
		color: "#E2E8F0",
		fontWeight: "700",
	},
	bottomPanel: {
		paddingHorizontal: 20,
		paddingVertical: 18,
		backgroundColor: "rgba(15, 23, 42, 0.68)",
		borderTopWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.16)",
		gap: 12,
	},
	routineRow: {
		flexDirection: "row",
		gap: 12,
	},
	routineCard: {
		flex: 1,
		padding: 12,
		borderRadius: 12,
		backgroundColor: "rgba(10, 15, 44, 0.65)",
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.16)",
		gap: 6,
	},
	routineLabel: {
		color: "#CBD5E1",
		fontSize: 12,
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	routineValue: {
		color: "#E2E8F0",
		fontSize: 16,
		fontWeight: "700",
	},
	routineHint: {
		color: "#94A3B8",
		fontSize: 12,
	},
	controlsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	resetButton: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(248, 113, 113, 0.4)",
		backgroundColor: "rgba(248, 113, 113, 0.12)",
	},
	resetText: {
		color: "#F87171",
		fontWeight: "700",
	},
	instructions: {
		gap: 8,
	},
	instructionText: {
		color: "#CBD5E1",
		fontSize: 14,
		lineHeight: 20,
	},
});
