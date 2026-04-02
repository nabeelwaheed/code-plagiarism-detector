#include "maze.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char *read_line(FILE *fp, char *buffer, size_t size) {
    char *line = fgets(buffer, (int)size, fp);
    if (!line) {
        return NULL;
    }

    size_t len = strlen(buffer);
    while (len > 0 && (buffer[len - 1] == '\n' || buffer[len - 1] == '\r')) {
        buffer[--len] = '\0';
    }

    return buffer;
}

Maze *maze_load(const char *path) {
    FILE *fp = fopen(path, "r");
    Maze *maze;
    char line[1024];
    int row = 0;
    int cap = 16;

    if (!fp) {
        return NULL;
    }

    maze = (Maze *)calloc(1, sizeof(Maze));
    if (!maze) {
        fclose(fp);
        return NULL;
    }

    maze->grid = (char **)malloc((size_t)cap * sizeof(char *));
    if (!maze->grid) {
        maze_free(maze);
        fclose(fp);
        return NULL;
    }

    maze->start_row = -1;
    maze->start_col = -1;
    maze->end_row = -1;
    maze->end_col = -1;

    while (read_line(fp, line, sizeof(line))) {
        int c;
        size_t len = strlen(line);
        if (len == 0) {
            continue;
        }

        if (maze->cols == 0) {
            maze->cols = (int)len;
        } else if (maze->cols != (int)len) {
            maze_free(maze);
            fclose(fp);
            return NULL;
        }

        if (row == cap) {
            char **grown;
            cap *= 2;
            grown = (char **)realloc(maze->grid, (size_t)cap * sizeof(char *));
            if (!grown) {
                maze_free(maze);
                fclose(fp);
                return NULL;
            }
            maze->grid = grown;
        }

        maze->grid[row] = (char *)malloc(len + 1);
        if (!maze->grid[row]) {
            maze_free(maze);
            fclose(fp);
            return NULL;
        }

        strcpy(maze->grid[row], line);
        for (c = 0; c < maze->cols; ++c) {
            if (maze->grid[row][c] == 'S') {
                maze->start_row = row;
                maze->start_col = c;
            } else if (maze->grid[row][c] == 'E') {
                maze->end_row = row;
                maze->end_col = c;
            }
        }

        row++;
    }

    fclose(fp);
    maze->rows = row;

    if (maze->rows == 0 || maze->start_row < 0 || maze->end_row < 0) {
        maze_free(maze);
        return NULL;
    }

    return maze;
}

void maze_print(const Maze *maze) {
    int r;
    for (r = 0; r < maze->rows; ++r) {
        puts(maze->grid[r]);
    }
}

void maze_free(Maze *maze) {
    int r;
    if (!maze) {
        return;
    }

    if (maze->grid) {
        for (r = 0; r < maze->rows; ++r) {
            free(maze->grid[r]);
        }
        free(maze->grid);
    }

    free(maze);
}
