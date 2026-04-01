#include "maze.h"
#include "solver.h"

#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    Maze *maze;
    int steps;
    char *render;

    if (argc != 2) {
        fprintf(stderr, "Usage: %s <maze_file>\n", argv[0]);
        return 1;
    }

    maze = maze_load(argv[1]);
    if (!maze) {
        fprintf(stderr, "Failed to load maze: %s\n", argv[1]);
        return 1;
    }

    render = (char *)malloc((size_t)maze->rows * (size_t)maze->cols);
    if (!render) {
        maze_free(maze);
        return 1;
    }

    puts("Maze:");
    maze_print(maze);

    steps = maze_shortest_path(maze, 1, '*', &render);
    if (steps < 0) {
        puts("No path from S to E.");
    } else {
        printf("Shortest path length: %d\n", steps);
        puts("Path visualization:");
        maze_print_rendered(maze, render);
    }

    free(render);
    maze_free(maze);
    return 0;
}
