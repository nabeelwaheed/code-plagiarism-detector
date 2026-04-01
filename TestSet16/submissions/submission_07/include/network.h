#ifndef NETWORK_H
#define NETWORK_H

typedef struct Link {
    int dest;
    struct Link *next;
} Link;

typedef struct {
    int size;
    Link **rows;
} Network;

Network *network_open(int size);
void network_attach(Network *net, int left, int right);
Network *network_read(const char *filename);
void network_close(Network *net);

#endif
