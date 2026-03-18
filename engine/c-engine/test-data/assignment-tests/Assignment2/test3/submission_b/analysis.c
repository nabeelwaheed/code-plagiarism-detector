#include "inventory.h"

int reorder_item_total(const Item *items, size_t count) {
    int total = 0;
    for (size_t index = 0; index < count; ++index) {
        int remaining = items[index].stock - items[index].sold;
        if (remaining < 3) {
            total += 1;
        }
    }
    return total;
}

int total_units_sold(const Item *items, size_t count) {
    int total = 0;
    for (size_t index = 0; index < count; ++index) {
        total += items[index].sold;
    }
    return total;
}
