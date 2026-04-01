#ifndef STARTER_ARGS_H
#define STARTER_ARGS_H

typedef struct {
    const char *input_path;
    const char *output_path;
    int verbose;
} StarterOptions;

int parse_starter_options(int argc, char **argv, StarterOptions *opts);
void print_starter_usage(const char *program_name);

#endif
