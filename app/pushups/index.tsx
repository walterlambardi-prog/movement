import { Skia } from "@shopify/react-native-skia";
import { Stack } from "expo-router";
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
import { styles } from "./Pushups.styles";
import {
	KeypointData,
	KeypointsMap,
	PushupState,
	RepQuality,
	StateTransitionResult,
} from "./Pushups.types";
import { useSessionRecorder } from "../state/useSessionRecorder";
import { useRoutineStep } from "../routine/useRoutineStep";

const { PoseLandmarks } = NativeModules;

const poseLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin("poseLandmarks", {});

function poseLandmarks(frame: Frame) {
	"worklet";
	if (poseLandMarkPlugin == null) {
		throw new Error("Failed to load Frame Processor Plugin!");
	}
	return poseLandMarkPlugin.call(frame);
}

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
linePaint.setColor(Skia.Color("#FF6B6B"));
linePaint.setStrokeWidth(25);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107"));
linePaint.setStrokeWidth(10);

const MIN_VISIBILITY = 0.45;
const HIP_SHOULDER_MAX_DELTA = 0.48;
const SHOULDER_LEVEL_DELTA = 0.2;
const SMOOTHING_ALPHA = 0.28;
const VISIBILITY_EPSILON = 0.1;
const BOTTOM_HOLD_MS = 80;
const MAX_TORSO_ANGLE = 35; // degrees from horizontal; larger means too vertical
const MAX_FRAME_HEIGHT = 0.6; // normalized bbox height threshold to reject standing
const MAX_HEIGHT_WIDTH_RATIO = 0.9; // if height ~= width, likely vertical

const ELBOW_EXTENDED = 136;
const ELBOW_START_DESCENT = 132;
const ELBOW_BOTTOM = 108;
const ELBOW_ASCEND_TRIGGER = 118;
const ELBOW_COMPLETE = 138;

function selectElbowAngle(
	leftShoulder: KeypointData,
	leftElbow: KeypointData,
	leftWrist: KeypointData,
	rightShoulder: KeypointData,
	rightElbow: KeypointData,
	rightWrist: KeypointData
) {
	const leftVisibility =
		(leftShoulder.visibility + leftElbow.visibility + leftWrist.visibility) / 3;
	const rightVisibility =
		(rightShoulder.visibility + rightElbow.visibility + rightWrist.visibility) / 3;

	const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
	const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

	if (Math.abs(leftVisibility - rightVisibility) < VISIBILITY_EPSILON) {
		return (leftAngle + rightAngle) / 2;
	}

	return leftVisibility > rightVisibility ? leftAngle : rightAngle;
}

function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

