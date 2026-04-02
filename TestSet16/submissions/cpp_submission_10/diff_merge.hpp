#ifndef DIFF_MERGE_HPP
#define DIFF_MERGE_HPP

#include <string>
#include <vector>

bool loadLines(const std::string &path, std::vector<std::string> &lines);
void diffLite(const std::vector<std::string> &a, const std::vector<std::string> &b);
std::size_t longestCommonPrefix(const std::vector<std::string> &a, const std::vector<std::string> &b);
std::size_t countCommonUnique(const std::vector<std::string> &a, const std::vector<std::string> &b);

#endif
