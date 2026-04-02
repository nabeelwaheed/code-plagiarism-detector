#ifndef CLI_OPTS_H
#define CLI_OPTS_H

typedef struct {
    const char *dictionary_path;
    const char *text_path;
    int max_suggestions;
} SpellCli;

int parse_spell_cli(int argc, char **argv, SpellCli *cli);
void print_spell_usage(const char *program_name);

#endif
