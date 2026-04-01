#include "cli_helpers.h"
#include "gradebook.h"

#include <stdio.h>

int main(int argc, char **argv) {
    CliConfig cfg;
    StudentRecord *records = NULL;
    size_t count = 0;

    if (!parse_cli_config(argc, argv, &cfg)) {
        print_cli_usage(argv[0]);
        return 1;
    }

    if (!load_gradebook_csv(cfg.input_csv, &records, &count)) {
        fprintf(stderr, "Could not load gradebook file: %s\n", cfg.input_csv);
        return 1;
    }

    compute_weighted_scores(records, count);
    sort_by_average_desc(records, count);

    printf("Students: %zu\n", count);
    printf("Class average: %.2f\n", class_average(records, count));
    printf("Pass rate: %.1f%%\n", pass_rate_percent(records, count));

    if (cfg.print_table) {
        print_grade_table(records, count);
    }

    if (cfg.output_report) {
        if (!write_grade_report(cfg.output_report, records, count)) {
            fprintf(stderr, "Failed to write report: %s\n", cfg.output_report);
            free_records(records);
            return 1;
        }
    }

    free_records(records);
    return 0;
}
