#ifndef GRAPH_ANALYZER_HPP
#define GRAPH_ANALYZER_HPP

#include <string>
#include <vector>

struct EdgePair {
    int u;
    int v;
};

class GraphAnalyzer {
public:
    explicit GraphAnalyzer(int n = 0);
    void addUndirected(int a, int b);
    int size() const;
    int components() const;
    int shortestPath(int source, int target) const;
    std::vector<int> degreeList() const;
    static bool loadFromFile(const std::string &path, GraphAnalyzer &graph);

private:
    int nodeCount;
    std::vector<std::vector<int>> adj;
};

#endif
