import sys
import time
import json

def calculate(n, cache):
    if str(n) in cache:
        return int(cache[str(n)])

    if n < 0:
        return 0
 
    elif n == 0:
        return 0
 
    elif n == 1 or n == 2:
        return 1
 
    else:
        return calculate(n-1, cache) + calculate(n-2, cache)

if __name__ == "__main__":
    while True:
        try:
            _input = str(input()).rstrip()
            inputs = _input.split('|')
            input_data = inputs[0]
            cache = json.loads(inputs[1])
            result = calculate(int(input_data), cache)
            sys.stdout.write(f"r|{int(input_data)}|{result}")
            sys.stdout.flush()
            # thortle 0.01s to avoid buffer interference
            time.sleep(0.01)
        except EOFError as e:
            break
        except Exception as e:
            sys.stdout.write(f"e|{int(input_data)}|{e}")
            sys.stdout.flush()
