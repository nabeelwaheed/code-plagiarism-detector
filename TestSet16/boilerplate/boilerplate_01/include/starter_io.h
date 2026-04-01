#ifndef STARTER_IO_H
#define STARTER_IO_H

#include <stddef.h>

char *read_entire_file(const char *path, size_t *size_out);
int write_text_file(const char *path, const char *text);
char **split_lines_mutable(char *buffer, int *count_out);
void free_line_array(char **lines);
int trim_trailing_newline(char *line);

#endif
