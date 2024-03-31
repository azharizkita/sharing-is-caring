import { spawn } from "node:child_process";
import { parentPort } from "node:worker_threads";
import { getSharedResult } from "./utils.js";

let timestamp = 0;
const pythonInstance = spawn("python3", ["./calculate.py"]);

pythonInstance.stdin.setDefaultEncoding("utf8");
pythonInstance.on("spawn", () => parentPort.postMessage("instance_ready"));
pythonInstance.stdout.on("data", (message) => {
  const payload = {
    result: message.toString(),
    duration: `${Date.now() - timestamp}ms`,
  };
  parentPort.postMessage(payload);
});
pythonInstance.stderr.on("error", (message) => {
  const payload = {
    result: message.toString(),
    duration: `${Date.now() - timestamp}ms`,
  };
  parentPort.postMessage(payload);
});
parentPort.on("message", (input) => {
  const sharedResults = getSharedResult({ parsed: false })
  timestamp = Date.now();
  pythonInstance.stdin.write(`${input}|${sharedResults}\n`);
});