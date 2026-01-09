import { Link } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function Page() {
	return (
		//Very ugly and simple UI and style :)
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<Text style={{ fontSize: 22 }}>Wellcome to Movement!</Text>
			<Text style={{ fontSize: 16 }}>Choose your tracking mode</Text>

			<Link href="/exercise" asChild>
				<TouchableOpacity
					style={{
						borderColor: "black",
						borderWidth: 1,
						borderRadius: 5,
						paddingHorizontal: 40,
						paddingVertical: 10,
						margin: 10,
						backgroundColor: "#f0f0f0",
					}}
				>
					<Text style={{ fontSize: 16, textAlign: "center" }}>💪 Body Exercise</Text>
					<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
						Full body pose tracking
					</Text>
				</TouchableOpacity>
			</Link>

			<Link href="/squats" asChild>
				<TouchableOpacity
					style={{
						borderColor: "black",
						borderWidth: 1,
						borderRadius: 5,
						paddingHorizontal: 40,
						paddingVertical: 10,
						margin: 10,
						backgroundColor: "#f0f0f0",
					}}
				>
					<Text style={{ fontSize: 16, textAlign: "center" }}>🏋️ Squat Counter</Text>
					<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
						Count your squats automatically
					</Text>
				</TouchableOpacity>
			</Link>

			<Link href="/pushups" asChild>
				<TouchableOpacity
					style={{
						borderColor: "black",
						borderWidth: 1,
						borderRadius: 5,
						paddingHorizontal: 40,
						paddingVertical: 10,
						margin: 10,
						backgroundColor: "#f0f0f0",
					}}
				>
					<Text style={{ fontSize: 16, textAlign: "center" }}>💪 Push-up Counter</Text>
					<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
						Count your push-ups automatically
					</Text>
				</TouchableOpacity>
			</Link>

			<Link href="/hands" asChild>
				<TouchableOpacity
					style={{
						borderColor: "black",
						borderWidth: 1,
						borderRadius: 5,
						paddingHorizontal: 40,
						paddingVertical: 10,
						margin: 10,
						backgroundColor: "#f0f0f0",
					}}
				>
					<Text style={{ fontSize: 16, textAlign: "center" }}>👋 Hand Tracking</Text>
					<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
						Track hand movements
					</Text>
				</TouchableOpacity>
			</Link>

			<Link href="/hammerCurls" asChild>
				<TouchableOpacity
					style={{
						borderColor: "black",
						borderWidth: 1,
						borderRadius: 5,
						paddingHorizontal: 40,
						paddingVertical: 10,
						margin: 10,
						backgroundColor: "#f0f0f0",
					}}
				>
					<Text style={{ fontSize: 16, textAlign: "center" }}>🔨 Hammer Curls</Text>
					<Text style={{ fontSize: 12, textAlign: "center", color: "gray" }}>
						Curl martillo alterno con conteo
					</Text>
				</TouchableOpacity>
			</Link>
		</View>
	);
}
