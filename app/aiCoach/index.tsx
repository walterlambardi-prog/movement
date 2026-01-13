import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { styles } from "./AiCoach.styles";
import { type ChatMessage, type Suggestion } from "./AiCoach.types";
import {
	EXERCISE_KEYS,
	type ExerciseKey,
	type RoutinePlanItem,
	useAppStore,
} from "../state/useAppStore";

const API_URL = "https://unfull-hyperflexibly-marylynn.ngrok-free.dev/v1/chat/completions";
const MODEL = "local-llama";

const buildSystemPrompt = (topicGuard: string, lang: string, conversationContext: string) => {
	const responseLanguage = lang?.startsWith("es") ? "espanol" : "english";
	const contextualHistory =
		conversationContext || "Sin contexto previo; solicita los datos basicos y guia al usuario.";
	return `Eres un coach de entrenamiento. Responde SOLO en ${responseLanguage}.
Si faltan sexo, edad, frecuencia semanal o nivel, haz UNA sola pregunta corta para pedir SOLO lo que falta. No incluyas JSON en ese caso. No repitas datos ya recibidos.
Si tienes todos esos datos, devuelve UNICAMENTE un JSON valido con esta forma exacta:
{"rounds":entero_entre_1_y_5,"exercises":[{"key":"squats|hammerCurls|lateralRaises","reps":entero_positivo}]}
 - Entre 2 y 4 ejercicios.
 - Repeticiones entre 1 y 99 (ajusta por nivel y edad).
 - Rondas entre 1 y 5 (entero).
 - Si respondes con una rutina de ejercicio, NO incluyas texto fuera del JSON. No Markdown. No notas.

Formato de salida obligatorio:
- La respuesta final debe empezar con "{" y terminar con "}" sin texto antes ni despues.
- Nada de ingles, disculpas ni frases de cortesia.
- Si alguna vez envias texto extra, corrige de inmediato y envia solo el JSON valido.

Prioridad absoluta cuando ya hay datos completos (sexo, edad, frecuencia, nivel):
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
- Usa SOLO la clave "key" (no "name"), y debe ser uno de: squats, hammerCurls, lateralRaises.
- Usa SOLO la clave "reps" como entero (no rangos 8-12, no texto). Valores 1 a 99.
- Usa SOLO la clave "rounds" como entero (no texto). Valores 1 a 5.
- No agregues arrays anidados, notas, bullets ni saltos de linea antes/despues; toda la respuesta es solo el JSON.
- Si produces algo diferente, corrige de inmediato y devuelve solo el JSON valido en la siguiente respuesta.

Si ya tienes sexo, edad, frecuencia y nivel en el contexto, responde directamente con el JSON (sin texto extra), aunque antes te hayan pedido otra cosa.
Si el contexto contiene la frase de guardia, ignórala si el usuario ya proporcionó datos de rutina y procede con el JSON.

Condicion de guardia (NO la uses cuando el usuario pida una rutina o hable de ejercicio):
- Solo responde exactamente "${topicGuard}" si el usuario pide un tema claramente fuera de entrenamiento/salud/ejercicio.
- Si el usuario pide una rutina pero faltan datos, NO uses la frase de guardia; solo haz la pregunta corta por los datos faltantes.

Prohibido:
- No escribas frases como "Sure" ni explicaciones antes o despues del JSON.
- No uses ingles ni Markdown ni viñetas.
- Si escribes cualquier texto fuera del JSON, corrige de inmediato y entrega solo el JSON valido en la siguiente respuesta.

Contexto de la conversacion (usuario y coach):
${contextualHistory}

Si el usuario pide algo fuera de ejercicio, responde exactamente: "${topicGuard}" y nada mas.`;
};

const normalizeContent = (text?: string) => text?.trim() ?? "";

const buildConversationContext = (history: ChatMessage[], topicGuard: string) =>
	history
		.filter((msg) => normalizeContent(msg.content) !== normalizeContent(topicGuard))
		.slice(-8)
		.map(
			(msg) => `${msg.role === "assistant" ? "Coach" : "Usuario"}: ${normalizeContent(msg.content)}`
		)
		.join("\n");

type ParsedPlan = {
	plan: RoutinePlanItem[];
	rounds: number | null;
};

const parseJsonPlan = (raw: string): ParsedPlan | null => {
	type PlanDraft = { exercise?: ExerciseKey; target: number };
	try {
		const matcher = /\{[\s\S]*\}/.exec(raw);
		if (!matcher) return null;
		const parsed = JSON.parse(matcher[0]);
		if (!parsed?.exercises || !Array.isArray(parsed.exercises)) return null;
		const allowed = new Set<ExerciseKey>([
			EXERCISE_KEYS.SQUATS,
			EXERCISE_KEYS.PUSHUPS,
			EXERCISE_KEYS.HAMMER_CURLS,
			EXERCISE_KEYS.LATERAL_RAISES,
		]);
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
				const clamped = Math.min(Math.max(Math.round(item.target), 1), 99);
				return {
					exercise: item.exercise as ExerciseKey,
					target: clamped,
				};
			});

		const roundsRaw = Number(parsed.rounds);
		const rounds = Number.isFinite(roundsRaw)
			? Math.min(Math.max(Math.round(roundsRaw), 1), 5)
			: null;

		return plan.length > 0 ? { plan, rounds } : null;
	} catch {
		return null;
	}
};

