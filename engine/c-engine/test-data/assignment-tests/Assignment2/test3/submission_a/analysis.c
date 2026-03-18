#include "inventory.h"

int total_sold(const Item *items, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        total += items[i].sold;
    }
    return total;
}

int items_to_reorder(const Item *items, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        int remaining = items[i].stock - items[i].sold;
        if (remaining < 3) {
            total++;
        }
    }
    return total;
}
