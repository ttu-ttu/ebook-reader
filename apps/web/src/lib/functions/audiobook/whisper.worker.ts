/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

/**
 * Transcribes an audiobook with Whisper (transformers.js, WebGPU when available)
 * in a worker: decodes the audio with Mediabunny a few minutes at a time and
 * posts the cues of each block. Started by lib/data/whisper.ts. Not part of upstream.
 */

import { env, pipeline } from '@huggingface/transformers';
import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, UrlSource } from 'mediabunny';
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import {
  chunksToCues,
  Resampler,
  whisperRate,
  type WhisperChunk
} from '$lib/functions/audiobook/whisper-audio';
import type { WhisperMessage, WhisperRequest } from '$lib/data/whisper';

// The runtime from this site rather than a CDN.
env.backends.onnx.wasm!.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
env.allowLocalModels = false;

/** Audio transcribed per call; the pipeline cuts it into 30 s windows itself. */
const blockSeconds = 300;

const post = (message: WhisperMessage) => self.postMessage(message);

async function transcribe({ model, sources }: WhisperRequest) {
  const adapter = await (navigator as any).gpu?.requestAdapter();
  const transcriber = await pipeline('automatic-speech-recognition', model, {
    device: adapter ? 'webgpu' : 'wasm',
    dtype: adapter
      ? {
          encoder_model: adapter.features.has('shader-f16') ? 'fp16' : 'q4',
          decoder_model_merged: 'q4'
        }
      : 'q8',
    progress_callback: (info: any) => {
      if (info.status === 'progress_total') {
        post({ type: 'loading', progress: info.progress / 100 });
      }
    }
  });
  const inputs = sources.map(
    (source) =>
      new Input({
        formats: ALL_FORMATS,
        source: source.blob ? new BlobSource(source.blob) : new UrlSource(source.url!)
      })
  );
  const durations = await Promise.all(inputs.map((input) => input.computeDuration()));
  const duration = sources[sources.length - 1].offset + durations[durations.length - 1];

  for (const [index, input] of inputs.entries()) {
    const track = await input.getPrimaryAudioTrack();

    if (!track) {
      throw new Error('No audio track found');
    }

    let resampler: Resampler | undefined;
    let block: Float32Array[] = [];
    let blockLength = 0;
    let blockStart = sources[index].offset;

    const flush = async () => {
      const audio = new Float32Array(blockLength);

      block.reduce((at, part) => (audio.set(part, at), at + part.length), 0);
      block = [];
      blockLength = 0;

      const result: any = await transcriber(audio, {
        // shortcut: Japanese only, like the rest of the reader; pass the book's language if others come.
        language: 'japanese',
        task: 'transcribe',
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5
      });
      const seconds = audio.length / whisperRate;

      post({
        type: 'cues',
        cues: chunksToCues((result.chunks ?? []) as WhisperChunk[], blockStart, seconds),
        seconds: blockStart + seconds,
        duration
      });
      blockStart += seconds;
    };

    for await (const sample of new AudioSampleSink(track).samples()) {
      resampler ??= new Resampler(sample.sampleRate);

      const planes = Array.from({ length: sample.numberOfChannels }, (_, planeIndex) => {
        const plane = new Float32Array(sample.numberOfFrames);

        sample.copyTo(plane, { planeIndex, format: 'f32-planar' });

        return plane;
      });

      sample.close();

      const part = resampler.push(planes);

      block.push(part);
      blockLength += part.length;
      if (blockLength >= blockSeconds * whisperRate) {
        await flush();
      }
    }
    if (blockLength) {
      await flush();
    }
    input.dispose();
  }
}

self.onmessage = ({ data }: MessageEvent<WhisperRequest>) =>
  transcribe(data).then(
    () => post({ type: 'done' }),
    (error) =>
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  );
