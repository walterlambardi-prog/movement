import { type LinkProps } from "expo-router";
import { ColorValue, type ImageSourcePropType } from "react-native";

export type Language = {
	readonly code: string;
	readonly label: string;
};

export type CardProps = {
	readonly href: LinkProps["href"];
	readonly title: string;
	readonly subtitle: string;
	readonly accent: ColorValue;
	readonly image: ImageSourcePropType;
};
