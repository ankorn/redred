# train

- [ ] compare seq2seq and chat llm approaches

#### seq2seq

- [ ] flat train loss; possibly streaming=True issue

#### chat llm

- [ ] archive 0.25 rouge1

- [ ] consider Pleias model: Pleias-RAG-350m, Pleias-RAG-1B

- [x] remove qwen quantization, use onnx quantization

- [x] (bug) rouge low(rouge1: 0.1402)
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
