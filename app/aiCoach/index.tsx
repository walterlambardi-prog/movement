import { useEffect, useRef } from "react";
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
import { useAiCoach, parseJsonPlan } from "./useAiCoach";

export default function AiCoach() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollView>(null);
	const {
		input,
		setInput,
		loading,
		messages,
		parsedPlan,
		suggestions,
		handleSend,
		createSuggestionHandler,
		handleStartRoutineFromPlan,
	} = useAiCoach();

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
						const parsedMessagePlan =
							message.role === "assistant" ? parseJsonPlan(message.content) : null;
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
									{parsedMessagePlan ? (
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
