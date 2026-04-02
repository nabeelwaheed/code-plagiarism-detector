#ifndef SALES_REVIEW_HPP
#define SALES_REVIEW_HPP

#include <string>
#include <vector>

struct SaleEntry {
    std::string agent;
    std::string zone;
    std::string period;
    double revenue;
};

bool readSales(const std::string &fileName, std::vector<SaleEntry> &entries);
double computeRevenue(const std::vector<SaleEntry> &entries);
void showRegionBreakdown(const std::vector<SaleEntry> &entries);
void showAgentBreakdown(const std::vector<SaleEntry> &entries);
std::vector<SaleEntry> selectPeriod(const std::vector<SaleEntry> &entries, const std::string &period);

#endif
