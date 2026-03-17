#include "assignment.h"

int custom_measure(const Student *students, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        if (students[i].grade >= 85) {
            total++;
        }
    }
    return total;
}

int extreme_grade(const Student *students, size_t count) {
    int highest = students[0].grade;
    for (size_t i = 1; i < count; ++i) {
        if (students[i].grade > highest) {
            highest = students[i].grade;
        }
    }
    return highest;
}
