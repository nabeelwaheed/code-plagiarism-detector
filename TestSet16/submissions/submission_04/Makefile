CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=coursebook
SRC=src/main.c src/coursebook.c src/options.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
