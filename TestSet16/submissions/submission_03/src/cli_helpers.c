#include "cli_helpers.h"

#include <stdio.h>
#include <string.h>

void print_cli_usage(const char *program) {
    printf("Usage: %s -i <grades.csv> [-o report.txt] [--table]\n", program);
}

int parse_cli_config(int argc, char **argv, CliConfig *cfg) {
    int i;

    cfg->input_csv = NULL;
    cfg->output_report = NULL;
    cfg->print_table = 0;

    for (i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            cfg->input_csv = argv[++i];
        } else if (strcmp(argv[i], "-o") == 0 && i + 1 < argc) {
            cfg->output_report = argv[++i];
        } else if (strcmp(argv[i], "--table") == 0) {
            cfg->print_table = 1;
        } else {
            return 0;
        }
    }

    return cfg->input_csv != NULL;
}
