#ifndef GRADEBOOK_H
#define GRADEBOOK_H

#include <stddef.h>

typedef struct {
    char student_id[24];
    char name[64];
    double labs;
    double midterm;
    double final_exam;
    double weighted_average;
    char letter;
} StudentRecord;

int load_gradebook_csv(const char *path, StudentRecord **records_out, size_t *count_out);
void compute_weighted_scores(StudentRecord *records, size_t count);
void sort_by_average_desc(StudentRecord *records, size_t count);
double class_average(const StudentRecord *records, size_t count);
double pass_rate_percent(const StudentRecord *records, size_t count);
int write_grade_report(const char *path, const StudentRecord *records, size_t count);
void print_grade_table(const StudentRecord *records, size_t count);
void free_records(StudentRecord *records);

#endif
