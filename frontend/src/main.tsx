import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { useUiStore } from "./stores/ui";

const stored = localStorage.getItem("smartdesk-ui");
if (stored) {
  try {
    const { theme } = JSON.parse(stored) as { theme?: "light" | "dark" };
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {
    /* empty */
  }
} else {
  useUiStore.getState().setTheme("light");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
