import { StateFromReducersMapObject, combineReducers, configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import {  persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { PersistGate } from "redux-persist/integration/react";
import { PersistPartial } from "redux-persist/lib/persistReducer";

// Import slices with their respective types
import UISlice from "./slices/UI";
import AppSlice from "./slices/App";

interface RootState extends PersistPartial {
  [key: string]: any;  // Allow any property with string type keys
  UI: ReturnType<typeof UISlice.reducer>;
  App: ReturnType<typeof AppSlice.reducer>;
}

export type RootStateType = StateFromReducersMapObject<RootState>;

function buildAppStore(): { reducers: any; state: RootStateType } {
  const slices = {
    UI: UISlice,
    App: AppSlice,
  };

  const reducers = {} as any;
  const stateX = {};
  Object.keys(slices).forEach(key => {
    reducers[key] = slices[key].reducer;
    const defaultState = slices[key].getInitialState();
    stateX[key] = defaultState;
  });

  return { reducers, state: stateX as RootStateType };
}

// Create store ONCE at module level, not on every render
let storeInstance: ReturnType<typeof configureStore> | null = null;
let persistorInstance: ReturnType<typeof persistStore> | null = null;

function getOrCreateStore() {
  if (storeInstance) {
    return { store: storeInstance, persistor: persistorInstance! };
  }

  const { reducers, state } = buildAppStore();
  const rootReducers = combineReducers<RootState>(reducers);
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
    preloadedState: state,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      })
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

export type Store = ReturnType<typeof buildAppStore>['state'];
export type AppDispatch = Store['dispatch'];
export { AppStore };
export type { RootState };