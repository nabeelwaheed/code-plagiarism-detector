#include "csv_summary.hpp"

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>

namespace {
std::string trimCopy(const std::string &text) {
    std::size_t b = text.find_first_not_of(" \t\r\n");
    std::size_t e = text.find_last_not_of(" \t\r\n");
    if (b == std::string::npos) {
        return "";
    }
    return text.substr(b, e - b + 1);
}

bool parseOne(const std::string &line, RevenueRow &row) {
    std::stringstream ss(line);
    std::string a, b, c, d;
    if (!std::getline(ss, a, ',')) return false;
    if (!std::getline(ss, b, ',')) return false;
    if (!std::getline(ss, c, ',')) return false;
    if (!std::getline(ss, d, ',')) return false;

    row.seller = trimCopy(a);
    row.territory = trimCopy(b);
    row.quarter = trimCopy(c);
    row.dollars = std::stod(trimCopy(d));
    return true;
}
}

bool parseRows(const std::string &path, std::vector<RevenueRow> &rows) {
    std::ifstream file(path);
    std::string line;
    if (!file) {
        return false;
    }

    while (std::getline(file, line)) {
        RevenueRow row;
        if (parseOne(line, row)) {
            rows.push_back(row);
        }
    }

    return true;
}

std::vector<RevenueRow> byQuarter(const std::vector<RevenueRow> &rows, const std::string &quarter) {
    std::vector<RevenueRow> subset;
    for (const auto &row : rows) {
        if (row.quarter == quarter) {
            subset.push_back(row);
        }
    }
    return subset;
}

double sumRevenue(const std::vector<RevenueRow> &rows) {
    double sum = 0.0;
    for (const auto &r : rows) {
        sum += r.dollars;
    }
    return sum;
}

void reportByTerritory(const std::vector<RevenueRow> &rows) {
    std::map<std::string, double> totals;
    for (const auto &r : rows) {
        totals[r.territory] += r.dollars;
    }

    std::cout << "\nTotals by territory\n";
    for (const auto &kv : totals) {
        std::cout << std::left << std::setw(14) << kv.first
                  << "$" << std::fixed << std::setprecision(2) << kv.second << '\n';
    }
}

void reportBySeller(const std::vector<RevenueRow> &rows) {
    std::map<std::string, double> totals;
    std::vector<std::pair<std::string, double>> ranking;

    for (const auto &r : rows) {
        totals[r.seller] += r.dollars;
    }
    for (const auto &kv : totals) {
        ranking.push_back(kv);
    }

    std::sort(ranking.begin(), ranking.end(), [](const auto &x, const auto &y) {
        return x.second > y.second;
    });

    std::cout << "\nTotals by seller\n";
    for (const auto &r : ranking) {
        std::cout << std::left << std::setw(18) << r.first
                  << "$" << std::fixed << std::setprecision(2) << r.second << '\n';
    }
}
