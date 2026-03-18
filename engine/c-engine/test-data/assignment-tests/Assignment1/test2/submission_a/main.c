#include <stdio.h>

#define HOT_LIMIT 30

static int calculate_total(const int *readings, size_t count) {
    int total = 0;
    for (size_t i = 0; i < count; ++i) {
        total += readings[i];
    }
    return total;
}

static int days_over_limit(const int *readings, size_t count) {
    int days = 0;
    for (size_t i = 0; i < count; ++i) {
        if (readings[i] >= HOT_LIMIT) {
            days++;
        }
    }
    return days;
}

static int peak_value(const int *readings, size_t count) {
    int peak = readings[0];
    for (size_t i = 1; i < count; ++i) {
        if (readings[i] > peak) {
            peak = readings[i];
        }
    }
    return peak;
}

static void emit_summary(const int *readings, size_t count) {
    int average = calculate_total(readings, count) / (int)count;
    printf("avg=%d hot=%d high=%d\n", average, days_over_limit(readings, count), peak_value(readings, count));
}

int main(void) {
    int readings[] = {14, 26, 29, 33, 37, 25};
    size_t count = sizeof(readings) / sizeof(readings[0]);
    emit_summary(readings, count);
    return 0;
}
