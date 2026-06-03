import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { env } from "@huggingface/transformers";

const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  const res = await originalFetch(input, init);

  if (url.includes("huggingface")) {
    const clone = res.clone();
    const text = await clone.text();
    console.log(
      `%c[HF] ${res.status} ${url}`,
      res.ok ? "color:green" : "color:red",
      text.slice(0, 60),
    );
  }
  return res;
};

env.allowLocalModels = false;
env.allowRemoteModels = true;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
