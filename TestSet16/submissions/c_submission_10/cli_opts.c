#include "cli_opts.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void print_spell_usage(const char *program_name) {
    printf("Usage: %s -d dictionary.txt -t text.txt [-m max_suggestions]\n", program_name);
}

int parse_spell_cli(int argc, char **argv, SpellCli *cli) {
    int i;

    cli->dictionary_path = NULL;
    cli->text_path = NULL;
    cli->max_suggestions = 3;

    for (i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "-d") == 0 && i + 1 < argc) {
            cli->dictionary_path = argv[++i];
        } else if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) {
            cli->text_path = argv[++i];
        } else if (strcmp(argv[i], "-m") == 0 && i + 1 < argc) {
            cli->max_suggestions = atoi(argv[++i]);
        } else {
            return 0;
        }
    }

    return cli->dictionary_path != NULL && cli->text_path != NULL;
}
