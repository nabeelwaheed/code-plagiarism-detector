#include "network.h"
#include "walker.h"

#include <stdio.h>
#include <stdlib.h>

static void usage(const char *p) {
    printf("Usage: %s <network_file> <start> <goal>\n", p);
}

int main(int argc, char **argv) {
    Network *net;
    int start;
    int goal;
    int steps;

    if (argc != 4) {
        usage(argv[0]);
        return 1;
    }

    net = network_read(argv[1]);
    if (!net) {
        fprintf(stderr, "Could not read file: %s\n", argv[1]);
        return 1;
    }

    start = atoi(argv[2]);
    goal = atoi(argv[3]);

    printf("Group count: %d\n", walker_count_groups(net));
    walker_print_density(net);

    steps = walker_distance(net, start, goal);
    if (steps >= 0) {
        printf("Distance from %d to %d is %d\n", start, goal, steps);
    } else {
        printf("No route from %d to %d\n", start, goal);
    }

    network_close(net);
    return 0;
}
