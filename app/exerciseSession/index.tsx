import React from "react";
import { Stack } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { Camera } from "react-native-vision-camera";
import { useTranslation } from "react-i18next";

import { styles } from "./ExerciseSession.styles";
import { ExerciseSessionProps } from "./ExerciseSession.types";
import { useExerciseController } from "./useExerciseController";

export default function ExerciseSession({ exerciseKey }: ExerciseSessionProps) {
	const { t } = useTranslation();
	const controller = useExerciseController(exerciseKey);

	const title = t(`${exerciseKey}.title` as const);
	const counterLabel = t(`${exerciseKey}.counterLabel` as const);
	const progressColor = controller.progressColor ?? controller.accent;

	if (!controller.hasPermission) {
		return (
			<View style={[styles.container, styles.content]}>
				<Text style={styles.feedback}>{t("common.noPermission")}</Text>
				<TouchableOpacity style={styles.resetButton} onPress={controller.requestPermission}>
					<Text style={styles.resetText}>{t("common.requestPermission")}</Text>
				</TouchableOpacity>
			</View>
		);
	}

	if (controller.device == null) {
		return (
			<View style={[styles.container, styles.content]}>
				<Text style={styles.feedback}>{t("common.noDevice")}</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					title,
					headerRight: () => controller.headerRight,
				}}
			/>

			<Camera
				style={styles.camera}
				device={controller.device}
				isActive={true}
				format={controller.format}
				frameProcessor={controller.frameProcessor ?? undefined}
				pixelFormat="yuv"
			/>

			<View style={styles.overlay} />

			<View style={styles.safeArea}>
				<View style={styles.topBar}>
					<View style={styles.counterContainer}>
						<Text style={styles.counterValue}>{controller.repCount}</Text>
						<Text style={styles.counterLabel}>{counterLabel}</Text>
					</View>
				</View>

				<View style={styles.content}>
					<Text style={styles.feedback}>{controller.feedback}</Text>

					<View style={styles.statRow}>
						{controller.statItems.map((item) => (
							<View key={item.label} style={styles.stat}>
								<Text style={styles.statLabel}>{item.label}</Text>
								<Text style={[styles.statValue, item.muted && styles.statMuted]}>{item.value}</Text>
							</View>
						))}
					</View>

					{controller.badge && (
						<View style={[styles.badge, { backgroundColor: controller.badge.color }]}>
							<Text style={styles.badgeText}>{controller.badge.label}</Text>
						</View>
					)}
				</View>

				{controller.progress !== null && (
					<View style={styles.progressContainer}>
						<View style={styles.progressBackground}>
							<View
								style={[
									styles.progressFill,
									{ width: `${Math.round(controller.progress)}%`, backgroundColor: progressColor },
								]}
							/>
						</View>
						<Text style={styles.progressText}>{Math.round(controller.progress)}%</Text>
					</View>
				)}

				<View style={styles.bottomPanel}>
					{controller.routine.isRoutine && controller.routine.target !== null && (
						<View style={styles.routineRow}>
							<View style={styles.routineCard}>
								<Text style={styles.routineLabel}>{t("routine.goalLabel")}</Text>
								<Text style={styles.routineValue}>
									{t("routine.goalValue", {
										current: Math.min(controller.repCount, controller.routine.target || 0),
										target: controller.routine.target,
									})}
								</Text>
								<Text style={styles.routineHint}>
									{t("routine.remainingValue", { count: controller.routine.remaining ?? 0 })}
								</Text>
							</View>
							<View style={styles.routineCard}>
								<Text style={styles.routineLabel}>{t("routine.nextLabel")}</Text>
								<Text style={styles.routineValue}>
									{controller.routine.nextExercise
										? t(`${controller.routine.nextExercise}.title` as const)
										: t("routine.completeLabel")}
								</Text>
								{!controller.routine.nextExercise && (
									<Text style={styles.routineHint}>{t("routine.finished")}</Text>
								)}
							</View>
						</View>
					)}

					<View style={styles.controlsRow}>
						<Text style={styles.routineLabel}>{t("common.state")}</Text>
						<TouchableOpacity style={styles.resetButton} onPress={controller.handleReset}>
							<Text style={styles.resetText}>{t("common.reset")}</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.instructions}>
						{controller.instructions.map((item) => (
							<Text key={item} style={styles.instructionText}>
								• {item}
							</Text>
						))}
					</View>
				</View>
			</View>
		</View>
	);
}
