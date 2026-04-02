#ifndef OPTIONS_H
#define OPTIONS_H

typedef struct {
    const char *source_file;
    const char *report_file;
    int dump_rows;
} RunOptions;

int parse_run_options(int argc, char **argv, RunOptions *options);
void show_usage(const char *program_name);

#endif
