import { ReactNode } from "react";
import type {
	CameraDevice,
	CameraDeviceFormat,
	DrawableFrameProcessor,
	ReadonlyFrameProcessor,
} from "react-native-vision-camera";
import type { ISharedValue } from "react-native-worklets-core";
import { TFunction } from "i18next";

import { ExerciseKey } from "../state/useAppStore";

export type LandmarkPoint = {
	x: number;
	y: number;
	visibility?: number;
	[key: string]: number | undefined;
};

export type StatItem = {
	label: string;
	value: string;
	muted?: boolean;
};

export type RoutineMeta = {
	isRoutine: boolean;
	target: number | null;
	nextExercise: ExerciseKey | null;
	remaining: number | null;
};

export type ExerciseTheme = {
	accent: string;
	lineColor: string;
	circleColor: string;
	lineWidth: number;
};

export type ExerciseControllerState = {
	repCount: number;
	feedback: string;
	progress: number | null;
	progressColor?: string;
	statItems: StatItem[];
	badge?: { label: string; color: string } | null;
	instructions: string[];
	routine: RoutineMeta;
	handleReset: () => void;
	toggleCamera: () => void;
	headerRight: ReactNode | null;
	accent: string;
	hasPermission: boolean;
	requestPermission: () => Promise<boolean>;
	device: CameraDevice | null;
	format: CameraDeviceFormat | undefined;
	frameProcessor: ReadonlyFrameProcessor | DrawableFrameProcessor | null;
};

export type ExerciseCameraContext = {
	landmarks: ISharedValue<Record<number, LandmarkPoint>>;
	hasPermission: boolean;
	requestPermission: () => Promise<boolean>;
	device: CameraDevice | null;
	format: CameraDeviceFormat | undefined;
	frameProcessor: ReadonlyFrameProcessor | DrawableFrameProcessor | null;
	toggleCamera: () => void;
};

export type BaseControllerState = Omit<
	ExerciseControllerState,
	| "accent"
	| "hasPermission"
	| "requestPermission"
	| "device"
	| "format"
	| "frameProcessor"
	| "toggleCamera"
	| "headerRight"
>;

export type ControllerArgs = {
	exerciseKey: ExerciseKey;
	theme: ExerciseTheme;
	camera: ExerciseCameraContext;
	t: TFunction;
};

export type ExerciseSessionProps = {
	exerciseKey: ExerciseKey;
};
