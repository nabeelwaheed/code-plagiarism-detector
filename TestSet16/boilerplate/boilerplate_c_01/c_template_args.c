#include "c_template_args.h"

#include <stdio.h>
#include <string.h>

void print_c_template_usage(const char *program) {
    printf("Usage: %s -i <input> [-o <output>] [-v]\n", program);
}

int parse_c_template_args(int argc, char **argv, CTemplateArgs *args) {
    int i;
    args->input_file = NULL;
    args->output_file = NULL;
    args->verbose = 0;

    for (i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            args->input_file = argv[++i];
        } else if (strcmp(argv[i], "-o") == 0 && i + 1 < argc) {
            args->output_file = argv[++i];
        } else if (strcmp(argv[i], "-v") == 0) {
            args->verbose = 1;
        } else {
            return 0;
        }
    }

    return args->input_file != NULL;
}
