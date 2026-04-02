#include "diff_merge.hpp"

#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

int main(int argc, char **argv) {
    std::vector<std::string> left;
    std::vector<std::string> right;

    if (argc != 3) {
        std::cerr << "Usage: " << argv[0] << " <sorted_a.txt> <sorted_b.txt>\n";
        return 1;
    }

    if (!loadLines(argv[1], left)) {
        std::cerr << "Failed to read " << argv[1] << '\n';
        return 1;
    }

    if (!loadLines(argv[2], right)) {
        std::cerr << "Failed to read " << argv[2] << '\n';
        return 1;
    }

    std::sort(left.begin(), left.end());
    std::sort(right.begin(), right.end());

    std::size_t commonPrefix = longestCommonPrefix(left, right);
    std::size_t uniqueOverlap = countCommonUnique(left, right);

    std::cout << "Longest equal prefix after sorting: " << commonPrefix << '\n';
    std::cout << "Unique line overlap count: " << uniqueOverlap << '\n';

    diffLite(left, right);
    return 0;
}
