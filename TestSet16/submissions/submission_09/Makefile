CC=gcc
CFLAGS=-std=c11 -Wall -Wextra
TARGET=diff_lite
SRC=src/main.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
