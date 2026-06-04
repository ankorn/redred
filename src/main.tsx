import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.remoteHost = "https://modelscope.cn";
env.remotePathTemplate = "models/{model}/resolve/main/"; // https://modelscope.cn/models/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/preprocessor_config.json

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
