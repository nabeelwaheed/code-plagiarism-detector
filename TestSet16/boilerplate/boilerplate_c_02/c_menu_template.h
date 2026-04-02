#ifndef C_MENU_TEMPLATE_H
#define C_MENU_TEMPLATE_H

typedef struct {
    int key;
    const char *label;
} CMenuItem;

void c_menu_print_title(const char *title);
void c_menu_print_items(const CMenuItem *items, int count);
int c_menu_read_choice(void);

#endif
