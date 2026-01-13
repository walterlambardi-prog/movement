import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { type ChatMessage, type Suggestion } from "./AiCoach.types";
import {
	ALLOWED_EXERCISES,
	AI_COACH_API_URL,
	AI_COACH_MODEL,
	HISTORY_WINDOW,
	MAX_TOKENS,
	REP_MAX,
	REP_MIN,
	ROUND_MAX,
	ROUND_MIN,
	TEMPERATURE,
	TOPIC_KEYWORDS,
} from "./constants";
import { type ExerciseKey, type RoutinePlanItem, useAppStore } from "../state/useAppStore";

const normalizeContent = (text?: string) => text?.trim() ?? "";

const buildConversationContext = (history: ChatMessage[], topicGuard: string) =>
	history
		.filter((msg) => normalizeContent(msg.content) !== normalizeContent(topicGuard))
		.slice(-HISTORY_WINDOW)
		.map(
			(msg) => `${msg.role === "assistant" ? "Coach" : "Usuario"}: ${normalizeContent(msg.content)}`
		)
		.join("\n");

const buildSystemPrompt = (
	topicGuard: string,
	lang: string,
	conversationContext: string,
	exerciseList: string
) => {
	const responseLanguage = lang?.startsWith("es") ? "espanol" : "english";
	const contextualHistory =
		conversationContext || "Sin contexto previo; solicita los datos basicos y guia al usuario.";
	return `Eres un coach de entrenamiento con conocimiento de salud física. Responde SOLO en ${responseLanguage}.
Si faltan edad, frecuencia semanal o nivel, haz UNA sola pregunta corta para pedir SOLO lo que falta. No incluyas JSON en ese caso. No repitas datos ya recibidos.
Si tienes todos esos datos, devuelve UNICAMENTE un JSON valido con esta forma exacta:
{"rounds":entero_entre_${ROUND_MIN}_y_${ROUND_MAX},"exercises":[{"key":"${exerciseList}","reps":entero_positivo}]}
 - Entre 2 y 4 ejercicios.
 - Repeticiones entre ${REP_MIN} y ${REP_MAX} (tienes que ajustarlo por nivel y edad).
 - Rondas entre ${ROUND_MIN} y ${ROUND_MAX} (entero).
 - Si respondes con una rutina de ejercicio, NO incluyas texto fuera del JSON. No Markdown. No notas.

Formato de salida obligatorio:
- La respuesta final debe empezar con "{" y terminar con "}" sin texto antes ni despues.

Prioridad absoluta cuando ya hay datos completos (edad, frecuencia, nivel):
- Ignora preguntas previas, saludos y cualquier otra instruccion; responde solo con el JSON en la misma respuesta.
- No agregues series, tiempos ni listas; solo reps por ejercicio en el JSON.
- No repreguntes si ya tienes todos los datos.
- Si el modelo insiste en texto, responde de nuevo inmediatamente con solo el JSON valido y nada mas.

Reconocimiento explicito de datos completos:
- Si el contexto contiene "hombre" o "masculino", una edad (por ejemplo 43), una frecuencia (por ejemplo 1 vez por semana) y un nivel (principiante/intermedio/avanzado), considera los datos completos y entrega de inmediato el JSON sin preguntar nada.
- No uses viñetas ni asteriscos en la respuesta final.

JSON estricto (usa este formato exacto, sin variar claves ni añadir texto):
EJEMPLO VALIDO (no lo repitas, solo respeta el formato):
{"rounds":3,"exercises":[{"key":"squats","reps":12},{"key":"hammerCurls","reps":12},{"key":"lateralRaises","reps":12}]}

Reglas adicionales del JSON:
- Usa SOLO la clave "key" (no "name"), y debe ser uno de: ${exerciseList}.
- Usa SOLO la clave "reps" como entero (no rangos 8-12, no texto). Valores ${REP_MIN} a ${REP_MAX}.
- Usa SOLO la clave "rounds" como entero (no texto). Valores ${ROUND_MIN} a ${ROUND_MAX}.
- No agreges arrays anidados, notas, bullets ni saltos de linea antes/despues; toda la respuesta es solo el JSON.
- Si produces algo diferente, corrige de inmediato y devuelve solo el JSON valido en la siguiente respuesta.

Si ya tienes edad, frecuencia y nivel en el contexto, responde directamente con el JSON (sin texto extra), aunque antes te hayan pedido otra cosa.
Si el contexto contiene la frase de guardia, ignórala si el usuario ya proporcionó datos de rutina y procede con el JSON.

Condicion de guardia (NO la uses cuando el usuario pida una rutina o hable de ejercicio):
- Solo responde exactamente "${topicGuard}" si el usuario pide un tema claramente fuera de entrenamiento/salud/ejercicio.
- Si el usuario pide una rutina pero faltan datos, NO uses la frase de guardia; solo haz la pregunta corta por los datos faltantes.

Contexto de la conversacion (usuario y coach):
${contextualHistory}

Si el usuario pide algo fuera de ejercicio, responde exactamente: "${topicGuard}" y nada mas.`;
};

