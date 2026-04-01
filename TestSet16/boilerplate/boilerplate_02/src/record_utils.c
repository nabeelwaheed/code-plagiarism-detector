#include "record_utils.h"

#include <ctype.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>

int parse_int_safe(const char *text, int *value_out) {
    char *end;
    long value;

    errno = 0;
    value = strtol(text, &end, 10);
    if (errno != 0 || end == text || *end != '\0') {
        return 0;
    }

    *value_out = (int)value;
    return 1;
}

int parse_double_safe(const char *text, double *value_out) {
    char *end;
    double value;

    errno = 0;
    value = strtod(text, &end);
    if (errno != 0 || end == text || *end != '\0') {
        return 0;
    }

    *value_out = value;
    return 1;
}

void to_uppercase_in_place(char *text) {
    while (*text) {
        *text = (char)toupper((unsigned char)*text);
        ++text;
    }
}

void copy_token(char *dest, size_t dest_size, const char *src) {
    if (dest_size == 0) {
        return;
    }

    strncpy(dest, src, dest_size - 1);
    dest[dest_size - 1] = '\0';
}
