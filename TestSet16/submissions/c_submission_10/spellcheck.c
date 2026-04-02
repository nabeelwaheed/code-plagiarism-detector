#include "spellcheck.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static unsigned long hash_word(const char *word) {
    unsigned long h = 5381UL;
    while (*word) {
        h = ((h << 5) + h) + (unsigned long)(unsigned char)(*word);
        ++word;
    }
    return h;
}

static char *copy_text(const char *src) {
    size_t n = strlen(src);
    char *dst = (char *)malloc(n + 1U);
    if (!dst) {
        return NULL;
    }
    memcpy(dst, src, n + 1U);
    return dst;
}

static int dictionary_insert(Dictionary *dict, const char *word) {
    unsigned long bucket = hash_word(word) % SPELL_BUCKETS;
    DictNode *node;

    if (dictionary_contains(dict, word)) {
        return 1;
    }

    node = (DictNode *)malloc(sizeof(DictNode));
    if (!node) {
        return 0;
    }
    node->word = copy_text(word);
    if (!node->word) {
        free(node);
        return 0;
    }

    node->next = dict->buckets[bucket];
    dict->buckets[bucket] = node;

    if (dict->count == dict->capacity) {
        size_t new_cap = dict->capacity == 0 ? 256 : dict->capacity * 2;
        char **expanded = (char **)realloc(dict->all_words, new_cap * sizeof(char *));
        if (!expanded) {
            return 0;
        }
        dict->all_words = expanded;
        dict->capacity = new_cap;
    }

    dict->all_words[dict->count++] = node->word;
    return 1;
}

int dictionary_init(Dictionary *dict) {
    size_t i;
    for (i = 0; i < SPELL_BUCKETS; ++i) {
        dict->buckets[i] = NULL;
    }
    dict->all_words = NULL;
    dict->count = 0;
    dict->capacity = 0;
    return 1;
}

void dictionary_free(Dictionary *dict) {
    size_t i;
    for (i = 0; i < SPELL_BUCKETS; ++i) {
        DictNode *cur = dict->buckets[i];
        while (cur) {
            DictNode *next = cur->next;
            free(cur->word);
            free(cur);
            cur = next;
        }
    }
    free(dict->all_words);
}

void normalize_word(char *text) {
    size_t r = 0;
    size_t w = 0;
    while (text[r] != '\0') {
        if (isalpha((unsigned char)text[r]) || text[r] == '\'') {
            text[w++] = (char)tolower((unsigned char)text[r]);
        }
        ++r;
    }
    text[w] = '\0';
}

int dictionary_load_file(Dictionary *dict, const char *path) {
    FILE *fp = fopen(path, "r");
    char line[128];

    if (!fp) {
        return 0;
    }

    while (fgets(line, sizeof(line), fp)) {
        size_t n = strlen(line);
        while (n > 0 && (line[n - 1] == '\n' || line[n - 1] == '\r')) {
            line[--n] = '\0';
        }
        normalize_word(line);
        if (line[0] != '\0') {
            if (!dictionary_insert(dict, line)) {
                fclose(fp);
                return 0;
            }
        }
    }

    fclose(fp);
    return 1;
}

int dictionary_contains(const Dictionary *dict, const char *word) {
    unsigned long bucket = hash_word(word) % SPELL_BUCKETS;
    DictNode *cur = dict->buckets[bucket];
    while (cur) {
        if (strcmp(cur->word, word) == 0) {
            return 1;
        }
        cur = cur->next;
    }
    return 0;
}

static int min3(int a, int b, int c) {
    int m = a < b ? a : b;
    return m < c ? m : c;
}

static int edit_distance_limited(const char *a, const char *b, int limit) {
    size_t la = strlen(a);
    size_t lb = strlen(b);
    int *prev;
    int *curr;
    size_t i;
    size_t j;

    if ((int)(la > lb ? la - lb : lb - la) > limit) {
        return limit + 1;
    }

    prev = (int *)malloc((lb + 1) * sizeof(int));
    curr = (int *)malloc((lb + 1) * sizeof(int));
    if (!prev || !curr) {
        free(prev);
        free(curr);
        return limit + 1;
    }

    for (j = 0; j <= lb; ++j) {
        prev[j] = (int)j;
    }

    for (i = 1; i <= la; ++i) {
        int row_min;
        curr[0] = (int)i;
        row_min = curr[0];
        for (j = 1; j <= lb; ++j) {
            int cost = a[i - 1] == b[j - 1] ? 0 : 1;
            curr[j] = min3(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
            if (curr[j] < row_min) {
                row_min = curr[j];
            }
        }
        if (row_min > limit) {
            free(prev);
            free(curr);
            return limit + 1;
        }
        for (j = 0; j <= lb; ++j) {
            prev[j] = curr[j];
        }
    }

    int distance = prev[lb];
    free(prev);
    free(curr);
    return distance;
}

int gather_suggestions(const Dictionary *dict, const char *word, char out[][48], int limit) {
    int found = 0;
    size_t i;

    for (i = 0; i < dict->count && found < limit; ++i) {
        const char *candidate = dict->all_words[i];
        if (candidate[0] == word[0] && edit_distance_limited(word, candidate, 2) <= 2) {
            strncpy(out[found], candidate, 47U);
            out[found][47] = '\0';
            found++;
        }
    }

    return found;
}
