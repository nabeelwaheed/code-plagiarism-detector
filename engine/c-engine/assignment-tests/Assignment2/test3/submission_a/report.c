#include "inventory.h"

#include <stdio.h>

void print_report(const Item *items, size_t count) {
    printf(
        "sold=%d reorder=%d\n",
        total_sold(items, count),
        items_to_reorder(items, count)
    );
}
