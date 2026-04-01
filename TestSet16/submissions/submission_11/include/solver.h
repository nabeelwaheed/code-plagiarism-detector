#ifndef SOLVER_H
#define SOLVER_H

#include "maze.h"

int maze_shortest_path(const Maze *maze, int mark_path, char marker, char **rendered_copy);
void maze_print_rendered(const Maze *maze, const char *rendered_copy);

#endif
