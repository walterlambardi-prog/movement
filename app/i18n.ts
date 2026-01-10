import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";

export const fallbackLng = "en";
export const supportedLngs = ["en", "es"] as const;

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? fallbackLng;
export const initialLanguage = supportedLngs.includes(
	deviceLanguage as (typeof supportedLngs)[number]
)
	? deviceLanguage
	: fallbackLng;

if (!i18n.isInitialized) {
	i18n.use(initReactI18next).init({
		compatibilityJSON: "v3",
		resources: {
			en: { translation: en },
			es: { translation: es },
		},
		lng: initialLanguage,
		fallbackLng,
		supportedLngs,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
} else {
	i18n.changeLanguage(initialLanguage);
}

export default i18n;
