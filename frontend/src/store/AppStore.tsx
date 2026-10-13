import { USE_API } from '../lib/api';
import * as mock from './MockStore';
import * as live from './ApiStore';

export type { AuthActions } from './ApiStore';
export { consentState } from '../lib/access';

export const AppStoreProvider = USE_API ? live.AppStoreProvider : mock.AppStoreProvider;
export const useStore: typeof mock.useStore = USE_API ? live.useStore : mock.useStore;
export const useReady: () => boolean = USE_API ? live.useReady : () => true;
export const useAuthActions: () => live.AuthActions | null = USE_API ? live.useAuthActions : () => null;