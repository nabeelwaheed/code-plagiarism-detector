#ifndef UI_SUPPORT_H
#define UI_SUPPORT_H

#include <stddef.h>

typedef struct {
    int code;
    const char *text;
} UiEntry;

void ui_draw_title(const char *text);
void ui_draw_options(const UiEntry *items, int count);
int ui_read_int(const char *prompt, int *out_value);
int ui_read_double(const char *prompt, double *out_value);
void ui_read_text(const char *prompt, char *buffer, size_t size);

#endif