function processPushupStateMachine(
	currentState: PushupState,
	elbowAngle: number,
	bodyFullyVisible: boolean,
	isInPlankPosition: boolean,
	translate: (key: string, options?: Record<string, unknown>) => string
): StateTransitionResult {
	const angle = Math.round(elbowAngle);

	if (!bodyFullyVisible) {
		return {
			newState: "idle",
			feedback: translate("pushups.feedback.noBody"),
			incrementCount: false,
			progress: 0,
		};
	}

	if (currentState === "idle") {
		if (isInPlankPosition && elbowAngle > ELBOW_EXTENDED) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.ready"),
				incrementCount: false,
				progress: 0,
			};
		}
		if (isInPlankPosition && elbowAngle < ELBOW_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("pushups.feedback.nowExtend"),
				incrementCount: false,
				progress: 50,
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

	if (currentState === "descending") {
		if (elbowAngle < ELBOW_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("pushups.feedback.goodDepth"),
				incrementCount: false,
				progress: 50,
			};
		}
		if (elbowAngle > ELBOW_EXTENDED) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.goLower"),
				incrementCount: false,
				progress: 0,
			};
		}
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

	if (currentState === "bottom") {
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

	if (currentState === "ascending") {
		if (elbowAngle > ELBOW_COMPLETE) {
			return {
				newState: "ready",
				feedback: translate("pushups.feedback.excellent"),
				incrementCount: true,
				quality: "perfect",
				progress: 100,
			};
		}
		if (elbowAngle < ELBOW_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("pushups.feedback.keepPushing"),
				incrementCount: false,
				progress: 50,
			};
		}
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
	const { t } = useTranslation();
	const landmarks = useSharedValue<KeypointsMap>({});
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const device = useCameraDevice(cameraPosition);
	const format = useCameraFormat(device, [{ fps: 24 }]);

	const lastPushupTimeRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);
	const pushupCountRef = useRef<number>(0);
	const pushupStateRef = useRef<PushupState>("idle");
	const angleEmaRef = useRef<number | null>(null);
	const bottomEntryRef = useRef<number | null>(null);

	const [pushupCount, setPushupCount] = useState(0);
	const [pushupState, setPushupState] = useState<PushupState>("idle");
	const [currentAngle, setCurrentAngle] = useState<number>(0);
	const [feedback, setFeedback] = useState<string>(t("pushups.feedback.noBody"));
	const [progress, setProgress] = useState<number>(0);
	const [lastRepQuality, setLastRepQuality] = useState<RepQuality | null>(null);

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep("pushups");
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - pushupCount, 0) : null),
		[pushupCount, target]
	);

	useSessionRecorder("pushups", pushupCount);

	const instructions = useMemo(
		() => t("pushups.instructions", { returnObjects: true }) as string[],
		[t]
	);

	useEffect(() => {
		pushupCountRef.current = pushupCount;
	}, [pushupCount]);

	useEffect(() => {
		pushupStateRef.current = pushupState;
	}, [pushupState]);

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

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		advanceToNext(pushupCount);
	}, [advanceToNext, pushupCount]);

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
					setPushupState("idle");
					setFeedback(t("pushups.feedback.noPose"));
					setProgress(0);
					return;
				}

				const detectedLandmarks: KeypointsMap = event.landmarks[0];
				landmarks.value = detectedLandmarks;

				const leftShoulder = detectedLandmarks[11];
				const rightShoulder = detectedLandmarks[12];
				const leftElbow = detectedLandmarks[13];
				const rightElbow = detectedLandmarks[14];
				const leftWrist = detectedLandmarks[15];
				const rightWrist = detectedLandmarks[16];
				const leftHip = detectedLandmarks[23];
				const rightHip = detectedLandmarks[24];

				const allPointsExist =
					leftShoulder &&
					rightShoulder &&
					leftElbow &&
					rightElbow &&
					leftWrist &&
					rightWrist &&
					leftHip &&
					rightHip;

				if (!allPointsExist) {
					setPushupState("idle");
					setFeedback(t("pushups.feedback.noBody"));
					setProgress(0);
					return;
				}

				const bodyFullyVisible =
					leftShoulder.visibility > MIN_VISIBILITY &&
					rightShoulder.visibility > MIN_VISIBILITY &&
					leftElbow.visibility > MIN_VISIBILITY &&
					rightElbow.visibility > MIN_VISIBILITY &&
					leftWrist.visibility > MIN_VISIBILITY &&
					rightWrist.visibility > MIN_VISIBILITY &&
					leftHip.visibility > MIN_VISIBILITY &&
					rightHip.visibility > MIN_VISIBILITY;

				const selectedElbowAngle = selectElbowAngle(
					leftShoulder,
					leftElbow,
					leftWrist,
					rightShoulder,
					rightElbow,
					rightWrist
				);

				const prevEma = angleEmaRef.current ?? selectedElbowAngle;
				const smoothedAngle = prevEma + SMOOTHING_ALPHA * (selectedElbowAngle - prevEma);
				angleEmaRef.current = smoothedAngle;
				setCurrentAngle(smoothedAngle);

				const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
				const avgHipY = (leftHip.y + rightHip.y) / 2;
				const shouldersLevel = Math.abs(leftShoulder.y - rightShoulder.y) < SHOULDER_LEVEL_DELTA;
				const hipsLevel = Math.abs(leftHip.y - rightHip.y) < SHOULDER_LEVEL_DELTA;

				const points = Object.values<KeypointData>(detectedLandmarks);
				const minX = Math.min(...points.map((p) => p.x));
				const maxX = Math.max(...points.map((p) => p.x));
				const minY = Math.min(...points.map((p) => p.y));
				const maxY = Math.max(...points.map((p) => p.y));
				const bboxWidth = Math.max(maxX - minX, Number.EPSILON);
				const bboxHeight = Math.max(maxY - minY, 0);
				const heightWidthRatio = bboxHeight / bboxWidth;
				const withinFrameHeight = bboxHeight;

				const centerShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
				const centerHipX = (leftHip.x + rightHip.x) / 2;
				const torsoAngle = Math.abs(
					(Math.atan2(avgHipY - avgShoulderY, centerHipX - centerShoulderX) * 180) / Math.PI
				);

				const torsoAligned = Math.abs(avgHipY - avgShoulderY) < HIP_SHOULDER_MAX_DELTA;
				const horizontalTorso = torsoAngle < MAX_TORSO_ANGLE;
				const bboxTooVertical =
					withinFrameHeight > MAX_FRAME_HEIGHT || heightWidthRatio > MAX_HEIGHT_WIDTH_RATIO;
				const isInPlankPosition =
					torsoAligned && (shouldersLevel || hipsLevel) && horizontalTorso && !bboxTooVertical;

				const postureAligned = bodyFullyVisible && isInPlankPosition;
				if (!postureAligned) {
					pushupStateRef.current = "idle";
					setPushupState("idle");
					setFeedback(t("pushups.feedback.needPlank"));
					setProgress(0);
					bottomEntryRef.current = null;
					return;
				}

				const result = processPushupStateMachine(
					pushupStateRef.current,
					smoothedAngle,
					bodyFullyVisible,
					isInPlankPosition,
					t
				);

				if (pushupStateRef.current === "bottom" && result.newState === "ascending") {
					const bottomDwell = bottomEntryRef.current
						? Date.now() - bottomEntryRef.current
						: BOTTOM_HOLD_MS;
					if (bottomDwell < BOTTOM_HOLD_MS) {
						setPushupState("bottom");
						setFeedback(t("pushups.feedback.nowExtend"));
						setProgress(50);
						return;
					}
				}

				if (result.newState === "bottom") {
					bottomEntryRef.current = Date.now();
				} else if (result.newState === "ready" || result.newState === "idle") {
					bottomEntryRef.current = null;
				}

				pushupStateRef.current = result.newState;
				setPushupState(result.newState);
				setFeedback(result.feedback);
				setProgress(result.progress);

				if (result.incrementCount) {
					const now = Date.now();
					if (now - lastPushupTimeRef.current > 1200) {
						lastPushupTimeRef.current = now;

						if (!isMountedRef.current) return;

						setLastRepQuality(result.quality || "good");

						setPushupCount((prevCount) => prevCount + 1);
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
		poseLandmarks(frame);

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
			/>

			<View style={styles.overlay} />

			<View style={styles.topBar}>
				<View style={styles.counterContainer}>
					<Text style={styles.counterValue}>{pushupCount}</Text>
					<Text style={styles.counterLabel}>{t("pushups.counterLabel")}</Text>
				</View>
			</View>

			<View style={styles.centerFeedback}>
				<Text style={[styles.feedbackText, getFeedbackStyle(pushupState)]}>{feedback}</Text>
				{pushupState !== "idle" && (
					<Text style={styles.angleIndicator}>{Math.round(currentAngle)}°</Text>
				)}
			</View>

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

			{lastRepQuality && pushupState === "ready" && (
				<View style={styles.qualityBadge}>
					<Text style={styles.qualityText}>
						{lastRepQuality === "perfect" ? t("common.quality.perfect") : t("common.quality.good")}
					</Text>
				</View>
			)}

			<View style={styles.bottomPanel}>
				{isRoutine && target !== null && (
					<View style={styles.routineMetaRow}>
						<View style={styles.routineChip}>
							<Text style={styles.statLabel}>{t("routine.goalLabel")}</Text>
							<Text style={styles.statValue}>
								{t("routine.goalValue", {
									current: Math.min(pushupCount, target),
									target,
								})}
							</Text>
							<Text style={styles.routineHint}>
								{t("routine.remainingValue", { count: remainingReps ?? 0 })}
							</Text>
						</View>
						<View style={styles.routineChip}>
							<Text style={styles.statLabel}>{t("routine.nextLabel")}</Text>
							<Text style={styles.statValue}>
								{nextExercise ? t(`${nextExercise}.title` as const) : t("routine.completeLabel")}
							</Text>
							{!nextExercise && <Text style={styles.routineHint}>{t("routine.finished")}</Text>}
						</View>
					</View>
				)}

				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statLabel}>{t("common.state")}</Text>
						<Text style={styles.statValue}>{getStateLabel(pushupState, t)}</Text>
					</View>
					<View style={styles.resetButtonContainer}>
						<Button title={t("common.reset")} onPress={handleReset} color="#FF6B6B" />
					</View>
				</View>

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
		</View>
	);
}

function getFeedbackStyle(state: PushupState) {
	switch (state) {
		case "idle":
			return { color: "#FFC107" };
		case "ready":
			return { color: "#FF6B6B" };
		case "descending":
			return { color: "#2196F3" };
		case "bottom":
			return { color: "#FF9800" };
		case "ascending":
			return { color: "#9C27B0" };
		default:
			return { color: "white" };
	}
}

function getProgressBarColor(state: PushupState) {
	switch (state) {
		case "descending":
			return { backgroundColor: "#2196F3" };
		case "bottom":
			return { backgroundColor: "#FF9800" };
		case "ascending":
			return { backgroundColor: "#FF6B6B" };
		default:
			return { backgroundColor: "#FF6B6B" };
	}
}

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
