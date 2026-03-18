#include <stdio.h>

#define HOT_LIMIT 30

static int sum_readings(const int *readings, size_t count) {
    int total = 0;
    for (size_t index = 0; index < count; ++index) {
        total += readings[index];
    }
    return total;
}

static int count_hot_days(const int *readings, size_t count) {
    int hot_days = 0;
    for (size_t index = 0; index < count; ++index) {
        if (readings[index] >= HOT_LIMIT) {
            hot_days += 1;
        }
    }
    return hot_days;
}

static int highest_reading(const int *readings, size_t count) {
    int peak = readings[0];
    for (size_t index = 1; index < count; ++index) {
        if (readings[index] > peak) {
            peak = readings[index];
        }
    }
    return peak;
}

static void print_report(const int *readings, size_t count) {
    int average = sum_readings(readings, count) / (int)count;
    int hot = count_hot_days(readings, count);
    int peak = highest_reading(readings, count);
    printf("avg=%d hot=%d high=%d\n", average, hot, peak);
}

int main(void) {
    int readings[] = {18, 27, 32, 31, 24, 35};
    size_t count = sizeof(readings) / sizeof(readings[0]);
    print_report(readings, count);
    return 0;
}
