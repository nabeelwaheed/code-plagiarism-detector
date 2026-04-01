#include "menu_framework.h"

#include <stdio.h>

void menu_print_header(const char *title) {
    printf("\n==== %s ====\n", title);
}

void menu_print_items(const MenuItem *items, int count) {
    int i;
    for (i = 0; i < count; ++i) {
        printf("%d) %s\n", items[i].key, items[i].label);
    }
}

int menu_prompt_choice(void) {
    int value;
    printf("Select option: ");
    if (scanf("%d", &value) != 1) {
        return -1;
    }
    return value;
}

int menu_dispatch(const MenuItem *items, int count, int choice, void *ctx) {
    int i;
    for (i = 0; i < count; ++i) {
        if (items[i].key == choice) {
            return items[i].action(ctx);
        }
    }
    printf("Unknown option: %d\n", choice);
    return 1;
}
