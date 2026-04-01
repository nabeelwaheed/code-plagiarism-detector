CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=maze_solver
SRC=src/main.c src/maze.c src/solver.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
