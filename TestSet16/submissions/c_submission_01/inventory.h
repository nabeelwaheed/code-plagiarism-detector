#ifndef INVENTORY_H
#define INVENTORY_H

#include <stddef.h>

typedef struct Item {
    int id;
    char name[64];
    int quantity;
    double unit_price;
    struct Item *next;
} Item;

Item *find_item(Item *head, int id);
int add_or_update_item(Item **head, int id, const char *name, int quantity, double unit_price);
int remove_item(Item **head, int id);
int sell_item(Item *head, int id, int amount);
int restock_item(Item *head, int id, int amount);
void print_inventory(Item *head);
void print_low_stock(Item *head, int threshold);
double inventory_value(Item *head);
int load_inventory_csv(const char *path, Item **head);
int save_inventory_csv(const char *path, Item *head);
void free_inventory(Item *head);

#endif
