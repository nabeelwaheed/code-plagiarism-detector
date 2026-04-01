#ifndef CATALOG_H
#define CATALOG_H

typedef struct ProductNode {
    int sku;
    char title[72];
    int on_hand;
    double cost;
    struct ProductNode *link;
} ProductNode;

ProductNode *catalog_lookup(ProductNode *root, int sku);
int catalog_store(ProductNode **root, int sku, const char *title, int on_hand, double cost);
int catalog_delete(ProductNode **root, int sku);
int catalog_ship(ProductNode *root, int sku, int units);
int catalog_receive(ProductNode *root, int sku, int units);
void catalog_dump(ProductNode *root);
void catalog_low(ProductNode *root, int cutoff);
double catalog_total(ProductNode *root);
int catalog_load(const char *filename, ProductNode **root);
int catalog_save(const char *filename, ProductNode *root);
void catalog_release(ProductNode *root);

#endif
