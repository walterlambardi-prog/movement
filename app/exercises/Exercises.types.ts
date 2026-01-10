import { type Href } from "expo-router";
import { type ImageSourcePropType } from "react-native";

export type ExerciseHref = Extract<Href, string>;

export type ExerciseCardProps = {
	readonly href: ExerciseHref;
	readonly title: string;
	readonly subtitle: string;
	readonly image: ImageSourcePropType;
};
