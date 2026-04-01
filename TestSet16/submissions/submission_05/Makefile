CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=grade_summary
SRC=src/main.c src/classroom.c src/parser.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
