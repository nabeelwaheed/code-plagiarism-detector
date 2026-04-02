#include "csv_analyzer.hpp"

#include <iostream>
#include <string>
#include <vector>

int main(int argc, char **argv) {
    std::vector<SalesRow> rows;
    std::string quarterFilter;

    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <sales.csv> [quarter]\n";
        return 1;
    }

    if (!loadSalesCsv(argv[1], rows)) {
        std::cerr << "Failed to load CSV: " << argv[1] << '\n';
        return 1;
    }

    if (argc >= 3) {
        quarterFilter = argv[2];
        rows = rowsForQuarter(rows, quarterFilter);
    }

    std::cout << "Rows processed: " << rows.size() << '\n';
    std::cout << "Total revenue: $" << totalRevenue(rows) << '\n';

    printTotalsByRegion(rows);
    printTotalsByRep(rows);

    return 0;
}
