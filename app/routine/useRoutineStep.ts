import { useCallback, useMemo, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { DEFAULT_ROUTINE_TARGET, ROUTINE_SEQUENCE, isRoutineExercise } from "./config";
import { ExerciseKey } from "../state/useAppStore";

type RoutineParams = {
	targetReps?: string | string[];
	routine?: string | string[];
	nextExercise?: string | string[];
	routineExercises?: string | string[];
	targets?: string | string[];
};

const normalizeParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const parseExercises = (raw?: string | null): ExerciseKey[] => {
	if (!raw) return [];
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter(isRoutineExercise) as ExerciseKey[];
};

const parseTargets = (raw?: string | null): Record<ExerciseKey, number> => {
	if (!raw) return {} as Record<ExerciseKey, number>;
	return raw.split(",").reduce(
		(acc, entry) => {
			const [key, value] = entry.split(":");
			if (isRoutineExercise(key)) {
				const parsed = Number(value);
				if (Number.isFinite(parsed) && parsed > 0) {
					acc[key as ExerciseKey] = parsed;
				}
			}
			return acc;
		},
		{} as Record<ExerciseKey, number>
	);
};

export function useRoutineStep(currentExercise: ExerciseKey) {
	const router = useRouter();
	const params = useLocalSearchParams<RoutineParams>();
	const routineExercisesParam = normalizeParam(params.routineExercises);
	const targetsParam = normalizeParam(params.targets);

	const target = useMemo(() => {
		const raw = normalizeParam(params.targetReps);
		const parsed = raw ? Number(raw) : NaN;
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}, [params.targetReps]);

	const isRoutine = useMemo(() => {
		const flag = normalizeParam(params.routine);
		return (
			flag === "true" ||
			target !== null ||
			!!normalizeParam(params.nextExercise) ||
			!!routineExercisesParam
		);
	}, [params.nextExercise, params.routine, routineExercisesParam, target]);

	const sequence = useMemo(() => {
		if (!isRoutine) return [] as ExerciseKey[];
		const parsed = parseExercises(routineExercisesParam);
		const uniqueParsed = Array.from(new Set(parsed));
		if (uniqueParsed.length > 0) return uniqueParsed as ExerciseKey[];
		return ROUTINE_SEQUENCE;
	}, [isRoutine, routineExercisesParam]);

	const targetMap = useMemo(() => parseTargets(targetsParam), [targetsParam]);

	const nextFromParams = useMemo(() => {
		if (!isRoutine) return null;
		const raw = normalizeParam(params.nextExercise);
		return isRoutineExercise(raw) ? (raw as ExerciseKey) : null;
	}, [isRoutine, params.nextExercise]);

	const resolvedTarget = isRoutine
		? (targetMap[currentExercise] ?? target ?? DEFAULT_ROUTINE_TARGET)
		: null;

	const computedNext = useMemo(() => {
		if (!isRoutine) return null;
		if (nextFromParams) return nextFromParams;
		const index = sequence.indexOf(currentExercise);
		if (index >= 0 && index < sequence.length - 1) return sequence[index + 1];
		return null;
	}, [currentExercise, isRoutine, nextFromParams, sequence]);

	const hasAdvancedRef = useRef(false);

	const serializedExercises = useMemo(() => sequence.join(","), [sequence]);
	const serializedTargets = useMemo(
		() =>
			Object.keys(targetMap)
				.map((key) => `${key}:${targetMap[key as ExerciseKey]}`)
				.join(","),
		[targetMap]
	);

	const advanceToNext = useCallback(
		(count: number) => {
			if (!isRoutine || resolvedTarget === null) return;
			if (count < resolvedTarget) return;
			if (hasAdvancedRef.current) return;

			hasAdvancedRef.current = true;

			if (computedNext) {
				const index = sequence.indexOf(computedNext);
				const following = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
				router.replace({
					pathname: `/${computedNext}`,
					params: {
						routine: "true",
						targetReps: resolvedTarget.toString(),
						...(serializedExercises ? { routineExercises: serializedExercises } : {}),
						...(serializedTargets ? { targets: serializedTargets } : {}),
						...(following ? { nextExercise: following } : {}),
					},
				});
				return;
			}

			router.replace("/");
		},
		[
			computedNext,
			isRoutine,
			resolvedTarget,
			router,
			sequence,
			serializedExercises,
			serializedTargets,
		]
	);

	return {
		isRoutine,
		target: resolvedTarget,
		nextExercise: computedNext,
		advanceToNext,
	};
}
