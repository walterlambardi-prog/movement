import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0A0F2C",
		paddingHorizontal: 20,
	},
	scrollContent: {
		paddingTop: 18,
		paddingBottom: 48,
	},
	header: {
		gap: 6,
		marginBottom: 16,
		marginHorizontal: 10,
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
	heroCard: {
		borderRadius: 18,
		overflow: "hidden",
		marginBottom: 16,
		backgroundColor: "#111735",
		borderWidth: 1,
		borderColor: "#1F2A4D",
	},
	heroImage: {
		borderRadius: 18,
	},
	heroOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(10, 15, 44, 0.55)",
	},
	heroContent: {
		padding: 18,
		gap: 12,
	},
	heroBadge: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "rgba(31, 42, 77, 0.9)",
		borderWidth: 1,
		borderColor: "#2C3A63",
	},
	heroBadgeText: {
		color: "#C7D2FE",
		fontWeight: "700",
		fontSize: 13,
		marginLeft: 8,
		letterSpacing: 0.2,
	},
	heroStats: {
		flexDirection: "row",
		alignItems: "center",
	},
	heroMetric: {
		flex: 1,
		gap: 4,
		alignItems: "center",
	},
	heroDivider: {
		width: 1,
		height: "70%",
		backgroundColor: "rgba(226, 232, 240, 0.28)",
		alignSelf: "center",
		marginHorizontal: 6,
	},
	heroValue: {
		fontSize: 32,
		fontWeight: "900",
		color: "#E2E8F0",
		letterSpacing: 0.3,
	},
	heroLabel: {
		color: "#CBD5E1",
		fontSize: 13,
		fontWeight: "700",
		letterSpacing: 0.2,
		textTransform: "uppercase",
	},
	statsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	statCard: {
		flexBasis: "48%",
		borderRadius: 14,
		overflow: "hidden",
	},
	statImage: {
		height: 150,
		justifyContent: "flex-end",
	},
	statImageRadius: {
		borderRadius: 14,
	},
	statOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(10, 15, 44, 0.55)",
	},
	statContent: {
		padding: 12,
		gap: 4,
	},
	statLabel: {
		color: "#E0F2FE",
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0.3,
		textTransform: "uppercase",
	},
	statValue: {
		color: "#FFFFFF",
		fontSize: 22,
		fontWeight: "900",
	},
	card: {
		marginTop: 18,
		marginBottom: 18,
		gap: 12,
	},
	detailCard: {
		borderRadius: 16,
		overflow: "hidden",
		marginBottom: 16,
		backgroundColor: "#111735",
		borderWidth: 1,
		borderColor: "#1F2A4D",
	},
	detailImage: {
		borderRadius: 16,
		resizeMode: "cover",
	},
	detailOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(10, 15, 44, 0.7)",
	},
	detailContent: {
		padding: 16,
		gap: 10,
	},
	pillRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#152044",
		borderColor: "#1F2A4D",
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 8,
		gap: 8,
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
	bottomBar: {
		marginTop: 16,
	},
	bottomMeta: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	selectionText: {
		color: "#CBD5E1",
		fontSize: 13,
	},
	startButton: {
		marginTop: 6,
		backgroundColor: "#22D3EE",
		borderRadius: 14,
		paddingVertical: 13,
		alignItems: "center",
		shadowColor: "#22D3EE",
		shadowOpacity: 0.22,
		shadowRadius: 8,
		elevation: 4,
	},
	startText: {
		color: "#0B122F",
		fontSize: 16,
		fontWeight: "900",
	},
	sectionTitle: {
		color: "#A5B4FC",
		fontSize: 14,
		fontWeight: "700",
		letterSpacing: 0.4,
		textTransform: "uppercase",
	},
	confettiContainer: {
		...StyleSheet.absoluteFillObject,
		zIndex: 2,
	},
});
