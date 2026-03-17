#include "assignment.h"

#include <stdio.h>

int main(void) {
    Student students[4] = {0};
    seed_students(students, 4);
    print_students(students, 4);
    printf(
        "metric=%d extreme=%d\n",
        custom_measure(students, 4),
        extreme_grade(students, 4)
    );
    return 0;
}
