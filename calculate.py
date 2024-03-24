

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
            input_data = str(input())
            result = calculate(int(input_data))
            print(result)
        except EOFError as e:
            break
        except Exception as e:
            print("An error occurred:", e)
