import { useEffect, useMemo, useRef } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { styles } from "./AiCoach.styles";
import { useAiCoach, parseJsonPlan, parseLevelPrompt } from "./useAiCoach";
import { useAppStore } from "../state/useAppStore";

export default function AiCoach() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);
	const username = useAppStore((s) => s.username);
	const {
		input,
		setInput,
		loading,
		messages,
		suggestions,
		handleSend,
		createSuggestionHandler,
		handleStartRoutineFromPlan,
		handleEditRoutineFromPlan,
		handleLevelSelect,
	} = useAiCoach();

	const formatTime = useMemo(
		() => (timestamp?: number) => {
			const date = timestamp ? new Date(timestamp) : new Date();
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		},
		[]
	);

	useEffect(() => {
		const timer = setTimeout(() => {
			scrollRef.current?.scrollToEnd({ animated: true });
		}, 30);
		return () => clearTimeout(timer);
	}, [messages]);

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
				onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
					{messages.map((message) => {
						const parsedLevelPrompt =
							message.role === "assistant" ? parseLevelPrompt(message.content) : null;
						const parsedMessagePlan =
							message.role === "assistant" ? parseJsonPlan(message.content) : null;
						const levelPromptTitle =
							parsedLevelPrompt?.prompt?.trim() || t("aiCoach.levelPromptFallback");
						return (
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
									<View
										style={[
											styles.metaRow,
											message.role === "user"
												? { justifyContent: "flex-end" }
												: { justifyContent: "flex-start" },
										]}
									>
										<Text style={message.role === "user" ? styles.metaNameUser : styles.metaName}>
											{message.role === "user"
												? username || t("aiCoach.meLabel")
												: t("aiCoach.coachLabel")}
										</Text>
										<Text style={message.role === "user" ? styles.metaTimeUser : styles.metaTime}>
											{formatTime(message.createdAt)}
										</Text>
									</View>
									{parsedLevelPrompt ? (
										<View style={styles.levelPrompt}>
											<Text style={styles.levelPromptTitle}>{levelPromptTitle}</Text>
											<View style={styles.levelOptions}>
												{parsedLevelPrompt.options.map((option) => {
													const lower = option.toLowerCase();
													const iconName =
														lower.includes("avanz") || lower.includes("advanced")
															? "rocket-outline"
															: lower.includes("inter")
																? "barbell-outline"
																: "leaf-outline";
													return (
														<TouchableOpacity
															key={`${message.id}-${option}`}
															style={styles.levelOptionButton}
															onPress={() => handleLevelSelect(option)}
														>
															<View style={styles.levelOptionContent}>
																<View style={styles.levelOptionIcon}>
																	<Ionicons name={iconName} size={16} color="#0B122F" />
																</View>
																<Text style={styles.levelOptionText}>{option}</Text>
															</View>
														</TouchableOpacity>
													);
												})}
											</View>
										</View>
									) : parsedMessagePlan ? (
										<View style={styles.planPreview}>
											<View style={styles.planHeader}>
												<Text style={styles.planTitle}>{t("aiCoach.planExercisesTitle")}</Text>
												<View style={styles.planBadge}>
													<Text style={styles.planBadgeText}>
														{t("aiCoach.planRoundsLabel", {
															rounds: parsedMessagePlan.rounds ?? 1,
														})}
													</Text>
												</View>
											</View>
											<View style={styles.planList}>
												{parsedMessagePlan.plan.map((item, idx) => {
													const exerciseLabel = t(`aiCoach.exerciseLabels.${item.exercise}`);
													return (
														<View
															style={styles.planRow}
															key={`${message.id}-${item.exercise}-${idx}`}
														>
															<View style={styles.planDot} />
															<Text style={styles.assistantText}>
																{t("aiCoach.planExerciseLine", {
																	exercise: exerciseLabel,
																	reps: item.target,
																})}
															</Text>
														</View>
													);
												})}
											</View>
											<View style={styles.planCta}>
												<View style={styles.planCtaRow}>
													<Ionicons name="checkmark-circle" size={18} color="#22D3EE" />
													<Text style={styles.statusText}>{t("aiCoach.planDetected")}</Text>
												</View>
												<View style={styles.planActions}>
													<TouchableOpacity
														style={styles.planStartButton}
														onPress={() => handleStartRoutineFromPlan()}
													>
														<View style={styles.planActionContent}>
															<Ionicons name="play" size={15} color="#0B122F" />
															<Text style={styles.planStartText}>{t("aiCoach.usePlanCta")}</Text>
														</View>
													</TouchableOpacity>
													<TouchableOpacity
														style={styles.planGhostButton}
														onPress={() => handleEditRoutineFromPlan()}
													>
														<View style={styles.planActionContent}>
															<Ionicons name="create-outline" size={15} color="#E2E8F0" />
															<Text style={styles.planGhostText}>{t("aiCoach.editPlanCta")}</Text>
														</View>
													</TouchableOpacity>
												</View>
											</View>
										</View>
									) : (
										<Text style={message.role === "user" ? styles.userText : styles.assistantText}>
											{message.content}
										</Text>
									)}
								</View>
							</View>
						);
					})}
					{loading ? (
						<View style={styles.statusRow}>
							<ActivityIndicator size="small" color="#22D3EE" />
							<Text style={styles.statusText}>{t("aiCoach.thinking")}</Text>
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
