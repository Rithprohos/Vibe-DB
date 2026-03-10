import type { StoreApi } from "zustand";
import type { AppState } from "../types";

export type AppSet = StoreApi<AppState>["setState"];
export type AppGet = StoreApi<AppState>["getState"];
