#ifndef MAZE_H
#define MAZE_H

typedef struct {
    int rows;
    int cols;
    char **grid;
    int start_row;
    int start_col;
    int end_row;
    int end_col;
} Maze;

Maze *maze_load(const char *path);
void maze_free(Maze *maze);
void maze_print(const Maze *maze);

#endif
