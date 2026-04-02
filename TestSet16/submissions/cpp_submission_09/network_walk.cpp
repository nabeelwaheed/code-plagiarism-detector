#include "network_walk.hpp"

#include <fstream>
#include <queue>
#include <stack>

NetworkWalk::NetworkWalk() : vertices(0) {}

NetworkWalk::NetworkWalk(int vertexCount)
    : vertices(vertexCount), links(static_cast<std::size_t>(vertexCount)) {}

bool NetworkWalk::read(const std::string &fileName) {
    std::ifstream in(fileName);
    int edgeCount = 0;

    if (!in) {
        return false;
    }
    if (!(in >> vertices >> edgeCount)) {
        return false;
    }

    links.assign(static_cast<std::size_t>(vertices), {});

    for (int i = 0; i < edgeCount; ++i) {
        int a = 0;
        int b = 0;
        if (!(in >> a >> b)) {
            break;
        }
        connect(a, b);
    }

    return true;
}

void NetworkWalk::connect(int left, int right) {
    if (left < 0 || right < 0 || left >= vertices || right >= vertices) {
        return;
    }
    links[static_cast<std::size_t>(left)].push_back(right);
    links[static_cast<std::size_t>(right)].push_back(left);
}

int NetworkWalk::vertexCount() const {
    return vertices;
}

int NetworkWalk::clusterCount() const {
    std::vector<int> mark(static_cast<std::size_t>(vertices), 0);
    int clusters = 0;

    for (int seed = 0; seed < vertices; ++seed) {
        if (mark[static_cast<std::size_t>(seed)] != 0) {
            continue;
        }

        std::stack<int> st;
        st.push(seed);
        mark[static_cast<std::size_t>(seed)] = 1;
        ++clusters;

        while (!st.empty()) {
            int node = st.top();
            st.pop();

            for (int nxt : links[static_cast<std::size_t>(node)]) {
                if (mark[static_cast<std::size_t>(nxt)] == 0) {
                    mark[static_cast<std::size_t>(nxt)] = 1;
                    st.push(nxt);
                }
            }
        }
    }

    return clusters;
}

int NetworkWalk::hopsBetween(int start, int goal) const {
    if (start < 0 || goal < 0 || start >= vertices || goal >= vertices) {
        return -1;
    }

    std::vector<int> distance(static_cast<std::size_t>(vertices), -1);
    std::queue<int> q;

    distance[static_cast<std::size_t>(start)] = 0;
    q.push(start);

    while (!q.empty()) {
        int node = q.front();
        q.pop();

        if (node == goal) {
            return distance[static_cast<std::size_t>(node)];
        }

        for (int nbr : links[static_cast<std::size_t>(node)]) {
            if (distance[static_cast<std::size_t>(nbr)] == -1) {
                distance[static_cast<std::size_t>(nbr)] = distance[static_cast<std::size_t>(node)] + 1;
                q.push(nbr);
            }
        }
    }

    return -1;
}

std::vector<int> NetworkWalk::neighborCounts() const {
    std::vector<int> out;
    out.reserve(static_cast<std::size_t>(vertices));
    for (int i = 0; i < vertices; ++i) {
        out.push_back(static_cast<int>(links[static_cast<std::size_t>(i)].size()));
    }
    return out;
}
