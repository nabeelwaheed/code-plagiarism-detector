#include "sales_review.hpp"

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>

static std::string clean(const std::string &x) {
    std::size_t left = x.find_first_not_of(" \t\r\n");
    std::size_t right = x.find_last_not_of(" \t\r\n");
    if (left == std::string::npos) {
        return "";
    }
    return x.substr(left, right - left + 1);
}

bool readSales(const std::string &fileName, std::vector<SaleEntry> &entries) {
    std::ifstream in(fileName);
    std::string line;
    if (!in) {
        return false;
    }

    while (std::getline(in, line)) {
        std::stringstream parser(line);
        std::string a;
        std::string z;
        std::string p;
        std::string r;

        if (!std::getline(parser, a, ',')) continue;
        if (!std::getline(parser, z, ',')) continue;
        if (!std::getline(parser, p, ',')) continue;
        if (!std::getline(parser, r, ',')) continue;

        SaleEntry e;
        e.agent = clean(a);
        e.zone = clean(z);
        e.period = clean(p);
        e.revenue = std::stod(clean(r));
        entries.push_back(e);
    }

    return true;
}

double computeRevenue(const std::vector<SaleEntry> &entries) {
    double sum = 0.0;
    for (const auto &e : entries) {
        sum += e.revenue;
    }
    return sum;
}

void showRegionBreakdown(const std::vector<SaleEntry> &entries) {
    std::map<std::string, double> acc;
    for (const auto &e : entries) {
        acc[e.zone] += e.revenue;
    }

    std::cout << "\nRevenue by zone\n";
    for (const auto &pair : acc) {
        std::cout << std::left << std::setw(12) << pair.first
                  << "$" << std::fixed << std::setprecision(2) << pair.second << '\n';
    }
}

void showAgentBreakdown(const std::vector<SaleEntry> &entries) {
    std::map<std::string, double> acc;
    for (const auto &e : entries) {
        acc[e.agent] += e.revenue;
    }

    std::vector<std::pair<std::string, double>> rows(acc.begin(), acc.end());
    std::sort(rows.begin(), rows.end(), [](const auto &l, const auto &r) {
        return l.second > r.second;
    });

    std::cout << "\nRevenue by agent\n";
    for (const auto &row : rows) {
        std::cout << std::left << std::setw(18) << row.first
                  << "$" << std::fixed << std::setprecision(2) << row.second << '\n';
    }
}

std::vector<SaleEntry> selectPeriod(const std::vector<SaleEntry> &entries, const std::string &period) {
    std::vector<SaleEntry> out;
    for (const auto &e : entries) {
        if (e.period == period) {
            out.push_back(e);
        }
    }
    return out;
}
