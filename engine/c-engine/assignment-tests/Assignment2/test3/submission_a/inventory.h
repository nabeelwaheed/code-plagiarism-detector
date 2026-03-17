#ifndef INVENTORY_H
#define INVENTORY_H

#include <stddef.h>

typedef struct {
    const char *name;
    int stock;
    int sold;
} Item;

int total_sold(const Item *items, size_t count);
int items_to_reorder(const Item *items, size_t count);
void print_report(const Item *items, size_t count);

#endif
