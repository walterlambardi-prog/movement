export type ArmState = "down" | "raising" | "up" | "lowering";

export type KeypointData = {
	x: number;
	y: number;
	z: number;
	visibility: number;
};

export type KeypointsMap = Record<number, KeypointData>;
