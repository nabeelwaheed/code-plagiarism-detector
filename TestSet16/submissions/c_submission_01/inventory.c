#include "inventory.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static Item *create_item(int id, const char *name, int quantity, double unit_price) {
    Item *node = (Item *)malloc(sizeof(Item));
    if (!node) {
        return NULL;
    }

    node->id = id;
    strncpy(node->name, name, sizeof(node->name) - 1U);
    node->name[sizeof(node->name) - 1U] = '\0';
    node->quantity = quantity;
    node->unit_price = unit_price;
    node->next = NULL;
    return node;
}

Item *find_item(Item *head, int id) {
    while (head) {
        if (head->id == id) {
            return head;
        }
        head = head->next;
    }
    return NULL;
}

int add_or_update_item(Item **head, int id, const char *name, int quantity, double unit_price) {
    Item *existing = find_item(*head, id);
    if (existing) {
        strncpy(existing->name, name, sizeof(existing->name) - 1U);
        existing->name[sizeof(existing->name) - 1U] = '\0';
        existing->quantity = quantity;
        existing->unit_price = unit_price;
        return 1;
    }

    Item *node = create_item(id, name, quantity, unit_price);
    if (!node) {
        return 0;
    }

    node->next = *head;
    *head = node;
    return 1;
}

int remove_item(Item **head, int id) {
    Item *current = *head;
    Item *previous = NULL;

    while (current) {
        if (current->id == id) {
            if (previous) {
                previous->next = current->next;
            } else {
                *head = current->next;
            }
            free(current);
            return 1;
        }
        previous = current;
        current = current->next;
    }

    return 0;
}

int sell_item(Item *head, int id, int amount) {
    Item *item = find_item(head, id);
    if (!item || amount <= 0 || item->quantity < amount) {
        return 0;
    }
    item->quantity -= amount;
    return 1;
}

int restock_item(Item *head, int id, int amount) {
    Item *item = find_item(head, id);
    if (!item || amount <= 0) {
        return 0;
    }
    item->quantity += amount;
    return 1;
}

void print_inventory(Item *head) {
    printf("\n%-6s %-24s %-10s %-10s\n", "ID", "Name", "Quantity", "Price");
    printf("-----------------------------------------------------\n");
    while (head) {
        printf("%-6d %-24s %-10d $%-9.2f\n", head->id, head->name, head->quantity, head->unit_price);
        head = head->next;
    }
}

void print_low_stock(Item *head, int threshold) {
    puts("Low stock items:");
    while (head) {
        if (head->quantity <= threshold) {
            printf("- %s (id=%d, qty=%d)\n", head->name, head->id, head->quantity);
        }
        head = head->next;
    }
}

double inventory_value(Item *head) {
    double total = 0.0;
    while (head) {
        total += head->unit_price * (double)head->quantity;
        head = head->next;
    }
    return total;
}

int load_inventory_csv(const char *path, Item **head) {
    FILE *fp = fopen(path, "r");
    char line[256];

    if (!fp) {
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        int id;
        int qty;
        double price;
        char name[64];
        if (sscanf(line, "%d,%63[^,],%d,%lf", &id, name, &qty, &price) == 4) {
            if (!add_or_update_item(head, id, name, qty, price)) {
                fclose(fp);
                return 0;
            }
        }
    }

    fclose(fp);
    return 1;
}

int save_inventory_csv(const char *path, Item *head) {
    FILE *fp = fopen(path, "w");

    if (!fp) {
        return 0;
    }

    while (head) {
        fprintf(fp, "%d,%s,%d,%.2f\n", head->id, head->name, head->quantity, head->unit_price);
        head = head->next;
    }

    fclose(fp);
    return 1;
}

void free_inventory(Item *head) {
    while (head) {
        Item *next = head->next;
        free(head);
        head = next;
    }
}
