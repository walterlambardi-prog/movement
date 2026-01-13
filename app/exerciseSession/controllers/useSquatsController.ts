import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

import { ControllerArgs, BaseControllerState } from "../ExerciseSession.types";
import { useSessionRecorder } from "../../state/useSessionRecorder";
import { useRoutineStep } from "../../routine/useRoutineStep";
import { KeypointData, RepQuality, SquatState, StateTransitionResult } from "../types/Squats.types";

const { PoseLandmarks } = NativeModules;

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

export function useSquatsController({
	t,
	exerciseKey,
	camera,
}: ControllerArgs): BaseControllerState {
	const { landmarks } = camera;
	const lastSquatTimeRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);
	const squatStateRef = useRef<SquatState>("idle");
	const lastUiUpdateRef = useRef<number>(0);

	const [squatCount, setSquatCount] = useState(0);
	const [squatState, setSquatState] = useState<SquatState>("idle");
	const [currentAngle, setCurrentAngle] = useState<number>(0);
	const [feedback, setFeedback] = useState<string>(t("squats.feedback.noBody"));
	const [progress, setProgress] = useState<number>(0);
	const [lastRepQuality, setLastRepQuality] = useState<RepQuality | null>(null);

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep(exerciseKey);
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - squatCount, 0) : null),
		[squatCount, target]
	);

	useSessionRecorder(exerciseKey, squatCount);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		advanceToNext(squatCount);
	}, [advanceToNext, squatCount]);

	const instructions = useMemo(
		() => t("squats.instructions", { returnObjects: true }) as string[],
		[t]
	);

	const handleReset = useCallback(() => {
		setSquatCount(0);
		setSquatState("idle");
		setProgress(0);
		setFeedback(t("squats.feedback.noBody"));
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

	const statItems = useMemo(
		() => [
			{
				label: t("common.state"),
				value: getStateLabel(squatState, t),
			},
			{
				label: t("squats.counterLabel"),
				value: `${currentAngle}°`,
			},
		],
		[currentAngle, squatState, t]
	);

	const badge = lastRepQuality
		? {
				label:
					lastRepQuality === "perfect" ? t("common.quality.perfect") : t("common.quality.good"),
				color: lastRepQuality === "perfect" ? "#10B981" : "#EAB308",
			}
		: null;

	const showProgress =
		squatState === "descending" || squatState === "ascending" || squatState === "bottom";

	return {
		repCount: squatCount,
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
