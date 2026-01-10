import { type ComponentProps } from "react";
import { type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
export type QuickActionHref = Extract<Href, string>;

export type QuickAction = {
	readonly href: QuickActionHref;
	readonly title: string;
	readonly subtitle: string;
	readonly accent: string;
	readonly icon: IoniconName;
};
