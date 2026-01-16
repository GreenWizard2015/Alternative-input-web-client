import { StateFromReducersMapObject, combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { PersistGate } from 'redux-persist/integration/react';
import { PersistPartial } from 'redux-persist/lib/persistReducer';

// Import slices with their respective types
import UISlice from './slices/UI';
import AppSlice from './slices/App';

interface RootState extends PersistPartial {
  UI: ReturnType<typeof UISlice.reducer>;
  App: ReturnType<typeof AppSlice.reducer>;
}

export type RootStateType = StateFromReducersMapObject<RootState>;

function buildAppStore(): {
  reducers: { UI: typeof UISlice.reducer; App: typeof AppSlice.reducer };
} {
  const slices = {
    UI: UISlice,
    App: AppSlice,
  };

  const reducers = {
    UI: slices.UI.reducer,
    App: slices.App.reducer,
  };

  return { reducers };
}

// Create store ONCE at module level, not on every render
let storeInstance: ReturnType<typeof configureStore> | null = null;
let persistorInstance: ReturnType<typeof persistStore> | null = null;

function getOrCreateStore() {
  if (storeInstance && persistorInstance) {
    return { store: storeInstance, persistor: persistorInstance };
  }

  const { reducers } = buildAppStore();
  const rootReducers = combineReducers(reducers);
  const persistReducerFn = persistReducer(
    {
      key: 'nextjs',
      storage,
      blacklist: ['App'],
      transforms: [],
    },
    rootReducers
  );

  storeInstance = configureStore({
    reducer: persistReducerFn,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });

  persistorInstance = persistStore(storeInstance);

  return { store: storeInstance, persistor: persistorInstance };
}

const AppStore: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { store, persistor } = getOrCreateStore();

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
};

export { AppStore };
export type { RootState };
