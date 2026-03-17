#include <stdio.h>

#define HOT_LIMIT 30

typedef struct {
    int total;
    int hottest;
    int hot_days;
} Stats;

static Stats summarize_days(const int *series, size_t length) {
    Stats summary = {0, series[0], 0};
    for (size_t cursor = 0; cursor < length; ++cursor) {
        int current = series[cursor];
        summary.total += current;
        if (current > summary.hottest) {
            summary.hottest = current;
        }
        if (current >= HOT_LIMIT) {
            summary.hot_days++;
        }
    }
    return summary;
}

static void emit_summary(const Stats *summary, size_t length) {
    int average = summary->total / (int)length;
    printf("avg=%d hot=%d high=%d\n", average, summary->hot_days, summary->hottest);
}

int main(void) {
    int series[] = {16, 22, 31, 28, 33, 27, 35};
    size_t length = sizeof(series) / sizeof(series[0]);
    Stats summary = summarize_days(series, length);
    emit_summary(&summary, length);
    return 0;
}
