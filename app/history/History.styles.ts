import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0A0F2C",
	},
	content: {
		paddingHorizontal: 20,
		paddingBottom: 39,
	},
	exercisesHeading: {
		marginTop: 10,
		marginBottom: 20,
		gap: 4,
		paddingHorizontal: 10,
	},
	summaryGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		marginBottom: 12,
	},
	summaryHeading: {
		marginTop: 39,
		marginBottom: 20,
		gap: 4,
		paddingHorizontal: 10,
	},
	summaryTitle: {
		color: "#E2E8F0",
		fontSize: 24,
		fontWeight: "900",
		textTransform: "uppercase",
	},
	summarySubtitle: {
		color: "#94A3B8",
		fontSize: 13,
		lineHeight: 18,
	},
	summaryCard: {
		flexBasis: "48%",
		backgroundColor: "#0F172A",
		borderRadius: 14,
		padding: 14,
		minHeight: 150,
		justifyContent: "space-between",
		shadowColor: "#0EA5E9",
		shadowOpacity: 0.18,
		shadowRadius: 8,
		elevation: 3,
		overflow: "hidden",
	},
	summaryHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 6,
	},
	summaryLabel: {
		color: "#E2E8F0",
		fontWeight: "800",
		fontSize: 13,
		overflow: "hidden",
	},
	summaryValue: {
		color: "#22D3EE",
		fontSize: 26,
		fontWeight: "900",
		marginBottom: 6,
	},
	summarySubtext: {
		color: "#94A3B8",
		fontSize: 12,
		lineHeight: 16,
		marginTop: 2,
	},
	summaryOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(10, 15, 44, 0.55)",
	},
	summaryContent: {
		flex: 1,
		justifyContent: "space-between",
	},
	summaryImageRadius: {
		borderRadius: 14,
		resizeMode: "cover",
	},
	statsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		marginBottom: 16,
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
		width: "90%",
	},
	statValue: {
		color: "#FFFFFF",
		fontSize: 22,
		fontWeight: "900",
	},
	listContent: {
		paddingBottom: 40,
	},
	listHeading: {
		marginTop: 39,
		marginBottom: 20,
		gap: 4,
		paddingHorizontal: 10,
	},
	itemCard: {
		backgroundColor: "#0F172A",
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: "#1E293B",
		marginBottom: 10,
	},
	itemTitle: {
		color: "#E2E8F0",
		fontWeight: "800",
		marginBottom: 4,
	},
	itemText: {
		color: "#CBD5E1",
	},
	itemTimestamp: {
		color: "#94A3B8",
		marginTop: 2,
	},
});
