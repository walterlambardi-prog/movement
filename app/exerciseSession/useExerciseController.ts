import React, { useCallback, useMemo, useState } from "react";
import { Button } from "react-native";
import {
	CameraDevice,
	CameraDeviceFormat,
	CameraPosition,
	DrawableFrameProcessor,
	Frame,
	ReadonlyFrameProcessor,
	useCameraDevice,
	useCameraFormat,
	useCameraPermission,
	useSkiaFrameProcessor,
	VisionCameraProxy,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";
import { useTranslation } from "react-i18next";
import { Skia } from "@shopify/react-native-skia";

import { EXERCISE_KEYS, ExerciseKey } from "../state/useAppStore";
import {
	BaseControllerState,
	ControllerArgs,
	ExerciseCameraContext,
	ExerciseControllerState,
	ExerciseTheme,
	LandmarkPoint,
} from "./ExerciseSession.types";
import { EXERCISE_THEMES } from "./exerciseConfig";
import { useHammerCurlsController } from "./controllers/useHammerCurlsController";
import { useLateralRaisesController } from "./controllers/useLateralRaisesController";
import { usePushupsController } from "./controllers/usePushupsController";
import { useSquatsController } from "./controllers/useSquatsController";

type LandmarksMap = Record<number, LandmarkPoint>;

const poseLandmarkPlugin = VisionCameraProxy.initFrameProcessorPlugin("poseLandmarks", {});

function runPoseLandmarks(frame: Frame) {
	"worklet";
	if (poseLandmarkPlugin == null) return null;
	return poseLandmarkPlugin.call(frame);
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

function useExerciseCamera(theme: ExerciseTheme): ExerciseCameraContext {
	const landmarks = useSharedValue<LandmarksMap>({});
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const device: CameraDevice | null = useCameraDevice(cameraPosition) ?? null;
	const format: CameraDeviceFormat | undefined = useCameraFormat(device ?? undefined, [
		{ fps: 24 },
	]);

	const backgroundPaint = useMemo(() => {
		const paint = Skia.Paint();
		paint.setColor(Skia.Color("black"));
		return paint;
	}, []);

	const linePaint = useMemo(() => {
		const paint = Skia.Paint();
		paint.setColor(Skia.Color(theme.lineColor));
		paint.setStrokeWidth(theme.lineWidth);
		return paint;
	}, [theme.lineColor, theme.lineWidth]);

	const circlePaint = useMemo(() => {
		const paint = Skia.Paint();
		paint.setColor(Skia.Color(theme.circleColor));
		paint.setStrokeWidth(theme.lineWidth / 2);
		return paint;
	}, [theme.circleColor, theme.lineWidth]);

	const frameProcessor = useSkiaFrameProcessor(
		(frame) => {
			"worklet";
			// Paint a solid dark background, run pose detection, then draw the silhouette.
			frame.drawRect(Skia.XYWHRect(0, 0, frame.width, frame.height), backgroundPaint);
			const result = runPoseLandmarks(frame) as {
				landmarks?: Record<number, LandmarkPoint>[];
			} | null;

			// Fallback: if plugin returns landmarks, stash them directly for drawing.
			if (result?.landmarks?.[0]) {
				landmarks.value = result.landmarks[0];
			}

			if (!landmarks?.value || Object.keys(landmarks.value).length === 0) return;
			const body = landmarks.value;
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
		},
		[backgroundPaint, landmarks, linePaint, circlePaint]
	);

	const toggleCamera = useCallback(() => {
		setCameraPosition((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	return {
		landmarks,
		hasPermission,
		requestPermission,
		device,
		format,
		frameProcessor,
		toggleCamera,
	};
}

type ControllerHook = (args: ControllerArgs) => BaseControllerState;

const controllerMap: Record<ExerciseKey, ControllerHook> = {
	[EXERCISE_KEYS.HAMMER_CURLS]: useHammerCurlsController,
	[EXERCISE_KEYS.LATERAL_RAISES]: useLateralRaisesController,
	[EXERCISE_KEYS.PUSHUPS]: usePushupsController,
	[EXERCISE_KEYS.SQUATS]: useSquatsController,
};

export function useExerciseController(exerciseKey: ExerciseKey): ExerciseControllerState {
	const { t } = useTranslation();
	const theme = EXERCISE_THEMES[exerciseKey];
	const camera = useExerciseCamera(theme);

	const controllerHook = controllerMap[exerciseKey];
	const baseController = controllerHook({
		exerciseKey,
		t,
		theme,
		camera,
	});

	const headerRight = useMemo(
		() =>
			React.createElement(Button, {
				title: t("common.changeCamera"),
				onPress: camera.toggleCamera,
			}),
		[camera.toggleCamera, t]
	);

	return {
		...baseController,
		accent: theme.accent,
		headerRight,
		toggleCamera: camera.toggleCamera,
		hasPermission: camera.hasPermission,
		requestPermission: camera.requestPermission,
		device: camera.device,
		format: camera.format,
		frameProcessor: camera.frameProcessor as ReadonlyFrameProcessor | DrawableFrameProcessor | null,
	};
}
