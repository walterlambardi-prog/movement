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
import { styles } from "./LateralRaises.styles";
import { ArmState, KeypointData, KeypointsMap } from "./LateralRaises.types";

const { PoseLandmarks } = NativeModules;

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
linePaint.setColor(Skia.Color("#00B8D4"));
linePaint.setStrokeWidth(12);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107"));
linePaint.setStrokeWidth(8);

const CONFETTI_INTERVAL = 10;
const UI_UPDATE_THROTTLE_MS = 120;
const REP_DEBOUNCE_MS = 850;

const MIN_VISIBILITY = 0.55;
const ANGLE_UP = 72;
const ANGLE_UP_RELEASE = 64;
const ANGLE_DOWN = 32;
const ANGLE_DOWN_RESET = 38;

function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

function mapProgress(angle: number) {
	const clamped = Math.max(Math.min(angle, ANGLE_UP), ANGLE_DOWN);
	const range = ANGLE_UP - ANGLE_DOWN;
	const value = clamped - ANGLE_DOWN;
	return Math.min(100, Math.max(0, (value / range) * 100));
}

function describeArmState(state: ArmState, translate: (key: string) => string) {
	switch (state) {
		case "down":
			return translate("lateralRaises.armState.down");
		case "raising":
			return translate("lateralRaises.armState.raising");
		case "up":
			return translate("lateralRaises.armState.up");
		case "lowering":
			return translate("lateralRaises.armState.lowering");
		default:
			return state;
	}
}

const CameraButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
	<Button title={label} onPress={onPress} />
);

