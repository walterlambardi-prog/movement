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
import { useTranslation } from "react-i18next";

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

type Arm = "left" | "right";

type ArmState = "extended" | "curling" | "top";

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

const linePaint = Skia.Paint();
linePaint.setColor(Skia.Color("#6C63FF"));
linePaint.setStrokeWidth(12);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107"));
linePaint.setStrokeWidth(8);

const CONFETTI_INTERVAL = 10;
const UI_UPDATE_THROTTLE_MS = 140;
const REP_DEBOUNCE_MS = 650;

const ELBOW_EXTENDED_ANGLE = 155;
const ELBOW_TOP_ANGLE = 60;
const MIN_VISIBILITY = 0.55;

function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

function mapProgress(angle: number) {
	const clamped = Math.max(Math.min(angle, ELBOW_EXTENDED_ANGLE), ELBOW_TOP_ANGLE);
	const range = ELBOW_EXTENDED_ANGLE - ELBOW_TOP_ANGLE;
	const value = ELBOW_EXTENDED_ANGLE - clamped;
	return Math.min(100, Math.max(0, (value / range) * 100));
}

function describeArmState(state: ArmState, translate: (key: string) => string) {
	switch (state) {
		case "extended":
			return translate("hammerCurls.armState.extended");
		case "curling":
			return translate("hammerCurls.armState.curling");
		case "top":
			return translate("hammerCurls.armState.top");
		default:
			return state;
	}
}

const CameraButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
	<Button title={label} onPress={onPress} />
);

