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
	useCameraDevice,
	useCameraFormat,
	useCameraPermission,
	useSkiaFrameProcessor,
	VisionCameraProxy,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";
import { useTranslation } from "react-i18next";
import { styles } from "./Squats.styles";
import {
	KeypointData,
	KeypointsMap,
	RepQuality,
	SquatState,
	StateTransitionResult,
} from "./Squats.types";
import { useSessionRecorder } from "../state/useSessionRecorder";
import { useRoutineStep } from "../routine/useRoutineStep";

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
linePaint.setColor(Skia.Color("#4CAF50"));
linePaint.setStrokeWidth(12);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("#FFC107"));
linePaint.setStrokeWidth(8);

const UI_UPDATE_THROTTLE_MS = 140;
const REP_DEBOUNCE_MS = 900;

const ANGLE_TOP_READY = 150;
const ANGLE_START_DESCENT = 145;
const ANGLE_BOTTOM = 130;
const ANGLE_ASCEND_TRIGGER = 140;
const ANGLE_COMPLETE = 150;

function calculateAngle(p1: KeypointData, p2: KeypointData, p3: KeypointData): number {
	const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
	let angle = Math.abs((radians * 180) / Math.PI);
	if (angle > 180) angle = 360 - angle;
	return angle;
}

function processSquatStateMachine(
	currentState: SquatState,
	avgKneeAngle: number,
	bodyFullyVisible: boolean,
	translate: (key: string, options?: Record<string, unknown>) => string
): StateTransitionResult {
	const angle = Math.round(avgKneeAngle);

	if (!bodyFullyVisible) {
		return {
			newState: "idle",
			feedback: translate("squats.feedback.noBody"),
			incrementCount: false,
			progress: 0,
		};
	}

	if (currentState === "idle") {
		if (avgKneeAngle > ANGLE_TOP_READY) {
			return {
				newState: "ready",
				feedback: translate("squats.feedback.ready"),
				incrementCount: false,
				progress: 0,
			};
		}
		return {
			newState: "idle",
			feedback: translate("squats.feedback.standStraight"),
			incrementCount: false,
			progress: 0,
		};
	}

	if (currentState === "ready") {
		if (avgKneeAngle < ANGLE_START_DESCENT) {
			return {
				newState: "descending",
				feedback: translate("squats.feedback.goingDown"),
				incrementCount: false,
				progress: 10,
			};
		}
		return {
			newState: "ready",
			feedback: translate("squats.feedback.ready"),
			incrementCount: false,
			progress: 0,
		};
	}

	if (currentState === "descending") {
		if (avgKneeAngle <= ANGLE_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("squats.feedback.perfectDepth"),
				incrementCount: false,
				progress: 50,
			};
		}
		if (avgKneeAngle > ANGLE_TOP_READY) {
			return {
				newState: "ready",
				feedback: translate("squats.feedback.goDeeper"),
				incrementCount: false,
				progress: 0,
			};
		}
		const progress = Math.min(
			50,
			((ANGLE_TOP_READY - avgKneeAngle) / (ANGLE_TOP_READY - ANGLE_BOTTOM)) * 50
		);
		return {
			newState: "descending",
			feedback: translate("squats.feedback.keepGoing", { angle }),
			incrementCount: false,
			progress,
		};
	}

	if (currentState === "bottom") {
		if (avgKneeAngle > ANGLE_ASCEND_TRIGGER) {
			return {
				newState: "ascending",
				feedback: translate("squats.feedback.push"),
				incrementCount: false,
				progress: 60,
			};
		}
		return {
			newState: "bottom",
			feedback: translate("squats.feedback.goodPush"),
			incrementCount: false,
			progress: 50,
		};
	}

	if (currentState === "ascending") {
		if (avgKneeAngle > ANGLE_COMPLETE) {
			return {
				newState: "ready",
				feedback: translate("squats.feedback.excellent"),
				incrementCount: true,
				quality: "perfect",
				progress: 100,
			};
		}
		if (avgKneeAngle <= ANGLE_BOTTOM) {
			return {
				newState: "bottom",
				feedback: translate("squats.feedback.keepPushing"),
				incrementCount: false,
				progress: 50,
			};
		}
		const progress =
			50 + Math.min(50, ((avgKneeAngle - ANGLE_BOTTOM) / (ANGLE_COMPLETE - ANGLE_BOTTOM)) * 50);
		return {
			newState: "ascending",
			feedback: translate("squats.feedback.almost", { angle }),
			incrementCount: false,
			progress,
		};
	}

	return {
		newState: currentState,
		feedback: translate("squats.feedback.keepPushing"),
		incrementCount: false,
		progress: 0,
	};
}

const CameraButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
	<Button title={label} onPress={onPress} />
);

