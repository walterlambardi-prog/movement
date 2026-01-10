import { type LinkProps } from "expo-router";
import { type ColorValue } from "react-native";

export type QuickAction = {
	readonly href: LinkProps["href"];
	readonly title: string;
	readonly subtitle: string;
	readonly accent: ColorValue;
	readonly icon: string;
};
