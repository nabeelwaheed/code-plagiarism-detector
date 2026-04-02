#include "graph_analyzer.hpp"

#include <iostream>
#include <vector>

int main(int argc, char **argv) {
    GraphAnalyzer graph;

    if (argc != 4) {
        std::cerr << "Usage: " << argv[0] << " <graph.txt> <source> <target>\n";
        std::cerr << "graph.txt format: n m followed by m lines of 'u v'\n";
        return 1;
    }

    if (!GraphAnalyzer::loadFromFile(argv[1], graph)) {
        std::cerr << "Cannot read graph file: " << argv[1] << '\n';
        return 1;
    }

    int source = std::stoi(argv[2]);
    int target = std::stoi(argv[3]);

    std::cout << "Node count: " << graph.size() << '\n';
    std::cout << "Connected components: " << graph.components() << '\n';

    std::vector<int> degrees = graph.degreeList();
    std::cout << "Degree report:\n";
    for (std::size_t i = 0; i < degrees.size(); ++i) {
        std::cout << "  node " << i << " -> " << degrees[i] << '\n';
    }

    int hops = graph.shortestPath(source, target);
    if (hops >= 0) {
        std::cout << "Shortest path from " << source << " to " << target << " = " << hops << "\n";
    } else {
        std::cout << "No path from " << source << " to " << target << "\n";
    }

    return 0;
}
