export type PushupState = "idle" | "ready" | "descending" | "bottom" | "ascending";

export type RepQuality = "good" | "perfect";

export type KeypointData = {
	x: number;
	y: number;
	z: number;
	visibility: number;
};

export type KeypointsMap = Record<number, KeypointData>;

export type StateTransitionResult = {
	newState: PushupState;
	feedback: string;
	incrementCount: boolean;
	quality?: RepQuality;
	progress: number;
};
