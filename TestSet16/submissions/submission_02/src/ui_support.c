#include "ui_support.h"

#include <stdio.h>
#include <string.h>

void ui_draw_title(const char *text) {
    printf("\n---- %s ----\n", text);
}

void ui_draw_options(const UiEntry *items, int count) {
    int idx;
    for (idx = 0; idx < count; ++idx) {
        printf("[%d] %s\n", items[idx].code, items[idx].text);
    }
}

int ui_read_int(const char *prompt, int *out_value) {
    char line[80];
    int parsed;
    printf("%s", prompt);
    if (!fgets(line, sizeof(line), stdin)) {
        return 0;
    }
    if (sscanf(line, "%d", &parsed) != 1) {
        return 0;
    }
    *out_value = parsed;
    return 1;
}

int ui_read_double(const char *prompt, double *out_value) {
    char line[80];
    double parsed;
    printf("%s", prompt);
    if (!fgets(line, sizeof(line), stdin)) {
        return 0;
    }
    if (sscanf(line, "%lf", &parsed) != 1) {
        return 0;
    }
    *out_value = parsed;
    return 1;
}

void ui_read_text(const char *prompt, char *buffer, size_t size) {
    size_t len;
    printf("%s", prompt);
    if (!fgets(buffer, (int)size, stdin)) {
        buffer[0] = '\0';
        return;
    }
    len = strlen(buffer);
    if (len > 0 && buffer[len - 1] == '\n') {
        buffer[len - 1] = '\0';
    }
}
