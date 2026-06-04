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

const mockPost = {
  source:
    "Original Post: Would you put the sectional on the other side?? OP: So I think I may have made this post confusing. What I would be doing is changing the side the chaise is on and putting the couch in the other side of the room. The side they are in now are bay windows and I feel I’m losing almost a foot of space. I understand that a tv with windows behind wouldn’t be ideal. But I don’t usually watch tv during the day anyway User 1: It sounds like you would be losing foot space regardless because the tv stand wouldn’t be able to fully fit in the bay window either. I think it looks nice as is. Maybe look into if there is a console table you could put behind the couch that is designed to fit with a bay window? OP: I’m getting a tv stand that is less wide to fit the space. User 2: Is there space to put a TV stand in the corner by the windows? User 3: You could put some tall plants behind the sofa or find a sofa table that fits between the couch and the windows? It’s hard to tell how much room there is back there in this photo. OP: This is true User 3: Ps. I wouldn’t put the tv in front of the windows, not just because of lighting but because it won’t look nice with the tv blocking the lovely windows. It can also be more difficult to hide all the inevitable connectors and cords. User 4: I would rather sit facing the windows! User 5: No. In my humble opinion, the chaise part of the section always go along the wall/window side of a room.. because you don’t want the space to feel closed off.  My sectional couch is non adjustable, so if I move to a new place where the chaise side doesn’t work with the layout of the room, then I will have to get a new couch. User 6: Agreed. I think this is the best possible set up for the space– chaise along the wall/window side, entertainment center on blank/focal wall. It may be difficult to view a TV against a backlit wall of bright windows. OP: Oh! I would order the couch the other way around.. User 7: This comment is everything I’ve been trying to explain to my husband. Thank you. LOL. User 8: The chaise part can be switched to the other side. Yes, you should definitely swap it around. User 9: Absolutely do not put the tv in front of your beautiful windows. This sofa won't work in this room no matter what you do so you might as well leave it where it is. Possibly hang the tv on the wall instead of crowding the room even more with more (dark) furniture. User 10: Honestly, I would sell the couch and buy a smaller one; it's too big for the room. OP: I agree. But I can’t. My boyfriend picked this couch because he’s tall and really wanted a sectional. I have to compromise on this. User 10: I understand. It's not a battle worth fighting.    In that case, I recommend blackout curtains to reduce glare on the TV. As for positioning the couch, try it out both ways. If it's facing the window, move the TV in the far corner at an angle (you might need a smaller TV stand). Also, you could access the windows much easier if the couch wasn't in the way. With the couch where it is now, direct light exposure might make the color fade, depending on the material. Also, the couch might collect dust and pollen from open windows if it's too close. User 11: If you put it on the other side and are able to keep the chaise on that side it seems like you’ll cover more of that window up, which would not be a good thing imo (it appears your window is closer to the wall on the right in the picture?).  But tell us about your rug, I love it! OP: Thanks! I live the rug too. We already ordered the same couch the other way -“and now I’m thinking I may have made a mistake but it’s too late :( User 11: Well I mean it’s not a tragedy, it’ll be fine :) I only meant “not good” relative to its current position. It’s a great space! And I’m just a dummy on the internet with possibly bad opinions.  Just noticed, is the window behind it now a bay window type thing? If so then you made the right choice. OP: It is! That is the only reason why I made the decision. None of the situation is ideal. I wouldn’t have gotten a sectional if it were up to me. I’m thinking because of the shape of the bay windows I’ll get more space the other way. But I know the tv will be getting a lot of sunlight- so :( User 12: I’d mount the tv on the wall, not block the windows w it OP: I can’t. User 12: I mean retain this setup vs turning everything around User 13: Yes, if there wont be a tv. User 14: Love your rug  I don’t think the couch is too big. It looks cozy",
  target:
    "The OP wanted to know which wall they should place their sectional couch up against in their living room.  Most commenters agreed that the seating should stay by the windows.  One commenter said to get a smaller couch, but OP said they can't.",
  url: "https://i.redd.it/gvwivhq9nmf31.jpg",
  subreddit: "designmyroom",
  id: "foo",
};

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

    const contentText = `Please write a short summary of the following Reddit post from \"${mockPost.subreddit}\" subreddit:
"${mockPost.source}"
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

    // const streamer = new TextStreamer(processor, skip_prompt = True)

    const prompt = processor.apply_chat_template(messages, {
      enable_thinking: false,
      add_generation_prompt: true,
    });

    const image = await load_image(mockPost.url);

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
