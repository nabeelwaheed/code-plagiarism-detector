#include "assignment.h"

#include <stdio.h>

int count_probation(const Student *students, size_t count);
int lowest_grade(const Student *students, size_t count);

int main(void) {
    Student students[4] = {0};
    seed_students(students, 4);
    print_students(students, 4);
    printf(
        "probation=%d low=%d\n",
        count_probation(students, 4),
        lowest_grade(students, 4)
    );
    return 0;
}