export default function LateralRaises() {
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
	const stateRef = useRef<ArmState>("down");

	const [repCount, setRepCount] = useState(0);
	const [feedback, setFeedback] = useState<string>(t("lateralRaises.feedback.showShoulders"));
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

	const instructions = useMemo(
		() => t("lateralRaises.instructions", { returnObjects: true }) as string[],
		[t]
	);
	const [leftAngle, setLeftAngle] = useState<number>(0);
	const [rightAngle, setRightAngle] = useState<number>(0);
	const [leftState, setLeftState] = useState<ArmState>("down");
	const [rightState, setRightState] = useState<ArmState>("down");
	const [progress, setProgress] = useState<number>(0);
	const [showConfetti, setShowConfetti] = useState(false);

	const progressAnim = useRef(new Animated.Value(0)).current;
	const lastUiUpdateRef = useRef<number>(0);

	const getMilestoneMessage = useCallback(
		(count: number) => {
			const messages = t("lateralRaises.voice.milestones", {
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

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleReset = useCallback(() => {
		setRepCount(0);
		setFeedback(t("lateralRaises.feedback.showShoulders"));
		setLeftState("down");
		setRightState("down");
		stateRef.current = "down";
		setProgress(0);
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
			title: t("lateralRaises.title"),
			headerRight: () => HeaderRight,
		}),
		[HeaderRight, t]
	);

	useEffect(() => {
		speak(t("lateralRaises.voice.welcome"));
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
		if (stateRef.current === "down") {
			setFeedback(t("lateralRaises.feedback.showShoulders"));
		}
	}, [t]);

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
					setFeedback(t("lateralRaises.feedback.noPose"));
					return;
				}

				const detectedLandmarks = event.landmarks[0];
				landmarks.value = detectedLandmarks;

				const leftShoulder = detectedLandmarks[11];
				const rightShoulder = detectedLandmarks[12];
				const leftElbow = detectedLandmarks[13];
				const rightElbow = detectedLandmarks[14];
				const leftHip = detectedLandmarks[23];
				const rightHip = detectedLandmarks[24];

				const allPointsExist =
					leftShoulder && rightShoulder && leftElbow && rightElbow && leftHip && rightHip;

				if (!allPointsExist) {
					setFeedback(t("lateralRaises.feedback.showShoulders"));
					return;
				}

				const bodyVisible =
					leftShoulder.visibility > MIN_VISIBILITY &&
					rightShoulder.visibility > MIN_VISIBILITY &&
					leftElbow.visibility > MIN_VISIBILITY &&
					rightElbow.visibility > MIN_VISIBILITY &&
					leftHip.visibility > MIN_VISIBILITY &&
					rightHip.visibility > MIN_VISIBILITY;

				if (!bodyVisible) {
					setFeedback(t("lateralRaises.feedback.improveLight"));
					return;
				}

				const leftAngleVal = calculateAngle(leftElbow, leftShoulder, leftHip);
				const rightAngleVal = calculateAngle(rightElbow, rightShoulder, rightHip);

				const now = Date.now();
				if (now - lastUiUpdateRef.current > UI_UPDATE_THROTTLE_MS) {
					lastUiUpdateRef.current = now;
					setLeftAngle(Math.round(leftAngleVal));
					setRightAngle(Math.round(rightAngleVal));
					setProgress((mapProgress(leftAngleVal) + mapProgress(rightAngleVal)) / 2);
				}

				const bothDown = leftAngleVal < ANGLE_DOWN && rightAngleVal < ANGLE_DOWN;
				const bothReset = leftAngleVal < ANGLE_DOWN_RESET && rightAngleVal < ANGLE_DOWN_RESET;
				const avgAngle = (leftAngleVal + rightAngleVal) / 2;
				const minAngle = Math.min(leftAngleVal, rightAngleVal);
				const bothUp = avgAngle > ANGLE_UP && minAngle > ANGLE_UP - 6;
				const leavingUp = avgAngle < ANGLE_UP_RELEASE || minAngle < ANGLE_UP_RELEASE;

				if (bothReset && stateRef.current !== "down") {
					stateRef.current = "down";
					setLeftState("down");
					setRightState("down");
					setFeedback(t("lateralRaises.feedback.armsDown"));
					return;
				}

				if (stateRef.current === "down" && !bothDown) {
					stateRef.current = "raising";
					setLeftState("raising");
					setRightState("raising");
					setFeedback(t("lateralRaises.feedback.raise"));
				}

				if (bothUp && stateRef.current !== "up") {
					const nowTime = Date.now();
					if (nowTime - lastRepTimeRef.current > REP_DEBOUNCE_MS) {
						lastRepTimeRef.current = nowTime;
						stateRef.current = "up";
						setLeftState("up");
						setRightState("up");

						setRepCount((prev) => {
							const newTotal = prev + 1;
							repCountRef.current = newTotal;

							if (newTotal % CONFETTI_INTERVAL === 0) {
								setShowConfetti(true);
								if (confettiTimeoutRef.current) {
									clearTimeout(confettiTimeoutRef.current);
								}
								confettiTimeoutRef.current = setTimeout(() => {
									if (isMountedRef.current) setShowConfetti(false);
								}, 3000);
							}

							return newTotal;
						});

						setFeedback(t("lateralRaises.feedback.upHold"));
						speak(`${repCountRef.current + 1}`);
					}
					return;
				}

				if (stateRef.current === "up" && leavingUp) {
					stateRef.current = "lowering";
					setLeftState("lowering");
					setRightState("lowering");
					setFeedback(t("lateralRaises.feedback.lower"));
					return;
				}

				if (!bothDown && !bothUp && stateRef.current !== "raising") {
					stateRef.current = "raising";
					setLeftState("raising");
					setRightState("raising");
					setFeedback(t("lateralRaises.feedback.raise"));
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
					<Text style={styles.counterLabel}>{t("lateralRaises.counterLabel")}</Text>
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
							styles.progressColor,
						]}
					/>
				</View>
				<Text style={styles.progressText}>{Math.round(progress)}%</Text>
			</View>

			<View style={styles.bottomPanel}>
				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statLabel}>{t("common.state")}</Text>
						<Text style={styles.statValue}>{describeArmState(stateRef.current, t)}</Text>
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
