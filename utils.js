import { Listr } from 'listr2'
import chalk from 'chalk';
import _ from 'lodash'

const thousandFormatter = (result) => String(result).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

const arrow = ' ------------>\t'

export const getWorkerLabel = (index = 0) => `Worker ${index}`

export const assignToAvailableWorker = (cpuCount = 0, workers = [], state = {}, onAvailable = (index = 0) => { }, chunk) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (chunk) {
        const pointer = workers[chunk]
        if (state[pointer].status === "idle") {
          clearInterval(interval);
          onAvailable(pointer);
          resolve(pointer);
          return
        }
        return
      }
      for (let index = 0; index < cpuCount; index++) {
        const pointer = workers[index]
        if (state[pointer].status === "idle") {
          clearInterval(interval);
          onAvailable(pointer);
          resolve(pointer);
          return
        }

        // if (index + 1 === totalWorker) {
        //   reject("none");
        // }
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
 * @param {'chunked' | 'normalized-chunk' | 'normal'} type 
 */
export const getTasks = (type) => {
  const fibonaccis = Array.from(Array(42).keys()).map(num => num + 1);
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
          const subTasks = chunkedTasks[i].map((num) => getFibonacciTask(num, i))
          return new Listr(subTasks, { concurrent: true, exitOnError: false, rendererOptions: { collapseSubtasks: false } });

        }
      }))
    }
    default: {
      return fibonaccis.map(num => getFibonacciTask(num));
    }
  }
}