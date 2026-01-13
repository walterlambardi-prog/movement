import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NativeEventEmitter, NativeModules } from "react-native";

import { ControllerArgs, BaseControllerState } from "../ExerciseSession.types";
import { useSessionRecorder } from "../../state/useSessionRecorder";
import { useRoutineStep } from "../../routine/useRoutineStep";
import { Arm, ArmState, KeypointData } from "../types/HammerCurls.types";

const { PoseLandmarks } = NativeModules;

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

export function useHammerCurlsController({
	t,
	exerciseKey,
	camera,
}: ControllerArgs): BaseControllerState {
	const { landmarks } = camera;
	const lastRepTimeRef = useRef<number>(0);
	const lastArmRef = useRef<Arm | null>(null);
	const leftStateRef = useRef<ArmState>("extended");
	const rightStateRef = useRef<ArmState>("extended");
	const repCountRef = useRef<number>(0);
	const lastUiUpdateRef = useRef<number>(0);

	const [repCount, setRepCount] = useState(0);
	const [feedback, setFeedback] = useState<string>(t("hammerCurls.feedback.showArms"));
	const [activeArm, setActiveArm] = useState<Arm | null>(null);
	const [leftAngle, setLeftAngle] = useState<number>(0);
	const [rightAngle, setRightAngle] = useState<number>(0);
	const [leftState, setLeftState] = useState<ArmState>("extended");
	const [rightState, setRightState] = useState<ArmState>("extended");
	const [progress, setProgress] = useState<number>(0);
	const [lastRepArm, setLastRepArm] = useState<Arm | null>(null);

	const { isRoutine, target, nextExercise, advanceToNext } = useRoutineStep(exerciseKey);
	const remainingReps = useMemo(
		() => (target !== null ? Math.max(target - repCount, 0) : null),
		[repCount, target]
	);

	useSessionRecorder(exerciseKey, repCount);

	useEffect(() => {
		advanceToNext(repCount);
	}, [advanceToNext, repCount]);

	const instructions = useMemo(
		() => t("hammerCurls.instructions", { returnObjects: true }) as string[],
		[t]
	);

	const handleReset = useCallback(() => {
		setRepCount(0);
		setFeedback(t("hammerCurls.feedback.showArms"));
		setActiveArm(null);
		setLeftState("extended");
		setRightState("extended");
		setProgress(0);
		setLastRepArm(null);
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
						return newTotal;
					});

					setFeedback(
						t("hammerCurls.feedback.counting", {
							arm: t(`hammerCurls.armLabel.${arm}` as const),
						})
					);
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
			{
				label: t("common.lastArm"),
				value: lastRepArm ? t(`hammerCurls.armLabel.${lastRepArm}` as const) : "-",
				muted: !lastRepArm,
			},
		],
		[lastRepArm, leftAngle, leftState, rightAngle, rightState, t]
	);

	return {
		repCount,
		feedback,
		progress: activeArm ? progress : null,
		progressColor: undefined,
		statItems,
		badge: null,
		instructions,
		routine: { isRoutine, target, nextExercise, remaining: remainingReps },
		handleReset,
	};
}
