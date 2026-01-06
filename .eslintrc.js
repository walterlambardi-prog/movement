module.exports = {
	root: true,
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:react/recommended",
		"plugin:react-hooks/recommended",
		"prettier",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaFeatures: {
			jsx: true,
		},
		ecmaVersion: 2021,
		sourceType: "module",
	},
	plugins: ["@typescript-eslint", "react", "react-hooks", "prettier"],
	rules: {
		"prettier/prettier": "warn",
		"react/react-in-jsx-scope": "off",
		"react/prop-types": "off",
		"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
		"@typescript-eslint/explicit-module-boundary-types": "off",
		"@typescript-eslint/no-explicit-any": "warn",
		"react-hooks/rules-of-hooks": "error",
		"react-hooks/exhaustive-deps": "warn",
	},
	settings: {
		react: {
			version: "detect",
		},
	},
	env: {
		browser: true,
		es2021: true,
		node: true,
	},
	ignorePatterns: [
		"node_modules/",
		"ios/",
		"android/",
		".expo/",
		"dist/",
		"build/",
		"*.config.js",
		"metro.config.js",
		"babel.config.js",
	],
};
