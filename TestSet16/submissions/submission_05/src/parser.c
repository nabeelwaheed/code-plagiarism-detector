#include "parser.h"

#include <stdio.h>
#include <string.h>

void print_app_help(const char *program_name) {
    printf("Usage: %s -i input.csv [-o summary.txt] [--show]\n", program_name);
}

int parse_app_args(int argc, char **argv, AppArgs *args) {
    int idx;

    args->input_path = NULL;
    args->output_path = NULL;
    args->show_ranked = 0;

    for (idx = 1; idx < argc; ++idx) {
        if (strcmp(argv[idx], "-i") == 0 && idx + 1 < argc) {
            args->input_path = argv[++idx];
        } else if (strcmp(argv[idx], "-o") == 0 && idx + 1 < argc) {
            args->output_path = argv[++idx];
        } else if (strcmp(argv[idx], "--show") == 0) {
            args->show_ranked = 1;
        } else {
            return 0;
        }
    }

    return args->input_path != NULL;
}
