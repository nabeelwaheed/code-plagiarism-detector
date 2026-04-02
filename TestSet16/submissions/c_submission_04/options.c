#include "options.h"

#include <stdio.h>
#include <string.h>

void show_usage(const char *program_name) {
    printf("Usage: %s --input <grades.csv> [--output report.txt] [--show]\n", program_name);
}

int parse_run_options(int argc, char **argv, RunOptions *options) {
    int pos;

    options->source_file = NULL;
    options->report_file = NULL;
    options->dump_rows = 0;

    for (pos = 1; pos < argc; ++pos) {
        if (strcmp(argv[pos], "--input") == 0 && pos + 1 < argc) {
            options->source_file = argv[++pos];
        } else if (strcmp(argv[pos], "--output") == 0 && pos + 1 < argc) {
            options->report_file = argv[++pos];
        } else if (strcmp(argv[pos], "--show") == 0) {
            options->dump_rows = 1;
        } else {
            return 0;
        }
    }

    return options->source_file != NULL;
}
