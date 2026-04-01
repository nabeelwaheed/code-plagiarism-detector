CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=inventory_manager
SRC=src/main.c src/inventory.c src/menu_helpers.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
