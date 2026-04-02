#ifndef PARSER_H
#define PARSER_H

typedef struct {
    const char *input_path;
    const char *output_path;
    int show_ranked;
} AppArgs;

int parse_app_args(int argc, char **argv, AppArgs *args);
void print_app_help(const char *program_name);

#endif
