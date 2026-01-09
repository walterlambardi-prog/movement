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
	Frame,
	useCameraDevice,
	useCameraFormat,
	useCameraPermission,
	useSkiaFrameProcessor,
	VisionCameraProxy,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";
import { useTranslation } from "react-i18next";

const { PoseLandmarks } = NativeModules;

// Initialize the frame processor plugin 'poseLandmarks'
const poseLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin("poseLandmarks", {});

function poseLandmarks(frame: Frame) {
	"worklet";
	if (poseLandMarkPlugin == null) {
		throw new Error("Failed to load Frame Processor Plugin!");
	}
	return poseLandMarkPlugin.call(frame);
}

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
linePaint.setColor(Skia.Color("#FF6B6B")); // Rojo para flexiones
linePaint.setStrokeWidth(25);

// Paint para los círculos (keypoints)
const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107")); // Amarillo para los puntos
linePaint.setStrokeWidth(10);

// Configuración: Mostrar confetti cada N flexiones
const CONFETTI_INTERVAL = 5;

// Detection tolerances
const MIN_VISIBILITY = 0.3; // More permissive visibility so the body can be considered visible
const HIP_SHOULDER_MAX_DELTA = 0.5; // More lenient plank tolerance between hips and shoulders
const KNEE_HIP_MIN_DELTA = -0.25; // Knees can sit a bit higher relative to hips

// Push-up angle thresholds (more permissive to count shallow reps)
const ELBOW_EXTENDED = 140; // Arms considered extended/ready
const ELBOW_START_DESCENT = 135; // Start counting descent sooner
const ELBOW_BOTTOM = 110; // Depth considered valid
const ELBOW_ASCEND_TRIGGER = 120; // Start ascent once past this
const ELBOW_COMPLETE = 140; // Count rep when back near extension

// Función para calcular el ángulo entre 3 puntos
function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

// Estados de la flexión mejorados
type PushupState = "idle" | "ready" | "descending" | "bottom" | "ascending";

type RepQuality = "perfect" | "good" | "incomplete";

type StateTransitionResult = {
	newState: PushupState;
	feedback: string;
	incrementCount: boolean;
	quality?: RepQuality;
	progress: number; // 0-100 para mostrar progreso visual
};

// Función mejorada para manejar las transiciones de estado de la flexión
// Usa ángulo de codo (enfoque estándar de apps de fitness)
function processPushupStateMachine(
	currentState: PushupState,
	elbowAngle: number, // Ángulo del codo (shoulder-elbow-wrist)
	bodyFullyVisible: boolean,
	isInPlankPosition: boolean, // Cuerpo en posición de plancha
	translate: (key: string, options?: Record<string, unknown>) => string
): StateTransitionResult {
	const angle = Math.round(elbowAngle);

	// Si el cuerpo no está completamente visible, volver a idle
	if (!bodyFullyVisible) {
		return {
			newState: "idle",
			feedback: translate("pushups.feedback.noBody"),
			incrementCount: false,
			progress: 0,
		};
	}

	// IDLE -> READY: En posición de plancha con brazos extendidos
	if (currentState === "idle") {
		if (isInPlankPosition && elbowAngle > ELBOW_EXTENDED) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.ready"),
				incrementCount: false,
				progress: 0,
			};
		}
		return {
			newState: "idle",
			feedback: isInPlankPosition
				? translate("pushups.feedback.extendArms", { angle })
				: translate("pushups.feedback.needPlank"),
			incrementCount: false,
			progress: 0,
		};
	}

	// READY -> DESCENDING: Comenzando a flexionar los brazos
	if (currentState === "ready") {
		if (elbowAngle < ELBOW_START_DESCENT) {
			return {
				newState: "descending",
				feedback: translate("pushups.feedback.goingDown"),
				incrementCount: false,
				progress: 10,
			};
		}
		return {
			newState: "ready",
			feedback: translate("pushups.feedback.ready"),
			incrementCount: false,
			progress: 0,
		};
	}

	// DESCENDING: Bajando
	if (currentState === "descending") {
		// Llegó a buena profundidad (brazos bien flexionados)
		if (elbowAngle < ELBOW_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("pushups.feedback.goodDepth"),
				incrementCount: false,
				progress: 50,
			};
		}
		// Se devolvió antes de llegar abajo
		if (elbowAngle > ELBOW_EXTENDED) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.goLower"),
				incrementCount: false,
				progress: 0,
			};
		}
		// Calculando progreso basado en ángulo (140° -> 110°)
		const progress = Math.min(
			50,
			((ELBOW_EXTENDED - elbowAngle) / (ELBOW_EXTENDED - ELBOW_BOTTOM)) * 50
		);
		return {
			newState: "descending",
			feedback: translate("pushups.feedback.keepGoing", { angle }),
			incrementCount: false,
			progress,
		};
	}

	// BOTTOM: En la posición más baja
	if (currentState === "bottom") {
		// Empezó a extender los brazos
		if (elbowAngle > ELBOW_ASCEND_TRIGGER) {
			return {
				newState: "ascending",
				feedback: translate("pushups.feedback.push"),
				incrementCount: false,
				progress: 60,
			};
		}
		return {
			newState: "bottom",
			feedback: translate("pushups.feedback.nowExtend"),
			incrementCount: false,
			progress: 50,
		};
	}

	// ASCENDING: Extendiendo los brazos
	if (currentState === "ascending") {
		// Completó la flexión - brazos extendidos
		if (elbowAngle > ELBOW_COMPLETE) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.excellent"),
				incrementCount: true,
				quality: "perfect",
				progress: 100,
			};
		}
		// Se devolvió antes de completar
		if (elbowAngle < ELBOW_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("pushups.feedback.keepPushing"),
				incrementCount: false,
				progress: 50,
			};
		}
		// Calculando progreso basado en ángulo (110° -> 140°)
		const progress =
			50 + Math.min(50, ((elbowAngle - ELBOW_BOTTOM) / (ELBOW_COMPLETE - ELBOW_BOTTOM)) * 50);
		return {
			newState: "ascending",
			feedback: translate("pushups.feedback.almost", { angle }),
			incrementCount: false,
			progress,
		};
	}

	return {
		newState: currentState,
		feedback: translate("pushups.feedback.keepPushing"),
		incrementCount: false,
		progress: 0,
	};
}

const CameraButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
	<Button title={label} onPress={onPress} />
);

export default function Pushups() {
	const { t, i18n } = useTranslation();
	const landmarks = useSharedValue<KeypointsMap>({});
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const device = useCameraDevice(cameraPosition);
	const format = useCameraFormat(device, [{ fps: 30 }]);

	// Referencias para control de tiempo
	const lastPushupTimeRef = useRef<number>(0);
	const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef<boolean>(true);
	const pushupCountRef = useRef<number>(0);
	const pushupStateRef = useRef<PushupState>("idle");

	// Estados del contador
	const [pushupCount, setPushupCount] = useState(0);
	const [pushupState, setPushupState] = useState<PushupState>("idle");
	const [currentAngle, setCurrentAngle] = useState<number>(0);
	const [feedback, setFeedback] = useState<string>(t("pushups.feedback.noBody"));
	const [progress, setProgress] = useState<number>(0);
	const [showConfetti, setShowConfetti] = useState(false);
	const [lastRepQuality, setLastRepQuality] = useState<RepQuality | null>(null);

	const voiceConfig = useMemo(
		() => ({
			language: i18n.language === "es" ? "es-ES" : "en-US",
			pitch: 1,
			rate: 0.85,
		}),
		[i18n.language]
	);

	const speak = useCallback(
		(text: string) => {
			Speech.speak(text, voiceConfig);
		},
		[voiceConfig]
	);

	const getMilestoneMessage = useCallback(
		(count: number) => {
			const messages = t("pushups.voice.milestones", { returnObjects: true, count }) as string[];
			if (Array.isArray(messages) && messages.length > 0) {
				const randomIndex = Math.floor(Math.random() * messages.length);
				return messages[randomIndex];
			}
			return `${count}`;
		},
		[t]
	);

	const instructions = useMemo(
		() => t("pushups.instructions", { returnObjects: true }) as string[],
		[t]
	);

	// Mantener refs sincronizados con el estado
	useEffect(() => {
		pushupCountRef.current = pushupCount;
	}, [pushupCount]);

	useEffect(() => {
		pushupStateRef.current = pushupState;
	}, [pushupState]);

	// Animación para la barra de progreso
	const progressAnim = useRef(new Animated.Value(0)).current;

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleReset = useCallback(() => {
		setPushupCount(0);
		setPushupState("idle");
		setProgress(0);
		setFeedback(t("pushups.feedback.noBody"));
		setLastRepQuality(null);
		setShowConfetti(false);
		if (confettiTimeoutRef.current) {
			clearTimeout(confettiTimeoutRef.current);
		}
	}, [t]);

	const HeaderRight = useMemo(
		() => <CameraButton label={t("common.changeCamera")} onPress={handleCameraChange} />,
		[handleCameraChange, t]
	);

	const screenOptions = useMemo(
		() => ({
			title: t("pushups.title"),
			headerRight: () => HeaderRight,
		}),
		[HeaderRight, t]
	);

	// Anunciar mensaje de bienvenida al montar el componente
	useEffect(() => {
		speak(t("pushups.voice.welcome"));
		return () => {
			Speech.stop();
		};
	}, [speak, t]);

	// Animar la barra de progreso cuando cambie
	useEffect(() => {
		Animated.timing(progressAnim, {
			toValue: progress,
			duration: 200,
			useNativeDriver: false,
		}).start();
	}, [progress, progressAnim]);

	useEffect(() => {
		if (pushupState === "idle") {
			setFeedback(t("pushups.feedback.noBody"));
		}
	}, [pushupState, t]);

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

	// Anunciar voz cuando cambia el contador (evita duplicados)
	useEffect(() => {
		if (pushupCount > 0) {
			if (pushupCount % CONFETTI_INTERVAL === 0) {
				// Anuncio especial para múltiplos del intervalo
				speak(getMilestoneMessage(pushupCount));
			} else {
				// Anuncio simple del número
				speak(`${pushupCount}`);
			}
		}
		return () => {
			Speech.stop();
		};
	}, [getMilestoneMessage, pushupCount, speak]);

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
					setPushupState("idle");
					setFeedback(t("pushups.feedback.noPose"));
					setProgress(0);
					return;
				}

				const detectedLandmarks = event.landmarks[0];
				landmarks.value = detectedLandmarks;

				// Verificar que los puntos necesarios existan
				const leftShoulder = detectedLandmarks[11];
				const rightShoulder = detectedLandmarks[12];
				const leftElbow = detectedLandmarks[13];
				const rightElbow = detectedLandmarks[14];
				const leftWrist = detectedLandmarks[15];
				const rightWrist = detectedLandmarks[16];
				const leftHip = detectedLandmarks[23];
				const rightHip = detectedLandmarks[24];
				const leftKnee = detectedLandmarks[25];
				const rightKnee = detectedLandmarks[26];
				const leftAnkle = detectedLandmarks[27];
				const rightAnkle = detectedLandmarks[28];

				// Validar que todos los puntos clave del cuerpo existan
				const allPointsExist =
					leftShoulder &&
					rightShoulder &&
					leftElbow &&
					rightElbow &&
					leftWrist &&
					rightWrist &&
					leftHip &&
					rightHip &&
					leftKnee &&
					rightKnee &&
					leftAnkle &&
					rightAnkle;

				if (!allPointsExist) {
					setPushupState("idle");
					setFeedback(t("pushups.feedback.noBody"));
					setProgress(0);
					return;
				}

				// Verificar visibilidad del cuerpo completo
				const bodyFullyVisible =
					leftShoulder.visibility > MIN_VISIBILITY &&
					rightShoulder.visibility > MIN_VISIBILITY &&
					leftElbow.visibility > MIN_VISIBILITY &&
					rightElbow.visibility > MIN_VISIBILITY &&
					leftWrist.visibility > MIN_VISIBILITY &&
					rightWrist.visibility > MIN_VISIBILITY &&
					leftHip.visibility > MIN_VISIBILITY &&
					rightHip.visibility > MIN_VISIBILITY &&
					leftKnee.visibility > MIN_VISIBILITY &&
					rightKnee.visibility > MIN_VISIBILITY;

				// Calcular ángulos de los codos (enfoque estándar de apps de fitness)
				const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
				const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
				const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
				setCurrentAngle(avgElbowAngle);

				// Validar posición de plancha: cuerpo relativamente recto y manos en posición
				const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
				const avgHipY = (leftHip.y + rightHip.y) / 2;
				const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
				// En plancha: caderas no deben estar muy abajo ni muy arriba
				const isInPlankPosition =
					Math.abs(avgHipY - avgShoulderY) < HIP_SHOULDER_MAX_DELTA &&
					avgKneeY > avgHipY + KNEE_HIP_MIN_DELTA;

				// Procesar la máquina de estados
				const result = processPushupStateMachine(
					pushupStateRef.current,
					avgElbowAngle,
					bodyFullyVisible,
					isInPlankPosition,
					t
				);

				setPushupState(result.newState);
				setFeedback(result.feedback);
				setProgress(result.progress);

				// Manejar el incremento del contador con debounce
				if (result.incrementCount) {
					const now = Date.now();
					// Debounce de 1.5 segundos entre reps
					if (now - lastPushupTimeRef.current > 1500) {
						lastPushupTimeRef.current = now;

						if (!isMountedRef.current) return;

						// Actualizar calidad de la rep
						setLastRepQuality(result.quality || "good");

						// Incrementar contador usando setState funcional y manejar confetti
						setPushupCount((prevCount) => {
							const newCount = prevCount + 1;

							// Mostrar confetti cada CONFETTI_INTERVAL flexiones
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
	}, [t]);

	const frameProcessor = useSkiaFrameProcessor((frame) => {
		"worklet";
		frame.render();
		poseLandmarks(frame);

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
	}, []);

	if (!hasPermission) {
		return (
			<View style={styles.container}>
				<Text>{t("common.noPermission")}</Text>
				<Button title={t("common.requestPermission") || ""} onPress={requestPermission} />
			</View>
		);
	}

	if (device == null) {
		return (
			<View style={styles.container}>
				<Text>{t("common.noDevice")}</Text>
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
				photoQualityBalance="speed"
				videoBitRate="extra-low"
			/>

			{/* Overlay oscuro para mejorar legibilidad */}
			<View style={styles.overlay} />

			{/* Contador principal - más grande y visible */}
			<View style={styles.topBar}>
				<View style={styles.counterContainer}>
					<Text style={styles.counterValue}>{pushupCount}</Text>
					<Text style={styles.counterLabel}>{t("pushups.counterLabel")}</Text>
				</View>
			</View>

			{/* Feedback central - mensaje principal */}
			<View style={styles.centerFeedback}>
				<Text style={[styles.feedbackText, getFeedbackStyle(pushupState)]}>{feedback}</Text>
				{pushupState !== "idle" && (
					<Text style={styles.angleIndicator}>{Math.round(currentAngle)}°</Text>
				)}
			</View>

			{/* Barra de progreso visual */}
			{(pushupState === "descending" ||
				pushupState === "ascending" ||
				pushupState === "bottom") && (
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
								getProgressBarColor(pushupState),
							]}
						/>
					</View>
					<Text style={styles.progressText}>{Math.round(progress)}%</Text>
				</View>
			)}

			{/* Indicador de calidad de la última rep */}
			{lastRepQuality && pushupState === "ready" && (
				<View style={styles.qualityBadge}>
					<Text style={styles.qualityText}>
						{lastRepQuality === "perfect" ? t("common.quality.perfect") : t("common.quality.good")}
					</Text>
				</View>
			)}

			{/* Panel inferior con controles */}
			<View style={styles.bottomPanel}>
				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statLabel}>{t("common.state")}</Text>
						<Text style={styles.statValue}>{getStateLabel(pushupState, t)}</Text>
					</View>
					<View style={styles.resetButtonContainer}>
						<Button title={t("common.reset")} onPress={handleReset} color="#FF6B6B" />
					</View>
				</View>

				{/* Guía de instrucciones compacta */}
				{pushupState === "idle" && (
					<View style={styles.instructionsContainer}>
						{instructions.map((item) => (
							<Text key={item} style={styles.instructionText}>
								{item}
							</Text>
						))}
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
function getFeedbackStyle(state: PushupState) {
	switch (state) {
		case "idle":
			return { color: "#FFC107" }; // Amarillo - atención
		case "ready":
			return { color: "#FF6B6B" }; // Rojo - listo
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
function getProgressBarColor(state: PushupState) {
	switch (state) {
		case "descending":
			return { backgroundColor: "#2196F3" }; // Azul
		case "bottom":
			return { backgroundColor: "#FF9800" }; // Naranja
		case "ascending":
			return { backgroundColor: "#FF6B6B" }; // Rojo
		default:
			return { backgroundColor: "#FF6B6B" };
	}
}

// Función auxiliar para etiqueta del estado
function getStateLabel(state: PushupState, translate: (key: string) => string): string {
	switch (state) {
		case "idle":
			return translate("pushups.stateLabel.idle");
		case "ready":
			return translate("pushups.stateLabel.ready");
		case "descending":
			return translate("pushups.stateLabel.descending");
		case "bottom":
			return translate("pushups.stateLabel.bottom");
		case "ascending":
			return translate("pushups.stateLabel.ascending");
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
		borderColor: "#FF6B6B",
		alignItems: "center",
	},
	counterValue: {
		fontSize: 80,
		fontWeight: "900",
		color: "#FF6B6B",
		letterSpacing: 2,
		textShadowColor: "rgba(255, 107, 107, 0.5)",
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
	bodyAngleIndicator: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#FFC107",
		marginTop: 8,
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
		backgroundColor: "rgba(255, 107, 107, 0.9)",
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
		color: "#FF6B6B",
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
