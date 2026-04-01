#ifndef COURSEBOOK_H
#define COURSEBOOK_H

#include <stddef.h>

typedef struct {
    char sid[24];
    char full_name[64];
    double lab_mark;
    double term_mark;
    double exam_mark;
    double final_mark;
    char band;
} CourseRow;

int coursebook_read(const char *path, CourseRow **rows_out, size_t *nrows_out);
void coursebook_calculate(CourseRow *rows, size_t nrows);
void coursebook_rank(CourseRow *rows, size_t nrows);
double coursebook_mean(const CourseRow *rows, size_t nrows);
double coursebook_success(const CourseRow *rows, size_t nrows);
int coursebook_export(const char *path, const CourseRow *rows, size_t nrows);
void coursebook_show(const CourseRow *rows, size_t nrows);
void coursebook_free(CourseRow *rows);

#endif
