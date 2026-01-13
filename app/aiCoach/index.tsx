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

const buildSystemPrompt = (topicGuard: string, lang: string) => {
	const responseLanguage = lang?.startsWith("es") ? "espanol" : "english";
	return `Eres un coach de entrenamiento para la app Movement. Solo respondes sobre ejercicio fisico, salud, rutinas y los cuatro ejercicios disponibles: sentadillas (squats), push-ups/flexiones, hammer curls y elevaciones laterales. Si el usuario pregunta algo fuera de entrenamiento o de su estado físico, responde exactamente: "${topicGuard}". Idioma obligatorio: ${responseLanguage}. Si respondes en otro idioma, la respuesta es invalida, asi que corrige y responde de nuevo en ${responseLanguage}.
Antes de proponer una rutina o repeticiones, primero pregunta de forma breve: sexo, edad, frecuencia semanal de actividad y nivel atletico (principiante/intermedio/avanzado). Cuando entregues una rutina, primero da una respuesta breve en texto, y despues en una nueva linea devuelve SOLO un objeto JSON con esta forma exacta: {"exercises":[{"key":"squats|pushups|hammerCurls|lateralRaises","reps":numero_positive}...]}. No agregues texto despues del JSON. Responde solo en ${responseLanguage}.`;
};

const normalizeContent = (text?: string) => text?.trim() ?? "";

const parseJsonPlan = (raw: string): RoutinePlanItem[] | null => {
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
			.map((item: PlanDraft) => ({
				exercise: item.exercise as ExerciseKey,
				target: Math.min(Math.max(Math.round(item.target), 1), 500),
			}));
		return plan.length > 0 ? plan : null;
	} catch {
		return null;
	}
};

export default function AiCoachScreen() {
	const { t, i18n } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);
	const [input, setInput] = useState("");
	const [loading, setLoading] = useState(false);
	const [parsedPlan, setParsedPlan] = useState<RoutinePlanItem[] | null>(null);
	const [messages, setMessages] = useState<ChatMessage[]>(() => [
		{
			id: "assistant-0",
			role: "assistant",
			content: t("aiCoach.welcome"),
		},
	]);

	const startRoutineSession = useAppStore((s) => s.startRoutineSession);

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
		];
		return keywords.some((keyword) => normalized.includes(keyword));
	}, []);

	const sendMessage = useCallback(
		async (override?: string) => {
			const query = (override ?? input).trim();
			if (!query || loading) return;
			setParsedPlan(null);

			const userMessage: ChatMessage = {
				id: `user-${Date.now()}`,
				role: "user",
				content: query,
			};

			const nextHistory = [...messages, userMessage];
			setMessages(nextHistory);
			setInput("");

			if (!isOnTopic(query)) {
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
				const payload = {
					model: MODEL,
					messages: [
						{
							role: "system",
							content: buildSystemPrompt(t("aiCoach.topicGuard"), i18n.language),
						},
						...nextHistory.slice(-10).map((msg) => ({ role: msg.role, content: msg.content })),
					],
					max_tokens: 360,
					temperature: 0.1,
				};

				const response = await fetch(API_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				const data = await response.json();
				const content = normalizeContent(data?.choices?.[0]?.message?.content);
				const assistantMessage: ChatMessage = {
					id: `assistant-${Date.now()}`,
					role: "assistant",
					content: content || t("aiCoach.fetchError"),
				};
				setMessages((prev) => [...prev, assistantMessage]);
				const plan = content ? parseJsonPlan(content) : null;
				if (plan) setParsedPlan(plan);
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

	const handleStartRoutineFromPlan = useCallback(() => {
		if (!parsedPlan || parsedPlan.length === 0) return;
		const startAt = Date.now();
		startRoutineSession(parsedPlan, startAt);
		const routineExercises = parsedPlan.map((item) => item.exercise).join(",");
		const targets = parsedPlan.map((item) => `${item.exercise}:${item.target}`).join(",");
		const [first, second] = parsedPlan;
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
	}, [parsedPlan, router, startRoutineSession]);

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
							<TouchableOpacity style={styles.suggestionChip} onPress={handleStartRoutineFromPlan}>
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
