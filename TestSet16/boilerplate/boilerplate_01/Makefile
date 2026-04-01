CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=starter_template
SRC=src/starter_main.c src/starter_args.c src/starter_io.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
