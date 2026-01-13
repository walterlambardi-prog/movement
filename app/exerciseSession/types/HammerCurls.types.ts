export type Arm = "left" | "right";

export type ArmState = "extended" | "curling" | "top";

export type KeypointData = {
	x: number;
	y: number;
	z: number;
	visibility: number;
};

export type KeypointsMap = Record<number, KeypointData>;
