import { useEffect, useRef } from "react";

import { type ExerciseKey, useAppStore } from "./useAppStore";

const DEFAULT_DEBOUNCE_MS = 4000;

export function useSessionRecorder(
	exercise: ExerciseKey,
	count: number,
	debounceMs: number = DEFAULT_DEBOUNCE_MS
) {
	const recordSession = useAppStore((state) => state.recordSession);
	const savedCountRef = useRef(0);
	const pendingRef = useRef(0);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const flush = () => {
			if (pendingRef.current <= 0) return;
			recordSession(exercise, pendingRef.current, Date.now());
			savedCountRef.current += pendingRef.current;
			pendingRef.current = 0;
		};

		// Reset tracking when counter resets (e.g., user taps reset button)
		if (count < savedCountRef.current) {
			savedCountRef.current = count;
			pendingRef.current = 0;
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
			return;
		}

		const delta = count - savedCountRef.current;
		if (delta > 0) {
			pendingRef.current += delta;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				flush();
				timerRef.current = null;
			}, debounceMs);
		}

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				flush();
			}
		};
	}, [count, debounceMs, exercise, recordSession]);
}
