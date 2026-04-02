#ifndef CSV_ANALYZER_HPP
#define CSV_ANALYZER_HPP

#include <string>
#include <vector>

struct SalesRow {
    std::string rep;
    std::string region;
    std::string quarter;
    double amount;
};

bool loadSalesCsv(const std::string &path, std::vector<SalesRow> &rows);
void printTotalsByRegion(const std::vector<SalesRow> &rows);
void printTotalsByRep(const std::vector<SalesRow> &rows);
double totalRevenue(const std::vector<SalesRow> &rows);
std::vector<SalesRow> rowsForQuarter(const std::vector<SalesRow> &rows, const std::string &quarter);

#endif
