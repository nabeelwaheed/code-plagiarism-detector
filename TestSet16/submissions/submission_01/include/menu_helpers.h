#ifndef MENU_HELPERS_H
#define MENU_HELPERS_H

#include <stddef.h>

typedef struct {
    int key;
    const char *label;
} SimpleMenuEntry;

void show_menu_banner(const char *title);
void show_menu_options(const SimpleMenuEntry *entries, int count);
int ask_int(const char *prompt, int *value_out);
int ask_double(const char *prompt, double *value_out);
void ask_string(const char *prompt, char *buffer, size_t buffer_size);

#endif
