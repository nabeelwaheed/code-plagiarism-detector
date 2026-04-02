#ifndef CSV_SUMMARY_HPP
#define CSV_SUMMARY_HPP

#include <string>
#include <vector>

struct RevenueRow {
    std::string seller;
    std::string territory;
    std::string quarter;
    double dollars;
};

bool parseRows(const std::string &path, std::vector<RevenueRow> &rows);
std::vector<RevenueRow> byQuarter(const std::vector<RevenueRow> &rows, const std::string &quarter);
void reportByTerritory(const std::vector<RevenueRow> &rows);
void reportBySeller(const std::vector<RevenueRow> &rows);
double sumRevenue(const std::vector<RevenueRow> &rows);

#endif
