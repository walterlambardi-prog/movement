import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

import { ControllerArgs, BaseControllerState } from "../ExerciseSession.types";
import { useSessionRecorder } from "../../state/useSessionRecorder";
import { useRoutineStep } from "../../routine/useRoutineStep";
import {
	KeypointData,
	PushupState,
	RepQuality,
	StateTransitionResult,
} from "../types/Pushups.types";

const { PoseLandmarks } = NativeModules;

const MIN_VISIBILITY = 0.45;
const HIP_SHOULDER_MAX_DELTA = 0.48;
const SHOULDER_LEVEL_DELTA = 0.2;
const SMOOTHING_ALPHA = 0.28;
const VISIBILITY_EPSILON = 0.1;
const BOTTOM_HOLD_MS = 80;
const MAX_TORSO_ANGLE = 35;
const MAX_FRAME_HEIGHT = 0.6;
const MAX_HEIGHT_WIDTH_RATIO = 0.9;

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

export function usePushupsController({
	t,
	exerciseKey,
	camera,
}: ControllerArgs): BaseControllerState {
	const { landmarks } = camera;
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

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep(exerciseKey);
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - pushupCount, 0) : null),
		[pushupCount, target]
	);

	useSessionRecorder(exerciseKey, pushupCount);

	useEffect(() => {
		pushupCountRef.current = pushupCount;
	}, [pushupCount]);

	useEffect(() => {
		pushupStateRef.current = pushupState;
	}, [pushupState]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		advanceToNext(pushupCount);
	}, [advanceToNext, pushupCount]);

	const instructions = useMemo(
		() => t("pushups.instructions", { returnObjects: true }) as string[],
		[t]
	);

	const handleReset = useCallback(() => {
		setPushupCount(0);
		setPushupState("idle");
		setProgress(0);
		setFeedback(t("pushups.feedback.noBody"));
		setLastRepQuality(null);
	}, [t]);

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

				const detectedLandmarks: Record<string, KeypointData> = event.landmarks[0];
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

	const statItems = useMemo(
		() => [
			{
				label: t("common.state"),
				value: getStateLabel(pushupState, t),
			},
			{
				label: t("pushups.counterLabel"),
				value: `${Math.round(currentAngle)}°`,
			},
		],
		[currentAngle, pushupState, t]
	);

	const badge = lastRepQuality
		? {
				label:
					lastRepQuality === "perfect" ? t("common.quality.perfect") : t("common.quality.good"),
				color: lastRepQuality === "perfect" ? "#10B981" : "#EAB308",
			}
		: null;

	const showProgress =
		pushupState === "descending" || pushupState === "ascending" || pushupState === "bottom";

	return {
		repCount: pushupCount,
		feedback,
		progress: showProgress ? progress : null,
		progressColor: undefined,
		statItems,
		badge,
		instructions,
		routine: { isRoutine, target, nextExercise, remaining: remainingReps },
		handleReset,
	};
}
