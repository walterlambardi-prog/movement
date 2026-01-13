import React, { useEffect, useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import ExerciseSession from "./exerciseSession";
import { EXERCISE_KEYS, ExerciseKey } from "./state/useAppStore";

const exerciseValues = Object.values(EXERCISE_KEYS);

const normalizeParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const isExerciseKey = (value: string | null | undefined): value is ExerciseKey => {
	if (!value) return false;
	return exerciseValues.includes(value as ExerciseKey);
};

export default function ExerciseRoute() {
	const router = useRouter();
	const params = useLocalSearchParams<{ exercise?: string | string[] }>();
	const exerciseParam = normalizeParam(params.exercise);

	const exerciseKey = useMemo<ExerciseKey | null>(() => {
		return isExerciseKey(exerciseParam) ? (exerciseParam as ExerciseKey) : null;
	}, [exerciseParam]);

	useEffect(() => {
		if (!exerciseKey) {
			router.replace("/");
		}
	}, [exerciseKey, router]);

	if (!exerciseKey) return null;

	return <ExerciseSession exerciseKey={exerciseKey} />;
}
