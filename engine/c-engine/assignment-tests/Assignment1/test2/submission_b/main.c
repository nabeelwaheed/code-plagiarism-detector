#include <stdio.h>
#define HOT_LIMIT 30

static int compute_total(const int *values, size_t length)
{
    int combined = 0;
    size_t cursor = 0;
    while (cursor < length) {
        combined += values[cursor];
        ++cursor;
    }
    return combined;
}

static int count_above_limit(const int *values, size_t length)
{
    int flagged = 0;
    for (size_t cursor = 0; cursor < length; ++cursor) {
        if (values[cursor] >= HOT_LIMIT) {
            flagged = flagged + 1;
        }
    }
    return flagged;
}

static int find_peak(const int *values, size_t length)
{
    int current_peak = values[0];
    for (size_t cursor = 1; cursor < length; ++cursor) {
        if (values[cursor] > current_peak) {
            current_peak = values[cursor];
        }
    }
    return current_peak;
}

static void show_summary(const int *values, size_t length)
{
    int mean = compute_total(values, length) / (int)length;
    printf(
        "avg=%d hot=%d high=%d\n",
        mean,
        count_above_limit(values, length),
        find_peak(values, length)
    );
}

int main(void)
{
    int values[] = {14, 26, 29, 33, 37, 25};
    size_t length = sizeof(values) / sizeof(values[0]);
    show_summary(values, length);
    return 0;
}
