import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import http from "node:http";
import { URL } from "node:url";

// configs
const port = 3000
const workerState = {};
const workerPosition = [];
const cpuCounts = availableParallelism();
const cpuPlaceholder = Array.from(Array(cpuCounts).keys());

const stateProcessor = (position = 'initial', newValue) => {
  const currentState = workerState[position]

  if (!currentState) {
    workerState[position] = { status: "idle", latest_duration: "-", latest_fibonacci: '-', latest_result: '-' }
    return
  }

  workerState[position] = {
    ...currentState,
    ...newValue
  }
  return
}

const getLabel = (value, type = "worker") => {
  switch (type) {
    case "worker":
      return `Worker ${value}`;
    default:
      return "Main Thread";
  }
};

const workers = cpuPlaceholder.map((i) => {
  const workerName = getLabel(i + 1);
  const workerData = {
    name: workerName,
  };
  workerPosition.push(workerName);
  const instance = new Worker("./worker.js", { workerData });
  instance.on("message", (data) => {
    if (data === "instance_ready") {
      stateProcessor(workerName)
      return;
    }
    stateProcessor(workerName, {
      latest_duration: data?.duration,
      latest_result: String(data?.result).replace('\n', '')
    })
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

        // if (index + 1 === totalWorker) {
        //   reject("none");
        // }
      }
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
      const workerStatePointer = workerPosition[availableWorkerId]
      workers[availableWorkerId].postMessage(num);
      stateProcessor(workerStatePointer, {
        status: "busy",
        latest_duration: "calculating",
        latest_fibonacci: String(num),
        latest_result: 'calculating'
      })
      const interval = setInterval(() => {
        const result = String(workerState[workerStatePointer].latest_result)
        if (workerState[workerStatePointer].status === 'busy' && result !== 'calculating') {
          clearInterval(interval)
          stateProcessor(workerStatePointer, {
            status: 'idle'
          })
          return res.end(JSON.stringify({
            result
          }));
        }
      }, 50);
    } catch (error) {
      return res.end(JSON.stringify({
        result: 'all workers seemed to be busy'
      }));
    }
  } else {
    res.end("Ok");
  }
});

setInterval(() => {
  console.clear();
  console.log(`http://localhost:${port}/fib`);
  console.table(workerState);
}, 50);

server.listen(port);
