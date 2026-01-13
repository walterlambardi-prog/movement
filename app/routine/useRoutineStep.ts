import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { DEFAULT_ROUTINE_TARGET, ROUTINE_SEQUENCE, isRoutineExercise } from "./config";
import { ExerciseKey, RoutinePlanItem, useAppStore } from "../state/useAppStore";

type RoutineParams = {
	targetReps?: string | string[];
	routine?: string | string[];
	nextExercise?: string | string[];
	routineExercises?: string | string[];
	targets?: string | string[];
	startAt?: string | string[];
	stepIndex?: string | string[];
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
	const routineFlag = normalizeParam(params.routine);
	const routineExercisesParam = normalizeParam(params.routineExercises);
	const targetsParam = normalizeParam(params.targets);
	const startAtParam = normalizeParam(params.startAt);
	const stepIndexParam = normalizeParam(params.stepIndex);
	const currentRoutine = useAppStore((s) => s.routine.currentSession);
	const planFromStore = currentRoutine?.plan ?? null;
	const startRoutineSession = useAppStore((s) => s.startRoutineSession);
	const completeRoutineExercise = useAppStore((s) => s.completeRoutineExercise);
	const finishRoutineSession = useAppStore((s) => s.finishRoutineSession);

	const target = useMemo(() => {
		const raw = normalizeParam(params.targetReps);
		const parsed = raw ? Number(raw) : NaN;
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}, [params.targetReps]);

	const isRoutine = useMemo(() => {
		if (routineFlag === "true") return true;
		if (routineFlag === "false") return false;
		return target !== null || !!normalizeParam(params.nextExercise) || !!routineExercisesParam;
	}, [params.nextExercise, routineFlag, routineExercisesParam, target]);

	const sequence = useMemo(() => {
		if (!isRoutine) return [] as ExerciseKey[];
		if (planFromStore) return planFromStore.map((item) => item.exercise);
		const parsed = parseExercises(routineExercisesParam);
		if (parsed.length > 0) return parsed as ExerciseKey[];
		return ROUTINE_SEQUENCE;
	}, [isRoutine, planFromStore, routineExercisesParam]);

	const targetMap = useMemo(() => {
		if (planFromStore) {
			return planFromStore.reduce(
				(acc, item) => {
					acc[item.exercise] = item.target;
					return acc;
				},
				{} as Record<ExerciseKey, number>
			);
		}
		return parseTargets(targetsParam);
	}, [planFromStore, targetsParam]);

	const startAt = useMemo(() => {
		if (currentRoutine?.startedAt) return currentRoutine.startedAt;
		const parsed = startAtParam ? Number(startAtParam) : NaN;
		return Number.isFinite(parsed) ? parsed : Date.now();
	}, [currentRoutine?.startedAt, startAtParam]);

	const stepIndex = useMemo(() => {
		const parsed = stepIndexParam ? Number(stepIndexParam) : NaN;
		if (Number.isFinite(parsed) && parsed >= 0) return parsed;
		return 0;
	}, [stepIndexParam]);

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
		if (stepIndex < sequence.length - 1) return sequence[stepIndex + 1];
		return null;
	}, [isRoutine, nextFromParams, sequence, stepIndex]);

	const hasAdvancedRef = useRef(false);

	useEffect(() => {
		hasAdvancedRef.current = false;
	}, [currentExercise, stepIndex]);

	const serializedExercises = useMemo(() => sequence.join(","), [sequence]);
	const serializedTargets = useMemo(() => {
		if (planFromStore) {
			return planFromStore.map((item) => `${item.exercise}:${item.target}`).join(",");
		}
		return Object.keys(targetMap)
			.map((key) => `${key}:${targetMap[key as ExerciseKey]}`)
			.join(",");
	}, [planFromStore, targetMap]);

	const planFromParams = useMemo<RoutinePlanItem[]>(
		() =>
			sequence.map((exercise) => ({
				exercise,
				target: targetMap[exercise] ?? target ?? DEFAULT_ROUTINE_TARGET,
			})),
		[sequence, targetMap, target]
	);

	useEffect(() => {
		if (!isRoutine) return;
		if (currentRoutine) return;
		if (planFromParams.length === 0) return;
		startRoutineSession(planFromParams, startAt);
	}, [currentRoutine, isRoutine, planFromParams, startAt, startRoutineSession]);

	const advanceToNext = useCallback(
		(count: number) => {
			if (!isRoutine || resolvedTarget === null) return;
			if (count < resolvedTarget) return;
			if (hasAdvancedRef.current) return;

			hasAdvancedRef.current = true;
			completeRoutineExercise(currentExercise, count, resolvedTarget);

			if (computedNext) {
				const nextStep = stepIndex + 1;
				const following = nextStep < sequence.length - 1 ? sequence[nextStep + 1] : null;
				router.replace({
					pathname: "/[exercise]",
					params: {
						exercise: computedNext,
						routine: "true",
						targetReps: resolvedTarget.toString(),
						stepIndex: nextStep.toString(),
						...(serializedExercises ? { routineExercises: serializedExercises } : {}),
						...(serializedTargets ? { targets: serializedTargets } : {}),
						...(following ? { nextExercise: following } : {}),
					},
				});
				return;
			}

			const sessionId = finishRoutineSession();
			router.replace({
				pathname: "/routineComplete",
				params: sessionId ? { sessionId } : {},
			});
		},
		[
			computedNext,
			isRoutine,
			resolvedTarget,
			router,
			sequence,
			serializedExercises,
			serializedTargets,
			completeRoutineExercise,
			currentExercise,
			finishRoutineSession,
			stepIndex,
		]
	);

	return {
		isRoutine,
		target: resolvedTarget,
		nextExercise: computedNext,
		advanceToNext,
	};
}
