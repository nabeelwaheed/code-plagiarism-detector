#ifndef WALKER_H
#define WALKER_H

#include "network.h"

int walker_count_groups(const Network *net);
int walker_distance(const Network *net, int start, int goal);
void walker_print_density(const Network *net);

#endif
