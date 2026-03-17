#ifndef TEMPLATE_H
#define TEMPLATE_H
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

typedef struct {
    int start;
    int end;
    int partial_count;
} WorkChunk;

void print_usage(void);
#endif
