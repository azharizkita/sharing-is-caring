import { Listr } from 'listr2'
import { getTasks } from './utils.js';



(async () => {
  const _tasks = getTasks('chunked', 41)

  const tasks = new Listr(_tasks, { concurrent: true, exitOnError: false, rendererOptions: { collapseSubtasks: false } })

  const start = Date.now()
  await tasks.run()

  const end = Date.now()
  console.log()
  console.log('Started at:\t', new Date(start).toLocaleString());
  console.log('Finished at:\t', new Date(end).toLocaleString())
  console.log('Elapsed time:\t', end - start, 'ms')
})();
