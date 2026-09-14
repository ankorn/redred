import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// import { env } from "@huggingface/transformers";

// env.remoteHost = "https://functions.yandexcloud.net/d4eg9ap7ucsan36isgk8";

// env.remotePathTemplate =
//   "?url=https://modelscope.cn/models/{model}/resolve/main/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
