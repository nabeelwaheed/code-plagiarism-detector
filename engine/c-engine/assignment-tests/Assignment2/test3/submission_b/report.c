#include "inventory.h"

#include <stdio.h>

void print_report(const Item *items, size_t count) {
    int sold = total_units_sold(items, count);
    int reorder = reorder_item_total(items, count);
    printf("sold=%d reorder=%d\n", sold, reorder);
}
