#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char **items;
    size_t count;
    size_t capacity;
} LineArray;

static int line_array_init(LineArray *arr) {
    arr->items = (char **)malloc(32 * sizeof(char *));
    if (!arr->items) {
        return 0;
    }
    arr->count = 0;
    arr->capacity = 32;
    return 1;
}

static void line_array_free(LineArray *arr) {
    size_t i;
    for (i = 0; i < arr->count; ++i) {
        free(arr->items[i]);
    }
    free(arr->items);
}

static int line_array_push(LineArray *arr, const char *text) {
    size_t len;
    char *copy;

    if (arr->count == arr->capacity) {
        size_t grown_cap = arr->capacity * 2;
        char **grown_items = (char **)realloc(arr->items, grown_cap * sizeof(char *));
        if (!grown_items) {
            return 0;
        }
        arr->items = grown_items;
        arr->capacity = grown_cap;
    }

    len = strlen(text);
    copy = (char *)malloc(len + 1);
    if (!copy) {
        return 0;
    }

    memcpy(copy, text, len + 1);
    arr->items[arr->count++] = copy;
    return 1;
}

static void trim_newline(char *text) {
    size_t n = strlen(text);
    while (n > 0 && (text[n - 1] == '\n' || text[n - 1] == '\r')) {
        text[n - 1] = '\0';
        n--;
    }
}

static int load_lines(const char *path, LineArray *arr) {
    FILE *fp = fopen(path, "r");
    char buffer[1024];

    if (!fp) {
        return 0;
    }

    while (fgets(buffer, sizeof(buffer), fp)) {
        trim_newline(buffer);
        if (!line_array_push(arr, buffer)) {
            fclose(fp);
            return 0;
        }
    }

    fclose(fp);
    return 1;
}

int main(int argc, char **argv) {
    LineArray a;
    LineArray b;
    size_t i = 0;
    size_t j = 0;
    int same = 0;
    int only_a = 0;
    int only_b = 0;

    if (argc != 3) {
        fprintf(stderr, "Usage: %s <sorted_file_a> <sorted_file_b>\n", argv[0]);
        return 1;
    }

    if (!line_array_init(&a) || !line_array_init(&b)) {
        fprintf(stderr, "Memory initialization failed\n");
        return 1;
    }

    if (!load_lines(argv[1], &a)) {
        fprintf(stderr, "Unable to load %s\n", argv[1]);
        line_array_free(&a);
        line_array_free(&b);
        return 1;
    }

    if (!load_lines(argv[2], &b)) {
        fprintf(stderr, "Unable to load %s\n", argv[2]);
        line_array_free(&a);
        line_array_free(&b);
        return 1;
    }

    puts("Diff-lite merge output:");
    while (i < a.count && j < b.count) {
        int cmp = strcmp(a.items[i], b.items[j]);
        if (cmp == 0) {
            printf(" SAME   | %s\n", a.items[i]);
            i++;
            j++;
            same++;
        } else if (cmp < 0) {
            printf(" ONLY_A | %s\n", a.items[i]);
            i++;
            only_a++;
        } else {
            printf(" ONLY_B | %s\n", b.items[j]);
            j++;
            only_b++;
        }
    }

    while (i < a.count) {
        printf(" ONLY_A | %s\n", a.items[i]);
        i++;
        only_a++;
    }

    while (j < b.count) {
        printf(" ONLY_B | %s\n", b.items[j]);
        j++;
        only_b++;
    }

    puts("\nSummary:");
    printf("same lines: %d\n", same);
    printf("only in A: %d\n", only_a);
    printf("only in B: %d\n", only_b);
    printf("total compared lines: %zu and %zu\n", a.count, b.count);

    line_array_free(&a);
    line_array_free(&b);
    return 0;
}
