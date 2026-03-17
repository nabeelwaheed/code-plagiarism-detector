#include <stdio.h>

#define HOT_LIMIT 30

static int sum_readings(const int *readings, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        total += readings[i];
    }
    return total;
}

static int count_hot_days(const int *readings, size_t count) {
    int hot_days = 0;
    for (size_t i = 0; i < count; ++i) {
        if (readings[i] >= HOT_LIMIT) {
            hot_days++;
        }
    }
    return hot_days;
}

static int highest_reading(const int *readings, size_t count) {
    int highest = readings[0];
    for (size_t i = 1; i < count; ++i) {
        if (readings[i] > highest) {
            highest = readings[i];
        }
    }
    return highest;
}

static void print_report(const int *readings, size_t count) {
    int average = sum_readings(readings, count) / (int)count;
    printf(
        "avg=%d hot=%d high=%d\n",
        average,
        count_hot_days(readings, count),
        highest_reading(readings, count)
    );
}

int main(void) {
    int readings[] = {18, 27, 32, 31, 24, 35};
    size_t count = sizeof(readings) / sizeof(readings[0]);
    print_report(readings, count);
    return 0;
}
