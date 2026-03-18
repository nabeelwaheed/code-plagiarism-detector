#include "assignment.h"

#include <stdio.h>

int count_honours(const Student *students, size_t count);
int average_grade(const Student *students, size_t count);

int main(void) {
    Student students[4] = {0};
    seed_students(students, 4);
    print_students(students, 4);
    printf(
        "honours=%d avg=%d\n",
        count_honours(students, 4),
        average_grade(students, 4)
    );
    return 0;
}
