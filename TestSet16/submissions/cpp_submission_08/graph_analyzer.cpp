#include "graph_analyzer.hpp"

#include <fstream>
#include <queue>
#include <stack>

GraphAnalyzer::GraphAnalyzer(int n) : nodeCount(n), adj(static_cast<std::size_t>(n)) {}

void GraphAnalyzer::addUndirected(int a, int b) {
    if (a < 0 || b < 0 || a >= nodeCount || b >= nodeCount) {
        return;
    }
    adj[static_cast<std::size_t>(a)].push_back(b);
    adj[static_cast<std::size_t>(b)].push_back(a);
}

int GraphAnalyzer::size() const {
    return nodeCount;
}

int GraphAnalyzer::components() const {
    int count = 0;
    std::vector<int> seen(static_cast<std::size_t>(nodeCount), 0);

    for (int i = 0; i < nodeCount; ++i) {
        if (seen[static_cast<std::size_t>(i)] != 0) {
            continue;
        }

        std::stack<int> work;
        work.push(i);
        seen[static_cast<std::size_t>(i)] = 1;
        ++count;

        while (!work.empty()) {
            int cur = work.top();
            work.pop();

            for (int next : adj[static_cast<std::size_t>(cur)]) {
                if (seen[static_cast<std::size_t>(next)] == 0) {
                    seen[static_cast<std::size_t>(next)] = 1;
                    work.push(next);
                }
            }
        }
    }

    return count;
}

int GraphAnalyzer::shortestPath(int source, int target) const {
    if (source < 0 || target < 0 || source >= nodeCount || target >= nodeCount) {
        return -1;
    }

    std::vector<int> dist(static_cast<std::size_t>(nodeCount), -1);
    std::queue<int> q;

    dist[static_cast<std::size_t>(source)] = 0;
    q.push(source);

    while (!q.empty()) {
        int cur = q.front();
        q.pop();

        if (cur == target) {
            return dist[static_cast<std::size_t>(cur)];
        }

        for (int next : adj[static_cast<std::size_t>(cur)]) {
            if (dist[static_cast<std::size_t>(next)] == -1) {
                dist[static_cast<std::size_t>(next)] = dist[static_cast<std::size_t>(cur)] + 1;
                q.push(next);
            }
        }
    }

    return -1;
}

std::vector<int> GraphAnalyzer::degreeList() const {
    std::vector<int> out;
    out.reserve(static_cast<std::size_t>(nodeCount));
    for (int i = 0; i < nodeCount; ++i) {
        out.push_back(static_cast<int>(adj[static_cast<std::size_t>(i)].size()));
    }
    return out;
}

bool GraphAnalyzer::loadFromFile(const std::string &path, GraphAnalyzer &graph) {
    std::ifstream in(path);
    int n = 0;
    int m = 0;
    if (!in) {
        return false;
    }

    if (!(in >> n >> m)) {
        return false;
    }

    GraphAnalyzer g(n);
    for (int i = 0; i < m; ++i) {
        int a = 0;
        int b = 0;
        if (!(in >> a >> b)) {
            break;
        }
        g.addUndirected(a, b);
    }

    graph = g;
    return true;
}
