import { Skia } from "@shopify/react-native-skia";
import { Stack } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Animated,
	Button,
	NativeEventEmitter,
	NativeModules,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Confetti } from "react-native-fast-confetti";
import {
	Camera,
	CameraPosition,
	useCameraDevice,
	useCameraFormat,
	useCameraPermission,
	useSkiaFrameProcessor,
	VisionCameraProxy,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";

const { PoseLandmarks } = NativeModules;

type KeypointData = {
	keypoint: number;
	x: number;
	y: number;
	z: number;
	visibility: number;
	presence: number;
};

type KeypointsMap = { [key: string]: KeypointData };

// Líneas para conectar los puntos del cuerpo (esqueleto)
const LINES = [
	[0, 1],
	[0, 4],
	[1, 2],
	[2, 3],
	[3, 7],
	[4, 5],
	[5, 6],
	[6, 8],
	[9, 10],
	[11, 12],
	[11, 13],
	[11, 23],
	[12, 14],
	[12, 24],
	[13, 15],
	[15, 17],
	[15, 19],
	[15, 21],
	[17, 19],
	[14, 16],
	[16, 18],
	[16, 20],
	[16, 22],
	[18, 20],
	[23, 24],
	[23, 25],
	[24, 26],
	[25, 27],
	[26, 28],
	[27, 29],
	[27, 31],
	[29, 31],
	[28, 30],
	[28, 32],
	[30, 32],
];

// Paint para las líneas (esqueleto)
const linePaint = Skia.Paint();
linePaint.setColor(Skia.Color("#4CAF50")); // Verde para que coincida con el tema de squats
linePaint.setStrokeWidth(12);

// Paint para los círculos (keypoints)
const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107")); // Amarillo para los puntos
linePaint.setStrokeWidth(8);

// Configuración: Mostrar confetti cada N sentadillas
const CONFETTI_INTERVAL = 5;
const UI_UPDATE_THROTTLE_MS = 140; // reduce setState frequency for smoother UI
const REP_DEBOUNCE_MS = 900; // allow quicker consecutive reps

// Configuración de voz
const VOICE_CONFIG = {
	language: "en-US", // Cambiar a "es-ES" para español
	pitch: 1,
	rate: 0.85,
};

// Mensaje de bienvenida
const WELCOME_MESSAGE = "Let's do some squats! Position your full body in frame to begin.";

// Mensajes motivacionales para milestones (se elige uno al azar)
const MILESTONE_MESSAGES = [
	(count: number) => `${count} squats! Keep it up!`,
	(count: number) => `Amazing! ${count} squats completed! You're on fire!`,
	(count: number) => `Wow! ${count} squats done! Keep pushing!`,
	(count: number) => `Fantastic! ${count} squats! You're crushing it!`,
];

// Mensajes de voz
const VOICE_MESSAGES = {
	MILESTONE: (count: number) => {
		const randomIndex = Math.floor(Math.random() * MILESTONE_MESSAGES.length);
		return MILESTONE_MESSAGES[randomIndex](count);
	},
	COUNT: (count: number) => `${count}`,
	WELCOME: WELCOME_MESSAGE,
};

// Angles tuned to be more permissive so reps count even if the form is shallow
const ANGLE_TOP_READY = 150; // Standing straight threshold (was 165)
const ANGLE_START_DESCENT = 145; // When descent is detected (was 150)
const ANGLE_BOTTOM = 130; // Depth considered valid at the bottom (was 100)
const ANGLE_ASCEND_TRIGGER = 140; // Begin ascent once knees open past this
const ANGLE_COMPLETE = 150; // Count rep once back near standing (was 165)

// Función helper para anunciar con voz
function announceVoice(text: string) {
	Speech.speak(text, VOICE_CONFIG);
}

// Función para calcular el ángulo entre 3 puntos
function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

// Estados de la sentadilla mejorados
type SquatState = "idle" | "ready" | "descending" | "bottom" | "ascending";

type RepQuality = "perfect" | "good" | "incomplete";

type StateTransitionResult = {
	newState: SquatState;
	feedback: string;
	incrementCount: boolean;
	quality?: RepQuality;
	progress: number; // 0-100 para mostrar progreso visual
};

// Función mejorada para manejar las transiciones de estado de la sentadilla
function processSquatStateMachine(
	currentState: SquatState,
	avgKneeAngle: number,
	bodyFullyVisible: boolean
): StateTransitionResult {
	const angle = Math.round(avgKneeAngle);

	// Si el cuerpo no está completamente visible, volver a idle
	if (!bodyFullyVisible) {
		return {
			newState: "idle",
			feedback: "Position your full body in frame",
			incrementCount: false,
			progress: 0,
		};
	}

	// IDLE -> READY: Cuerpo visible y en posición de pie
	if (currentState === "idle") {
		if (avgKneeAngle > ANGLE_TOP_READY) {
			return {
				newState: "ready",
				feedback: "Ready! Start your squat",
				incrementCount: false,
				progress: 0,
			};
		}
		return {
			newState: "idle",
			feedback: "Stand up straight to begin",
			incrementCount: false,
			progress: 0,
		};
	}

	// READY -> DESCENDING: Comenzando a bajar
	if (currentState === "ready") {
		if (avgKneeAngle < ANGLE_START_DESCENT) {
			return {
				newState: "descending",
				feedback: "Going down...",
				incrementCount: false,
				progress: 10,
			};
		}
		return {
			newState: "ready",
			feedback: "Ready! Start your squat",
			incrementCount: false,
			progress: 0,
		};
	}

	// DESCENDING: Bajando
	if (currentState === "descending") {
		// Llegó a buena profundidad (inclusive)
		if (avgKneeAngle <= ANGLE_BOTTOM) {
			return {
				newState: "bottom",
				feedback: "Perfect depth! 💪",
				incrementCount: false,
				progress: 50,
			};
		}
		// Se devolvió antes de llegar abajo
		if (avgKneeAngle > ANGLE_TOP_READY) {
			return {
				newState: "ready",
				feedback: "Go deeper next time",
				incrementCount: false,
				progress: 0,
			};
		}
		// Calculando progreso basado en ángulo (150° -> 130°)
		const progress = Math.min(
			50,
			((ANGLE_TOP_READY - avgKneeAngle) / (ANGLE_TOP_READY - ANGLE_BOTTOM)) * 50
		);
		return {
			newState: "descending",
			feedback: `Keep going... ${angle}°`,
			incrementCount: false,
			progress,
		};
	}

	// BOTTOM: En la posición más baja
	if (currentState === "bottom") {
		// Empezó a subir
		if (avgKneeAngle > ANGLE_ASCEND_TRIGGER) {
			return {
				newState: "ascending",
				feedback: "Push up! 🔥",
				incrementCount: false,
				progress: 60,
			};
		}
		return {
			newState: "bottom",
			feedback: "Good! Now push up",
			incrementCount: false,
			progress: 50,
		};
	}

	// ASCENDING: Subiendo
	if (currentState === "ascending") {
		// Completó la sentadilla perfectamente
		if (avgKneeAngle > ANGLE_COMPLETE) {
			return {
				newState: "ready",
				feedback: "Excellent! ✨",
				incrementCount: true,
				quality: "perfect",
				progress: 100,
			};
		}
		// Se devolvió antes de completar
		if (avgKneeAngle <= ANGLE_BOTTOM) {
			return {
				newState: "bottom",
				feedback: "Keep pushing!",
				incrementCount: false,
				progress: 50,
			};
		}
		// Calculando progreso basado en ángulo (130° -> 150°)
		const progress =
			50 + Math.min(50, ((avgKneeAngle - ANGLE_BOTTOM) / (ANGLE_COMPLETE - ANGLE_BOTTOM)) * 50);
		return {
			newState: "ascending",
			feedback: `Almost there... ${angle}°`,
			incrementCount: false,
			progress,
		};
	}

	return {
		newState: currentState,
		feedback: "Keep going!",
		incrementCount: false,
		progress: 0,
	};
}

const CameraButton = ({ onPress }: { onPress: () => void }) => (
	<Button title="Change camera" onPress={onPress} />
);

export default function Squats() {
	const landmarks = useSharedValue<KeypointsMap>({});
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const device = useCameraDevice(cameraPosition);
	const format = useCameraFormat(device, [{ fps: 24 }]);
	const poseLandmarkPlugin = useMemo(() => {
		try {
			return VisionCameraProxy.initFrameProcessorPlugin("poseLandmarks", {});
		} catch (error) {
			console.warn("poseLandmarks plugin failed to init", error);
			return null;
		}
	}, []);

	// Referencias para control de tiempo
	const lastSquatTimeRef = useRef<number>(0);
	const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef<boolean>(true);
	const squatCountRef = useRef<number>(0);
	const squatStateRef = useRef<SquatState>("idle");

	// Estados del contador
	const [squatCount, setSquatCount] = useState(0);
	const [squatState, setSquatState] = useState<SquatState>("idle");
	const [currentAngle, setCurrentAngle] = useState<number>(0);
	const [feedback, setFeedback] = useState<string>("Position yourself in frame");
	const [progress, setProgress] = useState<number>(0);
	const [showConfetti, setShowConfetti] = useState(false);
	const [lastRepQuality, setLastRepQuality] = useState<RepQuality | null>(null);

	// Mantener refs sincronizados con el estado
	useEffect(() => {
		squatCountRef.current = squatCount;
	}, [squatCount]);

	useEffect(() => {
		squatStateRef.current = squatState;
	}, [squatState]);

	// Animación para la barra de progreso
	const progressAnim = useRef(new Animated.Value(0)).current;
	const lastUiUpdateRef = useRef<number>(0);

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleReset = useCallback(() => {
		setSquatCount(0);
		setSquatState("idle");
		setProgress(0);
		setFeedback("Position yourself in frame");
		setLastRepQuality(null);
		setShowConfetti(false);
		if (confettiTimeoutRef.current) {
			clearTimeout(confettiTimeoutRef.current);
		}
	}, []);

	const HeaderRight = useMemo(
		() => <CameraButton onPress={handleCameraChange} />,
		[handleCameraChange]
	);

	const screenOptions = useMemo(
		() => ({
			headerRight: () => HeaderRight,
		}),
		[HeaderRight]
	);

	// Anunciar mensaje de bienvenida al montar el componente
	useEffect(() => {
		announceVoice(VOICE_MESSAGES.WELCOME);
		return () => {
			Speech.stop();
		};
	}, []);

	// Animar la barra de progreso cuando cambie
	useEffect(() => {
		Animated.timing(progressAnim, {
			toValue: progress,
			duration: 200,
			useNativeDriver: false,
		}).start();
	}, [progress, progressAnim]);

	// Limpiar recursos al desmontar
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			Speech.stop();
			if (confettiTimeoutRef.current) {
				clearTimeout(confettiTimeoutRef.current);
				confettiTimeoutRef.current = null;
			}
		};
	}, []);

	// Anunciar voz solo en hitos para reducir uso de Speech
	useEffect(() => {
		if (squatCount > 0 && squatCount % CONFETTI_INTERVAL === 0) {
			announceVoice(VOICE_MESSAGES.MILESTONE(squatCount));
		}
		return () => {
			Speech.stop();
		};
	}, [squatCount]);

	useEffect(() => {
		// Initialize the model explicitly (needed for iOS)
		PoseLandmarks?.initModel?.();

		if (!PoseLandmarks) {
			console.warn("PoseLandmarks module not available");
			return;
		}

		const poseLandmarksEmitter = new NativeEventEmitter(PoseLandmarks);
		const subscription = poseLandmarksEmitter.addListener("onPoseLandmarksDetected", (event) => {
			try {
				// Validar que existan landmarks
				if (!event?.landmarks?.[0]) {
					setSquatState("idle");
					setFeedback("No pose detected");
					setProgress(0);
					return;
				}

				const detectedLandmarks = event.landmarks[0];
				landmarks.value = detectedLandmarks;

				// Verificar que los puntos necesarios existan
				const leftShoulder = detectedLandmarks[11];
				const rightShoulder = detectedLandmarks[12];
				const leftHip = detectedLandmarks[23];
				const leftKnee = detectedLandmarks[25];
				const leftAnkle = detectedLandmarks[27];
				const rightHip = detectedLandmarks[24];
				const rightKnee = detectedLandmarks[26];
				const rightAnkle = detectedLandmarks[28];
				const leftHeel = detectedLandmarks[29];
				const rightHeel = detectedLandmarks[30];
				const leftFootIndex = detectedLandmarks[31];
				const rightFootIndex = detectedLandmarks[32];

				// Validar que todos los puntos clave del cuerpo existan
				const allPointsExist =
					leftShoulder &&
					rightShoulder &&
					leftHip &&
					leftKnee &&
					leftAnkle &&
					rightHip &&
					rightKnee &&
					rightAnkle &&
					leftHeel &&
					rightHeel &&
					leftFootIndex &&
					rightFootIndex;

				if (!allPointsExist) {
					setSquatState("idle");
					setFeedback("Position your full body in frame");
					setProgress(0);
					return;
				}

				// Verificar visibilidad del cuerpo completo
				const minVisibility = 0.55;
				const bodyFullyVisible =
					leftShoulder.visibility > minVisibility &&
					rightShoulder.visibility > minVisibility &&
					leftHip.visibility > minVisibility &&
					rightHip.visibility > minVisibility &&
					leftKnee.visibility > minVisibility &&
					rightKnee.visibility > minVisibility &&
					leftAnkle.visibility > minVisibility &&
					rightAnkle.visibility > minVisibility &&
					leftHeel.visibility > minVisibility &&
					rightHeel.visibility > minVisibility &&
					leftFootIndex.visibility > minVisibility &&
					rightFootIndex.visibility > minVisibility;

				// Calcular ángulos de ambas rodillas
				const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
				const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

				// Usar el promedio para mayor precisión
				const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

				// Procesar la máquina de estados con validación de visibilidad
				const result = processSquatStateMachine(
					squatStateRef.current,
					avgKneeAngle,
					bodyFullyVisible
				);
				squatStateRef.current = result.newState;

				// Throttle UI updates to reduce setState frequency
				const now = Date.now();
				if (now - lastUiUpdateRef.current > UI_UPDATE_THROTTLE_MS) {
					lastUiUpdateRef.current = now;
					setSquatState(result.newState);
					setFeedback(result.feedback);
					setProgress(result.progress);
					setCurrentAngle(Math.round(avgKneeAngle));
				}

				// Manejar el incremento del contador con debounce
				if (result.incrementCount) {
					const now = Date.now();
					// Debounce configurado
					if (now - lastSquatTimeRef.current > REP_DEBOUNCE_MS) {
						lastSquatTimeRef.current = now;

						if (!isMountedRef.current) return;

						// Actualizar calidad de la rep
						setLastRepQuality(result.quality || "good");

						// Incrementar contador usando setState funcional y manejar confetti
						setSquatCount((prevCount) => {
							const newCount = prevCount + 1;

							// Mostrar confetti cada CONFETTI_INTERVAL sentadillas
							if (newCount % CONFETTI_INTERVAL === 0) {
								setShowConfetti(true);

								// Ocultar confetti después de 3 segundos
								if (confettiTimeoutRef.current) {
									clearTimeout(confettiTimeoutRef.current);
									confettiTimeoutRef.current = null;
								}
								confettiTimeoutRef.current = setTimeout(() => {
									if (isMountedRef.current) {
										setShowConfetti(false);
									}
								}, 3000);
							}

							return newCount;
						});
					}
				}
			} catch (error) {
				console.error("Error in pose landmarks listener:", error);
			}
		});

		return () => {
			subscription.remove();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Solo crear el listener una vez

	const frameProcessor = useSkiaFrameProcessor(
		(frame) => {
			"worklet";
			if (poseLandmarkPlugin == null) return;
			poseLandmarkPlugin.call(frame);
			// Dibujar la silueta del usuario
			if (landmarks?.value !== undefined && Object.keys(landmarks?.value).length > 0) {
				const body = landmarks?.value;
				const frameWidth = frame.width;
				const frameHeight = frame.height;

				// Dibujar líneas del esqueleto
				for (const [from, to] of LINES) {
					const fromPoint = body[from];
					const toPoint = body[to];
					if (fromPoint && toPoint) {
						frame.drawLine(
							fromPoint.x * Number(frameWidth),
							fromPoint.y * Number(frameHeight),
							toPoint.x * Number(frameWidth),
							toPoint.y * Number(frameHeight),
							linePaint
						);
					}
				}

				// Dibujar círculos en los keypoints
				for (const mark of Object.values(body)) {
					if (mark && typeof mark === "object" && "x" in mark && "y" in mark) {
						frame.drawCircle(
							mark.x * Number(frameWidth),
							mark.y * Number(frameHeight),
							8,
							circlePaint
						);
					}
				}
			}
		},
		[poseLandmarkPlugin]
	);

	if (!hasPermission) {
		return (
			<View style={styles.container}>
				<Text>No camera permission</Text>
				<Button title="Request Permission" onPress={requestPermission} />
			</View>
		);
	}

	if (device == null) {
		return (
			<View style={styles.container}>
				<Text>No camera device found</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={screenOptions} />

			<Camera
				style={StyleSheet.absoluteFill}
				device={device}
				isActive={true}
				format={format}
				frameProcessor={frameProcessor}
				pixelFormat="yuv"
			/>

			{/* Overlay oscuro para mejorar legibilidad */}
			<View style={styles.overlay} />

			{/* Contador principal - más grande y visible */}
			<View style={styles.topBar}>
				<View style={styles.counterContainer}>
					<Text style={styles.counterValue}>{squatCount}</Text>
					<Text style={styles.counterLabel}>SQUATS</Text>
				</View>
			</View>

			{/* Feedback central - mensaje principal */}
			<View style={styles.centerFeedback}>
				<Text style={[styles.feedbackText, getFeedbackStyle(squatState)]}>{feedback}</Text>
				{squatState !== "idle" && squatState !== "ready" && (
					<Text style={styles.angleIndicator}>{currentAngle}°</Text>
				)}
			</View>

			{/* Barra de progreso visual */}
			{(squatState === "descending" || squatState === "ascending" || squatState === "bottom") && (
				<View style={styles.progressBarContainer}>
					<View style={styles.progressBarBackground}>
						<Animated.View
							style={[
								styles.progressBarFill,
								{
									width: progressAnim.interpolate({
										inputRange: [0, 100],
										outputRange: ["0%", "100%"],
									}),
								},
								getProgressBarColor(squatState),
							]}
						/>
					</View>
					<Text style={styles.progressText}>{Math.round(progress)}%</Text>
				</View>
			)}

			{/* Indicador de calidad de la última rep */}
			{lastRepQuality && squatState === "ready" && (
				<View style={styles.qualityBadge}>
					<Text style={styles.qualityText}>
						{lastRepQuality === "perfect" ? "🌟 Perfect!" : "✓ Good!"}
					</Text>
				</View>
			)}

			{/* Panel inferior con controles */}
			<View style={styles.bottomPanel}>
				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statLabel}>State</Text>
						<Text style={styles.statValue}>{getStateLabel(squatState)}</Text>
					</View>
					<View style={styles.resetButtonContainer}>
						<Button title="Reset" onPress={handleReset} color="#FF6B6B" />
					</View>
				</View>

				{/* Guía de instrucciones compacta */}
				{squatState === "idle" && (
					<View style={styles.instructionsContainer}>
						<Text style={styles.instructionText}>📱 Show your full body</Text>
						<Text style={styles.instructionText}>🦵 Squat down until knees reach ~100°</Text>
						<Text style={styles.instructionText}>⬆️ Stand back up to complete</Text>
					</View>
				)}
			</View>

			{/* Confetti - solo cuando showConfetti es true */}
			{showConfetti && (
				<View style={styles.confettiContainer}>
					<Confetti count={200} fallDuration={4000} />
				</View>
			)}
		</View>
	);
}

// Función auxiliar para estilos dinámicos del feedback
function getFeedbackStyle(state: SquatState) {
	switch (state) {
		case "idle":
			return { color: "#FFC107" }; // Amarillo - atención
		case "ready":
			return { color: "#4CAF50" }; // Verde - listo
		case "descending":
			return { color: "#2196F3" }; // Azul - bajando
		case "bottom":
			return { color: "#FF9800" }; // Naranja - profundidad
		case "ascending":
			return { color: "#9C27B0" }; // Púrpura - subiendo
		default:
			return { color: "white" };
	}
}

// Función auxiliar para color de barra de progreso
function getProgressBarColor(state: SquatState) {
	switch (state) {
		case "descending":
			return { backgroundColor: "#2196F3" }; // Azul
		case "bottom":
			return { backgroundColor: "#FF9800" }; // Naranja
		case "ascending":
			return { backgroundColor: "#4CAF50" }; // Verde
		default:
			return { backgroundColor: "#4CAF50" };
	}
}

// Función auxiliar para etiqueta del estado
function getStateLabel(state: SquatState): string {
	switch (state) {
		case "idle":
			return "Positioning...";
		case "ready":
			return "Ready";
		case "descending":
			return "Going Down";
		case "bottom":
			return "Bottom";
		case "ascending":
			return "Rising Up";
		default:
			return state;
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "black",
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		zIndex: 1,
	},
	// Barra superior con contador
	topBar: {
		position: "absolute",
		top: 60,
		left: 0,
		right: 0,
		zIndex: 10,
		alignItems: "center",
	},
	counterContainer: {
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		paddingVertical: 20,
		paddingHorizontal: 40,
		borderRadius: 20,
		borderWidth: 3,
		borderColor: "#4CAF50",
		alignItems: "center",
	},
	counterValue: {
		fontSize: 80,
		fontWeight: "900",
		color: "#4CAF50",
		letterSpacing: 2,
		textShadowColor: "rgba(76, 175, 80, 0.5)",
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 20,
	},
	counterLabel: {
		fontSize: 16,
		fontWeight: "bold",
		color: "white",
		letterSpacing: 4,
		marginTop: 5,
	},
	// Feedback central
	centerFeedback: {
		position: "absolute",
		top: "40%",
		left: 20,
		right: 20,
		zIndex: 10,
		alignItems: "center",
	},
	feedbackText: {
		fontSize: 32,
		fontWeight: "bold",
		textAlign: "center",
		textShadowColor: "rgba(0, 0, 0, 0.8)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 4,
		paddingHorizontal: 20,
		paddingVertical: 10,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		borderRadius: 15,
		overflow: "hidden",
	},
	angleIndicator: {
		fontSize: 48,
		fontWeight: "900",
		color: "white",
		marginTop: 10,
		textShadowColor: "rgba(0, 0, 0, 0.8)",
		textShadowOffset: { width: 0, height: 2 },
		textShadowRadius: 4,
	},
	// Barra de progreso
	progressBarContainer: {
		position: "absolute",
		top: "55%",
		left: 40,
		right: 40,
		zIndex: 10,
		alignItems: "center",
	},
	progressBarBackground: {
		width: "100%",
		height: 20,
		backgroundColor: "rgba(255, 255, 255, 0.2)",
		borderRadius: 10,
		overflow: "hidden",
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.3)",
	},
	progressBarFill: {
		height: "100%",
		borderRadius: 8,
	},
	progressText: {
		fontSize: 14,
		fontWeight: "bold",
		color: "white",
		marginTop: 5,
		textShadowColor: "rgba(0, 0, 0, 0.8)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 3,
	},
	// Badge de calidad
	qualityBadge: {
		position: "absolute",
		top: 220,
		alignSelf: "center",
		backgroundColor: "rgba(76, 175, 80, 0.9)",
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 20,
		zIndex: 10,
	},
	qualityText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "white",
	},
	// Panel inferior
	bottomPanel: {
		position: "absolute",
		bottom: 40,
		left: 20,
		right: 20,
		zIndex: 10,
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		borderRadius: 20,
		padding: 20,
		borderWidth: 2,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	statsRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	statItem: {
		flex: 1,
	},
	statLabel: {
		fontSize: 12,
		color: "#888",
		marginBottom: 3,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	statValue: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#4CAF50",
	},
	resetButtonContainer: {
		marginLeft: 10,
	},
	instructionsContainer: {
		marginTop: 10,
		paddingTop: 15,
		borderTopWidth: 1,
		borderTopColor: "rgba(255, 255, 255, 0.2)",
	},
	instructionText: {
		fontSize: 13,
		color: "#AAA",
		marginVertical: 3,
		textAlign: "center",
	},
	// Confetti
	confettiContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 9999,
		pointerEvents: "none",
	},
});
