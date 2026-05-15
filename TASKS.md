# train

- [ ] compare seq2seq and chat llm approaches

#### seq2seq

- [ ] flat train loss; possibly streaming=True issue

#### chat llm

- [ ] archive 0.25 rouge1

- [ ] consider Pleias model: Pleias-RAG-350m, Pleias-RAG-1B

- [ ] (?) is qwen quantization needed concidering that after train we use onnx quantization?

- [x] (bug) rouge low(rouge1: 0.1402): merge_and_unload in eval:
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

- [ ] after eval fine-tune generation

- [ ] handle non-englesh

- [ ] use rouge for checkpoint selection and early stopping
- [ ] evaluate on 500 examples
- [ ] add a small "general instruction" validation set(100 diverse prompts)
- [ ] try r=32, alpha=64, lr=2e-4, lora_dropout=0.1
