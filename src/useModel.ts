import { useState, useEffect, useCallback, useRef } from "react";
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
} from "@huggingface/transformers";

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const CACHE_META_KEY = `redred-model-${MODEL_ID}`;

interface ModelCache {
  processor: any;
  model: any;
}

export function useModel() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "checking" | "loading" | "ready"
  >("idle");

  const cache = useRef<ModelCache | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setStatus("checking");

      const meta = localStorage.getItem(CACHE_META_KEY);
      if (meta) {
        const { cached } = JSON.parse(meta);
        if (cached) {
          setProgress(100);

          setStatus("ready");

          return;
        }
      }

      setStatus("loading");

      const processor = await AutoProcessor.from_pretrained(MODEL_ID);

      if (!active) return;

      const model = await Gemma4ForConditionalGeneration.from_pretrained(
        MODEL_ID,
        {
          dtype: "q4f16",
          device: "webgpu",
          progress_callback: (info: any) => {
            if (!active) return;
            if (
              info.status === "progress_total" &&
              typeof info.progress === "number"
            ) {
              // magick; otherwise progress jumps to 100 swiftly then back to like 8
              if (info.loaded > 271681761) {
                setProgress(Math.round(info.progress));
              }
            }
          },
        },
      );

      if (!active) return;

      cache.current = { processor, model };
      localStorage.setItem(
        CACHE_META_KEY,
        JSON.stringify({ cached: true, timestamp: Date.now() }), // no need to save model manually, hf will save if Cache storage
      );
      setStatus("ready");
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const summarize = useCallback(async (text: string): Promise<string> => {
    const { processor, model } = cache.current || {};
    if (!processor || !model) return text;

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Summarize the following Reddit post in one concise sentence:\n\n${text}`,
          },
        ],
      },
    ];

    const prompt = processor.apply_chat_template(messages, {
      enable_thinking: false,
      add_generation_prompt: true,
    });

    const inputs = await processor(prompt, { add_special_tokens: false });

    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: 64,
      do_sample: false,
    });

    const decoded = processor.batch_decode(
      outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
      { skip_special_tokens: true },
    );

    return decoded[0]?.trim() || text;
  }, []);

  return {
    ready: status === "ready",
    progress,
    status,
    summarize,
  };
}
