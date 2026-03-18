#ifndef ASSIGNMENT_H
#define ASSIGNMENT_H

#include <stddef.h>

typedef struct {
    char name[16];
    int grade;
} Student;

void seed_students(Student *students, size_t count);
void print_students(const Student *students, size_t count);

#endif
