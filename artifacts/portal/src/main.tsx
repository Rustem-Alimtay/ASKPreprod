import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener("unhandledrejection", (event) => {
  if (!(event.reason instanceof Error)) {
    event.preventDefault();
    const msg =
      typeof event.reason === "string"
        ? event.reason
        : event.reason && typeof event.reason.message === "string"
          ? event.reason.message
          : "Unhandled promise rejection";
    console.error(new Error(msg));
  }
});

window.addEventListener("error", (event) => {
  if (!event.error || !(event.error instanceof Error)) {
    event.preventDefault();
    const msg =
      typeof event.error === "string"
        ? event.error
        : event.message || "Uncaught non-Error exception";
    console.error(new Error(msg));
  }
});

createRoot(document.getElementById("root")!).render(<App />);
