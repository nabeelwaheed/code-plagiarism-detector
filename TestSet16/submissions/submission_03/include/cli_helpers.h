#ifndef CLI_HELPERS_H
#define CLI_HELPERS_H

typedef struct {
    const char *input_csv;
    const char *output_report;
    int print_table;
} CliConfig;

int parse_cli_config(int argc, char **argv, CliConfig *cfg);
void print_cli_usage(const char *program);

#endif
