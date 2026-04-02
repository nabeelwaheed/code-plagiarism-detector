#include "network_walk.hpp"

#include <iostream>

int main(int argc, char **argv) {
    if (argc != 4) {
        std::cerr << "Usage: " << argv[0] << " <network.txt> <start> <goal>\n";
        return 1;
    }

    NetworkWalk graph;
    if (!graph.read(argv[1])) {
        std::cerr << "Unable to load network file\n";
        return 1;
    }

    int start = std::stoi(argv[2]);
    int goal = std::stoi(argv[3]);

    std::cout << "Vertices: " << graph.vertexCount() << '\n';
    std::cout << "Clusters: " << graph.clusterCount() << '\n';

    std::cout << "Neighbors per vertex:\n";
    auto counts = graph.neighborCounts();
    for (std::size_t i = 0; i < counts.size(); ++i) {
        std::cout << "  v" << i << " -> " << counts[i] << '\n';
    }

    int hops = graph.hopsBetween(start, goal);
    if (hops >= 0) {
        std::cout << "Path length: " << hops << '\n';
    } else {
        std::cout << "No route found\n";
    }

    return 0;
}