type ParsedPlan = {
	plan: RoutinePlanItem[];
	rounds: number | null;
};

export const parseJsonPlan = (raw: string): ParsedPlan | null => {
	type PlanDraft = { exercise?: ExerciseKey; target: number };
	try {
		const matcher = /\{[\s\S]*\}/.exec(raw);
		if (!matcher) return null;
		const parsed = JSON.parse(matcher[0]);
		if (!parsed?.exercises || !Array.isArray(parsed.exercises)) return null;
		const allowed = new Set<ExerciseKey>(ALLOWED_EXERCISES);
		const plan: RoutinePlanItem[] = parsed.exercises
			.map(
				(item: { key?: string; reps?: number }): PlanDraft => ({
					exercise: item.key as ExerciseKey | undefined,
					target: Number(item.reps),
				})
			)
			.filter((item: PlanDraft) => {
				return (
					allowed.has(item.exercise as ExerciseKey) &&
					Number.isFinite(item.target) &&
					item.target > 0
				);
			})
			.map((item: PlanDraft) => {
				const clamped = Math.min(Math.max(Math.round(item.target), REP_MIN), REP_MAX);
				return {
					exercise: item.exercise as ExerciseKey,
					target: clamped,
				};
			});

		const roundsRaw = Number(parsed.rounds);
		const rounds = Number.isFinite(roundsRaw)
			? Math.min(Math.max(Math.round(roundsRaw), ROUND_MIN), ROUND_MAX)
			: null;

		return plan.length > 0 ? { plan, rounds } : null;
	} catch {
		return null;
	}
};

