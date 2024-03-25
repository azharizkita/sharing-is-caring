# sharing-is-caring session 1

Hi folks, this is probably my first ever sharing session.

Most of you migth now the concept of load balancing and it might be currently applied via Nginx or any other frameworks.

> But have you ever try to load balance http requests with pure NodeJS?

Either way, let's talk about this.

## load balancing

> what is it?

well, just like the name.

it's like when you've got a bunch of tasks to do, so you split them up among different processes or resources, like servers or networks.

## why is it matters?

the idea is to keep things running smoothly, prevent bottlenecks, and make sure no one resource gets overloaded.

## study case

without further ado, let's see how load balancing can solve real problems.

> let's say you have a super great math engineering team, they made a fantastic formula of fibonacci in Python. Then your boss requires you (a software engineer) to make it available via http request. and it should be written in JS with nodejs runtime with low overhead as possible.

what probably will you do?

### 1. make a http server in NodeJS

```js
import http from "node:http";
import { URL } from "node:url";

const port = 3000;
const server = http.createServer();

server.on("request", async (req, res) => {
	const _url = new URL(req.url, "http://localhsot:3000");
	if (_url.href.includes("/fib")) {
		const num = _url.searchParams.get("num");
		if (!num) return res.end("include a number with /fib?num=x");
		return res.end(num);
	} else {
		res.end("Ok");
	}
});

server.listen(port);
```

by this code, when you hit `http://localhost:3000/fib?num=10` it will definiately returns `10`, this shows that your code working good.

the next thing comes to your mind:

> how do we communicate with the Python script?

the answer can be many thing, but here is what comes to mind:

> make the Python script as a server app using flask or stuff.

this is great until you remember your boss mention `low overhead as possible`. now this is time for the next thing shine:

> make the Python script as an active service listening to `stdin` input.

it is definiately got low overhead (even lower than websocket overhead). now we will go with this approach.

### 2. spawn the python instance using NodeJS child_process.spawn

to invoke this requirement, it is a simple as:

```js
import { spawn } from "node:child_process";

const pythonInstance = spawn("python3", ["./calculate.py"]);
pythonInstance.stdin.setDefaultEncoding("utf8");
```

now combine this with our existing code:

```js
import http from "node:http";
import { URL } from "node:url";
import { spawn } from "node:child_process";

const pythonInstance = spawn("python3", ["./calculate.py"]);
pythonInstance.stdin.setDefaultEncoding("utf8");

const port = 3000;
const server = http.createServer();

server.on("request", async (req, res) => {
	const _url = new URL(req.url, "http://localhsot:3000");
	if (_url.href.includes("/fib")) {
		const num = _url.searchParams.get("num");
		if (!num) return res.end("include a number with /fib?num=x");
		return res.end(num);
	} else {
		res.end("Ok");
	}
});

server.listen(port);
```

now what?

### 3. communicating with the pythonInstance

the good thing comes with `child_process.spawn`, is that it returns a `ChildProcessWithoutNullStreams` so that it has the capabilities of `stdio` (`stdin` and `stdout`). this is how we gonna communicate with the python instance:

1. make a `pythonInstance.stdin.write` invocation to send `stdin` into the pythonInstance inside the NodeJS http server.

```js
// define a result holder
const result = {};

// the python result will be sent here, the result format is {input}|{result}
pythonInstance.stdout.on("data", (message) => {
	// please be noted that basically stdout is a readable stream, it returns array of buffer so we need to process those buffer into string
	const _result = message.toString().split("|");
	result[_result[0]] = _result[1];
});

server.on("request", async (req, res) => {
	const _url = new URL(req.url, "http://localhsot:3000");
	if (_url.href.includes("/fib")) {
		const num = _url.searchParams.get("num");
		if (!num) return res.end("include a number with /fib?num=x");

		// here we go
		pythonInstance.stdin.write(`${num}\n`);

		// make a loop to check if result is already filled or not
		const interval = setInterval(() => {
			if (!result[num]) return;
			clearInterval(interval);
			return res.end(
				JSON.stringify({
					result: result[num],
				})
			);
		}, 50);
	} else {
		res.end("Ok");
	}
});
```

now if you hit `http://localhsot:3000/fib?num=41`, the request will be in a `loading` state until the pythonInstance give your fibonacci result.

this is the code we got so far:

