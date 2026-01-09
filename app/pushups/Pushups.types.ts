export type KeypointData = {
	keypoint: number;
	x: number;
	y: number;
	z: number;
	visibility: number;
	presence: number;
};

export type KeypointsMap = { [key: string]: KeypointData };

export type PushupState = "idle" | "ready" | "descending" | "bottom" | "ascending";

export type RepQuality = "perfect" | "good" | "incomplete";

export type StateTransitionResult = {
	newState: PushupState;
	feedback: string;
	incrementCount: boolean;
	quality?: RepQuality;
	progress: number;
};
