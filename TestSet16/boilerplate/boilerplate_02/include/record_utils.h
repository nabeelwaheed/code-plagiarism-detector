#ifndef RECORD_UTILS_H
#define RECORD_UTILS_H

#include <stddef.h>

int parse_int_safe(const char *text, int *value_out);
int parse_double_safe(const char *text, double *value_out);
void to_uppercase_in_place(char *text);
void copy_token(char *dest, size_t dest_size, const char *src);

#endif