export default function Squats() {
	const { t } = useTranslation();
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

	const lastSquatTimeRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);
	const squatCountRef = useRef<number>(0);
	const squatStateRef = useRef<SquatState>("idle");

	const [squatCount, setSquatCount] = useState(0);
	const [squatState, setSquatState] = useState<SquatState>("idle");
	const [currentAngle, setCurrentAngle] = useState<number>(0);
	const [feedback, setFeedback] = useState<string>(t("squats.feedback.noBody"));
	const [progress, setProgress] = useState<number>(0);
	const [lastRepQuality, setLastRepQuality] = useState<RepQuality | null>(null);

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep("squats");
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - squatCount, 0) : null),
		[squatCount, target]
	);

	useSessionRecorder("squats", squatCount);

	const instructions = useMemo(
		() => t("squats.instructions", { returnObjects: true }) as string[],
		[t]
	);

	useEffect(() => {
		squatCountRef.current = squatCount;
	}, [squatCount]);

	useEffect(() => {
		squatStateRef.current = squatState;
	}, [squatState]);

	const progressAnim = useRef(new Animated.Value(0)).current;
	const lastUiUpdateRef = useRef<number>(0);

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleReset = useCallback(() => {
		setSquatCount(0);
		setSquatState("idle");
		setProgress(0);
		setFeedback(t("squats.feedback.noBody"));
		setLastRepQuality(null);
	}, [t]);

	const HeaderRight = useMemo(
		() => <CameraButton label={t("common.changeCamera")} onPress={handleCameraChange} />,
		[handleCameraChange, t]
	);

	const screenOptions = useMemo(
		() => ({
			title: t("squats.title"),
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
		if (squatState === "idle") {
			setFeedback(t("squats.feedback.noBody"));
		}
	}, [squatState, t]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		advanceToNext(squatCount);
	}, [advanceToNext, squatCount]);

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
					setSquatState("idle");
					setFeedback(t("squats.feedback.noPose"));
					setProgress(0);
					return;
				}

				const detectedLandmarks = event.landmarks[0];
				landmarks.value = detectedLandmarks;

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
					setFeedback(t("squats.feedback.noBody"));
					setProgress(0);
					return;
				}

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

				const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
				const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
				const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

				const result = processSquatStateMachine(
					squatStateRef.current,
					avgKneeAngle,
					bodyFullyVisible,
					t
				);
				squatStateRef.current = result.newState;

				const now = Date.now();
				if (now - lastUiUpdateRef.current > UI_UPDATE_THROTTLE_MS) {
					lastUiUpdateRef.current = now;
					setSquatState(result.newState);
					setFeedback(result.feedback);
					setProgress(result.progress);
					setCurrentAngle(Math.round(avgKneeAngle));
				}

				if (result.incrementCount) {
					const now = Date.now();
					if (now - lastSquatTimeRef.current > REP_DEBOUNCE_MS) {
						lastSquatTimeRef.current = now;

						if (!isMountedRef.current) return;

						setLastRepQuality(result.quality || "good");

						setSquatCount((prevCount) => prevCount + 1);
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
					<Text style={styles.counterValue}>{squatCount}</Text>
					<Text style={styles.counterLabel}>{t("squats.counterLabel")}</Text>
				</View>
			</View>

			<View style={styles.centerFeedback}>
				<Text style={[styles.feedbackText, getFeedbackStyle(squatState)]}>{feedback}</Text>
				{squatState !== "idle" && squatState !== "ready" && (
					<Text style={styles.angleIndicator}>{currentAngle}°</Text>
				)}
			</View>

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

			{lastRepQuality && squatState === "ready" && (
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
									current: Math.min(squatCount, target),
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
						<Text style={styles.statValue}>{getStateLabel(squatState, t)}</Text>
					</View>
					<View style={styles.resetButtonContainer}>
						<Button title={t("common.reset")} onPress={handleReset} color="#FF6B6B" />
					</View>
				</View>

				{squatState === "idle" && (
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

function getFeedbackStyle(state: SquatState) {
	switch (state) {
		case "idle":
			return { color: "#FFC107" };
		case "ready":
			return { color: "#4CAF50" };
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

function getProgressBarColor(state: SquatState) {
	switch (state) {
		case "descending":
			return { backgroundColor: "#2196F3" };
		case "bottom":
			return { backgroundColor: "#FF9800" };
		case "ascending":
			return { backgroundColor: "#4CAF50" };
		default:
			return { backgroundColor: "#4CAF50" };
	}
}

function getStateLabel(state: SquatState, translate: (key: string) => string): string {
	switch (state) {
		case "idle":
			return translate("squats.stateLabel.idle");
		case "ready":
			return translate("squats.stateLabel.ready");
		case "descending":
			return translate("squats.stateLabel.descending");
		case "bottom":
			return translate("squats.stateLabel.bottom");
		case "ascending":
			return translate("squats.stateLabel.ascending");
		default:
			return state;
	}
}
