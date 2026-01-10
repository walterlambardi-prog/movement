import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#010a30ff",
	},
	screenContent: {
		paddingBottom: 40,
	},
	bubbleTop: {
		position: "absolute",
		top: -120,
		right: -100,
		width: 280,
		height: 280,
		borderRadius: 140,
		backgroundColor: "#38BDF8",
		opacity: 0.15,
	},
	bubbleBottom: {
		position: "absolute",
		bottom: -140,
		left: -120,
		width: 320,
		height: 320,
		borderRadius: 160,
		backgroundColor: "#0EA5E9",
		opacity: 0.1,
	},
	cardsContainer: {
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 32,
		gap: 20,
	},
	card: {
		borderRadius: 18,
		overflow: "hidden",
	},
	cardImage: {
		width: "100%",
		height: 260,
		justifyContent: "flex-end",
	},
	cardImageRadius: {
		borderRadius: 18,
	},
	cardOverlay: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 18,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
	},
	cardContent: {
		padding: 16,
		gap: 4,
	},
	cardTitle: {
		fontSize: 22,
		fontWeight: "900",
		color: "#E2E8F0",
	},
	cardSubtitle: {
		fontSize: 13,
		color: "#CBD5E1",
		lineHeight: 18,
	},
});
