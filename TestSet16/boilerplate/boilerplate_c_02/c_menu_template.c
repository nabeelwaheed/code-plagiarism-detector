#include "c_menu_template.h"

#include <stdio.h>

void c_menu_print_title(const char *title) {
    printf("\n=== %s ===\n", title);
}

void c_menu_print_items(const CMenuItem *items, int count) {
    int i;
    for (i = 0; i < count; ++i) {
        printf("%d) %s\n", items[i].key, items[i].label);
    }
}

int c_menu_read_choice(void) {
    int value;
    printf("Choice: ");
    if (scanf("%d", &value) != 1) {
        return -1;
    }
    return value;
}
