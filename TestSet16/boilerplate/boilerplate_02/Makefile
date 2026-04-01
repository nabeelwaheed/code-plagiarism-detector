CC=gcc
CFLAGS=-std=c11 -Wall -Wextra -Iinclude
TARGET=menu_template
SRC=src/sample_driver.c src/menu_framework.c src/record_utils.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
