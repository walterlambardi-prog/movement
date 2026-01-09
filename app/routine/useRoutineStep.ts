import { useCallback, useMemo, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { DEFAULT_ROUTINE_TARGET, getNextRoutineExercise, isRoutineExercise } from "./config";
import { ExerciseKey } from "../state/useAppStore";

type RoutineParams = {
	targetReps?: string | string[];
	routine?: string | string[];
	nextExercise?: string | string[];
};

const normalizeParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export function useRoutineStep(currentExercise: ExerciseKey) {
	const router = useRouter();
	const params = useLocalSearchParams<RoutineParams>();

	const target = useMemo(() => {
		const raw = normalizeParam(params.targetReps);
		const parsed = raw ? Number(raw) : NaN;
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}, [params.targetReps]);

	const isRoutine = useMemo(() => {
		const flag = normalizeParam(params.routine);
		return flag === "true" || target !== null || !!normalizeParam(params.nextExercise);
	}, [params.nextExercise, params.routine, target]);

	const nextFromParams = useMemo(() => {
		if (!isRoutine) return null;
		const raw = normalizeParam(params.nextExercise);
		return isRoutineExercise(raw) ? (raw as ExerciseKey) : null;
	}, [isRoutine, params.nextExercise]);

	const resolvedTarget = isRoutine ? (target ?? DEFAULT_ROUTINE_TARGET) : null;

	const computedNext = useMemo(() => {
		if (!isRoutine) return null;
		return nextFromParams ?? getNextRoutineExercise(currentExercise);
	}, [currentExercise, isRoutine, nextFromParams]);

	const hasAdvancedRef = useRef(false);

	const advanceToNext = useCallback(
		(count: number) => {
			if (!isRoutine || resolvedTarget === null) return;
			if (count < resolvedTarget) return;
			if (hasAdvancedRef.current) return;

			hasAdvancedRef.current = true;

			if (computedNext) {
				const following = getNextRoutineExercise(computedNext);
				router.replace({
					pathname: `/${computedNext}`,
					params: {
						routine: "true",
						targetReps: resolvedTarget.toString(),
						...(following ? { nextExercise: following } : {}),
					},
				});
				return;
			}

			router.replace("/");
		},
		[computedNext, isRoutine, resolvedTarget, router]
	);

	return {
		isRoutine,
		target: resolvedTarget,
		nextExercise: computedNext,
		advanceToNext,
	};
}
