#include "walker.h"

#include <stdio.h>
#include <stdlib.h>

static void flood_fill(const Network *net, int seed, int *marks, int *tmp) {
    int top = 0;
    tmp[top++] = seed;
    marks[seed] = 1;

    while (top > 0) {
        int node = tmp[--top];
        const Link *edge = net->rows[node];
        for (; edge != NULL; edge = edge->next) {
            if (!marks[edge->dest]) {
                marks[edge->dest] = 1;
                tmp[top++] = edge->dest;
            }
        }
    }
}

int walker_count_groups(const Network *net) {
    int *marks;
    int *tmp;
    int clusters = 0;
    int i;

    if (!net) {
        return 0;
    }

    marks = (int *)calloc((size_t)net->size, sizeof(int));
    tmp = (int *)malloc((size_t)net->size * sizeof(int));
    if (!marks || !tmp) {
        free(marks);
        free(tmp);
        return 0;
    }

    for (i = 0; i < net->size; ++i) {
        if (marks[i] == 0) {
            flood_fill(net, i, marks, tmp);
            clusters++;
        }
    }

    free(marks);
    free(tmp);
    return clusters;
}

int walker_distance(const Network *net, int start, int goal) {
    int *dist;
    int *ring;
    int head = 0;
    int tail = 0;
    int i;

    if (!net || start < 0 || goal < 0 || start >= net->size || goal >= net->size) {
        return -1;
    }

    dist = (int *)malloc((size_t)net->size * sizeof(int));
    ring = (int *)malloc((size_t)net->size * sizeof(int));
    if (!dist || !ring) {
        free(dist);
        free(ring);
        return -1;
    }

    for (i = 0; i < net->size; ++i) {
        dist[i] = -1;
    }

    dist[start] = 0;
    ring[tail++] = start;

    while (head < tail) {
        int node = ring[head++];
        const Link *edge = net->rows[node];

        if (node == goal) {
            int result = dist[node];
            free(dist);
            free(ring);
            return result;
        }

        for (; edge != NULL; edge = edge->next) {
            if (dist[edge->dest] == -1) {
                dist[edge->dest] = dist[node] + 1;
                ring[tail++] = edge->dest;
            }
        }
    }

    free(dist);
    free(ring);
    return -1;
}

void walker_print_density(const Network *net) {
    int i;
    puts("\nAdjacency density per vertex:");
    for (i = 0; i < net->size; ++i) {
        int count = 0;
        const Link *cursor = net->rows[i];
        while (cursor) {
            count++;
            cursor = cursor->next;
        }
        printf("v%d has %d neighbors\n", i, count);
    }
}
