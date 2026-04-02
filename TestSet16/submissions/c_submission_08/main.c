#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    const char *input_path;
    int top_words;
} CliOpts;

typedef struct {
    char word[48];
    int count;
} WordCount;

static int parse_cli(int argc, char **argv, CliOpts *opts) {
    int i;
    opts->input_path = NULL;
    opts->top_words = 10;

    for (i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            opts->input_path = argv[++i];
        } else if (strcmp(argv[i], "-n") == 0 && i + 1 < argc) {
            opts->top_words = atoi(argv[++i]);
        } else {
            return 0;
        }
    }

    return opts->input_path != NULL;
}

static void normalize_token(char *word) {
    size_t r = 0;
    size_t w = 0;
    while (word[r] != '\0') {
        if (isalpha((unsigned char)word[r]) || word[r] == '\'') {
            word[w++] = (char)tolower((unsigned char)word[r]);
        }
        ++r;
    }
    word[w] = '\0';
}

static int count_compare(const void *a, const void *b) {
    const WordCount *wa = (const WordCount *)a;
    const WordCount *wb = (const WordCount *)b;
    if (wb->count != wa->count) {
        return wb->count - wa->count;
    }
    return strcmp(wa->word, wb->word);
}

static int add_word(WordCount *table, int *used, const char *word) {
    int i;
    for (i = 0; i < *used; ++i) {
        if (strcmp(table[i].word, word) == 0) {
            table[i].count += 1;
            return 1;
        }
    }

    if (*used >= 4000) {
        return 0;
    }

    strncpy(table[*used].word, word, sizeof(table[*used].word) - 1U);
    table[*used].word[sizeof(table[*used].word) - 1U] = '\0';
    table[*used].count = 1;
    (*used)++;
    return 1;
}

int main(int argc, char **argv) {
    CliOpts opts;
    FILE *fp;
    char line[512];
    long line_count = 0;
    long char_count = 0;
    long word_total = 0;
    int unique_words = 0;
    int longest_word = 0;
    WordCount *table;

    if (!parse_cli(argc, argv, &opts)) {
        fprintf(stderr, "Usage: %s -i <text_file> [-n top_words]\n", argv[0]);
        return 1;
    }

    fp = fopen(opts.input_path, "r");
    if (!fp) {
        fprintf(stderr, "Cannot open file: %s\n", opts.input_path);
        return 1;
    }

    table = (WordCount *)calloc(4000, sizeof(WordCount));
    if (!table) {
        fclose(fp);
        return 1;
    }

    while (fgets(line, sizeof(line), fp)) {
        char *token;
        line_count++;
        char_count += (long)strlen(line);

        token = strtok(line, " \t\r\n,.;:!?()[]{}\"/");
        while (token) {
            int len;
            normalize_token(token);
            len = (int)strlen(token);
            if (len > 0) {
                word_total++;
                if (len > longest_word) {
                    longest_word = len;
                }
                add_word(table, &unique_words, token);
            }
            token = strtok(NULL, " \t\r\n,.;:!?()[]{}\"/");
        }
    }

    fclose(fp);

    qsort(table, (size_t)unique_words, sizeof(WordCount), count_compare);

    printf("Text statistics for %s\n", opts.input_path);
    printf("Lines: %ld\n", line_count);
    printf("Words: %ld\n", word_total);
    printf("Characters: %ld\n", char_count);
    printf("Unique words: %d\n", unique_words);
    printf("Longest token length: %d\n", longest_word);

    printf("\nTop %d words:\n", opts.top_words);
    for (int i = 0; i < opts.top_words && i < unique_words; ++i) {
        printf("%2d. %-20s %d\n", i + 1, table[i].word, table[i].count);
    }

    free(table);
    return 0;
}
