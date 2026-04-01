#include "parser.h"
#include "classroom.h"

#include <stdio.h>

int main(int argc, char **argv) {
    AppArgs args;
    GradeList list;

    if (!parse_app_args(argc, argv, &args)) {
        print_app_help(argv[0]);
        return 1;
    }

    if (!gradelist_init(&list)) {
        fprintf(stderr, "Unable to initialize data structure\n");
        return 1;
    }

    if (!gradelist_load_csv(&list, args.input_path)) {
        fprintf(stderr, "Could not read %s\n", args.input_path);
        gradelist_destroy(&list);
        return 1;
    }

    gradelist_calculate(&list);
    gradelist_sort(&list);

    printf("Rows: %zu\n", list.count);
    printf("Average: %.2f\n", gradelist_average(&list));
    printf("Pass rate: %.2f%%\n", gradelist_pass_rate(&list));

    if (args.show_ranked) {
        gradelist_print(&list);
    }

    if (args.output_path && !gradelist_write(&list, args.output_path)) {
        fprintf(stderr, "Failed to write %s\n", args.output_path);
        gradelist_destroy(&list);
        return 1;
    }

    gradelist_destroy(&list);
    return 0;
}
