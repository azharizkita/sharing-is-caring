import http from "node:http";
import { availableParallelism } from "node:os";
import { URL } from "node:url";
import { Worker } from 'node:worker_threads'
import { assignToAvailableWorker, getWorkerLabel } from "./utils.js";

// server configs
const port = 3000;
const workerPath = './worker.js'
const server = http.createServer();
const cpuCount = availableParallelism()

// behavior configs
const withCachedResults = true
const sharedCachedResults = false
const withQueue = true

// data pools
const workerPointers = []
const workerStates = {}
const results = {}
const workers = {}

const workerStateProcessor = (name = '', newState = {}) => {
  if (!workerStates[name]) {
    workerStates[name] = {
      status: 'idle',
      process_count: 0,
      duration: 0,
    }
    return
  }
  workerStates[name] = {
    ...workerStates[name],
    ...newState
  }
}

const getCachedResult = (num) => {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!results[num] || results[num].is_error || isNaN(results[num].result ?? null)) return resolve(null)
      clearInterval(interval)
      resolve(results[num])
    }, 150);
  })
}

for (let index = 0; index < cpuCount; index++) {
  const workerName = getWorkerLabel(index + 1)
  workerPointers.push(workerName)
  const worker = new Worker(workerPath);
  worker.on('message', (_data) => {
    if (_data === 'instance_ready') {
      workerStateProcessor(workerName)
      return
    }
    workerStateProcessor(workerName, {
      duration: _data.duration
    })
    const _result = _data.result.split('|')
    results[_result[1]] = {
      is_error: _result[0] === 'e',
      result: _result[2]
    }
  });
  workers[workerName] = worker
}

server.on("request", async (req, res) => {
  const _url = new URL(req.url, "http://localhsot:3000");
  if (_url.href.includes("/fib")) {
    const num = _url.searchParams.get("num");
    const chunk = _url.searchParams.get("chunk");
    if (isNaN(num)) return res.end(JSON.stringify({ result: "include a number with /fib?num=x", is_error: true }));

    if (withCachedResults) {
      const isInitated = results[num]
      const shouldCalculate = isInitated && isNaN(results[num].result)

      if (!shouldCalculate) {
        const cachedResult = await getCachedResult(num)
        if (cachedResult) return res.end(JSON.stringify(cachedResult))
      }
    }

    try {
      const _workerName = await assignToAvailableWorker({
        chunk,
        withQueue,
        cpuCount,
        state: workerStates,
        workers: workerPointers,
        onAvailable: (workerName) => {
          results[num] = {
            is_error: false,
            result: 'calculating'
          }
          workerStateProcessor(workerName, {
            status: 'busy',
            process_count: workerStates[workerName].process_count + 1,
            duration: 'calculating'
          })
          workers[workerName].postMessage(num)
        }
      })

      const interval = setInterval(() => {
        if (results[num].result === 'calculating') return
        clearInterval(interval);
        workerStateProcessor(_workerName, {
          status: 'idle',
        })
        return res.end(JSON.stringify(results[num]));

      }, 75);
    } catch (error) {
      res.end(JSON.stringify({ is_error: true, result: error }))
    }
  } else {
    res.end("Ok");
  }
});

server.listen(port);

setInterval(() => {
  console.clear()
  console.table(workerStates)
}, 200)
