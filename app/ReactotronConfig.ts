import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import Reactotron from "reactotron-react-native";

const scriptURL = NativeModules.SourceCode?.scriptURL;
const derivedHost = scriptURL ? scriptURL.split("://")[1]?.split(":")[0] : "localhost";
const defaultHost = derivedHost || "localhost";
const emulatorHost =
	Platform.OS === "android" && defaultHost === "localhost" ? "10.0.2.2" : defaultHost;
const host = process.env.REACTOTRON_HOST || emulatorHost;

const reactotron = __DEV__
	? Reactotron.setAsyncStorageHandler?.(AsyncStorage)
			.configure({ name: "Movement", host, port: 9090 })
			.useReactNative()
			.connect()
	: undefined;

if (__DEV__ && reactotron) {
	reactotron.clear?.();
	reactotron.log?.(`Reactotron connected (${host})`);
}

export default reactotron;
