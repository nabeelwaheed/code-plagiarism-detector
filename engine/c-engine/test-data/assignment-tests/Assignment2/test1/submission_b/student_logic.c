#include "assignment.h"

int count_probation(const Student *students, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        if (students[i].grade < 60) {
            total++;
        }
    }
    return total;
}

int lowest_grade(const Student *students, size_t count) {
    int lowest = students[0].grade;
    for (size_t i = 1; i < count; ++i) {
        if (students[i].grade < lowest) {
            lowest = students[i].grade;
        }
    }
    return lowest;
}
