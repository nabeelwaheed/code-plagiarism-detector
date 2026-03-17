#ifndef TEMPLATE_H
#define TEMPLATE_H
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char name[64];
    int marks[4];
    double average;
} StudentRecord;

void print_header(void);
#endif
