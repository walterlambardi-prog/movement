export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
	readonly id: string;
	readonly role: ChatMessageRole;
	readonly content: string;
};

export type Suggestion = {
	readonly id: string;
	readonly text: string;
};
