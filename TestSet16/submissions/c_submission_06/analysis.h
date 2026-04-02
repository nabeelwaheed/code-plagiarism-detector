#ifndef ANALYSIS_H
#define ANALYSIS_H

#include "graph.h"

int graph_connected_components(const Graph *g);
int graph_shortest_path_len(const Graph *g, int src, int dst);
void graph_degree_report(const Graph *g);

#endif
