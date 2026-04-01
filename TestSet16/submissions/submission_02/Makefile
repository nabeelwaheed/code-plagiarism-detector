CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=catalog_console
SRC=src/app.c src/catalog.c src/ui_support.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
