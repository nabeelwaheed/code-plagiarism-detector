import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { EngineRunRequest, EngineRunResponse } from "@similarity/shared";
import { workerRuntimeConfig } from "../config/runtime-config.js";

const ENGINE_BINARY = workerRuntimeConfig.engineBinaryPath;

export async function ensureEngineBinaryReady() {
  await access(ENGINE_BINARY);
}

export async function runEngine(request: EngineRunRequest): Promise<EngineRunResponse> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(ENGINE_BINARY, [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: Error) => rejectPromise(error));
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `engine process exited with code ${code}`));
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout) as EngineRunResponse);
      } catch (error) {
        rejectPromise(error);
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
