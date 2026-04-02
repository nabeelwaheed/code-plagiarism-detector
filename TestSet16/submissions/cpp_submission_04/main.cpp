#include "sales_review.hpp"

#include <iostream>
#include <string>
#include <vector>

int main(int argc, char **argv) {
    std::vector<SaleEntry> entries;

    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <sales.csv> [period]\n";
        return 1;
    }

    if (!readSales(argv[1], entries)) {
        std::cerr << "Could not open " << argv[1] << '\n';
        return 1;
    }

    if (argc >= 3) {
        entries = selectPeriod(entries, argv[2]);
    }

    std::cout << "Entries: " << entries.size() << '\n';
    std::cout << "Revenue total: $" << computeRevenue(entries) << '\n';

    showRegionBreakdown(entries);
    showAgentBreakdown(entries);

    return 0;
}
