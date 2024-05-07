import { StateFromReducersMapObject, combineReducers, configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import {  persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { PersistGate } from "redux-persist/integration/react";

// Import slices with their respective types
import UISlice from "./slices/UI";
import { PersistPartial } from "redux-persist/lib/persistReducer";

interface RootState extends PersistPartial {
  [key: string]: any;  // Allow any property with string type keys
  UI: ReturnType<typeof UISlice.reducer>;
}

export type RootStateType = StateFromReducersMapObject<RootState>;

function buildAppStore(): { reducers: any; state: RootStateType } {
  const slices = {
    UI: UISlice,
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

const AppStore: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { reducers, state } = buildAppStore();
  const rootReducers = combineReducers<RootState>(reducers);
  const persistReducerFn = persistReducer(
    {
      key: 'nextjs',
      storage,
      blacklist: [],
      transforms: [],
    },
    rootReducers
  );

  const store = configureStore({
    reducer: persistReducerFn,
    preloadedState: state,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      })
  });

  const persistor = persistStore(store);

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
export { AppStore, RootState };