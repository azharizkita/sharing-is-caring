import { Listr } from 'listr2'
import { getTasks } from './utils.js';

const _tasks = getTasks('chunked')

const tasks = new Listr(_tasks, { concurrent: true, exitOnError: false, rendererOptions: { collapseSubtasks: false } });

const start = Date.now()
console.log('Started at ', new Date(start).toLocaleString(), '\n')

tasks.run().then(() => {
  const end = Date.now()
  console.log()
  console.log('Finished at ', new Date(end).toLocaleString())
  console.log('Elapsed time: ', end - start, 'ms')
})