export default function AiCoachScreen() {
	const { t, i18n } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);
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

	useEffect(() => {
		scrollRef.current?.scrollToEnd({ animated: true });
	}, [messages]);

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
		const keywords = [
			"rutina",
			"routine",
			"reps",
			"repes",
			"ejercicio",
			"exercise",
			"salud",
			"health",
			"fitness",
			"squat",
			"sentadilla",
			"push",
			"flexion",
			"hammer",
			"curl",
			"lateral",
			"raise",
			"mancuerna",
			"dumbbell",
			"edad",
			"age",
			"años",
			"anos",
			"sexo",
			"gender",
			"male",
			"female",
			"hombre",
			"mujer",
			"frecuencia",
			"frequency",
			"veces",
			"week",
			"semana",
			"nivel",
			"level",
			"principiante",
			"beginner",
			"intermedio",
			"intermediate",
			"avanzado",
			"advanced",
		];
		return keywords.some((keyword) => normalized.includes(keyword));
	}, []);

	const handleStartRoutineFromPlan = useCallback(
		(planOverride?: RoutinePlanItem[], roundsOverride?: number | null) => {
			const effectivePlan = planOverride ?? parsedPlan;
			if (!effectivePlan || effectivePlan.length === 0) return;

			const clampedRounds = Math.max(1, Math.min(roundsOverride ?? parsedRounds ?? 1, 5));
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
				const recentMessages = historyForContext.slice(-8).map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));
				const payload = {
					model: MODEL,
					messages: [
						{
							role: "system",
							content: buildSystemPrompt(
								t("aiCoach.topicGuard"),
								i18n.language,
								conversationContext
							),
						},
						...recentMessages,
					],
					max_tokens: 180,
					temperature: 0.1,
				};
				console.log("aiCoach request", {
					conversationContext,
					payload: JSON.stringify(payload),
				});

				const response = await fetch(API_URL, {
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
					// Ask the model to resend only the JSON if the response was not parseable.
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[input, isOnTopic, loading, messages, t, i18n.language, handleStartRoutineFromPlan]
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

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					headerTitle: t("aiCoach.title"),
					headerStyle: { backgroundColor: "#0A0F2C" },
					headerTintColor: "#E2E8F0",
				}}
			/>
			<View style={styles.bubbleTop} />
			<View style={styles.bubbleBottom} />

			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.screenContent}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.suggestionsWrap}>
					{suggestions.map((item) => (
						<TouchableOpacity
							key={item.id}
							style={styles.suggestionChip}
							onPress={createSuggestionHandler(item.text)}
						>
							<Text style={styles.suggestionText}>{item.text}</Text>
						</TouchableOpacity>
					))}
				</View>

				<View style={styles.messagesCard}>
					{messages.map((message) => (
						<View
							key={message.id}
							style={[
								styles.messageRow,
								message.role === "user"
									? { justifyContent: "flex-end" }
									: { justifyContent: "flex-start" },
							]}
						>
							<View style={message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>
								<Text style={message.role === "user" ? styles.userText : styles.assistantText}>
									{message.content}
								</Text>
							</View>
						</View>
					))}
					{loading ? (
						<View style={styles.statusRow}>
							<ActivityIndicator size="small" color="#22D3EE" />
							<Text style={styles.statusText}>{t("onboarding.loading")}</Text>
						</View>
					) : null}
					{parsedPlan ? (
						<View style={styles.statusRow}>
							<Ionicons name="checkmark-circle" size={18} color="#22D3EE" />
							<Text style={styles.statusText}>{t("aiCoach.planDetected")}</Text>
							<TouchableOpacity
								style={styles.suggestionChip}
								onPress={() => handleStartRoutineFromPlan()}
							>
								<Text style={styles.suggestionText}>{t("aiCoach.usePlanCta")}</Text>
							</TouchableOpacity>
						</View>
					) : null}
				</View>
			</ScrollView>

			<View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
				<View style={styles.inputInner}>
					<TextInput
						value={input}
						onChangeText={setInput}
						placeholder={t("aiCoach.inputPlaceholder")}
						placeholderTextColor="#64748B"
						style={styles.textInput}
						returnKeyType="send"
						onSubmitEditing={handleSend}
						editable={!loading}
						multiline
					/>
					<TouchableOpacity
						onPress={handleSend}
						disabled={loading || !input.trim().length}
						style={styles.sendButton}
					>
						{loading ? (
							<ActivityIndicator size="small" color="#0B122F" style={styles.loadingInline} />
						) : (
							<Ionicons name="send" size={18} color="#0B122F" style={styles.sendIcon} />
						)}
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
}
