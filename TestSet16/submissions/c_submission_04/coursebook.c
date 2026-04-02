#include "coursebook.h"

#include <stdio.h>
#include <stdlib.h>

static char to_band(double score) {
    return (score >= 80.0) ? 'A' :
           (score >= 70.0) ? 'B' :
           (score >= 60.0) ? 'C' :
           (score >= 50.0) ? 'D' : 'F';
}

int coursebook_read(const char *path, CourseRow **rows_out, size_t *nrows_out) {
    FILE *fp = fopen(path, "r");
    CourseRow *rows = NULL;
    size_t used = 0;
    size_t cap = 8;
    char line[300];

    if (!fp) {
        return 0;
    }

    rows = (CourseRow *)malloc(cap * sizeof(CourseRow));
    if (!rows) {
        fclose(fp);
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        CourseRow row;
        int ok = sscanf(line, "%23[^,],%63[^,],%lf,%lf,%lf", row.sid, row.full_name,
                        &row.lab_mark, &row.term_mark, &row.exam_mark);
        if (ok != 5) {
            continue;
        }

        if (used == cap) {
            CourseRow *expanded;
            cap *= 2;
            expanded = (CourseRow *)realloc(rows, cap * sizeof(CourseRow));
            if (!expanded) {
                free(rows);
                fclose(fp);
                return 0;
            }
            rows = expanded;
        }

        row.final_mark = 0.0;
        row.band = 'F';
        rows[used++] = row;
    }

    fclose(fp);
    *rows_out = rows;
    *nrows_out = used;
    return 1;
}

void coursebook_calculate(CourseRow *rows, size_t nrows) {
    size_t i = 0;
    while (i < nrows) {
        double mark = rows[i].lab_mark * 0.40 + rows[i].term_mark * 0.25 + rows[i].exam_mark * 0.35;
        rows[i].final_mark = mark;
        rows[i].band = to_band(mark);
        ++i;
    }
}

void coursebook_rank(CourseRow *rows, size_t nrows) {
    size_t i;
    for (i = 0; i + 1 < nrows; ++i) {
        size_t best = i;
        size_t j;
        for (j = i + 1; j < nrows; ++j) {
            if (rows[j].final_mark > rows[best].final_mark) {
                best = j;
            }
        }
        if (best != i) {
            CourseRow temp = rows[i];
            rows[i] = rows[best];
            rows[best] = temp;
        }
    }
}

double coursebook_mean(const CourseRow *rows, size_t nrows) {
    double total = 0.0;
    size_t i;

    if (nrows == 0) {
        return 0.0;
    }

    for (i = 0; i < nrows; ++i) {
        total += rows[i].final_mark;
    }

    return total / (double)nrows;
}

double coursebook_success(const CourseRow *rows, size_t nrows) {
    size_t i;
    size_t passed = 0;

    if (nrows == 0) {
        return 0.0;
    }

    for (i = 0; i < nrows; ++i) {
        if (rows[i].final_mark >= 50.0) {
            passed++;
        }
    }

    return (double)passed * 100.0 / (double)nrows;
}

int coursebook_export(const char *path, const CourseRow *rows, size_t nrows) {
    FILE *fp = fopen(path, "w");
    size_t i;

    if (!fp) {
        return 0;
    }

    fprintf(fp, "student_id,name,final_mark,letter\n");
    for (i = 0; i < nrows; ++i) {
        fprintf(fp, "%s,%s,%.2f,%c\n", rows[i].sid, rows[i].full_name, rows[i].final_mark, rows[i].band);
    }

    fclose(fp);
    return 1;
}

void coursebook_show(const CourseRow *rows, size_t nrows) {
    size_t i;
    puts("\nID         Name                   Final      Grade");
    puts("---------------------------------------------------");
    for (i = 0; i < nrows; ++i) {
        printf("%-10s %-22s %-10.2f %c\n", rows[i].sid, rows[i].full_name, rows[i].final_mark, rows[i].band);
    }
}

void coursebook_free(CourseRow *rows) {
    free(rows);
}
