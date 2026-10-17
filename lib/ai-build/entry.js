// In-browser AI models (Transformers.js + ONNX Runtime Web), bundled into one classic script so it works from file://.
// 3DCraft loads this file only when an AI tool is first used. ort (the same runtime Transformers.js uses) runs models
// that have no ready-made pipeline.
import { env, pipeline, RawImage, AutoModel, AutoProcessor, SamModel, Tensor } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';
window.CraftTF = { env, pipeline, RawImage, AutoModel, AutoProcessor, SamModel, Tensor, ort };
