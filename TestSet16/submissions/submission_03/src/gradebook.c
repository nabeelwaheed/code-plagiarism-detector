#include "gradebook.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char letter_for_score(double value) {
    if (value >= 80.0) return 'A';
    if (value >= 70.0) return 'B';
    if (value >= 60.0) return 'C';
    if (value >= 50.0) return 'D';
    return 'F';
}

int load_gradebook_csv(const char *path, StudentRecord **records_out, size_t *count_out) {
    FILE *fp = fopen(path, "r");
    StudentRecord *records = NULL;
    size_t count = 0;
    size_t cap = 0;
    char line[320];

    if (!fp) {
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        StudentRecord row;
        if (sscanf(line, "%23[^,],%63[^,],%lf,%lf,%lf", row.student_id, row.name,
                   &row.labs, &row.midterm, &row.final_exam) != 5) {
            continue;
        }

        if (count == cap) {
            StudentRecord *grown;
            cap = cap == 0 ? 16 : cap * 2;
            grown = (StudentRecord *)realloc(records, cap * sizeof(StudentRecord));
            if (!grown) {
                free(records);
                fclose(fp);
                return 0;
            }
            records = grown;
        }

        row.weighted_average = 0.0;
        row.letter = 'F';
        records[count++] = row;
    }

    fclose(fp);
    *records_out = records;
    *count_out = count;
    return 1;
}

void compute_weighted_scores(StudentRecord *records, size_t count) {
    size_t i;
    for (i = 0; i < count; ++i) {
        double weighted = records[i].labs * 0.40 + records[i].midterm * 0.25 + records[i].final_exam * 0.35;
        records[i].weighted_average = weighted;
        records[i].letter = letter_for_score(weighted);
    }
}

void sort_by_average_desc(StudentRecord *records, size_t count) {
    size_t i;
    size_t j;
    for (i = 0; i < count; ++i) {
        for (j = i + 1; j < count; ++j) {
            if (records[j].weighted_average > records[i].weighted_average) {
                StudentRecord tmp = records[i];
                records[i] = records[j];
                records[j] = tmp;
            }
        }
    }
}

double class_average(const StudentRecord *records, size_t count) {
    size_t i;
    double sum = 0.0;
    if (count == 0) {
        return 0.0;
    }

    for (i = 0; i < count; ++i) {
        sum += records[i].weighted_average;
    }

    return sum / (double)count;
}

double pass_rate_percent(const StudentRecord *records, size_t count) {
    size_t i;
    size_t pass = 0;

    if (count == 0) {
        return 0.0;
    }

    for (i = 0; i < count; ++i) {
        if (records[i].weighted_average >= 50.0) {
            ++pass;
        }
    }

    return 100.0 * (double)pass / (double)count;
}

int write_grade_report(const char *path, const StudentRecord *records, size_t count) {
    FILE *fp = fopen(path, "w");
    size_t i;

    if (!fp) {
        return 0;
    }

    fprintf(fp, "StudentID,Name,Weighted,Letter\n");
    for (i = 0; i < count; ++i) {
        fprintf(fp, "%s,%s,%.2f,%c\n", records[i].student_id, records[i].name,
                records[i].weighted_average, records[i].letter);
    }

    fclose(fp);
    return 1;
}

void print_grade_table(const StudentRecord *records, size_t count) {
    size_t i;
    printf("\n%-10s %-22s %-10s %-6s\n", "ID", "Name", "Average", "Grade");
    printf("------------------------------------------------------\n");
    for (i = 0; i < count; ++i) {
        printf("%-10s %-22s %-10.2f %-6c\n", records[i].student_id, records[i].name,
               records[i].weighted_average, records[i].letter);
    }
}

void free_records(StudentRecord *records) {
    free(records);
}
