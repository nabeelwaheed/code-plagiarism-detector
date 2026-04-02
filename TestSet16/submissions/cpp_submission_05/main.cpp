#include "csv_summary.hpp"

#include <iostream>
#include <vector>

int main(int argc, char **argv) {
    std::vector<RevenueRow> rows;

    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <file.csv> [quarter]\n";
        return 1;
    }

    if (!parseRows(argv[1], rows)) {
        std::cerr << "Cannot parse " << argv[1] << '\n';
        return 1;
    }

    if (argc > 2) {
        rows = byQuarter(rows, argv[2]);
    }

    std::cout << "Loaded rows: " << rows.size() << '\n';
    std::cout << "Gross revenue: $" << sumRevenue(rows) << '\n';

    reportByTerritory(rows);
    reportBySeller(rows);

    return 0;
}
