#ifndef GRAPH_H
#define GRAPH_H

typedef struct EdgeNode {
    int to;
    struct EdgeNode *next;
} EdgeNode;

typedef struct {
    int vertex_count;
    EdgeNode **adj;
} Graph;

Graph *graph_create(int vertex_count);
void graph_add_undirected(Graph *g, int a, int b);
void graph_free(Graph *g);
Graph *graph_load_from_file(const char *path);

#endif