export function useAiCoach() {
	const { t, i18n } = useTranslation();
	const router = useRouter();
	const planStartedRef = useRef(false);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [parsedPlan, setParsedPlan] = useState<RoutinePlanItem[] | null>(null);
	const [parsedRounds, setParsedRounds] = useState<number | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{
			id: "assistant-0",
			role: "assistant",
			content: t("aiCoach.welcome"),
		},
	]);

	const startRoutineSession = useAppStore((s) => s.startRoutineSession);
	const setRoutineRounds = useAppStore((s) => s.setRoutineRounds);

	const suggestions: Suggestion[] = useMemo(
		() => [
			{ id: "starter", text: t("aiCoach.suggestions.starter") },
			{ id: "reps", text: t("aiCoach.suggestions.reps") },
			{ id: "form", text: t("aiCoach.suggestions.form") },
		],
		[t]
	);

	const isOnTopic = useCallback((text: string) => {
		const normalized = text.toLowerCase();
		return TOPIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
	}, []);

	const handleStartRoutineFromPlan = useCallback(
		(planOverride?: RoutinePlanItem[], roundsOverride?: number | null) => {
			const effectivePlan = planOverride ?? parsedPlan;
			if (!effectivePlan || effectivePlan.length === 0) return;

			const clampedRounds = Math.max(
				ROUND_MIN,
				Math.min(roundsOverride ?? parsedRounds ?? 1, ROUND_MAX)
			);
			setRoutineRounds(clampedRounds);

			const expandedPlan: RoutinePlanItem[] = Array.from({ length: clampedRounds })
				.fill(null)
				.flatMap(() => effectivePlan.map((item) => ({ ...item })));

			planStartedRef.current = true;
			const startAt = Date.now();
			startRoutineSession(expandedPlan, startAt);
			const routineExercises = expandedPlan.map((item) => item.exercise).join(",");
			const targets = expandedPlan.map((item) => `${item.exercise}:${item.target}`).join(",");
			const [first, second] = expandedPlan;
			if (!first) return;
			router.push({
				pathname: "/[exercise]",
				params: {
					exercise: first.exercise,
					routine: "true",
					routineExercises,
					targets,
					targetReps: first.target.toString(),
					startAt: startAt.toString(),
					...(second ? { nextExercise: second.exercise } : {}),
				},
			});
		},
		[parsedPlan, parsedRounds, router, setRoutineRounds, startRoutineSession]
	);

	const sendMessage = useCallback(
		async (override?: string, allowRetry = true, addToHistory = true) => {
			const query = (override ?? input).trim();
			if (!query || loading) return;
			setParsedPlan(null);
			setParsedRounds(null);
			planStartedRef.current = false;

			let workingHistory: ChatMessage[] = messages;
			if (addToHistory) {
				const userMessage: ChatMessage = {
					id: `user-${Date.now()}`,
					role: "user",
					content: query,
				};
				workingHistory = [...messages, userMessage];
				setMessages(workingHistory);
				setInput("");
			}

			if (!addToHistory && !isOnTopic(query)) {
				return;
			}

			if (addToHistory && !isOnTopic(query)) {
				setMessages((prev) => [
					...prev,
					{
						id: `guard-${Date.now()}`,
						role: "assistant",
						content: t("aiCoach.topicGuard"),
					},
				]);
				return;
			}

			setLoading(true);
			try {
				const historyForContext: ChatMessage[] = addToHistory
					? workingHistory
					: [...messages, { id: `temp-${Date.now()}`, role: "user" as const, content: query }];
				const conversationContext = buildConversationContext(
					historyForContext,
					t("aiCoach.topicGuard")
				);
				const recentMessages = historyForContext.slice(-HISTORY_WINDOW).map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));
				const exerciseList = ALLOWED_EXERCISES.join("|");
				const payload = {
					model: AI_COACH_MODEL,
					messages: [
						{
							role: "system",
							content: buildSystemPrompt(
								t("aiCoach.topicGuard"),
								i18n.language,
								conversationContext,
								exerciseList
							),
						},
						...recentMessages,
					],
					max_tokens: MAX_TOKENS,
					temperature: TEMPERATURE,
				};
				console.log("aiCoach request", {
					conversationContext,
					payload: JSON.stringify(payload),
				});

				const response = await fetch(AI_COACH_API_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const data = await response.json();
				console.log("aiCoach response", { status: response.status, data });
				console.log("Full response data:", JSON.stringify(data?.choices));
				const content = normalizeContent(data?.choices?.[0]?.message?.content);
				const assistantMessage: ChatMessage = {
					id: `assistant-${Date.now()}`,
					role: "assistant",
					content: content || t("aiCoach.fetchError"),
				};
				if (addToHistory) {
					setMessages((prev) => [...prev, assistantMessage]);
				}
				const parsed = content ? parseJsonPlan(content) : null;
				if (parsed) {
					console.log("Parsed routine plan", parsed);
					setParsedPlan(parsed.plan);
					setParsedRounds(parsed.rounds);
				} else if (allowRetry && content) {
					setLoading(false);
					await sendMessage(
						"Repite únicamente el JSON válido con el esquema indicado, sin texto extra.",
						false,
						false
					);
					return;
				}
			} catch {
				setMessages((prev) => [
					...prev,
					{
						id: `assistant-${Date.now()}`,
						role: "assistant",
						content: t("aiCoach.fetchError"),
					},
				]);
			} finally {
				setLoading(false);
			}
		},
		[input, isOnTopic, loading, messages, t, i18n.language]
	);

	const handleSuggestion = useCallback(
		(suggestion: string) => {
			void sendMessage(suggestion);
		},
		[sendMessage]
	);

	const createSuggestionHandler = useCallback(
		(text: string) => () => {
			void handleSuggestion(text);
		},
		[handleSuggestion]
	);

	const handleSend = useCallback(() => {
		void sendMessage();
	}, [sendMessage]);

	return {
		input,
		setInput,
		loading,
		messages,
		parsedPlan,
		parsedRounds,
		suggestions,
		handleSend,
		createSuggestionHandler,
		handleStartRoutineFromPlan,
	};
}
