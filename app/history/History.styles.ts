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
	headerTitle: {
		color: "#E2E8F0",
		fontSize: 22,
		fontWeight: "800",
		marginBottom: 16,
	},
	statsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		marginBottom: 16,
	},
	statCard: {
		flexBasis: "48%",
		backgroundColor: "#0F172A",
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: "#1E293B",
	},
	statLabel: {
		color: "#CBD5E1",
		fontSize: 12,
		marginBottom: 4,
	},
	statValue: {
		color: "#E2E8F0",
		fontSize: 18,
		fontWeight: "800",
	},
	listContent: {
		paddingBottom: 40,
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
