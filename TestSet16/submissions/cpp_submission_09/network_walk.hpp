#ifndef NETWORK_WALK_HPP
#define NETWORK_WALK_HPP

#include <string>
#include <vector>

class NetworkWalk {
public:
    NetworkWalk();
    explicit NetworkWalk(int vertices);
    bool read(const std::string &fileName);
    int vertexCount() const;
    int clusterCount() const;
    int hopsBetween(int start, int goal) const;
    std::vector<int> neighborCounts() const;

private:
    void connect(int left, int right);

private:
    int vertices;
    std::vector<std::vector<int>> links;
};

#endif
