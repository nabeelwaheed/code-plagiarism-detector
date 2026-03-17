#include "assignment.h"

#include <stdio.h>
#include <string.h>

void seed_students(Student *students, size_t count) {
    const char *names[] = {"Ana", "Ben", "Cia", "Dev"};
    int grades[] = {82, 67, 91, 74};

    for (size_t i = 0; i < count && i < 4; ++i) {
        strncpy(students[i].name, names[i], sizeof(students[i].name) - 1);
        students[i].name[sizeof(students[i].name) - 1] = '\0';
        students[i].grade = grades[i];
    }
}

void print_students(const Student *students, size_t count) {
    for (size_t i = 0; i < count; ++i) {
        printf("%s:%d\n", students[i].name, students[i].grade);
    }
}
