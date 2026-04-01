CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=spellcheck
SRC=src/main.c src/cli_opts.c src/spellcheck.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
