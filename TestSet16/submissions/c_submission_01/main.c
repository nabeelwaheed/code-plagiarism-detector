#include "inventory.h"
#include "menu_helpers.h"

#include <stdio.h>

static void do_add(Item **stock) {
    int id;
    int qty;
    double price;
    char name[64];

    if (!ask_int("Enter id: ", &id)) return;
    ask_string("Enter name: ", name, sizeof(name));
    if (!ask_int("Enter quantity: ", &qty)) return;
    if (!ask_double("Enter unit price: ", &price)) return;

    if (!add_or_update_item(stock, id, name, qty, price)) {
        puts("Failed to add item.");
    }
}

static void do_sell(Item *stock) {
    int id;
    int amount;
    if (!ask_int("Enter id: ", &id)) return;
    if (!ask_int("Amount sold: ", &amount)) return;
    if (!sell_item(stock, id, amount)) {
        puts("Sale failed.");
    }
}

static void do_restock(Item *stock) {
    int id;
    int amount;
    if (!ask_int("Enter id: ", &id)) return;
    if (!ask_int("Amount to add: ", &amount)) return;
    if (!restock_item(stock, id, amount)) {
        puts("Restock failed.");
    }
}

int main(void) {
    Item *stock = NULL;
    int running = 1;

    SimpleMenuEntry menu[] = {
        {1, "Load inventory from CSV"},
        {2, "Add or update item"},
        {3, "Sell item"},
        {4, "Restock item"},
        {5, "Remove item"},
        {6, "List inventory"},
        {7, "Low stock report"},
        {8, "Save inventory"},
        {0, "Exit"}
    };

    while (running) {
        int choice;
        show_menu_banner("Inventory Manager");
        show_menu_options(menu, 9);
        if (!ask_int("Choice: ", &choice)) {
            puts("Invalid choice.");
            continue;
        }

        switch (choice) {
            case 1: {
                char path[128];
                ask_string("CSV input path: ", path, sizeof(path));
                puts(load_inventory_csv(path, &stock) ? "Loaded." : "Load failed.");
                break;
            }
            case 2:
                do_add(&stock);
                break;
            case 3:
                do_sell(stock);
                break;
            case 4:
                do_restock(stock);
                break;
            case 5: {
                int id;
                if (!ask_int("ID to remove: ", &id)) break;
                puts(remove_item(&stock, id) ? "Removed." : "Not found.");
                break;
            }
            case 6:
                print_inventory(stock);
                printf("Total stock value: $%.2f\n", inventory_value(stock));
                break;
            case 7: {
                int threshold;
                if (!ask_int("Threshold: ", &threshold)) break;
                print_low_stock(stock, threshold);
                break;
            }
            case 8: {
                char path[128];
                ask_string("CSV output path: ", path, sizeof(path));
                puts(save_inventory_csv(path, stock) ? "Saved." : "Save failed.");
                break;
            }
            case 0:
                running = 0;
                break;
            default:
                puts("Unknown option.");
                break;
        }
    }

    free_inventory(stock);
    return 0;
}
