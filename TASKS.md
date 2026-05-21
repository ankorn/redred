# train

- [ ] compare seq2seq and chat llm approaches

#### seq2seq

- [ ] flat train loss; possibly streaming=True issue

#### chat llm

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

MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"
NUM_SAMPLES = 150_000
MAX_SEQ_LENGTH = 1500
LORA_R = 16
LORA_ALPHA = LORA_R \* 2
LORA_DROPOUT = 0.2
BATCH_SIZE = 8
GRAD_ACCUMULATION = 4
LEARNING_RATE = 2e-4
NUM_EPOCHS = 1
WARMUP_RATIO = 0.1
MAX_NEW_TOKENS=128

dataset = load_dataset("webis/tldr-17", split="train", trust_remote_code=True, streaming=True)

dataset = dataset.train_test_split(test_size=0.005)
train_ds = dataset["train"]
eval_ds = dataset["test"]

def format_chat(example):
content = clean_text(example["content"])
summary = clean_text(example["summary"])
messages = [
{"role": "system", "content": system_msg},
{"role": "user", "content": f"Reddit post:n{content}"},
{"role": "assistant", "content": summary},
]
text = tokenizer.apply_chat_template(
messages,
tokenize=False,
add_generation_prompt=False,
)
return {"text": text}

train_ds_formatted = train_ds.map(format_chat, remove_columns=train_ds.column_names)
eval_ds_formatted = eval_ds.map(format_chat, remove_columns=eval_ds.column_names)

lora_cfg = LoraConfig(
r=LORA_R,
lora_alpha=LORA_ALPHA,
target_modules=[
"q_proj", "k_proj", "v_proj", "o_proj",
"gate_proj", "up_proj", "down_proj",
],
lora_dropout=LORA_DROPOUT,
bias="none",
task_type=TaskType.CAUSAL_LM,
)
model = get_peft_model(model, lora_cfg)

eval_generation_config = GenerationConfig(
max_new_tokens=MAX_NEW_TOKENS,
do_sample=False,
num_beams=1,
early_stopping=True,
pad_token_id=tokenizer.pad_token_id,
eos_token_id=[tokenizer.eos_token_id, tokenizer.convert_tokens_to_ids("<|im_end|>")],
)

class EvalTrainer(SFTTrainer):
def prediction_step(self, model, inputs, prediction_loss_only, ignore_keys=None):
if prediction_loss_only:
return super().prediction_step(model, inputs, True, ignore_keys)

        # 1. Compute loss (teacher-forced)
        loss, _, _ = super().prediction_step(model, inputs, True, ignore_keys)

        # 2. Ensure eval mode + clear cache before generation
        model.eval()
        torch.cuda.empty_cache()

        input_ids = inputs["input_ids"]
        attention_mask = inputs.get("attention_mask")
        labels = inputs.get("labels")
        batch_size = input_ids.shape[0]
        device = input_ids.device

        # 3. Extract prompts (same logic as before)
        prompt_lengths = []
        prompt_ids_list = []
        prompt_mask_list = []

        for i in range(batch_size):
            if attention_mask is not None:
                active = attention_mask[i].nonzero(as_tuple=True)[0]
                actual_start = active[0].item() if len(active) > 0 else 0
            else:
                actual_start = 0

            if labels is not None:
                valid = (labels[i] != -100).nonzero(as_tuple=True)[0]
                completion_start = valid[0].item() if len(valid) > 0 else input_ids.shape[1]
            else:
                completion_start = input_ids.shape[1]

            pl = completion_start - actual_start
            prompt_lengths.append(pl)
            prompt_ids_list.append(input_ids[i, actual_start:completion_start])
            if attention_mask is not None:
                prompt_mask_list.append(attention_mask[i, actual_start:completion_start])

        # 4. Left-pad prompts to batch max (generation requires uniform length)
        max_pl = max(prompt_lengths) if prompt_lengths else 0
        prompt_ids = torch.full((batch_size, max_pl), self.processing_class.pad_token_id,
                                dtype=torch.long, device=device)
        prompt_mask = torch.zeros((batch_size, max_pl), dtype=torch.long, device=device)

        for i in range(batch_size):
            pl = prompt_lengths[i]
            prompt_ids[i, -pl:] = prompt_ids_list[i]  # right-align / left-pad
            if attention_mask is not None:
                prompt_mask[i, -pl:] = prompt_mask_list[i]

        # 5. Generate with eval config (greedy, beam=1)
        with torch.no_grad():
            outputs = model.generate(
                input_ids=prompt_ids,
                attention_mask=prompt_mask,
                generation_config=eval_generation_config,
            )

        # 6. Strip prompts, keep only new tokens
        gen_tokens = []
        max_gen = 0
        for i in range(batch_size):
            gen_only = outputs[i, max_pl:]  # remove the padded prompt length
            gen_tokens.append(gen_only)
            max_gen = max(max_gen, gen_only.shape[0])

        padded_preds = torch.full((batch_size, max_gen), self.processing_class.pad_token_id,
                                  dtype=torch.long, device=device)
        for i in range(batch_size):
            padded_preds[i, :gen_tokens[i].shape[0]] = gen_tokens[i]

        # 7. Extract completion-only labels
        if labels is not None:
            label_tokens = []
            max_lab = 0
            for i in range(batch_size):
                valid = labels[i][labels[i] != -100]
                label_tokens.append(valid)
                max_lab = max(max_lab, valid.shape[0])

            padded_labels = torch.full((batch_size, max_lab), -100,
                                       dtype=torch.long, device=device)
            for i in range(batch_size):
                padded_labels[i, :label_tokens[i].shape[0]] = label_tokens[i]
        else:
            padded_labels = None

        return (loss, padded_preds, padded_labels)

model.generation_config = eval_generation_config
metric = evaluate.load("rouge")
def compute_metrics(eval_pred):
predictions, labels = eval_pred
predictions = np.where(predictions != -100, predictions, tokenizer.pad_token_id)
labels = np.where(labels != -100, labels, tokenizer.pad_token_id)
predictions = predictions.astype(np.int32)
labels = labels.astype(np.int32)
decoded_preds = tokenizer.batch_decode(predictions, skip_special_tokens=True)
decoded_labels = tokenizer.batch_decode(labels, skip_special_tokens=True)
result = metric.compute(predictions=decoded_preds, references=decoded_labels)
return {k: round(v, 4) for k, v in result.items()}

training_args = TrainingArguments(
per_device_train_batch_size=BATCH_SIZE,
gradient_accumulation_steps=GRAD_ACCUMULATION,
num_train_epochs=NUM_EPOCHS,
learning_rate=LEARNING_RATE,
bf16=True,
logging_steps=500,
eval_strategy="steps",
eval_steps=500,
load_best_model_at_end=True,
metric_for_best_model="eval_rouge1",
greater_is_better=True,
optim="paged_adamw_8bit",
lr_scheduler_type="cosine",
warmup_ratio=WARMUP_RATIO
)

trainer = EvalTrainer(
model=model,
processing_class=tokenizer,
train_dataset=train_ds_formatted,
eval_dataset=eval_ds_formatted,
args=training_args,
max_seq_length=MAX_SEQ_LENGTH,
packing=False,
data_collator=DataCollatorForCompletionOnlyLM(
response_template="<|im_start|>assistant\n",
tokenizer=tokenizer
),
compute_metrics=compute_metrics,
)
