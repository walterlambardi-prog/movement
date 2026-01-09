export type KeypointData = {
	keypoint: number;
	x: number;
	y: number;
	z: number;
	visibility: number;
	presence: number;
};

export type KeypointsMap = { [key: string]: KeypointData };

export type ArmState = "down" | "raising" | "up" | "lowering";