```js
import http from "node:http";
import { URL } from "node:url";
import { spawn } from "node:child_process";

const pythonInstance = spawn("python3", ["./calculate.py"]);
pythonInstance.stdin.setDefaultEncoding("utf8");
const result = {};

pythonInstance.stdout.on("data", (message) => {
	const _result = message.toString().split("|");
	result[_result[0]] = _result[1];
});

const port = 3000;
const server = http.createServer();

server.on("request", async (req, res) => {
	const _url = new URL(req.url, "http://localhsot:3000");
	if (_url.href.includes("/fib")) {
		const num = _url.searchParams.get("num");
		if (!num) return res.end("include a number with /fib?num=x");

		pythonInstance.stdin.write(`${num}\n`);

		const interval = setInterval(() => {
			if (!result[num]) return;
			clearInterval(interval);
			return res.end(
				JSON.stringify({
					result: result[num],
				})
			);
		}, 50);
	} else {
		res.end("Ok");
	}
});

server.listen(port);
```

and that is it, you deploy it to the production and show it to your boss. untill the say:

> mmmm somehow it loads forever when I try to check fibonacci of 45 then fibonacci of 10 at the same time. pls fix.

## what's wrong?

in short, our current code can only handle a request at a time. it requires the fibonacci result to be asigned into our `cosnt result = {};` variable then it can achieve the `req.end`. so that it blocks the next request.

this is a no-no, especially if the url is publicly available.

to tackle this issue, here is a thought:

## threading

this is where the load balance starts. by splitting process into threads, it will greatly increase parallelism process so the boss won't be mad again on why we can't multi-process fibonacci.

## applying NodeJS worker threads

firstly, we need to know whether if a process can be put in a main/worker thread. by this case, here is what I think which is which:

```js
import http from "node:http";
import { URL } from "node:url";
import { spawn } from "node:child_process";

// worker thread, I want to spawn the python instance within a worker thread so that I have multiple python instance
const pythonInstance = spawn("python3", ["./calculate.py"]);
pythonInstance.stdin.setDefaultEncoding("utf8");
const result = {};

pythonInstance.stdout.on("data", (message) => {
  const _result = message.toString().split('|')
  result[_result[0]] = _result[1]
});
// end of worker thread process

const port = 3000;
const server = http.createServer();

// definiately main thread
server.on("request", async (req, res) => {
  const _url = new URL(req.url, "http://localhsot:3000");
  if (_url.href.includes("/fib")) {
    const num = _url.searchParams.get("num");
    if (!num) return res.end("include a number with /fib?num=x");

    pythonInstance.stdin.write(`${num}\n`);

    const interval = setInterval(() => {
      if (!result[num]) return
      clearInterval(interval);
      return res.end(JSON.stringify({
        result: result[num]
      }));

    }, 50);
  } else {
    res.end("Ok");
  }
});

server.listen(port);
//end of main thread process
```

now let's create a `worker.js` file (or any name you like).

`worker.js`
```js
// worker.js
import { spawn } from "node:child_process";

const pythonInstance = spawn("python3", ["./calculate.py"]);
pythonInstance.stdin.setDefaultEncoding("utf8");
const result = {};

pythonInstance.stdout.on("data", (message) => {
  const _result = message.toString().split('|')
  result[_result[0]] = _result[1]
});
```

`index.js`
```js
// index.js
import http from "node:http";
import { URL } from "node:url";

const port = 3000;
const server = http.createServer();

server.on("request", async (req, res) => {
  const _url = new URL(req.url, "http://localhsot:3000");
  if (_url.href.includes("/fib")) {
    const num = _url.searchParams.get("num");
    if (!num) return res.end("include a number with /fib?num=x");

    pythonInstance.stdin.write(`${num}\n`);

    const interval = setInterval(() => {
      if (!result[num]) return
      clearInterval(interval);
      return res.end(JSON.stringify({
        result: result[num]
      }));

    }, 50);
  } else {
    res.end("Ok");
  }
});

server.listen(port);

```

### new problems

migration isn't always easy. here are a new sets of problems:

1. in the `index.js`, `pythonInstance` is undefined because it is not defined anywhere within the file
2. `const result;` is not defined within the `index.js`, we are losing the caching ability.

so I will fix it real quick the code while implementing the NodeJS worker thread:

> to be continued...