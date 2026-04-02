#include "graph.h"

#include <stdio.h>
#include <stdlib.h>

static EdgeNode *make_edge(int to, EdgeNode *next) {
    EdgeNode *node = (EdgeNode *)malloc(sizeof(EdgeNode));
    if (!node) {
        return NULL;
    }
    node->to = to;
    node->next = next;
    return node;
}

Graph *graph_create(int vertex_count) {
    Graph *g;
    int i;

    if (vertex_count <= 0) {
        return NULL;
    }

    g = (Graph *)malloc(sizeof(Graph));
    if (!g) {
        return NULL;
    }

    g->adj = (EdgeNode **)malloc((size_t)vertex_count * sizeof(EdgeNode *));
    if (!g->adj) {
        free(g);
        return NULL;
    }

    for (i = 0; i < vertex_count; ++i) {
        g->adj[i] = NULL;
    }

    g->vertex_count = vertex_count;
    return g;
}

void graph_add_undirected(Graph *g, int a, int b) {
    EdgeNode *edge1;
    EdgeNode *edge2;

    if (!g || a < 0 || b < 0 || a >= g->vertex_count || b >= g->vertex_count) {
        return;
    }

    edge1 = make_edge(b, g->adj[a]);
    edge2 = make_edge(a, g->adj[b]);

    if (!edge1 || !edge2) {
        free(edge1);
        free(edge2);
        return;
    }

    g->adj[a] = edge1;
    g->adj[b] = edge2;
}

void graph_free(Graph *g) {
    int i;
    if (!g) {
        return;
    }

    for (i = 0; i < g->vertex_count; ++i) {
        EdgeNode *it = g->adj[i];
        while (it) {
            EdgeNode *next = it->next;
            free(it);
            it = next;
        }
    }

    free(g->adj);
    free(g);
}

Graph *graph_load_from_file(const char *path) {
    FILE *fp = fopen(path, "r");
    int n;
    int m;
    int i;
    Graph *g;

    if (!fp) {
        return NULL;
    }

    if (fscanf(fp, "%d %d", &n, &m) != 2) {
        fclose(fp);
        return NULL;
    }

    g = graph_create(n);
    if (!g) {
        fclose(fp);
        return NULL;
    }

    for (i = 0; i < m; ++i) {
        int a;
        int b;
        if (fscanf(fp, "%d %d", &a, &b) != 2) {
            break;
        }
        graph_add_undirected(g, a, b);
    }

    fclose(fp);
    return g;
}
