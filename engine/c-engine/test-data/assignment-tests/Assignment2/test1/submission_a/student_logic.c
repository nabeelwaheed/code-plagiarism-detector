#include "assignment.h"

int count_honours(const Student *students, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        if (students[i].grade >= 80) {
            total++;
        }
    }
    return total;
}

int average_grade(const Student *students, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        total += students[i].grade;
    }
    return total / (int)count;
}
