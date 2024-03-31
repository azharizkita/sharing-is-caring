import { Listr } from 'listr2'
import chalk from 'chalk';
import _ from 'lodash'

const thousandFormatter = (result) => String(result).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const arrow = ' ------------>\t'

const resourceBusy = "All workers are busy"

export const getSharedResult = ({ parsed } = { parsed: true }) => {
  const sharedResult = process.env.SHARED_RESULT;

  if (!sharedResult) {
    return parsed ? {} : JSON.stringify({});
  }

  return parsed ? JSON.parse(sharedResult) : sharedResult;
};


export const setSharedResult = (newResult = {}) => {
  const currentSharedResult = getSharedResult()
  process.env.SHARED_RESULT = JSON.stringify({
    ...currentSharedResult,
    ...newResult
  })
}

export const getWorkerLabel = (index = 0) => `Worker ${index}`

export const assignToAvailableWorker = ({ cpuCount = 0, workers = [], state = {}, chunk, withQueue, onAvailable = () => { } }) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (!isNaN(chunk)) {
        const pointer = workers[chunk]
        if (state[pointer].status === "idle") {
          clearInterval(interval);
          onAvailable(pointer);
          resolve(pointer);
          return
        }
        if (!withQueue) {
          clearInterval(interval);
          reject(resourceBusy);
          return
        }
        return
      }
      for (let index = 0; index < cpuCount; index++) {
        const pointer = workers[index]
        if (state[pointer].status === "busy") {
          if (!withQueue && index + 1 === cpuCount) {
            clearInterval(interval);
            reject(resourceBusy);
            break
          }
          continue
        }
        clearInterval(interval);
        onAvailable(pointer);
        resolve(pointer);
        break
      }
    }, 150);
  });
}

/**
 * 
 * @param {*} num 
 * @returns {import('listr2').ListrTask}
 */
const getFibonacciTask = (num, chunk = null) => {
  const label = `Fibonacci of ${chalk.cyan(String(num).padStart(2))}`
  return {
    title: label,
    task: async (_, task) => {
      const requestUrl = `http://localhost:3000/fib?num=${num}&chunk=${chunk}`
      task.title = `${label}${chalk.gray(arrow)}${chalk.italic.gray('calculating...')}`
      try {
        const response = await fetch(requestUrl)

        const { result, is_error } = await response.json()
        if (is_error) {
          throw new Error(result)
        }
        const _result = thousandFormatter(result)
        task.title = `${label}${chalk.green(arrow)}${chalk.gray(_result)}`
      } catch (error) {
        throw new Error(`${label}${chalk.red(arrow)}${chalk.gray(String(error))}`)
      }
    }
  }
}

/**
 * 
 * @param {'chunked' | 'normalized-chunk' | 'normal' | 'single'} type 
 */
export const getTasks = (type, value = 42) => {
  const fibonaccis = Array.from(Array(value).keys()).map(num => num + 1);
  const chunkSize = 7;

  switch (type) {
    case 'chunked': {
      return _.chunk(fibonaccis, chunkSize).map((chunk, index) => {
        return {
          title: `Task chunk - ${index + 1}`,
          task: async () => {
            const subTasks = chunk.map(num => getFibonacciTask(num));
            return new Listr(subTasks, { concurrent: true, exitOnError: false, rendererOptions: { collapseSubtasks: false } });
          }
        }
      });
    }
    case 'normalized-chunk': {
      const chunkedTasks = Array.from({ length: chunkSize }, () => []);

      fibonaccis.forEach((num, index) => {
        const chunkIndex = index % chunkSize;
        chunkedTasks[chunkIndex].push(num);
      });

      return chunkedTasks.map((_, i) => ({
        title: `Task chunk - ${i + 1}`, title: `Task chunk - ${i + 1}`,
        task: async () => {
          const subTasks = chunkedTasks[i].map((num) => getFibonacciTask(num))
          return new Listr(subTasks, { concurrent: true, exitOnError: false, rendererOptions: { collapseSubtasks: false } });

        }
      }))
    }
    case 'single': {
      return getFibonacciTask(value)
    }

    default: {
      return fibonaccis.map(num => getFibonacciTask(num));
    }
  }
}