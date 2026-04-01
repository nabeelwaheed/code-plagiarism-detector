#include "solver.h"

#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int r;
    int c;
} Point;

static int inside(const Maze *maze, int r, int c) {
    return r >= 0 && c >= 0 && r < maze->rows && c < maze->cols;
}

static int idx(const Maze *maze, int r, int c) {
    return r * maze->cols + c;
}

int maze_shortest_path(const Maze *maze, int mark_path, char marker, char **rendered_copy) {
    int total = maze->rows * maze->cols;
    int *dist = (int *)malloc((size_t)total * sizeof(int));
    int *prev = (int *)malloc((size_t)total * sizeof(int));
    Point *queue = (Point *)malloc((size_t)total * sizeof(Point));
    int head = 0;
    int tail = 0;
    int drow[4] = {-1, 1, 0, 0};
    int dcol[4] = {0, 0, -1, 1};
    int i;
    int start_index;
    int end_index;
    int result;

    if (!dist || !prev || !queue) {
        free(dist);
        free(prev);
        free(queue);
        return -1;
    }

    for (i = 0; i < total; ++i) {
        dist[i] = -1;
        prev[i] = -1;
    }

    start_index = idx(maze, maze->start_row, maze->start_col);
    end_index = idx(maze, maze->end_row, maze->end_col);
    dist[start_index] = 0;
    queue[tail++] = (Point){maze->start_row, maze->start_col};

    while (head < tail) {
        Point cur = queue[head++];
        int cur_index = idx(maze, cur.r, cur.c);

        for (i = 0; i < 4; ++i) {
            int nr = cur.r + drow[i];
            int nc = cur.c + dcol[i];
            int ni;
            if (!inside(maze, nr, nc)) {
                continue;
            }
            if (maze->grid[nr][nc] == '#') {
                continue;
            }
            ni = idx(maze, nr, nc);
            if (dist[ni] != -1) {
                continue;
            }
            dist[ni] = dist[cur_index] + 1;
            prev[ni] = cur_index;
            queue[tail++] = (Point){nr, nc};
        }
    }

    result = dist[end_index];

    if (mark_path && result >= 0 && rendered_copy) {
        int r;
        int pos = end_index;

        for (r = 0; r < maze->rows; ++r) {
            for (i = 0; i < maze->cols; ++i) {
                rendered_copy[idx(maze, r, i)] = maze->grid[r][i];
            }
        }

        while (pos != -1 && pos != start_index) {
            int pr = pos / maze->cols;
            int pc = pos % maze->cols;
            if (rendered_copy[pos] == '.') {
                rendered_copy[pos] = marker;
            }
            if (pr == maze->start_row && pc == maze->start_col) {
                break;
            }
            pos = prev[pos];
        }
    }

    free(dist);
    free(prev);
    free(queue);
    return result;
}

void maze_print_rendered(const Maze *maze, const char *rendered_copy) {
    int r;
    int c;
    for (r = 0; r < maze->rows; ++r) {
        for (c = 0; c < maze->cols; ++c) {
            putchar(rendered_copy[idx(maze, r, c)]);
        }
        putchar('\n');
    }
}
