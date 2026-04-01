#include "network.h"

#include <stdio.h>
#include <stdlib.h>

static Link *make_link(int dest, Link *next) {
    Link *node = (Link *)malloc(sizeof(Link));
    if (!node) {
        return NULL;
    }
    node->dest = dest;
    node->next = next;
    return node;
}

Network *network_open(int size) {
    Network *net;
    int i;

    if (size <= 0) {
        return NULL;
    }

    net = (Network *)malloc(sizeof(Network));
    if (!net) {
        return NULL;
    }

    net->rows = (Link **)malloc((size_t)size * sizeof(Link *));
    if (!net->rows) {
        free(net);
        return NULL;
    }

    for (i = 0; i < size; ++i) {
        net->rows[i] = NULL;
    }

    net->size = size;
    return net;
}

void network_attach(Network *net, int left, int right) {
    Link *one;
    Link *two;

    if (!net) {
        return;
    }

    if (left < 0 || right < 0 || left >= net->size || right >= net->size) {
        return;
    }

    one = make_link(right, net->rows[left]);
    two = make_link(left, net->rows[right]);
    if (!one || !two) {
        free(one);
        free(two);
        return;
    }

    net->rows[left] = one;
    net->rows[right] = two;
}

Network *network_read(const char *filename) {
    FILE *fp = fopen(filename, "r");
    int vertices;
    int edges;
    int idx;
    Network *net;

    if (!fp) {
        return NULL;
    }

    if (fscanf(fp, "%d %d", &vertices, &edges) != 2) {
        fclose(fp);
        return NULL;
    }

    net = network_open(vertices);
    if (!net) {
        fclose(fp);
        return NULL;
    }

    for (idx = 0; idx < edges; ++idx) {
        int left;
        int right;
        if (fscanf(fp, "%d %d", &left, &right) != 2) {
            break;
        }
        network_attach(net, left, right);
    }

    fclose(fp);
    return net;
}

void network_close(Network *net) {
    int i;
    if (!net) {
        return;
    }

    for (i = 0; i < net->size; ++i) {
        Link *cursor = net->rows[i];
        while (cursor) {
            Link *next = cursor->next;
            free(cursor);
            cursor = next;
        }
    }

    free(net->rows);
    free(net);
}
