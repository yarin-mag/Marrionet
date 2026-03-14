export type { TokenAlert } from "./types";
export { TokenAlertStorage } from "./TokenAlertStorage";
export { LocalStorageTokenAlertStorage } from "./LocalStorageTokenAlertStorage";

import { LocalStorageTokenAlertStorage } from "./LocalStorageTokenAlertStorage";
export const tokenAlertStorage = new LocalStorageTokenAlertStorage();
