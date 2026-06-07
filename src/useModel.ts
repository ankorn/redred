import { useState, useEffect, useCallback, useRef } from "react";
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  load_image,
} from "@huggingface/transformers";

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";
const CACHE_META_KEY = `redred-model-${MODEL_ID}`;

interface ModelCache {
  processor: any;
  model: any;
}

export function useModel() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");

  const cache = useRef<ModelCache | null>(null);

  let cached = false;
  const meta = localStorage.getItem(CACHE_META_KEY);
  if (meta) {
    cached = JSON.parse(meta).cached;
  }

  const downloadModel = useCallback(async () => {
    setStatus("loading");

    const processor = await AutoProcessor.from_pretrained(MODEL_ID);

    if (cached) {
      setProgress(100);
    }

    const model = await Gemma4ForConditionalGeneration.from_pretrained(
      MODEL_ID,
      {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: (info: any) => {
          if (
            info.status === "progress_total" &&
            typeof info.progress === "number"
          ) {
            // magick; otherwise progress jumps to 100 swiftly then back to like 8
            if (!cached && info.loaded > 271681761) {
              setProgress(Math.round(info.progress));
            }
          }
        },
      },
    );

    cache.current = { processor, model };

    if (!cached) {
      localStorage.setItem(
        CACHE_META_KEY,
        // no need to save model manually, hf will save if Cache storage
        JSON.stringify({ cached: true, timestamp: Date.now() }),
      );
    }

    setStatus("ready");
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setStatus("loading");

      if (cached) {
        setProgress(100);
        setStatus("ready");

        return;
      }

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
              if (!cached && info.loaded > 271681761) {
                setProgress(Math.round(info.progress));
              }
            }
          },
        },
      );

      if (!active) return;

      cache.current = { processor, model };

      if (!cached) {
        localStorage.setItem(
          CACHE_META_KEY,
          // no need to save model manually, hf will save if Cache storage
          JSON.stringify({ cached: true, timestamp: Date.now() }),
        );
      }

      setStatus("ready");
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const summarize = useCallback(
    async (
      { text, url }: { text: string; url: string },
      subreddit: string,
      onGenerate: (streamingText: string) => void,
    ): Promise<string> => {
      const { processor, model } = cache.current || {};
      if (!processor || !model) return text;

      const contentText = `Please write a short summary of the following Reddit post from \"${subreddit}\" subreddit:
"${text}"
Just plain summary without introductory text, titles, subtitles, lists, suggestions
`;

      const messages = [
        {
          role: "user",
          content: [
            { type: "image" },
            {
              type: "text",
              text: contentText,
            },
          ],
        },
      ];

      try {
        const prompt = processor.apply_chat_template(messages, {
          enable_thinking: false,
          add_generation_prompt: true,
        });

        const image = await load_image(url);

        const inputs = await processor(prompt, image, null, {
          add_special_tokens: false,
        });

        const outputs = await model.generate({
          ...inputs,
          max_new_tokens: 256,
          temperature: 1.0,
          top_p: 0.95,
          top_k: 64,
          use_cache: true,
          streamer: new TextStreamer(processor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (text) => {
              onGenerate(text);
            },
          }),
        });

        const decoded = processor.batch_decode(
          outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
          { skip_special_tokens: true },
        );

        return decoded[0]?.trim() || text;
      } catch (err) {
        console.warn(err);
        return "";
      }
    },
    [],
  );

  return {
    ready: status === "ready",
    cached,
    progress,
    status,
    summarize,
    downloadModel,
  };
}
