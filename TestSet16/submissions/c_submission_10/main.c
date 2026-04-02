#include "cli_opts.h"
#include "spellcheck.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    SpellCli cli;
    Dictionary dict;
    FILE *fp;
    char line[512];
    int miss_count = 0;

    if (!parse_spell_cli(argc, argv, &cli)) {
        print_spell_usage(argv[0]);
        return 1;
    }

    dictionary_init(&dict);
    if (!dictionary_load_file(&dict, cli.dictionary_path)) {
        fprintf(stderr, "Failed to load dictionary: %s\n", cli.dictionary_path);
        dictionary_free(&dict);
        return 1;
    }

    fp = fopen(cli.text_path, "r");
    if (!fp) {
        fprintf(stderr, "Failed to open text file: %s\n", cli.text_path);
        dictionary_free(&dict);
        return 1;
    }

    while (fgets(line, sizeof(line), fp)) {
        char *token = strtok(line, " \t\r\n,.;:!?()[]{}\"/");
        while (token) {
            char word[96];
            char suggestions[5][48];
            int s;

            strncpy(word, token, sizeof(word) - 1U);
            word[sizeof(word) - 1U] = '\0';
            normalize_word(word);

            if (word[0] != '\0' && !dictionary_contains(&dict, word)) {
                int got = gather_suggestions(&dict, word, suggestions, cli.max_suggestions);
                printf("Misspelled: %-20s", word);
                if (got > 0) {
                    printf(" suggestions:");
                    for (s = 0; s < got; ++s) {
                        printf(" %s", suggestions[s]);
                    }
                }
                printf("\n");
                miss_count++;
            }

            token = strtok(NULL, " \t\r\n,.;:!?()[]{}\"/");
        }
    }

    fclose(fp);

    printf("\nDictionary size: %zu words\n", dict.count);
    printf("Total misspelled tokens: %d\n", miss_count);

    dictionary_free(&dict);
    return 0;
}