export default function HammerCurls() {
	const { t, i18n } = useTranslation();
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

	const lastRepTimeRef = useRef<number>(0);
	const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef<boolean>(true);
	const repCountRef = useRef<number>(0);
	const lastArmRef = useRef<Arm | null>(null);
	const leftStateRef = useRef<ArmState>("extended");
	const rightStateRef = useRef<ArmState>("extended");

	const [repCount, setRepCount] = useState(0);
	const [feedback, setFeedback] = useState<string>(t("hammerCurls.feedback.showArms"));
	const [activeArm, setActiveArm] = useState<Arm | null>(null);
	const [leftAngle, setLeftAngle] = useState<number>(0);
	const [rightAngle, setRightAngle] = useState<number>(0);
	const [leftState, setLeftState] = useState<ArmState>("extended");
	const [rightState, setRightState] = useState<ArmState>("extended");
	const [progress, setProgress] = useState<number>(0);
	const [showConfetti, setShowConfetti] = useState(false);
	const [lastRepArm, setLastRepArm] = useState<Arm | null>(null);

	const progressAnim = useRef(new Animated.Value(0)).current;
	const lastUiUpdateRef = useRef<number>(0);

	const voiceConfig = useMemo(
		() => ({
			language: i18n.language === "es" ? "es-ES" : "en-US",
			pitch: 1,
			rate: 0.9,
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
			const messages = t("hammerCurls.voice.milestones", {
				returnObjects: true,
				count,
			}) as string[];
			if (Array.isArray(messages) && messages.length > 0) {
				const randomIndex = Math.floor(Math.random() * messages.length);
				return messages[randomIndex];
			}
			return `${count}`;
		},
		[t]
	);

	const instructions = useMemo(
		() => t("hammerCurls.instructions", { returnObjects: true }) as string[],
		[t]
	);

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleReset = useCallback(() => {
		setRepCount(0);
		setFeedback(t("hammerCurls.feedback.showArms"));
		setActiveArm(null);
		setLeftState("extended");
		setRightState("extended");
		setProgress(0);
		setLastRepArm(null);
		if (confettiTimeoutRef.current) {
			clearTimeout(confettiTimeoutRef.current);
		}
		setShowConfetti(false);
	}, [t]);

	const HeaderRight = useMemo(
		() => <CameraButton label={t("common.changeCamera")} onPress={handleCameraChange} />,
		[handleCameraChange, t]
	);

	const screenOptions = useMemo(
		() => ({
			title: t("hammerCurls.title"),
			headerRight: () => HeaderRight,
		}),
		[HeaderRight, t]
	);

	useEffect(() => {
		speak(t("hammerCurls.voice.welcome"));
		return () => {
			Speech.stop();
		};
	}, [speak, t]);

	useEffect(() => {
		Animated.timing(progressAnim, {
			toValue: progress,
			duration: 200,
			useNativeDriver: false,
		}).start();
	}, [progress, progressAnim]);

	useEffect(() => {
		if (!activeArm && repCount === 0) {
			setFeedback(t("hammerCurls.feedback.showArms"));
		}
	}, [activeArm, repCount, t]);

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

	useEffect(() => {
		if (repCount > 0 && repCount % CONFETTI_INTERVAL === 0) {
			speak(getMilestoneMessage(repCount));
		}
		return () => {
			Speech.stop();
		};
	}, [getMilestoneMessage, repCount, speak]);

	useEffect(() => {
		PoseLandmarks?.initModel?.();

		if (!PoseLandmarks) {
			console.warn("PoseLandmarks module not available");
			return;
		}

		const poseLandmarksEmitter = new NativeEventEmitter(PoseLandmarks);
		const subscription = poseLandmarksEmitter.addListener("onPoseLandmarksDetected", (event) => {
			try {
				if (!event?.landmarks?.[0]) {
					setFeedback(t("hammerCurls.feedback.noPose"));
					return;
				}

				const detectedLandmarks = event.landmarks[0];
				landmarks.value = detectedLandmarks;

				const leftShoulder = detectedLandmarks[11];
				const rightShoulder = detectedLandmarks[12];
				const leftElbow = detectedLandmarks[13];
				const rightElbow = detectedLandmarks[14];
				const leftWrist = detectedLandmarks[15];
				const rightWrist = detectedLandmarks[16];

				const allPointsExist =
					leftShoulder && rightShoulder && leftElbow && rightElbow && leftWrist && rightWrist;

				if (!allPointsExist) {
					setFeedback(t("hammerCurls.feedback.showArms"));
					return;
				}

				const bodyVisible =
					leftShoulder.visibility > MIN_VISIBILITY &&
					rightShoulder.visibility > MIN_VISIBILITY &&
					leftElbow.visibility > MIN_VISIBILITY &&
					rightElbow.visibility > MIN_VISIBILITY &&
					leftWrist.visibility > MIN_VISIBILITY &&
					rightWrist.visibility > MIN_VISIBILITY;

				if (!bodyVisible) {
					setFeedback(t("hammerCurls.feedback.improveLight"));
					return;
				}

				const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
				const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

				const now = Date.now();
				if (now - lastUiUpdateRef.current > UI_UPDATE_THROTTLE_MS) {
					lastUiUpdateRef.current = now;
					setLeftAngle(Math.round(leftElbowAngle));
					setRightAngle(Math.round(rightElbowAngle));
				}

				const newLeftState: ArmState =
					leftElbowAngle < ELBOW_TOP_ANGLE
						? "top"
						: leftElbowAngle > ELBOW_EXTENDED_ANGLE
							? "extended"
							: "curling";
				const newRightState: ArmState =
					rightElbowAngle < ELBOW_TOP_ANGLE
						? "top"
						: rightElbowAngle > ELBOW_EXTENDED_ANGLE
							? "extended"
							: "curling";

				leftStateRef.current = newLeftState;
				rightStateRef.current = newRightState;

				const otherExtendedEnough = (arm: Arm) => {
					return arm === "left"
						? rightElbowAngle > ELBOW_EXTENDED_ANGLE - 10
						: leftElbowAngle > ELBOW_EXTENDED_ANGLE - 10;
				};

				const tryCount = (arm: Arm, angle: number, state: ArmState) => {
					if (state !== "top") return;
					if (!otherExtendedEnough(arm)) return;
					if (lastArmRef.current && lastArmRef.current === arm) return;

					const nowTime = Date.now();
					if (nowTime - lastRepTimeRef.current < REP_DEBOUNCE_MS) return;

					lastRepTimeRef.current = nowTime;
					lastArmRef.current = arm;
					setLastRepArm(arm);
					setActiveArm(arm);
					setProgress(mapProgress(angle));

					setRepCount((prev) => {
						const newTotal = prev + 1;
						repCountRef.current = newTotal;

						if (newTotal % CONFETTI_INTERVAL === 0) {
							setShowConfetti(true);
							if (confettiTimeoutRef.current) {
								clearTimeout(confettiTimeoutRef.current);
							}
							// eslint-disable-next-line max-nested-callbacks
							confettiTimeoutRef.current = setTimeout(() => {
								if (isMountedRef.current) setShowConfetti(false);
							}, 3000);
						}

						return newTotal;
					});

					setFeedback(
						t("hammerCurls.feedback.counting", {
							arm: t(`hammerCurls.armLabel.${arm}` as const),
						})
					);
					speak(`${repCountRef.current + 1}`);
				};

				tryCount("left", leftElbowAngle, newLeftState);
				tryCount("right", rightElbowAngle, newRightState);

				setLeftState(newLeftState);
				setRightState(newRightState);

				if (newLeftState === "extended" && newRightState === "extended") {
					setFeedback(t("hammerCurls.feedback.bothDown"));
					setActiveArm(null);
					setProgress(0);
				}
			} catch (error) {
				console.error("Error in pose landmarks listener:", error);
			}
		});

		return () => {
			subscription.remove();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [speak, t]);

	const frameProcessor = useSkiaFrameProcessor(
		(frame) => {
			"worklet";
			if (poseLandmarkPlugin == null) return;
			poseLandmarkPlugin.call(frame);
			if (landmarks?.value !== undefined && Object.keys(landmarks?.value).length > 0) {
				const body = landmarks?.value;
				const frameWidth = frame.width;
				const frameHeight = frame.height;

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
			/>

			<View style={styles.overlay} />

			<View style={styles.topBar}>
				<View style={styles.counterContainer}>
					<Text style={styles.counterValue}>{repCount}</Text>
					<Text style={styles.counterLabel}>{t("hammerCurls.counterLabel")}</Text>
				</View>
			</View>

			<View style={styles.centerFeedback}>
				<Text style={[styles.feedbackText]}>{feedback}</Text>
				<View style={styles.armAnglesRow}>
					<View style={styles.armChip}>
						<Text style={styles.armLabel}>{t("hammerCurls.armLabel.left")}</Text>
						<Text style={styles.armValue}>{leftAngle}°</Text>
						<Text style={styles.armState}>{describeArmState(leftState, t)}</Text>
					</View>
					<View style={styles.armChip}>
						<Text style={styles.armLabel}>{t("hammerCurls.armLabel.right")}</Text>
						<Text style={styles.armValue}>{rightAngle}°</Text>
						<Text style={styles.armState}>{describeArmState(rightState, t)}</Text>
					</View>
				</View>
			</View>

			{activeArm && (
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
								activeArm === "left" ? styles.leftColor : styles.rightColor,
							]}
						/>
					</View>
					<Text style={styles.progressText}>{Math.round(progress)}%</Text>
				</View>
			)}

			<View style={styles.bottomPanel}>
				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statLabel}>{t("common.lastArm")}</Text>
						<Text style={styles.statValue}>
							{lastRepArm ? t(`hammerCurls.armLabel.${lastRepArm}` as const) : "-"}
						</Text>
					</View>
					<View style={styles.resetButtonContainer}>
						<Button title={t("common.reset")} onPress={handleReset} color="#FF6B6B" />
					</View>
				</View>

				<View style={styles.instructionsContainer}>
					{instructions.map((item) => (
						<Text key={item} style={styles.instructionText}>
							{item}
						</Text>
					))}
				</View>
			</View>

			{showConfetti && (
				<View style={styles.confettiContainer}>
					<Confetti count={150} fallDuration={3000} />
				</View>
			)}
		</View>
	);
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
		borderColor: "#6C63FF",
		alignItems: "center",
	},
	counterValue: {
		fontSize: 80,
		fontWeight: "900",
		color: "#6C63FF",
		letterSpacing: 2,
		textShadowColor: "rgba(108, 99, 255, 0.5)",
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
	centerFeedback: {
		position: "absolute",
		top: "38%",
		left: 20,
		right: 20,
		zIndex: 10,
		alignItems: "center",
	},
	feedbackText: {
		fontSize: 28,
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
		color: "white",
	},
	armAnglesRow: {
		flexDirection: "row",
		marginTop: 12,
		gap: 10,
	},
	armChip: {
		backgroundColor: "rgba(0, 0, 0, 0.55)",
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
		alignItems: "center",
	},
	armLabel: {
		fontSize: 12,
		color: "#AAA",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	armValue: {
		fontSize: 30,
		fontWeight: "900",
		color: "white",
	},
	armState: {
		fontSize: 12,
		color: "#DDD",
	},
	progressBarContainer: {
		position: "absolute",
		top: "54%",
		left: 40,
		right: 40,
		zIndex: 10,
		alignItems: "center",
	},
	progressBarBackground: {
		width: "100%",
		height: 18,
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
	leftColor: {
		backgroundColor: "#00C853",
	},
	rightColor: {
		backgroundColor: "#FF7043",
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
		color: "#6C63FF",
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
