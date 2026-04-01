CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=expr_eval
SRC=src/main.c src/expr_parser.c src/expr_runtime.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
