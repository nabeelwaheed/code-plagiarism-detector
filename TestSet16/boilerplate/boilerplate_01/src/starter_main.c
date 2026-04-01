#include "starter_args.h"
#include "starter_io.h"

#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    StarterOptions opts;
    size_t size = 0;
    char *content;

    if (!parse_starter_options(argc, argv, &opts)) {
        print_starter_usage(argv[0]);
        return 1;
    }

    content = read_entire_file(opts.input_path, &size);
    if (!content) {
        fprintf(stderr, "Failed to open input file: %s\n", opts.input_path);
        return 1;
    }

    if (opts.verbose) {
        printf("Loaded %zu bytes\n", size);
    }

    if (opts.output_path) {
        if (!write_text_file(opts.output_path, content)) {
            fprintf(stderr, "Failed to write output file: %s\n", opts.output_path);
            free(content);
            return 1;
        }
    } else {
        puts(content);
    }

    free(content);
    return 0;
}
