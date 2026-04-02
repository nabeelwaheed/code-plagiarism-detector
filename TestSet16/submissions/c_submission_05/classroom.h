#ifndef CLASSROOM_H
#define CLASSROOM_H

#include <stddef.h>

typedef struct {
    char id[24];
    char student[64];
    double assignment;
    double mid;
    double exam;
    double final_score;
    char final_letter;
} GradeEntry;

typedef struct {
    GradeEntry *items;
    size_t count;
    size_t capacity;
} GradeList;

int gradelist_init(GradeList *list);
void gradelist_destroy(GradeList *list);
int gradelist_push(GradeList *list, const GradeEntry *entry);
int gradelist_load_csv(GradeList *list, const char *file_path);
void gradelist_calculate(GradeList *list);
void gradelist_sort(GradeList *list);
double gradelist_average(const GradeList *list);
double gradelist_pass_rate(const GradeList *list);
void gradelist_print(const GradeList *list);
int gradelist_write(const GradeList *list, const char *file_path);

#endif
