CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=network_walk
SRC=src/main.c src/network.c src/walker.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
