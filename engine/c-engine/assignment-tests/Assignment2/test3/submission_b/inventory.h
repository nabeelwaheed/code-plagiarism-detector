#ifndef INVENTORY_H
#define INVENTORY_H

#include <stddef.h>

typedef struct {
    const char *name;
    int stock;
    int sold;
} Item;

int total_units_sold(const Item *items, size_t count);
int reorder_item_total(const Item *items, size_t count);
void print_report(const Item *items, size_t count);

#endif
