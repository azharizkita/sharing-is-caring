import sys
import time

def calculate(n):
    if n < 0:
        return 0
 
    elif n == 0:
        return 0
 
    elif n == 1 or n == 2:
        return 1
 
    else:
        return calculate(n-1) + calculate(n-2)

if __name__ == "__main__":
    while True:
        try:
            input_data = str(input()).rstrip()
            result = calculate(int(input_data))
            sys.stdout.write(f"r|{int(input_data)}|{result}")
            sys.stdout.flush()
            # thortle 0.01s to avoid buffer interference
            time.sleep(0.01)
        except EOFError as e:
            break
        except Exception as e:
            sys.stdout.write(f"e|{int(input_data)}|{e}")
            sys.stdout.flush()
