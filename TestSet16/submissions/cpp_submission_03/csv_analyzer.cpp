#include "csv_analyzer.hpp"

#include <algorithm>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <fstream>

static std::string trimToken(const std::string &text) {
    std::size_t first = text.find_first_not_of(" \t\r\n");
    std::size_t last = text.find_last_not_of(" \t\r\n");
    if (first == std::string::npos) {
        return "";
    }
    return text.substr(first, last - first + 1);
}

bool loadSalesCsv(const std::string &path, std::vector<SalesRow> &rows) {
    std::ifstream file(path);
    std::string line;
    if (!file) {
        return false;
    }

    while (std::getline(file, line)) {
        std::stringstream ss(line);
        std::string rep;
        std::string region;
        std::string quarter;
        std::string amount;

        if (!std::getline(ss, rep, ',')) continue;
        if (!std::getline(ss, region, ',')) continue;
        if (!std::getline(ss, quarter, ',')) continue;
        if (!std::getline(ss, amount, ',')) continue;

        SalesRow row;
        row.rep = trimToken(rep);
        row.region = trimToken(region);
        row.quarter = trimToken(quarter);
        row.amount = std::stod(trimToken(amount));

        rows.push_back(row);
    }

    return true;
}

double totalRevenue(const std::vector<SalesRow> &rows) {
    double total = 0.0;
    for (const auto &row : rows) {
        total += row.amount;
    }
    return total;
}

void printTotalsByRegion(const std::vector<SalesRow> &rows) {
    std::map<std::string, double> sums;
    for (const auto &row : rows) {
        sums[row.region] += row.amount;
    }

    std::cout << "\nTotals by region\n";
    for (const auto &kv : sums) {
        std::cout << std::left << std::setw(12) << kv.first
                  << " $" << std::fixed << std::setprecision(2) << kv.second << '\n';
    }
}

void printTotalsByRep(const std::vector<SalesRow> &rows) {
    std::map<std::string, double> sums;
    for (const auto &row : rows) {
        sums[row.rep] += row.amount;
    }

    std::vector<std::pair<std::string, double>> ranking(sums.begin(), sums.end());
    std::sort(ranking.begin(), ranking.end(), [](const auto &a, const auto &b) {
        return a.second > b.second;
    });

    std::cout << "\nTotals by representative\n";
    for (const auto &entry : ranking) {
        std::cout << std::left << std::setw(18) << entry.first
                  << " $" << std::fixed << std::setprecision(2) << entry.second << '\n';
    }
}

std::vector<SalesRow> rowsForQuarter(const std::vector<SalesRow> &rows, const std::string &quarter) {
    std::vector<SalesRow> filtered;
    for (const auto &row : rows) {
        if (row.quarter == quarter) {
            filtered.push_back(row);
        }
    }
    return filtered;
}
