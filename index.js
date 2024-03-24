import Listr from 'listr'
import chalk from 'chalk';
import _ from 'lodash'

const getFibonacciTask = (num) => {
  const label = `Fibonacci of ${chalk.cyan(num)}`
  return {
    title: label,
    task: async (_, task) => {
      const requestUrl = `http://localhost:3000/fib?num=${num}`
      try {
        const response = await fetch(requestUrl)

        const { result } = await response.json()
        task.title = `${label} ${chalk.gray(`-> ${result}`)}`
      } catch (error) {
        task.title = String(error)
        console.error(error)
      }

    }
  }
}

const fibonaccis = Array.from(Array(42).keys())
const chunckedTasksPlaceholder = _.chunk(fibonaccis, 10)
const chunkedTasks = chunckedTasksPlaceholder.map((_chunks, i) => {
  return {
    title: `Task chunk - ${i + 1}`,
    task: async () => new Listr(_chunks.map((num) => getFibonacciTask(num + 1)), { concurrent: true }),
  }
})

const tasks = new Listr(chunkedTasks, { concurrent: true, collapse: false });

tasks.run()