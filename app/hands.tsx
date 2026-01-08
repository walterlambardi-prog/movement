import { Skia } from "@shopify/react-native-skia";
import { Stack } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Button,
	NativeEventEmitter,
	NativeModules,
	Platform,
	StyleSheet,
	Text,
	View,
} from "react-native";
import {
	Camera,
	CameraPosition,
	Frame,
	useCameraDevice,
	useCameraFormat,
	useCameraPermission,
	useSkiaFrameProcessor,
	VisionCameraProxy,
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";

// Use the HandLandmarks module for hand tracking
const { HandLandmarks } = NativeModules;

// Initialize the hand landmarks frame processor plugin
const handLandmarkPlugin = VisionCameraProxy.initFrameProcessorPlugin("handLandmarks", {});

function handLandmarks(frame: Frame) {
	"worklet";
	if (handLandmarkPlugin == null) {
		throw new Error("Failed to load Hand Frame Processor Plugin!");
	}
	return handLandmarkPlugin.call(frame);
}

type HandLandmarkData = {
	index: number;
	x: number;
	y: number;
	z: number;
	visibility: number;
};

type HandData = {
	handIndex: number;
	landmarks: HandLandmarkData[];
	label: string; // "Left" or "Right"
	score: number;
};

const linePaint = Skia.Paint();
linePaint.setColor(Skia.Color("blue"));
linePaint.setStrokeWidth(3);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("red"));

const leftHandPaint = Skia.Paint();
leftHandPaint.setColor(Skia.Color("green"));

const rightHandPaint = Skia.Paint();
rightHandPaint.setColor(Skia.Color("orange"));

const CameraButton = ({ onPress }: { onPress: () => void }) => (
	<Button title="Change camera" onPress={onPress} />
);

export default function HandTracking() {
	const hands = useSharedValue<HandData[]>([]);
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const [showSkeleton, setShowSkeleton] = useState(true);
	const [showLandmarks, setShowLandmarks] = useState(true);
	const device = useCameraDevice(cameraPosition);
	const format = useCameraFormat(device, [{ fps: 30 }]);

	useEffect(() => {
		// Initialize the hand model
		HandLandmarks?.initModel?.();

		if (!HandLandmarks) {
			console.warn("HandLandmarks module not available");
			return;
		}

		const handLandmarksEmitter = new NativeEventEmitter(HandLandmarks);
		const subscription = handLandmarksEmitter.addListener("onHandLandmarksDetected", (event) => {
			if (event.hands && event.hands.length > 0) {
				hands.value = event.hands;
			} else {
				hands.value = [];
			}
		});

		// Listen for errors
		const errorSubscription = handLandmarksEmitter.addListener("onHandLandmarksError", (event) => {
			console.log("Hand landmarks error:", event.error);
		});

		return () => {
			subscription.remove();
			errorSubscription.remove();
		};
	}, [hands]);

	useEffect(() => {
		requestPermission().catch((error) => console.log(error));
	}, [requestPermission]);

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "front" ? "back" : "front"));
	}, []);

	const handleToggleSkeleton = useCallback(() => {
		setShowSkeleton((prev) => !prev);
	}, []);

	const handleToggleLandmarks = useCallback(() => {
		setShowLandmarks((prev) => !prev);
	}, []);

	const frameProcessor = useSkiaFrameProcessor(
		(frame) => {
			"worklet";

			frame.render();
			handLandmarks(frame);

			if (hands?.value && hands.value.length > 0) {
				const frameWidth = frame.width;
				const frameHeight = frame.height;

				// Draw each detected hand
				hands.value.forEach((hand) => {
					if (hand?.landmarks) {
						// Choose color based on handedness
						const isLeftHand = hand.label === "Left";
						const handColor = isLeftHand ? leftHandPaint : rightHandPaint;

						// Draw hand skeleton connections if enabled
						if (showSkeleton) {
							// Define hand connections (21 landmarks standard)
							const HAND_CONNECTIONS = [
								// Thumb
								[0, 1],
								[1, 2],
								[2, 3],
								[3, 4],
								// Index finger
								[0, 5],
								[5, 6],
								[6, 7],
								[7, 8],
								// Middle finger
								[0, 9],
								[9, 10],
								[10, 11],
								[11, 12],
								// Ring finger
								[0, 13],
								[13, 14],
								[14, 15],
								[15, 16],
								// Pinky
								[0, 17],
								[17, 18],
								[18, 19],
								[19, 20],
							];

							for (const [from, to] of HAND_CONNECTIONS) {
								const fromLandmark = hand.landmarks[from];
								const toLandmark = hand.landmarks[to];

								if (fromLandmark && toLandmark) {
									frame.drawLine(
										fromLandmark.x * frameWidth,
										fromLandmark.y * frameHeight,
										toLandmark.x * frameWidth,
										toLandmark.y * frameHeight,
										handColor
									);
								}
							}
						}

						// Draw hand landmarks if enabled
						if (showLandmarks) {
							hand.landmarks.forEach((landmark) => {
								if (landmark.visibility > 0.3) {
									frame.drawCircle(
										landmark.x * frameWidth,
										landmark.y * frameHeight,
										6,
										circlePaint
									);
								}
							});
						}
					}
				});
			}
		},
		[showSkeleton, showLandmarks]
	);

	const pixelFormat = Platform.OS === "ios" ? "rgb" : "yuv";

	const HeaderRight = useMemo(
		() => <CameraButton onPress={handleCameraChange} />,
		[handleCameraChange]
	);

	const screenOptions = useMemo(
		() => ({
			title: "Hand Tracking",
			headerRight: () => HeaderRight,
		}),
		[HeaderRight]
	);

	if (!hasPermission) {
		return <Text>No permission</Text>;
	}

	if (device == null) {
		return <Text>No device</Text>;
	}

	return (
		<>
			<Stack.Screen name="hands" options={screenOptions} />
			<View style={styles.drawControl}>
				<Button title={showSkeleton ? "Hide lines" : "Show lines"} onPress={handleToggleSkeleton} />
				<Button
					title={showLandmarks ? "Hide circles" : "Show circles"}
					onPress={handleToggleLandmarks}
				/>
			</View>
			<Camera
				style={StyleSheet.absoluteFill}
				device={device}
				isActive={true}
				frameProcessor={frameProcessor}
				pixelFormat={pixelFormat}
				videoHdr={false}
				enableBufferCompression={true}
				photo={false}
				format={format}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	drawControl: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		zIndex: 10,
		backgroundColor: "#FFF",
		flexDirection: "row",
		justifyContent: "space-between",
		padding: 10,
	},
});
