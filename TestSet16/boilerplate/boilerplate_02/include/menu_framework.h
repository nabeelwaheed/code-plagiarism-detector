#ifndef MENU_FRAMEWORK_H
#define MENU_FRAMEWORK_H

typedef int (*MenuAction)(void *ctx);

typedef struct {
    int key;
    const char *label;
    MenuAction action;
} MenuItem;

void menu_print_header(const char *title);
void menu_print_items(const MenuItem *items, int count);
int menu_prompt_choice(void);
int menu_dispatch(const MenuItem *items, int count, int choice, void *ctx);

#endif
