#include "catalog.h"
#include "ui_support.h"

#include <stdio.h>

int main(void) {
    ProductNode *catalog = NULL;
    int continue_loop = 1;
    UiEntry entries[] = {
        {1, "Load from CSV"},
        {2, "Insert or overwrite"},
        {3, "Ship order"},
        {4, "Receive shipment"},
        {5, "Delete by SKU"},
        {6, "Print catalog"},
        {7, "Low stock"},
        {8, "Save to CSV"},
        {0, "Quit"}
    };

    while (continue_loop) {
        int code;
        ui_draw_title("Store Catalog Console");
        ui_draw_options(entries, 9);

        if (!ui_read_int("Command: ", &code)) {
            puts("Please enter a valid number.");
            continue;
        }

        if (code == 0) {
            continue_loop = 0;
        } else if (code == 1) {
            char file[140];
            ui_read_text("CSV file to load: ", file, sizeof(file));
            puts(catalog_load(file, &catalog) ? "load ok" : "load failed");
        } else if (code == 2) {
            int sku;
            int units;
            double cost;
            char title[72];
            if (!ui_read_int("SKU: ", &sku)) continue;
            ui_read_text("Product title: ", title, sizeof(title));
            if (!ui_read_int("Units on hand: ", &units)) continue;
            if (!ui_read_double("Unit cost: ", &cost)) continue;
            puts(catalog_store(&catalog, sku, title, units, cost) ? "stored" : "store failed");
        } else if (code == 3) {
            int sku;
            int units;
            if (!ui_read_int("SKU: ", &sku)) continue;
            if (!ui_read_int("Units to ship: ", &units)) continue;
            puts(catalog_ship(catalog, sku, units) ? "shipment recorded" : "shipment failed");
        } else if (code == 4) {
            int sku;
            int units;
            if (!ui_read_int("SKU: ", &sku)) continue;
            if (!ui_read_int("Units received: ", &units)) continue;
            puts(catalog_receive(catalog, sku, units) ? "receive recorded" : "receive failed");
        } else if (code == 5) {
            int sku;
            if (!ui_read_int("SKU to delete: ", &sku)) continue;
            puts(catalog_delete(&catalog, sku) ? "removed" : "not found");
        } else if (code == 6) {
            catalog_dump(catalog);
            printf("Catalog value: $%.2f\n", catalog_total(catalog));
        } else if (code == 7) {
            int cutoff;
            if (!ui_read_int("Low stock cutoff: ", &cutoff)) continue;
            catalog_low(catalog, cutoff);
        } else if (code == 8) {
            char file[140];
            ui_read_text("CSV file to save: ", file, sizeof(file));
            puts(catalog_save(file, catalog) ? "save ok" : "save failed");
        } else {
            puts("unknown command");
        }
    }

    catalog_release(catalog);
    return 0;
}
