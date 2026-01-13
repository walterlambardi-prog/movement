import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

import { ControllerArgs, BaseControllerState } from "../ExerciseSession.types";
import { useSessionRecorder } from "../../state/useSessionRecorder";
import { useRoutineStep } from "../../routine/useRoutineStep";
import { ArmState, KeypointData } from "../types/LateralRaises.types";

const { PoseLandmarks } = NativeModules;

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

export function useLateralRaisesController({
	t,
	exerciseKey,
	camera,
}: ControllerArgs): BaseControllerState {
	const { landmarks } = camera;
	const lastRepTimeRef = useRef<number>(0);
	const isMountedRef = useRef<boolean>(true);
	const repCountRef = useRef<number>(0);
	const stateRef = useRef<ArmState>("down");
	const lastUiUpdateRef = useRef<number>(0);

	const [repCount, setRepCount] = useState(0);
	const [feedback, setFeedback] = useState<string>(t("lateralRaises.feedback.showShoulders"));
	const [leftAngle, setLeftAngle] = useState<number>(0);
	const [rightAngle, setRightAngle] = useState<number>(0);
	const [leftState, setLeftState] = useState<ArmState>("down");
	const [rightState, setRightState] = useState<ArmState>("down");
	const [progress, setProgress] = useState<number>(0);

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep(exerciseKey);
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - repCount, 0) : null),
		[repCount, target]
	);

	useSessionRecorder(exerciseKey, repCount);

	useEffect(() => {
		advanceToNext(repCount);
	}, [advanceToNext, repCount]);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const instructions = useMemo(
		() => t("lateralRaises.instructions", { returnObjects: true }) as string[],
		[t]
	);

	const handleReset = useCallback(() => {
		setRepCount(0);
		setFeedback(t("lateralRaises.feedback.showShoulders"));
		setLeftState("down");
		setRightState("down");
		stateRef.current = "down";
		setProgress(0);
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
							return newTotal;
						});

						setFeedback(t("lateralRaises.feedback.upHold"));
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
	}, [t]);

	const statItems = useMemo(
		() => [
			{
				label: t("hammerCurls.armLabel.left"),
				value: `${leftAngle}° · ${describeArmState(leftState, t)}`,
			},
			{
				label: t("hammerCurls.armLabel.right"),
				value: `${rightAngle}° · ${describeArmState(rightState, t)}`,
			},
		],
		[leftAngle, leftState, rightAngle, rightState, t]
	);

	return {
		repCount,
		feedback,
		progress,
		progressColor: undefined,
		statItems,
		badge: null,
		instructions,
		routine: { isRoutine, target, nextExercise, remaining: remainingReps },
		handleReset,
	};
}
