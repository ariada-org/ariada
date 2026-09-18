import { spawn } from "node:child_process";

export interface SubprocessRequest {
    command: string;
    args: readonly string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
}
export interface SubprocessResult {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}
export type SubprocessRunner = (request: SubprocessRequest) => Promise<SubprocessResult>;
const MAX_CAPTURE_BYTES = 1024 * 1024;
// The capture limit is the whole of the memory safety here: a scanner writing
// without end would otherwise be held in an array until the process died.
export const spawnSubprocess: SubprocessRunner = async (request) => new Promise((resolve, reject) => {
    const child = spawn(request.command, [...request.args], {
        cwd: request.cwd,
        env: request.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    let capturedBytes = 0;
    const forwardSignal = (signal: NodeJS.Signals): void => {
        child.kill(signal);
    };
    const forwardInterrupt = () => forwardSignal("SIGINT");
    const forwardTermination = () => forwardSignal("SIGTERM");
    process.once("SIGINT", forwardInterrupt);
    process.once("SIGTERM", forwardTermination);
    const cleanup = (): void => {
        process.removeListener("SIGINT", forwardInterrupt);
        process.removeListener("SIGTERM", forwardTermination);
    };
    const capture = (destination: string[], chunk: Buffer): void => {
        const text = chunk.toString();
        capturedBytes += Buffer.byteLength(text);
        if (capturedBytes > MAX_CAPTURE_BYTES) {
            child.kill("SIGKILL");
            cleanup();
            reject(new Error(`Ariada output exceeded the ${MAX_CAPTURE_BYTES}-byte capture limit`));
            return;
        }
        destination.push(text);
    };
    child.stdout.on("data", (chunk: Buffer) => capture(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, chunk));
    child.once("error", (error: Error) => {
        cleanup();
        reject(error);
    });
    child.once("close", (exitCode: number | null, signal: NodeJS.Signals | null) => {
        cleanup();
        resolve({
            exitCode,
            signal,
            stdout: stdout.join(""),
            stderr: stderr.join(""),
        });
    });
});
