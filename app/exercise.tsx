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

const { PoseLandmarks } = NativeModules;

const poseLandmarksEmitter = new NativeEventEmitter(PoseLandmarks);

// Initialize the frame processor plugin 'poseLandmarks'
const poseLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin("poseLandmarks", {});

function poseLandmarks(frame: Frame) {
	"worklet";
	if (poseLandMarkPlugin == null) {
		throw new Error("Failed to load Frame Processor Plugin!");
	}
	return poseLandMarkPlugin.call(frame);
}

type KeypointData = {
	keypoint: number;
	x: number;
	y: number;
	z: number;
	visibility: number;
	presence: number;
};

type KeypointsMap = { [key: string]: KeypointData };
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
const linePaint = Skia.Paint();
linePaint.setColor(Skia.Color("red"));
linePaint.setStrokeWidth(30);

const circlePaint = Skia.Paint();
circlePaint.setColor(Skia.Color("green"));
linePaint.setStrokeWidth(10);

const CameraButton = ({ onPress }: { onPress: () => void }) => (
	<Button title="Change camera" onPress={onPress} />
);

export default function Exercise() {
	const landmarks = useSharedValue<KeypointsMap>({});
	const { hasPermission, requestPermission } = useCameraPermission();
	const [cameraPosition, setCameraPosition] = useState<CameraPosition>("front");
	const [showLines, setShowLines] = useState(true);
	const [showCircles, setShowCircles] = useState(true);
	const device = useCameraDevice(cameraPosition);
	const format = useCameraFormat(device, [{ fps: 30 }]);

	useEffect(() => {
		// Set up the event listener to listen for pose landmarks detection results
		const subscription = poseLandmarksEmitter.addListener("onPoseLandmarksDetected", (event) => {
			// Update the landmarks shared value to paint them on the screen

			/*
          The event contains values for landmarks and pose.
          These values are defined in the PoseLandmarkerResultProcessor class
          found in the PoseLandmarks.swift file.
        */
			landmarks.value = event.landmarks[0];
		});

		// Clean up the event listener when the component is unmounted
		return () => {
			subscription.remove();
		};
	}, [landmarks]);

	useEffect(() => {
		requestPermission().catch((error) => console.log(error));
	}, [requestPermission]);

	const handleCameraChange = useCallback(() => {
		setCameraPosition((prev) => (prev === "front" ? "back" : "front"));
	}, []);

	const handleToggleLines = useCallback(() => {
		setShowLines((prev) => !prev);
	}, []);

	const handleToggleCircles = useCallback(() => {
		setShowCircles((prev) => !prev);
	}, []);

	const frameProcessor = useSkiaFrameProcessor(
		(frame) => {
			"worklet";

			// Process the frame using the 'poseLandmarks' function
			frame.render();
			poseLandmarks(frame);
			if (landmarks?.value !== undefined && Object.keys(landmarks?.value).length > 0) {
				const body = landmarks?.value;
				const frameWidth = frame.width;
				const frameHeight = frame.height;
				// Draw line on landmarks
				if (showLines) {
					for (const [from, to] of LINES) {
						frame.drawLine(
							body[from].x * Number(frameWidth),
							body[from].y * Number(frameHeight),
							body[to].x * Number(frameWidth),
							body[to].y * Number(frameHeight),
							linePaint
						);
					}
				} // Draw circles on landmarks
				if (showCircles) {
					for (const mark of Object.values(body)) {
						frame.drawCircle(
							mark.x * Number(frameWidth),
							mark.y * Number(frameHeight),
							6,
							circlePaint
						);
					}
				}
			}
		},
		[showLines, showCircles]
	);

	const pixelFormat = Platform.OS === "ios" ? "rgb" : "yuv";

	const HeaderRight = useMemo(
		() => <CameraButton onPress={handleCameraChange} />,
		[handleCameraChange]
	);

	const screenOptions = useMemo(
		() => ({
			title: "Exercise",
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
			<Stack.Screen name="exercise" options={screenOptions} />
			<View style={styles.drawControl}>
				<Button title={showLines ? "Hide lines" : "Show lines"} onPress={handleToggleLines} />
				<Button
					title={showCircles ? "Hide circles" : "Show circles"}
					onPress={handleToggleCircles}
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
