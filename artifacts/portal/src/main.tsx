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

window.onerror = (_message, _source, _lineno, _colno, error) => {
  if (error && !(error instanceof Error)) {
    const msg =
      typeof error === "string"
        ? error
        : "Uncaught non-Error exception";
    console.error(new Error(msg));
    return true;
  }
  return false;
};

createRoot(document.getElementById("root")!).render(<App />);
