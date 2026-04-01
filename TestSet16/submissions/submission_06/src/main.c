#include "analysis.h"
#include "graph.h"

#include <stdio.h>
#include <stdlib.h>

static void print_usage(const char *program) {
    printf("Usage: %s <graph_file> <src> <dst>\n", program);
    printf("Graph file format: first line is 'n m', followed by m lines of 'u v' edges\n");
}

int main(int argc, char **argv) {
    Graph *g;
    int src;
    int dst;
    int shortest;

    if (argc != 4) {
        print_usage(argv[0]);
        return 1;
    }

    g = graph_load_from_file(argv[1]);
    if (!g) {
        fprintf(stderr, "Could not load graph file: %s\n", argv[1]);
        return 1;
    }

    src = atoi(argv[2]);
    dst = atoi(argv[3]);

    printf("Connected components: %d\n", graph_connected_components(g));
    graph_degree_report(g);

    shortest = graph_shortest_path_len(g, src, dst);
    if (shortest >= 0) {
        printf("Shortest path from %d to %d is %d edges\n", src, dst, shortest);
    } else {
        printf("No path found from %d to %d\n", src, dst);
    }

    graph_free(g);
    return 0;
}
