#ifndef C_TEMPLATE_ARGS_H
#define C_TEMPLATE_ARGS_H

typedef struct {
    const char *input_file;
    const char *output_file;
    int verbose;
} CTemplateArgs;

int parse_c_template_args(int argc, char **argv, CTemplateArgs *args);
void print_c_template_usage(const char *program);

#endif
