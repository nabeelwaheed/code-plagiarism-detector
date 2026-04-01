#include "analysis.h"

#include <stdio.h>
#include <stdlib.h>

int graph_connected_components(const Graph *g) {
    int components = 0;
    int *seen;
    int *stack;
    int i;

    if (!g) {
        return 0;
    }

    seen = (int *)calloc((size_t)g->vertex_count, sizeof(int));
    stack = (int *)malloc((size_t)g->vertex_count * sizeof(int));
    if (!seen || !stack) {
        free(seen);
        free(stack);
        return 0;
    }

    for (i = 0; i < g->vertex_count; ++i) {
        if (!seen[i]) {
            int top = 0;
            stack[top++] = i;
            seen[i] = 1;
            components++;

            while (top > 0) {
                int v = stack[--top];
                const EdgeNode *e = g->adj[v];
                while (e) {
                    if (!seen[e->to]) {
                        seen[e->to] = 1;
                        stack[top++] = e->to;
                    }
                    e = e->next;
                }
            }
        }
    }

    free(seen);
    free(stack);
    return components;
}

int graph_shortest_path_len(const Graph *g, int src, int dst) {
    int *dist;
    int *queue;
    int head = 0;
    int tail = 0;
    int i;

    if (!g || src < 0 || dst < 0 || src >= g->vertex_count || dst >= g->vertex_count) {
        return -1;
    }

    dist = (int *)malloc((size_t)g->vertex_count * sizeof(int));
    queue = (int *)malloc((size_t)g->vertex_count * sizeof(int));
    if (!dist || !queue) {
        free(dist);
        free(queue);
        return -1;
    }

    for (i = 0; i < g->vertex_count; ++i) {
        dist[i] = -1;
    }

    dist[src] = 0;
    queue[tail++] = src;

    while (head < tail) {
        int v = queue[head++];
        const EdgeNode *e = g->adj[v];

        if (v == dst) {
            int answer = dist[v];
            free(dist);
            free(queue);
            return answer;
        }

        while (e) {
            if (dist[e->to] == -1) {
                dist[e->to] = dist[v] + 1;
                queue[tail++] = e->to;
            }
            e = e->next;
        }
    }

    free(dist);
    free(queue);
    return -1;
}

void graph_degree_report(const Graph *g) {
    int i;
    if (!g) {
        return;
    }

    puts("\nVertex degree report:");
    for (i = 0; i < g->vertex_count; ++i) {
        int degree = 0;
        const EdgeNode *e = g->adj[i];
        while (e) {
            degree++;
            e = e->next;
        }
        printf("vertex %d -> degree %d\n", i, degree);
    }
}
