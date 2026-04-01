#include "starter_io.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *read_entire_file(const char *path, size_t *size_out) {
    FILE *fp;
    long length;
    size_t bytes_read;
    char *buffer;

    fp = fopen(path, "rb");
    if (!fp) {
        return NULL;
    }

    if (fseek(fp, 0, SEEK_END) != 0) {
        fclose(fp);
        return NULL;
    }

    length = ftell(fp);
    if (length < 0) {
        fclose(fp);
        return NULL;
    }

    rewind(fp);
    buffer = (char *)malloc((size_t)length + 1U);
    if (!buffer) {
        fclose(fp);
        return NULL;
    }

    bytes_read = fread(buffer, 1, (size_t)length, fp);
    fclose(fp);

    buffer[bytes_read] = '\0';
    if (size_out) {
        *size_out = bytes_read;
    }

    return buffer;
}

int write_text_file(const char *path, const char *text) {
    FILE *fp = fopen(path, "wb");
    size_t expected;

    if (!fp) {
        return 0;
    }

    expected = strlen(text);
    if (fwrite(text, 1, expected, fp) != expected) {
        fclose(fp);
        return 0;
    }

    fclose(fp);
    return 1;
}

char **split_lines_mutable(char *buffer, int *count_out) {
    int capacity = 16;
    int count = 0;
    char **lines;
    char *cursor;

    lines = (char **)malloc((size_t)capacity * sizeof(char *));
    if (!lines) {
        return NULL;
    }

    cursor = buffer;
    while (cursor && *cursor != '\0') {
        char *next = strchr(cursor, '\n');
        if (count == capacity) {
            char **grown;
            capacity *= 2;
            grown = (char **)realloc(lines, (size_t)capacity * sizeof(char *));
            if (!grown) {
                free(lines);
                return NULL;
            }
            lines = grown;
        }

        if (next) {
            *next = '\0';
        }

        lines[count++] = cursor;
        cursor = next ? next + 1 : NULL;
    }

    if (count_out) {
        *count_out = count;
    }

    return lines;
}

void free_line_array(char **lines) {
    free(lines);
}

int trim_trailing_newline(char *line) {
    size_t n = strlen(line);
    if (n > 0 && line[n - 1] == '\r') {
        line[n - 1] = '\0';
        return 1;
    }
    return 0;
}
