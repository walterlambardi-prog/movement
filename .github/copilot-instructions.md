# Copilot Instructions for Movement

- Follow existing screen/component structure: each screen folder must include at least `index.tsx`, `*.styles.ts`, and `*.types.ts`. Keep logic in `index`, styles in `*.styles`, and shared shapes in `*.types`.
- Use i18n strings from `app/locales/en.json` and `app/locales/es.json`; avoid hardcoded text.
- Persist workout data via `useSessionRecorder` + `recordSession` (Zustand store in `app/state/useAppStore.ts`). Do not introduce alternative persistence paths.
- Maintain Expo/React Native theming already in use (dark navy background, accent borders). Extract inline styles to StyleSheet when feasible.
- Keep onboarding optional if `hasOnboarded` and `username` already exist; don’t regress that flow.
- Prefer memoized calculations and throttled updates on vision/pose code to avoid perf regressions.
- After each response that involves code changes, you must run "yarn tsc" and "yarn lint". Fix any errors or warnings before proceeding.

## Development Guidelines

1. **Component Development**: Always create types, styles, and implementation files
2. **State Management**: Use or create a store for complex state, local state for simple UI state
3. **Performance**: Use React.memo, useCallback, and useMemo appropriately
