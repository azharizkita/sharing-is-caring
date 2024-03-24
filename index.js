import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import http from "node:http";
import { URL } from "node:url";

const workerState = {};
const workerPosition = [];

const getLabel = (value, type = "worker") => {
  switch (type) {
    case "worker":
      return `Worker ${value}`;
    default:
      return "Main Thread";
  }
};

const cpuCounts = availableParallelism() / 2;
const cpuPlaceholder = Array.from(Array(cpuCounts).keys());

const workers = cpuPlaceholder.map((i) => {
  const workerName = getLabel(i + 1);
  const workerData = {
    name: workerName,
  };
  workerPosition.push(workerName);
  const instance = new Worker("./worker.js", { workerData });
  instance.on("message", (data) => {
    if (data === "instance_ready") {
      workerState[workerName] = { status: "idle", latest_duration: "-" };
      return;
    }
    workerState[workerName] = {
      status: "idle",
      latest_duration: data?.duration,
    };
  });
  return instance;
});

const availabilityChecker = () =>
  new Promise((resolve, reject) => {
    const totalWorker = workers.length;
    const interval = setInterval(() => {
      for (let index = 0; index < totalWorker; index++) {
        if (workerState[workerPosition[index]].status === "idle") {
          clearInterval(interval);
          resolve(index);
          return;
        }

        if (index + 1 === totalWorker) {
          reject("none");
        }
      }
      resolve(1);
    }, 150);
  });

const server = http.createServer();

server.on("request", async (req, res) => {
  const _url = new URL(req.url, "http://localhsot:3000");
  if (_url.href.includes("/fib")) {
    const num = _url.searchParams.get("num");
    if (!num) return res.end("include a number with /fib?num=x");
    try {
      const availableWorkerId = await availabilityChecker();
      workers[availableWorkerId].postMessage(num);
      workerState[workerPosition[availableWorkerId]] = {
        status: "busy",
        latest_duration: "calculating",
      };
      return res.end(num);
    } catch (error) {
      return res.end('all workers seemed to be busy');
    }
  } else {
    res.end("Ok");
  }
});

setInterval(() => {
  console.clear();
  console.log("http://localhost:3000/fib");
  console.table(workerState);
}, 50);

server.listen(3000);
