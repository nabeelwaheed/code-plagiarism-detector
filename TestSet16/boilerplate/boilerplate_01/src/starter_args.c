#include "starter_args.h"

#include <stdio.h>
#include <string.h>

void print_starter_usage(const char *program_name) {
    printf("Usage: %s -i <input_file> [-o <output_file>] [-v]\n", program_name);
}

int parse_starter_options(int argc, char **argv, StarterOptions *opts) {
    int i;

    opts->input_path = NULL;
    opts->output_path = NULL;
    opts->verbose = 0;

    for (i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            opts->input_path = argv[++i];
        } else if (strcmp(argv[i], "-o") == 0 && i + 1 < argc) {
            opts->output_path = argv[++i];
        } else if (strcmp(argv[i], "-v") == 0) {
            opts->verbose = 1;
        } else {
            return 0;
        }
    }

    return opts->input_path != NULL;
}
