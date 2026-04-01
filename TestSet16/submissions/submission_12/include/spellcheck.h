#ifndef SPELLCHECK_H
#define SPELLCHECK_H

#include <stddef.h>

#define SPELL_BUCKETS 2048

typedef struct DictNode {
    char *word;
    struct DictNode *next;
} DictNode;

typedef struct {
    DictNode *buckets[SPELL_BUCKETS];
    char **all_words;
    size_t count;
    size_t capacity;
} Dictionary;

int dictionary_init(Dictionary *dict);
void dictionary_free(Dictionary *dict);
int dictionary_load_file(Dictionary *dict, const char *path);
int dictionary_contains(const Dictionary *dict, const char *word);
void normalize_word(char *text);
int gather_suggestions(const Dictionary *dict, const char *word, char out[][48], int limit);

#endif
