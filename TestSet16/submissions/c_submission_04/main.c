#include "options.h"
#include "coursebook.h"

#include <stdio.h>

int main(int argc, char **argv) {
    RunOptions options;
    CourseRow *rows = NULL;
    size_t nrows = 0;

    if (!parse_run_options(argc, argv, &options)) {
        show_usage(argv[0]);
        return 1;
    }

    if (!coursebook_read(options.source_file, &rows, &nrows)) {
        fprintf(stderr, "Unable to load %s\n", options.source_file);
        return 1;
    }

    coursebook_calculate(rows, nrows);
    coursebook_rank(rows, nrows);

    printf("Rows processed: %zu\n", nrows);
    printf("Mean score: %.2f\n", coursebook_mean(rows, nrows));
    printf("Pass percentage: %.2f%%\n", coursebook_success(rows, nrows));

    if (options.dump_rows) {
        coursebook_show(rows, nrows);
    }

    if (options.report_file && !coursebook_export(options.report_file, rows, nrows)) {
        fprintf(stderr, "Could not write report %s\n", options.report_file);
        coursebook_free(rows);
        return 1;
    }

    coursebook_free(rows);
    return 0;
}
