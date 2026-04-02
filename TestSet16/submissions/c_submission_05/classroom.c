#include "classroom.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char letter_from_score(double score) {
    if (score >= 80.0) return 'A';
    if (score >= 70.0) return 'B';
    if (score >= 60.0) return 'C';
    if (score >= 50.0) return 'D';
    return 'F';
}

int gradelist_init(GradeList *list) {
    list->items = (GradeEntry *)malloc(16 * sizeof(GradeEntry));
    if (!list->items) {
        return 0;
    }
    list->count = 0;
    list->capacity = 16;
    return 1;
}

void gradelist_destroy(GradeList *list) {
    free(list->items);
    list->items = NULL;
    list->count = 0;
    list->capacity = 0;
}

int gradelist_push(GradeList *list, const GradeEntry *entry) {
    if (list->count == list->capacity) {
        size_t new_cap = list->capacity * 2;
        GradeEntry *bigger = (GradeEntry *)realloc(list->items, new_cap * sizeof(GradeEntry));
        if (!bigger) {
            return 0;
        }
        list->items = bigger;
        list->capacity = new_cap;
    }

    list->items[list->count++] = *entry;
    return 1;
}

int gradelist_load_csv(GradeList *list, const char *file_path) {
    FILE *fp = fopen(file_path, "r");
    char line[300];

    if (!fp) {
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        GradeEntry row;
        if (sscanf(line, "%23[^,],%63[^,],%lf,%lf,%lf", row.id, row.student,
                   &row.assignment, &row.mid, &row.exam) == 5) {
            row.final_score = 0.0;
            row.final_letter = 'F';
            if (!gradelist_push(list, &row)) {
                fclose(fp);
                return 0;
            }
        }
    }

    fclose(fp);
    return 1;
}

void gradelist_calculate(GradeList *list) {
    size_t i;
    for (i = 0; i < list->count; ++i) {
        double weighted = list->items[i].assignment * 0.40
                        + list->items[i].mid * 0.25
                        + list->items[i].exam * 0.35;
        list->items[i].final_score = weighted;
        list->items[i].final_letter = letter_from_score(weighted);
    }
}

void gradelist_sort(GradeList *list) {
    size_t i;
    for (i = 1; i < list->count; ++i) {
        GradeEntry key = list->items[i];
        size_t j = i;
        while (j > 0 && list->items[j - 1].final_score < key.final_score) {
            list->items[j] = list->items[j - 1];
            --j;
        }
        list->items[j] = key;
    }
}

double gradelist_average(const GradeList *list) {
    size_t i;
    double total = 0.0;
    if (list->count == 0) {
        return 0.0;
    }
    for (i = 0; i < list->count; ++i) {
        total += list->items[i].final_score;
    }
    return total / (double)list->count;
}

double gradelist_pass_rate(const GradeList *list) {
    size_t i;
    size_t pass = 0;
    if (list->count == 0) {
        return 0.0;
    }
    for (i = 0; i < list->count; ++i) {
        if (list->items[i].final_score >= 50.0) {
            ++pass;
        }
    }
    return 100.0 * (double)pass / (double)list->count;
}

void gradelist_print(const GradeList *list) {
    size_t i;
    puts("\nID         Student                Final      Grade");
    puts("---------------------------------------------------");
    for (i = 0; i < list->count; ++i) {
        printf("%-10s %-22s %-10.2f %c\n", list->items[i].id,
               list->items[i].student,
               list->items[i].final_score,
               list->items[i].final_letter);
    }
}

int gradelist_write(const GradeList *list, const char *file_path) {
    FILE *fp = fopen(file_path, "w");
    size_t i;
    if (!fp) {
        return 0;
    }

    fprintf(fp, "id,name,final_score,grade\n");
    for (i = 0; i < list->count; ++i) {
        fprintf(fp, "%s,%s,%.2f,%c\n", list->items[i].id,
                list->items[i].student,
                list->items[i].final_score,
                list->items[i].final_letter);
    }

    fclose(fp);
    return 1;
}
