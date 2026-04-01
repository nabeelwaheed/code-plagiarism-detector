CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=graph_analyzer
SRC=src/main.c src/graph.c src/analysis.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
