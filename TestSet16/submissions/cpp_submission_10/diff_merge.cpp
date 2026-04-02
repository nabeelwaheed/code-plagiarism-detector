#include "diff_merge.hpp"

#include <fstream>
#include <set>
#include <iostream>
#include <string>
#include <vector>

bool loadLines(const std::string &path, std::vector<std::string> &lines) {
    std::ifstream in(path);
    std::string line;
    if (!in) {
        return false;
    }

    while (std::getline(in, line)) {
        lines.push_back(line);
    }

    return true;
}

void diffLite(const std::vector<std::string> &a, const std::vector<std::string> &b) {
    std::size_t i = 0;
    std::size_t j = 0;
    int same = 0;
    int onlyA = 0;
    int onlyB = 0;

    std::cout << "Diff-lite output\n";
    while (i < a.size() && j < b.size()) {
        if (a[i] == b[j]) {
            std::cout << " SAME   | " << a[i] << '\n';
            ++same;
            ++i;
            ++j;
        } else if (a[i] < b[j]) {
            std::cout << " ONLY_A | " << a[i] << '\n';
            ++onlyA;
            ++i;
        } else {
            std::cout << " ONLY_B | " << b[j] << '\n';
            ++onlyB;
            ++j;
        }
    }

    while (i < a.size()) {
        std::cout << " ONLY_A | " << a[i] << '\n';
        ++onlyA;
        ++i;
    }

    while (j < b.size()) {
        std::cout << " ONLY_B | " << b[j] << '\n';
        ++onlyB;
        ++j;
    }

    std::cout << "\nSummary\n";
    std::cout << "same lines: " << same << '\n';
    std::cout << "only in A: " << onlyA << '\n';
    std::cout << "only in B: " << onlyB << '\n';
    std::cout << "input sizes: " << a.size() << " and " << b.size() << '\n';
}

std::size_t longestCommonPrefix(const std::vector<std::string> &a, const std::vector<std::string> &b) {
    std::size_t limit = a.size() < b.size() ? a.size() : b.size();
    std::size_t i = 0;
    while (i < limit && a[i] == b[i]) {
        ++i;
    }
    return i;
}

std::size_t countCommonUnique(const std::vector<std::string> &a, const std::vector<std::string> &b) {
    std::set<std::string> left(a.begin(), a.end());
    std::size_t common = 0;
    for (const auto &line : b) {
        if (left.find(line) != left.end()) {
            ++common;
            left.erase(line);
        }
    }
    return common;
}
