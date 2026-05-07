# train

- [ ] compare seq2seq and chat llm approaches

#### seq2seq

- [ ] flat train loss; possibly streaming=True issue

#### chat llm

- [ ] (?) is qwen quantization needed concidering that after train we use onnx quantization?

- [ ] (bug) rouge low(rouge1: 0.1402): merge_and_unload in eval:
  - [ ] more steps
  - [x] r=64
  - [ ] check summary len, if needed: MAX_SEQ_LENGTH=1024; cut text on format_chat
  - [x] collator with response_template="<|im_start|>assistant\n"

- [x] (bug) check if chat-formatted string used in eval(<|im_start|>); remove

- [ ] check q4 rouge, actual local enference speed
- [ ] check q8 rouge, actual local enference speed
- [ ] (?) q4 less supported?

- [ ] duplicates

- [ ] uploda onnx model

- [ ] after eval fine-tune generation
