#include "catalog.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static ProductNode *new_product(int sku, const char *title, int on_hand, double cost) {
    ProductNode *node = (ProductNode *)malloc(sizeof(ProductNode));
    if (!node) {
        return NULL;
    }
    node->sku = sku;
    strncpy(node->title, title, sizeof(node->title) - 1U);
    node->title[sizeof(node->title) - 1U] = '\0';
    node->on_hand = on_hand;
    node->cost = cost;
    node->link = NULL;
    return node;
}

ProductNode *catalog_lookup(ProductNode *root, int sku) {
    for (; root != NULL; root = root->link) {
        if (root->sku == sku) {
            return root;
        }
    }
    return NULL;
}

int catalog_store(ProductNode **root, int sku, const char *title, int on_hand, double cost) {
    ProductNode *entry = catalog_lookup(*root, sku);
    if (entry) {
        strncpy(entry->title, title, sizeof(entry->title) - 1U);
        entry->title[sizeof(entry->title) - 1U] = '\0';
        entry->on_hand = on_hand;
        entry->cost = cost;
        return 1;
    }

    entry = new_product(sku, title, on_hand, cost);
    if (!entry) {
        return 0;
    }

    entry->link = *root;
    *root = entry;
    return 1;
}

int catalog_delete(ProductNode **root, int sku) {
    ProductNode *curr = *root;
    ProductNode *prev = NULL;

    while (curr != NULL) {
        if (curr->sku == sku) {
            if (prev == NULL) {
                *root = curr->link;
            } else {
                prev->link = curr->link;
            }
            free(curr);
            return 1;
        }
        prev = curr;
        curr = curr->link;
    }

    return 0;
}

int catalog_ship(ProductNode *root, int sku, int units) {
    ProductNode *entry = catalog_lookup(root, sku);
    if (!entry || units <= 0 || entry->on_hand < units) {
        return 0;
    }
    entry->on_hand -= units;
    return 1;
}

int catalog_receive(ProductNode *root, int sku, int units) {
    ProductNode *entry = catalog_lookup(root, sku);
    if (!entry || units <= 0) {
        return 0;
    }
    entry->on_hand += units;
    return 1;
}

void catalog_dump(ProductNode *root) {
    puts("\nSKU    Product                  Units      Cost");
    puts("-----------------------------------------------");
    for (; root != NULL; root = root->link) {
        printf("%-6d %-24s %-10d $%-8.2f\n", root->sku, root->title, root->on_hand, root->cost);
    }
}

void catalog_low(ProductNode *root, int cutoff) {
    for (; root != NULL; root = root->link) {
        if (root->on_hand <= cutoff) {
            printf("low: %s (sku=%d, units=%d)\n", root->title, root->sku, root->on_hand);
        }
    }
}

double catalog_total(ProductNode *root) {
    double sum = 0.0;
    for (; root != NULL; root = root->link) {
        sum += root->cost * (double)root->on_hand;
    }
    return sum;
}

int catalog_load(const char *filename, ProductNode **root) {
    FILE *fp = fopen(filename, "r");
    char line[260];

    if (!fp) {
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        int sku;
        int units;
        double cost;
        char title[72];

        if (sscanf(line, "%d,%71[^,],%d,%lf", &sku, title, &units, &cost) == 4) {
            if (!catalog_store(root, sku, title, units, cost)) {
                fclose(fp);
                return 0;
            }
        }
    }

    fclose(fp);
    return 1;
}

int catalog_save(const char *filename, ProductNode *root) {
    FILE *fp = fopen(filename, "w");
    if (!fp) {
        return 0;
    }

    while (root != NULL) {
        fprintf(fp, "%d,%s,%d,%.2f\n", root->sku, root->title, root->on_hand, root->cost);
        root = root->link;
    }

    fclose(fp);
    return 1;
}

void catalog_release(ProductNode *root) {
    while (root != NULL) {
        ProductNode *next = root->link;
        free(root);
        root = next;
    }
}
