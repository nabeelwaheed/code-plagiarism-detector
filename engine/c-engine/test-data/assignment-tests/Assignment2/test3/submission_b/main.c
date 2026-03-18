#include "inventory.h"

int main(void) {
    Item items[] = {
        {"pens", 8, 3},
        {"pads", 6, 4},
        {"clips", 5, 1},
        {"tabs", 3, 2}
    };
    print_report(items, sizeof(items) / sizeof(items[0]));
    return 0;
}
