CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=gradebook_tool
SRC=src/main.c src/gradebook.c src/cli_helpers.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
