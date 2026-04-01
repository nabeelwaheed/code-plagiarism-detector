#include "menu_helpers.h"

#include <stdio.h>
#include <string.h>

void show_menu_banner(const char *title) {
    printf("\n==== %s ====\n", title);
}

void show_menu_options(const SimpleMenuEntry *entries, int count) {
    int i;
    for (i = 0; i < count; ++i) {
        printf("%d) %s\n", entries[i].key, entries[i].label);
    }
}

int ask_int(const char *prompt, int *value_out) {
    char line[64];
    int value;

    printf("%s", prompt);
    if (!fgets(line, sizeof(line), stdin)) {
        return 0;
    }

    if (sscanf(line, "%d", &value) != 1) {
        return 0;
    }

    *value_out = value;
    return 1;
}

int ask_double(const char *prompt, double *value_out) {
    char line[64];
    double value;

    printf("%s", prompt);
    if (!fgets(line, sizeof(line), stdin)) {
        return 0;
    }

    if (sscanf(line, "%lf", &value) != 1) {
        return 0;
    }

    *value_out = value;
    return 1;
}

void ask_string(const char *prompt, char *buffer, size_t buffer_size) {
    size_t len;

    printf("%s", prompt);
    if (!fgets(buffer, (int)buffer_size, stdin)) {
        buffer[0] = '\0';
        return;
    }

    len = strlen(buffer);
    if (len > 0 && buffer[len - 1] == '\n') {
        buffer[len - 1] = '\0';
    }
}
