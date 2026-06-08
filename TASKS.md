#### qwen + tl;dr dataset

- [ ] archive 0.25 rouge1

- [ ] consider Pleias model: Pleias-RAG-350m, Pleias-RAG-1B

- [x] remove qwen quantization, use onnx quantization

- [x] (bug) rouge low after 500 steps(rouge1 less then 0.1402)
  - [x] more steps
  - [x] r=64
  - [x] check summary len, if needed: MAX_SEQ_LENGTH=1024; cut text on format_chat
  - [x] collator with response_template="<|im_start|>assistant\n"
  - [x] length_penalty: 0.5
  - [x] do not use eos_token as pad_token

- [x] (bug) check if chat-formatted string used in eval(<|im_start|>); remove special tokens

- [ ] check q4 rouge, actual local enference speed
- [ ] check q8 rouge, actual local enference speed
- [ ] (?) q4 less supported?

- [x] remove few very long texts
- [x] remove non-english texts
- [x] remove duplicates

- [ ] upload onnx model

- [x] after eval fine-tune generation

- [x] handle non-englesh

- [x] use rouge for checkpoint selection and early stopping
- [x] (bug) oom during evaluation
  - [x] add preprocess_logits_for_metrics
  - [x] custom prediction_step with optimizations

- [ ] unsloth

- [ ] rouge1 0.17, which is suboptimal
  - [x] check overfitting due to to big lora rank; try 16 r; 1e-4; dropout=0.2; warmup_ratio=0.1; max_new_tokens=128; early_stopping=False; MAX_SEQ_LENGTH=1500; LR_SCHEDULE_TYPE='cosine'
    - consistent improvement over 4500 steps; slow; rouge1: 0.158
  - [x] try all above with lr 2e-4
    - rouge1: 0.183; after started decaying
  - [x] try all above with lr 1.5e-4
    - rouge1: \_
  - [x] try LEARNING_RATE = 2e-4; WEIGHT_DECAY = 0.05; LABEL_SMOOTHING_FACTOR = 0.1; LORA_DROPOUT = 0.3; GRAD_ACCUMULATION = 8; LR_SCHEDULE_TYPE='linear'; WARMUP_STEPS = 500; NUM_SAMPLES=500_000;
    - early stopped at 2000 steps; rouge1: 0.152
  - [x] try LEARNING_RATE = 1.5e-4; WEIGHT_DECAY = 0.01; LORA_DROPOUT = 0.2; LR_SCHEDULE_TYPE='constant_with_warmup'
    - inconsistent loss, max rouge1: 0.152

- [x] add subreddit name to prompt
- [ ] try only eos_token_id stop

## change dataset and model

tl;dr summaries are too ironic and short for target task of casual summarization; fine-tuning does not give much improvement due to dataset nature

also qwen2.5 is probably not the best model for a task - gemma4 is newer and multi-modal which is very important for summarization of reddit posts where picture holds a lot of meaning

so choosing mRedditSum(small multi-modal human labeled) and gemma4

## gemma + unsloth + mredditsum

- [x] gemma
  - [ ] convert dataset to hf
  - [ ] think during inference
  - [ ] base
  - [x] instuct
  - [x] image + text summary: https://aclanthology.org/2023.emnlp-main.251/; https://github.com/Koverbay/mredditsum
  - [x] Put image and/or audio before text
  - [ ] check visual token budget
  - [x] remove reddit id from the start
  - [x] sys prompt
  - [x] define metrics apart from rouge
  - initial rouge1: 0.3741; rougeLsum: 0.2577
  - [x] remove 'Here is a summary of the Reddit post from the r/designmyroom subreddit'
    - initial: rouge1: 0.4346; rougeLsum: 0.2890
    - after 1 epoch: rouge1: 0.4369; rougeLsum: 0.2849
    - after 2 epochs: rouge1: 0.4586; rougeLsum: 0.2976
    - after 3 epochs: rouge1:0.4605; rougeLsum: 0.3167
  - [ ] onnx
    - [x] without unsloth; did't work without hacking
    - [x] push merged
    - [ ] export to onnx without unsloth
    - [x] implement wrapper class
  - [x] fix passing target during eval
  - [ ] reeval

## delivery ways

- [x] choose a way
  - make it public and share the inference widget? widget is not enough for subreddit summarization
  - Ollama? this would mean loosing the freedom of website usage
  - server? can work with web app, but app originally was intended to use small model; running small model on server does not make much sense
  - (chosen) use original onnx model until onnx + optimum fine-tuned gemma4 support? this will allow to build a app without significant loss in quality - I only slightly fine-tuned the model, from initial rougeLsum 0.29 to 0.32

## frontend

- [x] ts + reactQuery + react app
  - [x] init
  - [x] simple ui: input for subreddit name; list of summaries
- [x] fetch model as in https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX
- [x] fetch reddit top k posts with comments; api or scrap
- [x] apply to text mRedditSum format: post text, OP:..., User1:...; check ds repo for ready utils
- [ ] handle gif
- [x] apply to multi-modal data same format as in training
- [x] infer as in evaluations
- [x] think during inference performance? too many tokens
- [x] streaming
- [x] summarize top k posts
- [x] fix cors
- [x] fix availabilty
- [x] fix shared progress
- [x] use hf mirror: https://modelscope.cn/models/onnx-community/gemma-4-E2B-it-ONNX
- [x] find out why 3.5gb
- [x] add delay for downloading progress bar
- [x] filter out AutoModerator comments
- [ ] filter out '[удалено]'
- [x] fix reddit cors
  - [x] clowflare worker? vpn needed
  - [x] deno deploy? vpn needed
  - [x] yandex cloud functions
    - [x] set requests or budget limit
- [x] download button
  - [x] rework useModel for manual downloading
- [x] fix endless Loading... when all three posts failed to fetch images
- [x] github pages
- [x] fix images failing at github pages
  - [x] yandex cloud function for image proxy
- [x] handle non existing subreddit
- [ ] check if proxy image actually understood by model
